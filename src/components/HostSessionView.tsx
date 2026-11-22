import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import {
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  OctagonX,
  Eye,
  Volume2,
  Clipboard,
  FileUp,
  Gauge,
  Monitor,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import {
  DEFAULT_PERMISSIONS,
  PAIRING_CODE_TTL_MS,
  type ControlMessage,
  type Language,
  type SasCode,
  type SessionDurationMinutes,
  type SessionPermissions,
} from '../types/session';
import { getTranslations } from '../i18n/translations';
import {
  collectConnectionFingerprints,
  derivePeerIdFromWords,
  deriveSasCode,
  generateNonce,
  generatePairingWords,
} from '../utils/crypto';
import { applyBandwidthMode, formatCountdown, PEER_CONFIG } from '../utils/webrtc';
import { appendAuditEntry } from '../utils/auditLog';
import { useWebRtcStats } from '../hooks/useWebRtcStats';
import { useDataChannelTransfer } from '../hooks/useDataChannelTransfer';
import { ScamWarningCard } from './ScamWarningCard';
import { SasVerificationModal } from './SasVerificationModal';
import { LiveStatsStrip } from './LiveStatsStrip';
import { DataChannelTools } from './DataChannelTools';

type HostPhase =
  | 'scam-warning'
  | 'waiting'
  | 'approval-pending'
  | 'sas-pending'
  | 'active'
  | 'terminated';

interface PendingViewerRequest {
  conn: DataConnection;
  viewerNonce: string;
  viewerLabel: string;
  requestedAt: string;
}

interface HostSessionViewProps {
  lang: Language;
  onExit: () => void;
  onActiveStateChange: (active: boolean) => void;
}

/**
 * Host Session Workspace:
 * 1. Mandatory scam warning screen before first pairing code.
 * 2. Cryptographic 6-word one-time pairing code (5-minute expiry, single-use).
 * 3. Explicit Allow/Deny approval popup on incoming viewer request.
 * 4. Dual-sided DTLS-bound SAS fingerprint verification gate.
 * 5. Active sharing with permanent red viewport border + banner, Panic Stop (Ctrl+Shift+K),
 *    session auto-expiry (15m / 1h / 4h), granular permissions (all OFF by default),
 *    low-bandwidth adaptive bitrate control, live WebRTC stats, and DataChannel tools.
 */
export function HostSessionView({
  lang,
  onExit,
  onActiveStateChange,
}: HostSessionViewProps) {
  const t = getTranslations(lang);

  const [phase, setPhase] = useState<HostPhase>('scam-warning');
  const [pairingWords, setPairingWords] = useState<string[]>([]);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(0);
  const [codeRemainingMs, setCodeRemainingMs] = useState<number>(0);
  const [codeExpired, setCodeExpired] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [signalingState, setSignalingState] = useState<'connecting' | 'ready' | 'error'>(
    'connecting'
  );
  const [signalingError, setSignalingError] = useState<string | null>(null);

  const [durationMinutes, setDurationMinutes] = useState<SessionDurationMinutes>(15);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [permissions, setPermissions] = useState<SessionPermissions>(DEFAULT_PERMISSIONS);

  const [pendingRequest, setPendingRequest] = useState<PendingViewerRequest | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);

  const [sasCode, setSasCode] = useState<SasCode | null>(null);
  const [localSasConfirmed, setLocalSasConfirmed] = useState(false);
  const [remoteSasConfirmed, setRemoteSasConfirmed] = useState(false);

  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number>(0);
  const [terminationReason, setTerminationReason] = useState<
    'panic' | 'expired' | 'ended' | 'sas-mismatch' | 'viewer-left'
  >('ended');
  const [fallbackRttMs, setFallbackRttMs] = useState<number | null>(null);

  // Refs for clean async & WebRTC lifecycle management
  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaCallRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaPcRef = useRef<RTCPeerConnection | null>(null);
  const [mediaPcState, setMediaPcState] = useState<RTCPeerConnection | null>(null);

  const codeUsedRef = useRef(false);
  const codeExpiresAtRef = useRef(0);
  const phaseRef = useRef<HostPhase>('scam-warning');
  const permissionsRef = useRef<SessionPermissions>(DEFAULT_PERMISSIONS);
  const sasVerifiedRef = useRef(false);
  const localSasConfirmedRef = useRef(false);
  const remoteSasConfirmedRef = useRef(false);
  const hostNonceRef = useRef<string>('');
  const viewerNonceRef = useRef<string>('');
  const sasHexRef = useRef<string>('');
  const lowBandwidthRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);

  useEffect(() => {
    lowBandwidthRef.current = lowBandwidth;
  }, [lowBandwidth]);

  const isConnectedUi =
    phase === 'approval-pending' || phase === 'sas-pending' || phase === 'active';

  useEffect(() => {
    onActiveStateChange(isConnectedUi);
    return () => onActiveStateChange(false);
  }, [isConnectedUi, onActiveStateChange]);

  const {
    clipboardHistory,
    files,
    fileProgress,
    fileError,
    sendClipboard,
    sendFile,
    handleIncomingTransferMessage,
    resetTransfers,
  } = useDataChannelTransfer({
    role: 'host',
    permissionsRef,
    dataConnRef,
    sasVerifiedRef,
  });

  const stats = useWebRtcStats({
    peerConnection: mediaPcState,
    direction: 'outbound',
    active: phase === 'active',
    fallbackRttMs,
  });

  /**
   * Immediately tear down all WebRTC connections, stop media tracks,
   * destroy ephemeral keys/nonces, and clean up state.
   */
  const destroyEverything = useCallback(
    (
      reason: 'panic' | 'expired' | 'ended' | 'sas-mismatch' | 'viewer-left',
      notifyRemote: boolean
    ) => {
      if (notifyRemote && dataConnRef.current?.open) {
        const msgReason =
          reason === 'panic'
            ? 'panic'
            : reason === 'expired'
              ? 'expired'
              : 'host-ended';
        try {
          if (reason === 'sas-mismatch') {
            dataConnRef.current.send({ type: 'sas-mismatch' } satisfies ControlMessage);
          } else {
            dataConnRef.current.send({
              type: 'session-ended',
              reason: msgReason,
            } satisfies ControlMessage);
          }
        } catch {
          // Ignore send errors on teardown
        }
      }

      // Stop all capture tracks immediately
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.onended = null;
          track.stop();
        }
        streamRef.current = null;
      }

      const activeCall = mediaCallRef.current;
      mediaCallRef.current = null;
      mediaPcRef.current = null;
      setMediaPcState(null);
      try {
        activeCall?.close();
      } catch {
        // ignore
      }

      const activeConn = dataConnRef.current;
      dataConnRef.current = null;
      try {
        activeConn?.close();
      } catch {
        // ignore
      }

      const activePeer = peerRef.current;
      peerRef.current = null;
      try {
        activePeer?.destroy();
      } catch {
        // ignore
      }

      // Destroy ephemeral session keys / nonces / pairing words in memory
      hostNonceRef.current = '';
      viewerNonceRef.current = '';
      sasHexRef.current = '';
      sasVerifiedRef.current = false;
      localSasConfirmedRef.current = false;
      remoteSasConfirmedRef.current = false;
      codeUsedRef.current = true;

      setPairingWords([]);
      setPendingRequest(null);
      setSasCode(null);
      setLocalSasConfirmed(false);
      setRemoteSasConfirmed(false);
      setPermissions(DEFAULT_PERMISSIONS);
      setSessionExpiresAt(null);
      setHasAudioTrack(false);
      resetTransfers();

      setTerminationReason(reason);
      setPhase('terminated');
    },
    [resetTransfers]
  );

  /** Panic Stop: instant termination + key destruction + audit entry. */
  const handlePanicStop = useCallback(() => {
    void appendAuditEntry(
      'PANIC_KILL',
      'host',
      'Host triggered Panic Stop (Ctrl+Shift+K); all tracks stopped and session keys destroyed'
    );
    destroyEverything('panic', true);
  }, [destroyEverything]);

  // Global Panic Hotkey: Ctrl+Shift+K (also supports Cmd+Shift+K on macOS)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        if (phase === 'waiting' || phase === 'approval-pending' || phase === 'sas-pending' || phase === 'active') {
          e.preventDefault();
          handlePanicStop();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handlePanicStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
      try {
        mediaCallRef.current?.close();
        dataConnRef.current?.close();
        peerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  /** Attach live preview stream to host local thumbnail video when active. */
  useEffect(() => {
    if (localPreviewRef.current && streamRef.current) {
      localPreviewRef.current.srcObject = streamRef.current;
    }
  }, [phase, permissions.viewOnly]);

  /** Create a fresh one-time 6-word pairing code and register on PeerJS cloud signaling. */
  const initializePairingCode = useCallback(async () => {
    // Clean up any existing idle Peer instance
    try {
      peerRef.current?.destroy();
    } catch {
      // ignore
    }
    peerRef.current = null;
    dataConnRef.current = null;

    const words = generatePairingWords(6);
    const expiresAt = Date.now() + PAIRING_CODE_TTL_MS;

    codeUsedRef.current = false;
    codeExpiresAtRef.current = expiresAt;
    setPairingWords(words);
    setCodeExpiresAt(expiresAt);
    setCodeRemainingMs(PAIRING_CODE_TTL_MS);
    setCodeExpired(false);
    setScreenError(null);
    setSignalingState('connecting');
    setSignalingError(null);
    setPhase('waiting');

    const peerId = await derivePeerIdFromWords(words);
    void appendAuditEntry(
      'CODE_GENERATED',
      'host',
      `Generated one-time 6-word pairing code (expires in 5 min; signaling ID ${peerId.slice(0, 12)}…)`
    );

    const peer = new Peer(peerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', () => {
      setSignalingState('ready');
    });

    peer.on('error', (err) => {
      setSignalingState('error');
      setSignalingError(err.message || String(err.type || 'Signaling error'));
    });

    peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const msg = raw as ControlMessage;
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

        if (msg.type === 'join-request') {
          // Enforce strict 5-minute TTL
          if (Date.now() > codeExpiresAtRef.current) {
            conn.send({ type: 'join-rejected', reason: 'expired' } satisfies ControlMessage);
            window.setTimeout(() => conn.close(), 250);
            return;
          }
          // Enforce strict one-time use
          if (codeUsedRef.current) {
            conn.send({ type: 'join-rejected', reason: 'used' } satisfies ControlMessage);
            window.setTimeout(() => conn.close(), 250);
            return;
          }
          // Reject if already handling another viewer
          if (dataConnRef.current) {
            conn.send({ type: 'join-rejected', reason: 'busy' } satisfies ControlMessage);
            window.setTimeout(() => conn.close(), 250);
            return;
          }

          // Mark pairing code as consumed immediately upon first valid request
          codeUsedRef.current = true;
          dataConnRef.current = conn;
          viewerNonceRef.current = msg.viewerNonce;

          void appendAuditEntry(
            'CONNECTION_REQUEST',
            'host',
            `Incoming viewer request (${msg.viewerLabel}); pairing code marked as used`
          );

          setPendingRequest({
            conn,
            viewerNonce: msg.viewerNonce,
            viewerLabel: msg.viewerLabel,
            requestedAt: msg.requestedAt,
          });
          setPhase('approval-pending');
          return;
        }

        // Only process subsequent messages from the approved/active DataConnection
        if (conn !== dataConnRef.current) return;

        if (msg.type === 'sas-confirm') {
          if (sasHexRef.current && msg.sasHex !== sasHexRef.current) {
            void appendAuditEntry(
              'SAS_MISMATCH',
              'host',
              'Remote SAS checksum differed from local DTLS-derived SAS; aborting session'
            );
            destroyEverything('sas-mismatch', true);
            return;
          }
          remoteSasConfirmedRef.current = true;
          setRemoteSasConfirmed(true);
          if (localSasConfirmedRef.current) {
            sasVerifiedRef.current = true;
            setPhase('active');
            void appendAuditEntry(
              'SAS_CONFIRMED',
              'host',
              `Both peers confirmed SAS checksum ${sasHexRef.current}`
            );
          }
          return;
        }

        if (msg.type === 'sas-mismatch') {
          void appendAuditEntry('SAS_MISMATCH', 'host', 'Viewer aborted due to SAS mismatch');
          destroyEverything('sas-mismatch', false);
          return;
        }

        if (msg.type === 'ping') {
          conn.send({ type: 'pong', sentAt: msg.sentAt } satisfies ControlMessage);
          return;
        }

        if (msg.type === 'pong') {
          setFallbackRttMs(Math.max(1, Math.round(Date.now() - msg.sentAt)));
          return;
        }

        if (msg.type === 'session-ended') {
          void appendAuditEntry('DISCONNECTED', 'host', `Viewer disconnected (${msg.reason})`);
          destroyEverything('viewer-left', false);
          return;
        }

        // Delegate clipboard & file transfer messages
        void handleIncomingTransferMessage(msg);
      });

      conn.on('close', () => {
        if (conn === dataConnRef.current && phaseRef.current !== 'terminated') {
          void appendAuditEntry('DISCONNECTED', 'host', 'DataChannel closed by remote peer');
          destroyEverything('viewer-left', false);
        }
      });
    });
  }, [destroyEverything, handleIncomingTransferMessage]);

  // 5-minute pairing code countdown timer
  useEffect(() => {
    if (phase !== 'waiting' || codeExpiresAt === 0) return;

    const timer = window.setInterval(() => {
      const remaining = codeExpiresAt - Date.now();
      if (remaining <= 0) {
        setCodeRemainingMs(0);
        setCodeExpired(true);
        window.clearInterval(timer);
        void appendAuditEntry('CODE_EXPIRED', 'host', 'One-time 6-word pairing code expired after 5 minutes');
        try {
          peerRef.current?.destroy();
        } catch {
          // ignore
        }
        peerRef.current = null;
      } else {
        setCodeRemainingMs(remaining);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [phase, codeExpiresAt]);

  // Session auto-expiry countdown timer
  useEffect(() => {
    if (!sessionExpiresAt || (phase !== 'sas-pending' && phase !== 'active')) return;

    const timer = window.setInterval(() => {
      const remaining = sessionExpiresAt - Date.now();
      if (remaining <= 0) {
        setSessionRemainingMs(0);
        window.clearInterval(timer);
        void appendAuditEntry(
          'SESSION_EXPIRED',
          'host',
          `Session auto-expired after ${durationMinutes} minutes`
        );
        destroyEverything('expired', true);
      } else {
        setSessionRemainingMs(remaining);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionExpiresAt, phase, durationMinutes, destroyEverything]);

  // Periodic lightweight DataChannel ping for accurate fallback RTT latency
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = window.setInterval(() => {
      if (dataConnRef.current?.open) {
        dataConnRef.current.send({ type: 'ping', sentAt: Date.now() } satisfies ControlMessage);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [phase]);

  /** Compute SAS verification phrase from live DataConnection DTLS certificate fingerprints. */
  const computeHostSas = useCallback(async (conn: DataConnection, hostNonce: string, viewerNonce: string) => {
    // Poll briefly if PeerJS peerConnection descriptions are still settling
    for (let attempt = 0; attempt < 15; attempt++) {
      const { local, remote } = await collectConnectionFingerprints([conn.peerConnection]);
      if (local.length > 0 && remote.length > 0) {
        const sas = await deriveSasCode({
          localFingerprints: local,
          remoteFingerprints: remote,
          hostNonce,
          viewerNonce,
        });
        sasHexRef.current = sas.hex;
        setSasCode(sas);
        return;
      }
      await new Promise((r) => window.setTimeout(r, 150));
    }

    // Fallback if browser hides SDP fingerprint (still bound to nonces)
    const fallbackSas = await deriveSasCode({
      localFingerprints: [],
      remoteFingerprints: [],
      hostNonce,
      viewerNonce,
    });
    sasHexRef.current = fallbackSas.hex;
    setSasCode(fallbackSas);
  }, []);

  /** Host clicks "Deny" on incoming viewer approval popup. */
  const handleDenyViewer = () => {
    const req = pendingRequest;
    if (req) {
      try {
        req.conn.send({ type: 'join-rejected', reason: 'denied' } satisfies ControlMessage);
      } catch {
        // ignore
      }
      window.setTimeout(() => req.conn.close(), 200);
    }
    dataConnRef.current = null;
    setPendingRequest(null);
    void appendAuditEntry('ACCESS_DENIED', 'host', 'Host denied incoming viewer connection request');
    // Code was consumed on first attempt; let host generate a fresh code
    setCodeExpired(true);
    setPhase('waiting');
  };

  /** Host clicks "Allow" on incoming viewer approval popup -> captures screen & starts SAS gate. */
  const handleAllowViewer = async () => {
    if (!pendingRequest || !peerRef.current) return;
    setScreenError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setScreenError(
        'Screen capture (getDisplayMedia) is not supported in this browser or context. Open in a desktop Chromium/Firefox/Safari HTTPS tab.'
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: lowBandwidthRef.current
          ? {
              width: { max: 1280 },
              height: { max: 720 },
              frameRate: { ideal: 10, max: 10 },
            }
          : {
              frameRate: { ideal: 30 },
            },
        audio: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Screen selection cancelled';
      setScreenError(msg);
      return;
    }

    // SECURITY INVARIANT: All permissions start OFF by default!
    // Video and audio tracks remain disabled until SAS is confirmed AND host enables them.
    stream.getVideoTracks().forEach((track) => {
      track.enabled = false;
      track.onended = () => {
        void appendAuditEntry(
          'DISCONNECTED',
          'host',
          'Host stopped screen sharing from browser controls'
        );
        destroyEverything('ended', true);
      };
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });

    streamRef.current = stream;
    setHasAudioTrack(stream.getAudioTracks().length > 0);
    setPermissions(DEFAULT_PERMISSIONS);
    permissionsRef.current = DEFAULT_PERMISSIONS;

    const hostNonce = generateNonce(16);
    hostNonceRef.current = hostNonce;
    const expiresAt = Date.now() + durationMinutes * 60 * 1000;
    setSessionExpiresAt(expiresAt);
    setSessionRemainingMs(durationMinutes * 60 * 1000);

    const conn = pendingRequest.conn;
    conn.send({
      type: 'join-approved',
      hostNonce,
      sessionExpiresAt: expiresAt,
      permissions: DEFAULT_PERMISSIONS,
      lowBandwidth: lowBandwidthRef.current,
    } satisfies ControlMessage);

    // Establish peer-to-peer WebRTC media connection (DTLS-SRTP)
    const call = peerRef.current.call(conn.peer, stream);
    mediaCallRef.current = call;

    const attachPc = () => {
      if (call.peerConnection) {
        mediaPcRef.current = call.peerConnection;
        setMediaPcState(call.peerConnection);
        void applyBandwidthMode({
          stream: streamRef.current,
          peerConnection: call.peerConnection,
          lowBandwidth: lowBandwidthRef.current,
        });
      }
    };
    attachPc();
    window.setTimeout(attachPc, 800);

    void appendAuditEntry(
      'ACCESS_APPROVED',
      'host',
      `Approved viewer (${pendingRequest.viewerLabel}); auto-expiry set to ${durationMinutes} min; all permissions OFF by default`
    );

    setPendingRequest(null);
    setPhase('sas-pending');
    await computeHostSas(conn, hostNonce, pendingRequest.viewerNonce);
  };

  /** Host confirms the 3-word SAS verification phrase matches. */
  const handleConfirmSas = () => {
    if (!sasCode || !dataConnRef.current?.open) return;
    localSasConfirmedRef.current = true;
    setLocalSasConfirmed(true);
    dataConnRef.current.send({
      type: 'sas-confirm',
      sasHex: sasCode.hex,
    } satisfies ControlMessage);

    if (remoteSasConfirmedRef.current) {
      sasVerifiedRef.current = true;
      setPhase('active');
      void appendAuditEntry(
        'SAS_CONFIRMED',
        'host',
        `Both peers confirmed SAS checksum ${sasCode.hex}`
      );
    }
  };

  /** Host aborts because SAS verification phrase did not match. */
  const handleAbortSas = () => {
    void appendAuditEntry(
      'SAS_MISMATCH',
      'host',
      'Host aborted session due to SAS verification mismatch'
    );
    destroyEverything('sas-mismatch', true);
  };

  /** Toggle an individual per-session permission and enforce immediately on tracks & DataChannel. */
  const handleTogglePermission = (key: keyof SessionPermissions) => {
    const nextValue = !permissions[key];
    const nextPermissions: SessionPermissions = {
      ...permissions,
      [key]: nextValue,
    };

    // Enforce locally on live MediaStreamTracks
    if (key === 'viewOnly' && streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextValue;
      });
    }
    if (key === 'audio' && streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextValue;
      });
    }

    setPermissions(nextPermissions);
    permissionsRef.current = nextPermissions;

    if (dataConnRef.current?.open) {
      dataConnRef.current.send({
        type: 'permissions-update',
        permissions: nextPermissions,
      } satisfies ControlMessage);
    }

    void appendAuditEntry(
      'PERMISSION_CHANGED',
      'host',
      `Permission "${key}" set to ${nextValue ? 'ON' : 'OFF'}`
    );
  };

  /** Allow Host to re-select shared screen/tab (e.g., to include audio) seamlessly via replaceTrack(). */
  const handleRepickScreen = async () => {
    setScreenError(null);
    try {
      const newStream = await navigator.mediaDevices.getDisplayMedia({
        video: lowBandwidthRef.current
          ? {
              width: { max: 1280 },
              height: { max: 720 },
              frameRate: { ideal: 10, max: 10 },
            }
          : { frameRate: { ideal: 30 } },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const newAudioTrack = newStream.getAudioTracks()[0] ?? null;

      if (newVideoTrack) {
        newVideoTrack.enabled = permissionsRef.current.viewOnly;
        newVideoTrack.onended = () => {
          void appendAuditEntry('DISCONNECTED', 'host', 'Host stopped screen sharing');
          destroyEverything('ended', true);
        };
      }
      if (newAudioTrack) {
        newAudioTrack.enabled = permissionsRef.current.audio;
      }

      // Replace tracks on the active RTCPeerConnection without dropping the session
      const pc = mediaPcRef.current;
      if (pc) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender && newVideoTrack) {
          await videoSender.replaceTrack(newVideoTrack);
        }
        const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (audioSender && newAudioTrack) {
          await audioSender.replaceTrack(newAudioTrack);
        }
      }

      // Stop old tracks cleanly
      streamRef.current?.getTracks().forEach((tr) => {
        tr.onended = null;
        tr.stop();
      });

      streamRef.current = newStream;
      setHasAudioTrack(Boolean(newAudioTrack));
      if (localPreviewRef.current) {
        localPreviewRef.current.srcObject = newStream;
      }

      await applyBandwidthMode({
        stream: newStream,
        peerConnection: pc,
        lowBandwidth: lowBandwidthRef.current,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to switch screen';
      setScreenError(msg);
    }
  };

  /** Toggle Low-Bandwidth Mode (720p, 10 fps, adaptive RTCRtpSender bitrate). */
  const handleToggleLowBandwidth = async () => {
    const next = !lowBandwidth;
    setLowBandwidth(next);
    lowBandwidthRef.current = next;

    await applyBandwidthMode({
      stream: streamRef.current,
      peerConnection: mediaPcRef.current,
      lowBandwidth: next,
    });

    if (dataConnRef.current?.open) {
      dataConnRef.current.send({
        type: 'low-bandwidth-update',
        enabled: next,
      } satisfies ControlMessage);
    }

    void appendAuditEntry(
      'LOW_BANDWIDTH_CHANGED',
      'host',
      `Low-bandwidth mode set to ${next ? 'ON (720p / 10 fps / ~450 kbps)' : 'OFF (Standard)'}`
    );
  };

  const handleCopyCode = async () => {
    if (pairingWords.length === 0) return;
    try {
      await navigator.clipboard.writeText(pairingWords.join(' '));
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleNormalEnd = () => {
    void appendAuditEntry('DISCONNECTED', 'host', 'Host ended session normally');
    destroyEverything('ended', true);
  };

  // Phase 1: Mandatory Scam Warning before every first Host connection
  if (phase === 'scam-warning') {
    return (
      <ScamWarningCard
        lang={lang}
        onAcknowledge={() => void initializePairingCode()}
        onCancel={onExit}
      />
    );
  }

  // Phase 6: Session Terminated / Panic Killed summary
  if (phase === 'terminated') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
        <div
          className={`rounded-xl bg-[#121824] border p-6 sm:p-8 ${
            terminationReason === 'panic' || terminationReason === 'sas-mismatch'
              ? 'border-red-500/50'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                terminationReason === 'panic' || terminationReason === 'sas-mismatch'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <OctagonX className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-50">{t.panicKilledTitle}</h1>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">{t.panicKilledDesc}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              {t.startNewSession}
            </button>
            <button
              type="button"
              onClick={() => setPhase('scam-warning')}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              {t.regenerateCode}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showRedViewingFrame = phase === 'sas-pending' || phase === 'active';

  const permissionItems: Array<{
    key: keyof SessionPermissions;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'viewOnly',
      label: t.permViewOnly,
      desc: t.permViewOnlyDesc,
      icon: <Eye className="w-4 h-4" />,
    },
    {
      key: 'audio',
      label: t.permAudio,
      desc: t.permAudioDesc,
      icon: <Volume2 className="w-4 h-4" />,
    },
    {
      key: 'clipboard',
      label: t.permClipboard,
      desc: t.permClipboardDesc,
      icon: <Clipboard className="w-4 h-4" />,
    },
    {
      key: 'fileTransfer',
      label: t.permFileTransfer,
      desc: t.permFileTransferDesc,
      icon: <FileUp className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* PERMANENT RED VIEWPORT BORDER while Host is connected */}
      {showRedViewingFrame && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none border-[5px] border-red-600 z-50"
        />
      )}

      {/* PERMANENT RED "YOUR SCREEN IS BEING VIEWED" BANNER + PANIC BUTTON */}
      {showRedViewingFrame && (
        <div className="sticky top-14 z-40 bg-red-600 text-white border-b border-red-500">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
              <span className="text-sm sm:text-base font-bold tracking-tight">
                {t.hostViewingBanner}
              </span>
              {sessionExpiresAt && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono bg-red-700/80 px-2.5 py-1 rounded tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {t.hostSessionRemaining}: {formatCountdown(sessionRemainingMs)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePanicStop}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-red-700 bg-white hover:bg-red-50 transition-colors whitespace-nowrap shadow-sm"
              >
                <OctagonX className="w-4 h-4" />
                <span>{t.panicButton}</span>
                <kbd className="hidden md:inline font-mono text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                  {t.panicHotkeyHint}
                </kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header bar inside Host workspace */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {phase === 'waiting' && (
              <button
                type="button"
                onClick={() => {
                  try {
                    peerRef.current?.destroy();
                  } catch {
                    // ignore
                  }
                  onExit();
                }}
                className="p-2 rounded-lg text-slate-400 bg-slate-900 border border-slate-800 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                aria-label={t.scamCancel}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-50">{t.hostPanelTitle}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{t.metaEncryption}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {signalingState === 'ready'
                    ? t.signalingReady
                    : signalingState === 'error'
                      ? `${t.signalingError}: ${signalingError}`
                      : t.signalingConnecting}
                </span>
              </div>
            </div>
          </div>

          {showRedViewingFrame && (
            <button
              type="button"
              onClick={handleNormalEnd}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {t.endSessionBtn}
            </button>
          )}
        </div>

        {/* WAITING PHASE: One-time 6-word pairing code + pre-session settings */}
        {phase === 'waiting' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl bg-[#121824] border border-slate-800 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">{t.pairingCodeLabel}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.pairingCodeHint}</p>
                </div>
                <div
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    codeExpired ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {codeExpired
                    ? t.codeExpired
                    : `${t.codeExpiresIn}: ${formatCountdown(codeRemainingMs)}`}
                </div>
              </div>

              {/* 6-word grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pairingWords.map((word, idx) => (
                  <div
                    key={`${word}-${idx}`}
                    className={`px-4 py-3.5 rounded-lg border text-center transition-opacity ${
                      codeExpired
                        ? 'bg-[#0B0F17]/60 border-slate-800/60 opacity-40 line-through'
                        : 'bg-[#0B0F17] border-slate-700/80'
                    }`}
                  >
                    <span className="block text-[11px] font-mono text-slate-500 tabular-nums">
                      0{idx + 1}
                    </span>
                    <span className="block mt-0.5 text-base sm:text-lg font-mono font-semibold text-slate-50">
                      {word}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  {codeExpired ? t.codeExpired : t.waitingForViewer}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={codeExpired}
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {codeCopied ? t.copied : t.copyCode}
                  </button>
                  <button
                    type="button"
                    onClick={() => void initializePairingCode()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t.regenerateCode}
                  </button>
                </div>
              </div>
            </div>

            {/* Session configuration sidebar */}
            <div className="rounded-xl bg-[#121824] border border-slate-800 p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-100">
                  {t.sessionDurationLabel}
                </label>
                <div className="mt-3 grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#0B0F17] border border-slate-800">
                  {(
                    [
                      { value: 15, label: t.dur15m },
                      { value: 60, label: t.dur1h },
                      { value: 240, label: t.dur4h },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDurationMinutes(opt.value)}
                      className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        durationMinutes === opt.value
                          ? 'bg-slate-800 text-slate-50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{t.lowBandwidthLabel}</div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {t.lowBandwidthDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={lowBandwidth}
                    onClick={() => void handleToggleLowBandwidth()}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                      lowBandwidth ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        lowBandwidth ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handlePanicStop}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-red-200 bg-red-950/60 border border-red-500/40 hover:bg-red-900/70 transition-colors"
                >
                  <OctagonX className="w-4 h-4" />
                  <span>
                    {t.panicButton} ({t.panicHotkeyHint})
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* APPROVAL POPUP PHASE: Clear Allow / Deny prompt */}
        {phase === 'approval-pending' && pendingRequest && (
          <div className="max-w-2xl mx-auto rounded-xl bg-[#121824] border border-amber-500/50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400">{t.approvalTitle}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-50">{t.approvalBody}</h2>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-lg bg-[#0B0F17] border border-slate-800 text-sm space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{t.approvalDevice}</span>
                <span className="font-mono text-slate-200">{pendingRequest.viewerLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{t.sessionDurationLabel}</span>
                <span className="font-mono text-slate-200 tabular-nums">
                  {durationMinutes} min
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-amber-300/90 leading-relaxed">{t.approvalWarning}</p>

            {screenError && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200">
                {screenError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                type="button"
                onClick={handleDenyViewer}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-red-200 bg-red-950/60 border border-red-500/40 hover:bg-red-900/70 transition-colors whitespace-nowrap"
              >
                {t.denyBtn}
              </button>
              <button
                type="button"
                onClick={() => void handleAllowViewer()}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors whitespace-nowrap"
              >
                {t.allowBtn}
              </button>
            </div>
          </div>
        )}

        {/* SAS VERIFICATION PHASE */}
        {phase === 'sas-pending' && (
          <div className="max-w-2xl mx-auto">
            <SasVerificationModal
              lang={lang}
              sasCode={sasCode}
              localConfirmed={localSasConfirmed}
              remoteConfirmed={remoteSasConfirmed}
              onConfirm={handleConfirmSas}
              onAbort={handleAbortSas}
            />
          </div>
        )}

        {/* ACTIVE SESSION WORKSPACE */}
        {phase === 'active' && (
          <div className="space-y-6">
            {/* Live Telemetry + Low-Bandwidth + Panic Row */}
            <div className="rounded-xl bg-[#121824] border border-slate-800 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Gauge className="w-4 h-4 text-slate-400" />
                  <span>{t.performanceTitle}</span>
                  {sasCode && (
                    <span className="text-xs font-mono text-emerald-400 ml-2">
                      · {t.sasBothConfirmed} ({sasCode.hex})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <span>{t.lowBandwidthLabel}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={lowBandwidth}
                      onClick={() => void handleToggleLowBandwidth()}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                        lowBandwidth ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          lowBandwidth ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>

              <LiveStatsStrip lang={lang} stats={stats} />
            </div>

            {/* Permissions + Local Screen Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Per-Session Permissions (ALL OFF by default) */}
              <section className="lg:col-span-7 rounded-xl bg-[#121824] border border-slate-800 p-5">
                <div className="pb-4 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-slate-100">{t.permissionsTitle}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.permissionsSubtitle}</p>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {permissionItems.map((item) => {
                    const enabled = permissions[item.key];
                    return (
                      <div
                        key={item.key}
                        className="py-4 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`mt-0.5 p-2 rounded-lg border shrink-0 ${
                              enabled
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-100">{item.label}</div>
                            <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs font-mono font-semibold w-8 text-right ${
                              enabled ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {enabled ? t.onLabel : t.offLabel}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={item.label}
                            onClick={() => handleTogglePermission(item.key)}
                            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                              enabled ? 'bg-emerald-600' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                                enabled ? 'translate-x-7' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {permissions.audio && !hasAudioTrack && (
                  <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                    {t.noAudioTrackHint}
                  </div>
                )}

                {screenError && (
                  <div className="mt-3 p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200">
                    {screenError}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRepickScreen()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    {t.repickScreenBtn}
                  </button>

                  <button
                    type="button"
                    onClick={handlePanicStop}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors whitespace-nowrap"
                  >
                    <OctagonX className="w-4 h-4" />
                    <span>
                      {t.panicButton} ({t.panicHotkeyHint})
                    </span>
                  </button>
                </div>
              </section>

              {/* Host Local Preview */}
              <section className="lg:col-span-5 rounded-xl bg-[#121824] border border-slate-800 p-5 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-sm font-semibold text-slate-100">
                    {permissions.viewOnly ? t.permViewOnly : t.viewerPausedByHost}
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      permissions.viewOnly ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {permissions.viewOnly ? t.onLabel : t.offLabel}
                  </span>
                </div>

                <div className="mt-4 relative flex-1 min-h-[200px] rounded-lg bg-[#070A10] border border-slate-800 overflow-hidden flex items-center justify-center">
                  <video
                    ref={localPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-contain transition-opacity ${
                      permissions.viewOnly ? 'opacity-100' : 'opacity-20'
                    }`}
                  />
                  {!permissions.viewOnly && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                      <Eye className="w-6 h-6 text-slate-400 mb-2" />
                      <p className="text-xs font-medium text-slate-200">{t.viewerPausedByHost}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Encrypted DataChannel Tools (Clipboard + File Transfer) */}
            <DataChannelTools
              lang={lang}
              role="host"
              permissions={permissions}
              clipboardHistory={clipboardHistory}
              onSendClipboard={sendClipboard}
              files={files}
              fileTransferProgress={fileProgress}
              fileError={fileError}
              onSendFile={(f) => void sendFile(f)}
            />
          </div>
        )}
      </div>
    </>
  );
}
