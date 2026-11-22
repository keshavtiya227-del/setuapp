/**
 * Shared types for SetuScreen WebRTC peer-to-peer protocol, permissions,
 * telemetry stats, and session lifecycles.
 */

export type Language = 'en' | 'hi';

export type AppView = 'home' | 'host' | 'viewer' | 'audit' | 'limitations';

/** Session duration presets selectable by the Host (in minutes). */
export type SessionDurationMinutes = 15 | 60 | 240;

/**
 * Granular per-session permissions controlled exclusively by the Host.
 * Security invariant: ALL permissions start as `false` (OFF by default).
 */
export interface SessionPermissions {
  viewOnly: boolean;
  audio: boolean;
  clipboard: boolean;
  fileTransfer: boolean;
}

export const DEFAULT_PERMISSIONS: SessionPermissions = {
  viewOnly: false,
  audio: false,
  clipboard: false,
  fileTransfer: false,
};

/** Max file transfer size allowed over WebRTC DataChannel (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Chunk size for DataChannel binary file transfer (16 KB is safe across all browsers). */
export const FILE_CHUNK_SIZE = 16 * 1024;

/** Pairing code TTL: 5 minutes in milliseconds. */
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;

/** Live WebRTC telemetry polled from RTCPeerConnection.getStats(). */
export interface LiveStats {
  latencyMs: number | null;
  fps: number | null;
  bitrateKbps: number | null;
  resolution: string | null;
  iceState: string;
}

/** Derived Short Authentication String (SAS) shown on both peers to detect MITM. */
export interface SasCode {
  words: string[];
  hex: string;
  fingerprintSummary: string;
  verifiedFromDtls: boolean;
}

/** Shared clipboard item sent over encrypted WebRTC DataChannel. */
export interface ClipboardMessage {
  id: string;
  sender: 'host' | 'viewer';
  text: string;
  timestamp: string;
}

/** Received or sent file record over WebRTC DataChannel. */
export interface TransferredFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  direction: 'sent' | 'received';
  sha256: string;
  verified: boolean;
  timestamp: string;
  downloadUrl?: string;
}

/** Structured messages exchanged over the PeerJS WebRTC DataChannel. */
export type ControlMessage =
  | {
      type: 'join-request';
      viewerNonce: string;
      viewerLabel: string;
      requestedAt: string;
    }
  | {
      type: 'join-rejected';
      reason: 'denied' | 'expired' | 'used' | 'busy';
    }
  | {
      type: 'join-approved';
      hostNonce: string;
      sessionExpiresAt: number;
      permissions: SessionPermissions;
      lowBandwidth: boolean;
    }
  | {
      type: 'sas-confirm';
      sasHex: string;
    }
  | {
      type: 'sas-mismatch';
    }
  | {
      type: 'permissions-update';
      permissions: SessionPermissions;
    }
  | {
      type: 'low-bandwidth-update';
      enabled: boolean;
    }
  | {
      type: 'clipboard-text';
      id: string;
      text: string;
      timestamp: string;
    }
  | {
      type: 'file-meta';
      id: string;
      name: string;
      size: number;
      mimeType: string;
      totalChunks: number;
      sha256: string;
    }
  | {
      type: 'file-chunk';
      id: string;
      chunkIndex: number;
      data: string; // Base64 chunk for reliable cross-browser DataChannel serialization
    }
  | {
      type: 'file-complete';
      id: string;
    }
  | {
      type: 'file-rejected';
      id: string;
      reason: 'disabled' | 'too-large';
    }
  | {
      type: 'ping';
      sentAt: number;
    }
  | {
      type: 'pong';
      sentAt: number;
    }
  | {
      type: 'session-ended';
      reason: 'host-ended' | 'viewer-ended' | 'panic' | 'expired';
    };
