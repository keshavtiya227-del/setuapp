import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  ShieldCheck,
  EyeOff,
  Clock,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import {
  DEFAULT_PERMISSIONS,
  type ControlMessage,
  type Language,
  type SasCode,
  type SessionPermissions,
} from '../types/session';
import { getTranslations } from '../i18n/translations';
import {
  collectConnectionFingerprints,
  derivePeerIdFromWords,
  deriveSasCode,
  generateNonce,
  normalizePairingCode,
} from '../utils/crypto';
import { formatCountdown, getViewerDeviceSummary, PEER_CONFIG } from '../utils/webrtc';
import { appendAuditEntry } from '../utils/auditLog';
import { useWebRtcStats } from '../hooks/useWebRtcStats';
import { useDataChannelTransfer } from '../hooks/useDataChannelTransfer';
import { SasVerificationModal } from './SasVerificationModal';
import { LiveStatsStrip } from './LiveStatsStrip';
import { DataChannelTools } from './DataChannelTools';

type ViewerPhase =
  | 'enter-code'
  | 'connecting'
  | 'waiting-approval'
  | 'sas-pending'
  | 'active'
  | 'ended';

interface ViewerSessionViewProps {
  lang: Language;
  onExit: () => void;
  onActiveStateChange: (active: boolean) => void;
}

/**
 * Viewer Session Workspace:
 * 1. Enter Host's 6-word one-time pairing code.
 * 2. Wait for Host's explicit "Allow" approval.
 * 3. Confirm matching DTLS-bound 3-word SAS verification phrase.
 * 4. View live peer-to-peer screen stream, telemetry stats, and permitted DataChannel tools.
 */
