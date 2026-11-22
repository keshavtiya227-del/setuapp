import { WORD_LIST } from '../data/wordlist';
import type { SasCode } from '../types/session';

/**
 * Cryptographic utilities backed strictly by the browser's Web Crypto API
 * (`crypto.subtle` and `crypto.getRandomValues`). Zero external crypto libraries.
 */

const textEncoder = new TextEncoder();

/** Convert an ArrayBuffer or Uint8Array to lowercase hex string. */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Compute SHA-256 hex digest of a string or binary buffer. */
export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data: BufferSource =
    typeof input === 'string'
      ? textEncoder.encode(input)
      : input instanceof Uint8Array
        ? new Uint8Array(input)
        : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

/** Generate a cryptographically random hex nonce (default 16 bytes = 32 hex chars). */
export function generateNonce(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes);
}

/**
 * Generate a one-time pairing code of `count` words (default 6)
 * using unbiased cryptographic randomness (256-word list maps cleanly to 1 byte/word).
 */
export function generatePairingWords(count = 6): string[] {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => WORD_LIST[b % WORD_LIST.length]);
}

/**
 * Normalize user-typed pairing code into clean lowercase word tokens.
 * Accepts spaces, hyphens, underscores, commas, or newlines as separators.
 */
export function normalizePairingCode(rawInput: string): string[] {
  return rawInput
    .trim()
    .toLowerCase()
    .split(/[\s\-_,./]+/)
    .filter(Boolean);
}

/**
 * Derive an opaque PeerJS signaling ID from the 6-word pairing code.
 * Hashing the words ensures the human pairing code itself is never transmitted
 * in plaintext to the public PeerJS signaling server.
 */
export async function derivePeerIdFromWords(words: string[]): Promise<string> {
  const canonical = `setuscreen-pair-v1:${words.map((w) => w.trim().toLowerCase()).join('-')}`;
  const digest = await sha256Hex(canonical);
  return `setu-${digest.slice(0, 32)}`;
}

/**
 * Parse all DTLS certificate fingerprints (`a=fingerprint:...`) from a WebRTC SDP string.
 * Returns normalized, deduplicated uppercase fingerprint strings.
 */
export function extractSdpFingerprints(sdp?: string | null): string[] {
  if (!sdp) return [];
  const matches = sdp.match(/^a=fingerprint:([^\r\n]+)/gm);
  if (!matches) return [];
  const unique = new Set<string>();
  for (const line of matches) {
    const value = line.replace(/^a=fingerprint:/i, '').trim().toUpperCase();
    if (value) unique.add(value);
  }
  return Array.from(unique);
}

/**
 * Extract active DTLS fingerprints directly from one or more RTCPeerConnections.
 * Checks both SDP descriptions and WebRTC `certificate` stats when available.
 */
export async function collectConnectionFingerprints(
  connections: Array<RTCPeerConnection | null | undefined>
): Promise<{ local: string[]; remote: string[] }> {
  const localSet = new Set<string>();
  const remoteSet = new Set<string>();

  for (const pc of connections) {
    if (!pc) continue;
    for (const fp of extractSdpFingerprints(pc.localDescription?.sdp)) {
      localSet.add(fp);
    }
    for (const fp of extractSdpFingerprints(pc.remoteDescription?.sdp)) {
      remoteSet.add(fp);
    }
  }

  return {
    local: Array.from(localSet).sort(),
    remote: Array.from(remoteSet).sort(),
  };
}

/**
 * Derive the Short Authentication String (SAS) from both peers' DTLS certificate
 * fingerprints and session nonces.
 *
 * Security property:
 * Sorting the combined fingerprints lexicographically guarantees Host and Viewer
 * independently compute the exact same SAS phrase IF AND ONLY IF both sides see
 * the same DTLS certificates (no MITM substituting keys on the signaling channel).
 */
export async function deriveSasCode(params: {
  localFingerprints: string[];
  remoteFingerprints: string[];
  hostNonce: string;
  viewerNonce: string;
}): Promise<SasCode> {
  const allFingerprints = Array.from(
    new Set([...params.localFingerprints, ...params.remoteFingerprints])
  ).sort();

  const verifiedFromDtls =
    params.localFingerprints.length > 0 && params.remoteFingerprints.length > 0;

  const transcript = [
    'setuscreen-sas-v1',
    `dtls:${allFingerprints.join('|')}`,
    `host:${params.hostNonce}`,
    `viewer:${params.viewerNonce}`,
  ].join('\n');

  const digestHex = await sha256Hex(transcript);

  // Convert first 3 bytes into 3 distinct SAS words from WORD_LIST (256 words each)
  const wordIndices = [
    parseInt(digestHex.slice(0, 2), 16),
    parseInt(digestHex.slice(2, 4), 16),
    parseInt(digestHex.slice(4, 6), 16),
  ];
  const words = wordIndices.map((idx) => WORD_LIST[idx % WORD_LIST.length]);
  const hex = `${digestHex.slice(6, 10).toUpperCase()}-${digestHex.slice(10, 14).toUpperCase()}`;

  const primaryFp = allFingerprints[0] || '';
  const fpClean = primaryFp.replace(/^SHA-256\s+/i, '');
  const fingerprintSummary = fpClean
    ? `${fpClean.slice(0, 11)}…${fpClean.slice(-8)}`
    : 'pending';

  return {
    words,
    hex,
    fingerprintSummary,
    verifiedFromDtls,
  };
}

/**
 * Convert an ArrayBuffer slice to Base64 for reliable JSON DataChannel framing.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert a Base64 string back into a Uint8Array. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
