import type { PeerOptions } from 'peerjs';

/**
 * WebRTC and PeerJS helper utilities.
 *
 * PeerJS uses the default free public cloud signaling broker solely to exchange
 * SDP offers/answers and ICE candidates. All screen video, audio, clipboard,
 * and file data travel directly peer-to-peer over DTLS-SRTP / SCTP.
 */

export const PEER_CONFIG: PeerOptions = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

/**
 * Apply low-bandwidth or standard quality constraints to both the local
 * MediaStreamTrack and the WebRTC RTCRtpSender encoding parameters.
 */
export async function applyBandwidthMode(params: {
  stream: MediaStream | null;
  peerConnection: RTCPeerConnection | null | undefined;
  lowBandwidth: boolean;
}): Promise<void> {
  const { stream, peerConnection, lowBandwidth } = params;

  // 1. Constrain capture track resolution & framerate
  const videoTrack = stream?.getVideoTracks()[0];
  if (videoTrack) {
    try {
      await videoTrack.applyConstraints(
        lowBandwidth
          ? {
              width: { max: 1280 },
              height: { max: 720 },
              frameRate: { ideal: 10, max: 10 },
            }
          : {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
            }
      );
    } catch {
      // Some browsers restrict dynamic applyConstraints on display tracks;
      // RTCRtpSender encoding parameters below still enforce adaptive bitrate & framerate.
    }
  }

  // 2. Enforce adaptive bitrate & framerate directly on the RTCRtpSender
  if (peerConnection) {
    const senders = peerConnection.getSenders();
    const videoSender = senders.find((s) => s.track?.kind === 'video');
    if (videoSender) {
      try {
        const senderParams = videoSender.getParameters();
        if (!senderParams.encodings || senderParams.encodings.length === 0) {
          senderParams.encodings = [{}];
        }
        const encoding = senderParams.encodings[0];
        if (lowBandwidth) {
          encoding.maxBitrate = 450_000; // ~450 kbps adaptive cap
          encoding.maxFramerate = 10;
          encoding.scaleResolutionDownBy = 1.5;
          senderParams.degradationPreference = 'maintain-framerate';
        } else {
          encoding.maxBitrate = 2_500_000; // ~2.5 Mbps crisp screen text
          encoding.maxFramerate = 30;
          encoding.scaleResolutionDownBy = 1;
          senderParams.degradationPreference = 'maintain-resolution';
        }
        await videoSender.setParameters(senderParams);
      } catch {
        // Ignore if browser rejects a specific encoding field mid-negotiation
      }
    }
  }
}

/** Format milliseconds into MM:SS or HH:MM:SS for tabular countdown timers. */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Format byte count into human-readable KB / MB string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Produce a concise non-identifying browser/OS summary for the Host approval prompt. */
export function getViewerDeviceSummary(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}
