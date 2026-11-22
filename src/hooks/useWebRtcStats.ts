import { useEffect, useRef, useState } from 'react';
import type { LiveStats } from '../types/session';

interface UseWebRtcStatsOptions {
  peerConnection: RTCPeerConnection | null;
  direction: 'outbound' | 'inbound';
  active: boolean;
  /** Optional measured DataChannel ping/pong RTT in ms as fallback when ICE stats omit RTT */
  fallbackRttMs: number | null;
}

const INITIAL_STATS: LiveStats = {
  latencyMs: null,
  fps: null,
  bitrateKbps: null,
  resolution: null,
  iceState: 'new',
};

/**
 * Polls genuine WebRTC metrics from `RTCPeerConnection.getStats()` every second.
 * Computes live bitrate from byte deltas, FPS from video RTP stats, resolution,
 * and round-trip latency from the active ICE candidate pair (with DataChannel RTT fallback).
 */
export function useWebRtcStats({
  peerConnection,
  direction,
  active,
  fallbackRttMs,
}: UseWebRtcStatsOptions): LiveStats {
  const [stats, setStats] = useState<LiveStats>(INITIAL_STATS);
  const prevBytesRef = useRef<number | null>(null);
  const prevTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !peerConnection) {
      prevBytesRef.current = null;
      prevTimestampRef.current = null;
      setStats(INITIAL_STATS);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const report = await peerConnection.getStats();
        if (cancelled) return;

        let latencyMs: number | null = null;
        let fps: number | null = null;
        let bitrateKbps: number | null = null;
        let resolution: string | null = null;

        report.forEach((entry) => {
          // Latency from selected/succeeded ICE candidate pair
          if (
            entry.type === 'candidate-pair' &&
            (entry.state === 'succeeded' || entry.nominated) &&
            typeof entry.currentRoundTripTime === 'number'
          ) {
            latencyMs = Math.round(entry.currentRoundTripTime * 1000);
          }

          // Video RTP stats (outbound for Host, inbound for Viewer)
          const targetType = direction === 'outbound' ? 'outbound-rtp' : 'inbound-rtp';
          if (entry.type === targetType && (entry.kind === 'video' || entry.mediaType === 'video')) {
            if (typeof entry.framesPerSecond === 'number') {
              fps = Math.round(entry.framesPerSecond);
            }
            if (typeof entry.frameWidth === 'number' && typeof entry.frameHeight === 'number') {
              if (entry.frameWidth > 0 && entry.frameHeight > 0) {
                resolution = `${entry.frameWidth}×${entry.frameHeight}`;
              }
            }

            const currentBytes =
              direction === 'outbound' ? entry.bytesSent : entry.bytesReceived;
            const currentTs = entry.timestamp; // milliseconds

            if (typeof currentBytes === 'number' && typeof currentTs === 'number') {
              if (
                prevBytesRef.current !== null &&
                prevTimestampRef.current !== null &&
                currentTs > prevTimestampRef.current
              ) {
                const deltaBytes = Math.max(0, currentBytes - prevBytesRef.current);
                const deltaSec = (currentTs - prevTimestampRef.current) / 1000;
                if (deltaSec > 0) {
                  bitrateKbps = Math.round((deltaBytes * 8) / deltaSec / 1000);
                }
              }
              prevBytesRef.current = currentBytes;
              prevTimestampRef.current = currentTs;
            }
          }
        });

        setStats({
          latencyMs: latencyMs ?? fallbackRttMs,
          fps,
          bitrateKbps,
          resolution,
          iceState: peerConnection.iceConnectionState,
        });
      } catch {
        // Connection may have closed between polls
      }
    };

    poll();
    const timer = window.setInterval(poll, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [peerConnection, direction, active, fallbackRttMs]);

  return stats;
}