export function ViewerSessionView({
  lang,
  onExit,
  onActiveStateChange,
}: ViewerSessionViewProps) {
  const t = getTranslations(lang);

  const [phase, setPhase] = useState<ViewerPhase>('enter-code');
  const [codeInput, setCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [endNotice, setEndNotice] = useState<string>('');

  const [permissions, setPermissions] = useState<SessionPermissions>(DEFAULT_PERMISSIONS);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number>(0);

  const [sasCode, setSasCode] = useState<SasCode | null>(null);
  const [localSasConfirmed, setLocalSasConfirmed] = useState(false);
  const [remoteSasConfirmed, setRemoteSasConfirmed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackRttMs, setFallbackRttMs] = useState<number | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const mediaCallRef = useRef<MediaConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [mediaPcState, setMediaPcState] = useState<RTCPeerConnection | null>(null);

  const phaseRef = useRef<ViewerPhase>('enter-code');
  const permissionsRef = useRef<SessionPermissions>(DEFAULT_PERMISSIONS);
  const sasVerifiedRef = useRef(false);
  const localSasConfirmedRef = useRef(false);
  const remoteSasConfirmedRef = useRef(false);
  const viewerNonceRef = useRef('');
  const hostNonceRef = useRef('');
  const sasHexRef = useRef('');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);

  const isSessionLive =
    phase === 'waiting-approval' || phase === 'sas-pending' || phase === 'active';

  useEffect(() => {
    onActiveStateChange(isSessionLive);
    return () => onActiveStateChange(false);
  }, [isSessionLive, onActiveStateChange]);

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
    role: 'viewer',
    permissionsRef,
    dataConnRef,
    sasVerifiedRef,
  });

  const stats = useWebRtcStats({
    peerConnection: mediaPcState,
    direction: 'inbound',
    active: phase === 'active',
    fallbackRttMs,
  });

  /** Tear down all WebRTC connections and clear ephemeral state. */
  const cleanupSession = useCallback(
    (notice: string, notifyHost: boolean) => {
      if (notifyHost && dataConnRef.current?.open) {
        try {
          dataConnRef.current.send({
            type: 'session-ended',
            reason: 'viewer-ended',
          } satisfies ControlMessage);
        } catch {
          // ignore
        }
      }

      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
      }

      const activeCall = mediaCallRef.current;
      const activeConn = dataConnRef.current;
      const activePeer = peerRef.current;
      mediaCallRef.current = null;
      dataConnRef.current = null;
      peerRef.current = null;
      setMediaPcState(null);

      try {
        activeCall?.close();
        activeConn?.close();
        activePeer?.destroy();
      } catch {
        // ignore
      }

      viewerNonceRef.current = '';
      hostNonceRef.current = '';
      sasHexRef.current = '';
      sasVerifiedRef.current = false;
      localSasConfirmedRef.current = false;
      remoteSasConfirmedRef.current = false;

      setSasCode(null);
      setLocalSasConfirmed(false);
      setRemoteSasConfirmed(false);
      setPermissions(DEFAULT_PERMISSIONS);
      setSessionExpiresAt(null);
      resetTransfers();

      setEndNotice(notice);
      setPhase('ended');
    },
    [resetTransfers]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        mediaCallRef.current?.close();
        dataConnRef.current?.close();
        peerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  // Bind remote MediaStream to <video> element once active & viewOnly permission is ON
  useEffect(() => {
    if (videoRef.current && remoteStreamRef.current) {
      videoRef.current.srcObject = remoteStreamRef.current;
      videoRef.current.muted = !permissions.audio;
      void videoRef.current.play().catch(() => {
        // Browser autoplay policy fallback handled cleanly
      });
    }
  }, [phase, permissions.viewOnly, permissions.audio]);

  // Listen for fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Session countdown timer synced from Host
  useEffect(() => {
    if (!sessionExpiresAt || (phase !== 'sas-pending' && phase !== 'active')) return;
    const timer = window.setInterval(() => {
      const rem = sessionExpiresAt - Date.now();
      setSessionRemainingMs(Math.max(0, rem));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionExpiresAt, phase]);

  // Periodic DataChannel ping/pong for fallback latency
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = window.setInterval(() => {
      if (dataConnRef.current?.open) {
        dataConnRef.current.send({ type: 'ping', sentAt: Date.now() } satisfies ControlMessage);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [phase]);

  /** Compute SAS phrase independently from Viewer's view of the DTLS certificates. */
  const computeViewerSas = useCallback(
    async (conn: DataConnection, hostNonce: string, viewerNonce: string) => {
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

      const fallbackSas = await deriveSasCode({
        localFingerprints: [],
        remoteFingerprints: [],
        hostNonce,
        viewerNonce,
      });
      sasHexRef.current = fallbackSas.hex;
      setSasCode(fallbackSas);
    },
    []
  );

  /** Initiate peer-to-peer connection to Host using derived SHA-256 PeerJS ID. */
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const words = normalizePairingCode(codeInput);
    if (words.length !== 6) {
      setErrorMsg(t.invalidCodeError);
      return;
    }

    setPhase('connecting');
    const targetPeerId = await derivePeerIdFromWords(words);
    const viewerNonce = generateNonce(16);
    viewerNonceRef.current = viewerNonce;

    const peer = new Peer(PEER_CONFIG);
    peerRef.current = peer;

    peer.on('error', (err) => {
      const msg =
        err.type === 'peer-unavailable'
          ? 'No active host found for this 6-word code. Check spelling or ask host for a fresh code.'
          : err.message || 'Unable to connect to signaling server.';
      setErrorMsg(msg);
      setPhase('enter-code');
      try {
        peer.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    });

    // Listen for incoming WebRTC media call once Host clicks Allow
    peer.on('call', (call) => {
      mediaCallRef.current = call;
      // Answer receive-only (no camera/mic requested on viewer)
      call.answer();

      const bindPc = () => {
        if (call.peerConnection) {
          setMediaPcState(call.peerConnection);
        }
      };
      bindPc();
      window.setTimeout(bindPc, 600);

      call.on('stream', (stream) => {
        remoteStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = !permissionsRef.current.audio;
          void videoRef.current.play().catch(() => {});
        }
      });
    });

    peer.on('open', () => {
      const conn = peer.connect(targetPeerId, {
        reliable: true,
        serialization: 'json',
      });
      dataConnRef.current = conn;

      conn.on('open', () => {
        setPhase('waiting-approval');
        void appendAuditEntry(
          'CONNECTION_REQUEST',
          'viewer',
          `Requested connection to host (${targetPeerId.slice(0, 12)}…)`
        );
        conn.send({
          type: 'join-request',
          viewerNonce,
          viewerLabel: getViewerDeviceSummary(),
          requestedAt: new Date().toISOString(),
        } satisfies ControlMessage);
      });

      conn.on('data', (raw) => {
        const msg = raw as ControlMessage;
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

        if (msg.type === 'join-rejected') {
          const reasonMap = {
            denied: t.rejectedDenied,
            expired: t.rejectedExpired,
            used: t.rejectedUsed,
            busy: t.rejectedBusy,
          };
          void appendAuditEntry('ACCESS_DENIED', 'viewer', `Host rejected request (${msg.reason})`);
          cleanupSession(reasonMap[msg.reason], false);
          return;
        }

        if (msg.type === 'join-approved') {
          hostNonceRef.current = msg.hostNonce;
          setSessionExpiresAt(msg.sessionExpiresAt);
          setSessionRemainingMs(Math.max(0, msg.sessionExpiresAt - Date.now()));
          setPermissions(msg.permissions);
          permissionsRef.current = msg.permissions;
          setLowBandwidth(msg.lowBandwidth);
          setPhase('sas-pending');
          void appendAuditEntry(
            'ACCESS_APPROVED',
            'viewer',
            'Host approved request; entering SAS verification'
          );
          void computeViewerSas(conn, msg.hostNonce, viewerNonce);
          return;
        }

        if (msg.type === 'sas-confirm') {
          if (sasHexRef.current && msg.sasHex !== sasHexRef.current) {
            void appendAuditEntry(
              'SAS_MISMATCH',
              'viewer',
              'Host SAS checksum differed from local DTLS-derived SAS; aborting'
            );
            conn.send({ type: 'sas-mismatch' } satisfies ControlMessage);
            cleanupSession(t.sasMismatchEndedMsg, false);
            return;
          }
          remoteSasConfirmedRef.current = true;
          setRemoteSasConfirmed(true);
          if (localSasConfirmedRef.current) {
            sasVerifiedRef.current = true;
            setPhase('active');
            void appendAuditEntry(
              'SAS_CONFIRMED',
              'viewer',
              `Both peers confirmed SAS checksum ${sasHexRef.current}`
            );
          }
          return;
        }

        if (msg.type === 'sas-mismatch') {
          void appendAuditEntry('SAS_MISMATCH', 'viewer', 'Host aborted due to SAS mismatch');
          cleanupSession(t.sasMismatchEndedMsg, false);
          return;
        }

        if (msg.type === 'permissions-update') {
          setPermissions(msg.permissions);
          permissionsRef.current = msg.permissions;
          if (videoRef.current) {
            videoRef.current.muted = !msg.permissions.audio;
          }
          void appendAuditEntry(
            'PERMISSION_CHANGED',
            'viewer',
            `Host updated permissions: view=${msg.permissions.viewOnly}, audio=${msg.permissions.audio}, clipboard=${msg.permissions.clipboard}, files=${msg.permissions.fileTransfer}`
          );
          return;
        }

        if (msg.type === 'low-bandwidth-update') {
          setLowBandwidth(msg.enabled);
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
          const reasonNotice =
            msg.reason === 'panic'
              ? t.panicEndedMsg
              : msg.reason === 'expired'
                ? t.expiredEndedMsg
                : t.hostEndedMsg;
          void appendAuditEntry(
            msg.reason === 'panic'
              ? 'PANIC_KILL'
              : msg.reason === 'expired'
                ? 'SESSION_EXPIRED'
                : 'DISCONNECTED',
            'viewer',
            `Session ended by host (${msg.reason})`
          );
          cleanupSession(reasonNotice, false);
          return;
        }

        void handleIncomingTransferMessage(msg);
      });

      conn.on('close', () => {
        if (phaseRef.current !== 'ended' && dataConnRef.current === conn) {
          void appendAuditEntry('DISCONNECTED', 'viewer', 'Connection to host closed');
          cleanupSession(t.hostEndedMsg, false);
        }
      });
    });
  };

  /** Viewer confirms SAS phrase matches Host's screen. */
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
        'viewer',
        `Both peers confirmed SAS checksum ${sasCode.hex}`
      );
    }
  };

  /** Viewer aborts due to SAS mismatch. */
  const handleAbortSas = () => {
    try {
      dataConnRef.current?.send({ type: 'sas-mismatch' } satisfies ControlMessage);
    } catch {
      // ignore
    }
    void appendAuditEntry('SAS_MISMATCH', 'viewer', 'Viewer aborted due to SAS mismatch');
    cleanupSession(t.sasMismatchEndedMsg, false);
  };

  const handleToggleFullscreen = async () => {
    if (!videoContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore if fullscreen denied
    }
  };

  // Phase: Ended
  if (phase === 'ended') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
        <div className="rounded-xl bg-[#121824] border border-slate-800 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">{endNotice || t.hostEndedMsg}</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                All WebRTC connections have been closed and ephemeral session state cleared.
              </p>
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
              onClick={() => {
                setCodeInput('');
                setErrorMsg(null);
                setPhase('enter-code');
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              {t.modeViewerCta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {phase === 'enter-code' && (
            <button
              type="button"
              onClick={onExit}
              className="p-2 rounded-lg text-slate-400 bg-slate-900 border border-slate-800 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              aria-label={t.scamCancel}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-50">
              {t.viewerPanelTitle}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{t.metaEncryption}</span>
              {phase === 'active' && sasCode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-mono">
                    {t.viewerEncryptedVerified} ({sasCode.hex})
                  </span>
                </>
              )}
              {lowBandwidth && phase === 'active' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">{t.lowBandwidthLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isSessionLive && (
          <div className="flex items-center gap-3">
            {sessionExpiresAt && (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatCountdown(sessionRemainingMs)}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void appendAuditEntry('DISCONNECTED', 'viewer', 'Viewer disconnected manually');
                cleanupSession('Disconnected from host.', true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-red-200 bg-red-950/60 border border-red-500/40 hover:bg-red-900/70 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.disconnectBtn}
            </button>
          </div>
        )}
      </div>

      {/* ENTER 6-WORD CODE FORM */}
      {(phase === 'enter-code' || phase === 'connecting' || phase === 'waiting-approval') && (
        <div className="max-w-2xl mx-auto rounded-xl bg-[#121824] border border-slate-800 p-6 sm:p-8">
          <form onSubmit={(e) => void handleConnectSubmit(e)} className="space-y-4">
            <div>
              <label
                htmlFor="pairing-code-input"
                className="block text-sm font-semibold text-slate-100"
              >
                {t.enterCodeLabel}
              </label>
              <input
                id="pairing-code-input"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={phase !== 'enter-code'}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={t.enterCodePlaceholder}
                className="mt-2.5 w-full rounded-lg bg-[#0B0F17] border border-slate-700 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200">
                {errorMsg}
              </div>
            )}

            {phase === 'enter-code' ? (
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors whitespace-nowrap"
                >
                  {t.connectBtn}
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#0B0F17] border border-slate-800 flex items-center justify-between gap-4">
                <span className="text-sm text-slate-300">
                  {phase === 'connecting' ? t.connectingPeer : t.waitingApproval}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    cleanupSession('Connection request cancelled.', false);
                    setPhase('enter-code');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800"
                >
                  {t.scamCancel}
                </button>
              </div>
            )}
          </form>
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

      {/* ACTIVE VIEWER WORKSPACE */}
      {phase === 'active' && (
        <div className="space-y-6">
          {/* Remote Screen Viewport */}
          <div
            ref={videoContainerRef}
            className="rounded-xl bg-[#070A10] border border-slate-800 overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-[#121824] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {t.permViewOnly}:{' '}
                  <strong className={permissions.viewOnly ? 'text-emerald-400' : 'text-amber-400'}>
                    {permissions.viewOnly ? t.onLabel : t.offLabel}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span>
                  {t.permAudio}:{' '}
                  <strong className={permissions.audio ? 'text-emerald-400' : 'text-slate-500'}>
                    {permissions.audio ? t.onLabel : t.offLabel}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleToggleFullscreen()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    {t.exitFullscreenBtn}
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    {t.fullscreenBtn}
                  </>
                )}
              </button>
            </div>

            <div className="relative aspect-video w-full bg-[#05070C] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!permissions.audio}
                className={`w-full h-full object-contain transition-opacity ${
                  permissions.viewOnly ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {!permissions.viewOnly && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
                    <EyeOff className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-100">
                    {t.viewerPausedByHost}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                    {t.viewerPausedByHostDesc}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Live WebRTC Stats */}
          <LiveStatsStrip lang={lang} stats={stats} />

          {/* Encrypted Clipboard & File Transfer */}
          <DataChannelTools
            lang={lang}
            role="viewer"
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
  );
}
