import { ShieldCheck, ShieldOff, Lock } from 'lucide-react';
import type { Language, SasCode } from '../types/session';
import { getTranslations } from '../i18n/translations';

interface SasVerificationModalProps {
  lang: Language;
  sasCode: SasCode | null;
  localConfirmed: boolean;
  remoteConfirmed: boolean;
  onConfirm: () => void;
  onAbort: () => void;
}

/**
 * Dual-sided Short Authentication String (SAS) verification gate.
 * Both Host and Viewer see the exact same 3-word phrase + checksum derived from
 * the live WebRTC DTLS certificate fingerprints and must confirm it matches
 * before video/clipboard/file features unlock.
 */
export function SasVerificationModal({
  lang,
  sasCode,
  localConfirmed,
  remoteConfirmed,
  onConfirm,
  onAbort,
}: SasVerificationModalProps) {
  const t = getTranslations(lang);

  return (
    <div className="rounded-xl bg-[#121824] border border-blue-500/40 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
          <Lock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-50">{t.sasTitle}</h2>
          <p className="mt-1 text-sm text-slate-300 leading-relaxed">{t.sasSubtitle}</p>
        </div>
      </div>

      {sasCode ? (
        <div className="mt-6 rounded-lg bg-[#0B0F17] border border-slate-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>{t.sasPhraseLabel}</span>
            <span>{t.sasDtlsBound}</span>
          </div>

          {/* Primary 3-word human-verifiable SAS phrase */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {sasCode.words.map((word, index) => (
              <div
                key={`${word}-${index}`}
                className="py-3.5 px-3 rounded-lg bg-slate-900 border border-slate-700/80 text-center"
              >
                <span className="block text-[11px] font-mono text-slate-500 tabular-nums">
                  0{index + 1}
                </span>
                <span className="block mt-0.5 text-base sm:text-lg font-mono font-semibold text-slate-50 tracking-wide">
                  {word}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              <span>{t.sasChecksumLabel}: </span>
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {sasCode.hex}
              </span>
            </div>
            <div className="font-mono text-slate-500 truncate max-w-xs">
              DTLS: {sasCode.fingerprintSummary}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg bg-[#0B0F17] border border-slate-800 p-6 text-center text-sm text-slate-400">
          Computing DTLS certificate fingerprints...
        </div>
      )}

      {localConfirmed && !remoteConfirmed ? (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3 text-sm text-emerald-300">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{t.sasWaitingOther}</span>
          </div>
          <button
            type="button"
            onClick={onAbort}
            className="px-4 py-2 rounded-lg text-xs font-medium text-red-300 bg-red-950/60 border border-red-500/30 hover:bg-red-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            {t.sasMismatchBtn}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            onClick={onAbort}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-300 bg-red-950/50 border border-red-500/30 hover:bg-red-950 transition-colors whitespace-nowrap"
          >
            <ShieldOff className="w-4 h-4" />
            {t.sasMismatchBtn}
          </button>

          <button
            type="button"
            disabled={!sasCode}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4" />
            {t.sasConfirmBtn}
          </button>
        </div>
      )}
    </div>
  );
}
