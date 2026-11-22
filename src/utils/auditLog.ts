import { sha256Hex } from './crypto';

/**
 * Local tamper-evident audit log stored in `localStorage` as a SHA-256 hash chain.
 *
 * Each entry commits to:
 *   hash = SHA-256(index | timestamp | event | role | details | prevHash)
 *
 * Modifying, deleting, or reordering any past entry breaks the hash chain,
 * which `verifyAuditChain()` immediately detects and pinpoints.
 */

export const AUDIT_STORAGE_KEY = 'setuscreen_audit_chain_v1';
export const GENESIS_HASH = '0'.repeat(64);

export type AuditEventType =
  | 'CODE_GENERATED'
  | 'CODE_EXPIRED'
  | 'CONNECTION_REQUEST'
  | 'ACCESS_APPROVED'
  | 'ACCESS_DENIED'
  | 'SAS_CONFIRMED'
  | 'SAS_MISMATCH'
  | 'PERMISSION_CHANGED'
  | 'LOW_BANDWIDTH_CHANGED'
  | 'CLIPBOARD_SHARED'
  | 'FILE_TRANSFERRED'
  | 'SESSION_EXPIRED'
  | 'PANIC_KILL'
  | 'DISCONNECTED';

export interface AuditEntry {
  index: number;
  timestamp: string;
  event: AuditEventType;
  role: 'host' | 'viewer' | 'system';
  details: string;
  prevHash: string;
  hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  brokenAtIndex: number | null;
  reason: string | null;
  headHash: string;
  verifiedAt: string;
}

/** Canonical serialization used for SHA-256 chain computation. */
function serializeForHash(entry: Omit<AuditEntry, 'hash'>): string {
  return [
    String(entry.index),
    entry.timestamp,
    entry.event,
    entry.role,
    entry.details,
    entry.prevHash,
  ].join('|');
}

/** Read raw audit entries from localStorage safely. */
export function getAuditEntries(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Serialize concurrent appends via a promise queue so chain links never race.
let appendQueue: Promise<void> = Promise.resolve();

/**
 * Append a new event to the local hash-chained audit log.
 * Uses a sequential queue so rapid events maintain strict prevHash ordering.
 */
export function appendAuditEntry(
  event: AuditEventType,
  role: 'host' | 'viewer' | 'system',
  details: string
): Promise<AuditEntry> {
  let resolveEntry!: (entry: AuditEntry) => void;
  const resultPromise = new Promise<AuditEntry>((resolve) => {
    resolveEntry = resolve;
  });

  appendQueue = appendQueue
    .then(async () => {
      const existing = getAuditEntries();
      const last = existing[existing.length - 1];
      const index = last ? last.index + 1 : 0;
      const prevHash = last ? last.hash : GENESIS_HASH;
      const timestamp = new Date().toISOString();

      const unsigned: Omit<AuditEntry, 'hash'> = {
        index,
        timestamp,
        event,
        role,
        details,
        prevHash,
      };
      const hash = await sha256Hex(serializeForHash(unsigned));
      const fullEntry: AuditEntry = { ...unsigned, hash };

      const updated = [...existing, fullEntry];
      try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors gracefully
      }
      resolveEntry(fullEntry);
    })
    .catch(() => {
      // Keep queue alive even if an error occurred
    });

  return resultPromise;
}

/**
 * Recompute every SHA-256 hash from genesis (index 0) to head and verify
 * linkage (`prevHash === previous.hash`) and payload integrity.
 */
export async function verifyAuditChain(): Promise<AuditVerificationResult> {
  const entries = getAuditEntries();
  const verifiedAt = new Date().toISOString();

  if (entries.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      brokenAtIndex: null,
      reason: null,
      headHash: GENESIS_HASH,
      verifiedAt,
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.index !== i) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtIndex: i,
        reason: `Sequence index mismatch at position ${i} (found #${entry.index})`,
        headHash: entries[entries.length - 1]?.hash ?? GENESIS_HASH,
        verifiedAt,
      };
    }

    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtIndex: i,
        reason: `Broken chain link at entry #${i}: prevHash does not match previous entry hash`,
        headHash: entries[entries.length - 1]?.hash ?? GENESIS_HASH,
        verifiedAt,
      };
    }

    const recomputed = await sha256Hex(
      serializeForHash({
        index: entry.index,
        timestamp: entry.timestamp,
        event: entry.event,
        role: entry.role,
        details: entry.details,
        prevHash: entry.prevHash,
      })
    );

    if (recomputed !== entry.hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtIndex: i,
        reason: `Hash mismatch at entry #${i}: entry content was altered after recording`,
        headHash: entries[entries.length - 1]?.hash ?? GENESIS_HASH,
        verifiedAt,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    brokenAtIndex: null,
    reason: null,
    headHash: expectedPrevHash,
    verifiedAt,
  };
}

/** Remove all audit entries from localStorage. */
export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_STORAGE_KEY);
}
