import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Download, Trash2, RefreshCw } from 'lucide-react';
import type { Language } from '../types/session';
import { getTranslations } from '../i18n/translations';
import {
  clearAuditLog,
  getAuditEntries,
  verifyAuditChain,
  type AuditEntry,
  type AuditVerificationResult,
} from '../utils/auditLog';

interface AuditLogViewProps {
  lang: Language;
}

/**
 * Tamper-evident local audit log viewer.
 * Displays every recorded SHA-256 hash-chained session event stored in localStorage
 * and lets the user cryptographically verify the entire chain on demand.
 */
export function AuditLogView({ lang }: AuditLogViewProps) {
  const t = getTranslations(lang);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<AuditVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadEntries = () => {
    setEntries(getAuditEntries());
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    loadEntries();
    const result = await verifyAuditChain();
    setVerification(result);
    setVerifying(false);
  };

  const handleExport = () => {
    const data = JSON.stringify(getAuditEntries(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `setuscreen-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearAuditLog();
    setEntries([]);
    setVerification(null);
    setConfirmClear(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">{t.auditTitle}</h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            {t.auditSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            {t.auditVerifyBtn}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {t.auditExportBtn}
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-red-300 bg-slate-900 border border-slate-800 hover:border-red-500/40 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              {t.auditClearBtn}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/40">
              <span className="text-xs text-red-200">{t.auditClearConfirm}</span>
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-500"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 rounded text-xs text-slate-300 hover:text-white"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Integrity Verification Banner */}
      {verification && (
        <div
          className={`mt-6 rounded-xl p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            verification.valid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {verification.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {verification.valid ? t.auditValidMsg : t.auditBrokenMsg}
              </div>
              <div className="mt-0.5 text-xs opacity-90 font-mono tabular-nums">
                {verification.valid
                  ? `${verification.totalEntries} ${t.auditEntriesCount} · ${t.auditHeadHash}: ${verification.headHash.slice(0, 16)}…`
                  : verification.reason}
              </div>
            </div>
          </div>
          <div className="text-xs font-mono opacity-80 tabular-nums shrink-0">
            {new Date(verification.verifiedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Hash-Chained Log Table */}
      <div className="mt-6 rounded-xl bg-[#121824] border border-slate-800 overflow-hidden">
        {entries.length === 0 ? (
          <div className="py-14 px-6 text-center text-sm text-slate-400">{t.auditEmpty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0E131D] text-xs font-medium text-slate-400">
                  <th className="py-3 px-4 w-12">{t.auditColIndex}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.auditColTime}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.auditColRole}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.auditColEvent}</th>
                  <th className="py-3 px-4">{t.auditColDetails}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.auditColHash}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {[...entries].reverse().map((entry) => {
                  const isTampered =
                    verification !== null &&
                    !verification.valid &&
                    verification.brokenAtIndex !== null &&
                    entry.index >= verification.brokenAtIndex;

                  return (
                    <tr
                      key={`${entry.index}-${entry.hash}`}
                      className={`transition-colors ${
                        isTampered
                          ? 'bg-red-950/40 text-red-200'
                          : 'hover:bg-slate-800/30 text-slate-200'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                        {entry.index}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300 uppercase">
                        {entry.role}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                        <span
                          className={
                            entry.event === 'PANIC_KILL' ||
                            entry.event === 'SAS_MISMATCH' ||
                            entry.event === 'ACCESS_DENIED'
                              ? 'text-red-400'
                              : entry.event === 'SAS_CONFIRMED' || entry.event === 'ACCESS_APPROVED'
                                ? 'text-emerald-400'
                                : 'text-slate-200'
                          }
                        >
                          {entry.event}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-md break-words">
                        {entry.details}
                      </td>
                      <td
                        className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap"
                        title={`hash: ${entry.hash}\nprev: ${entry.prevHash}`}
                      >
                        {entry.hash.slice(0, 14)}…
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
