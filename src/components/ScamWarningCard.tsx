import { useState } from 'react';
import { ShieldAlert, ArrowLeft, Check } from 'lucide-react';
import type { Language } from '../types/session';
import { getTranslations } from '../i18n/translations';

interface ScamWarningCardProps {
  lang: Language;
  onAcknowledge: () => void;
  onCancel: () => void;
}

/**
 * Mandatory anti-scam warning gate displayed to the Host before every first
 * pairing session to deter bank/KYC/tech-support screen-sharing fraud.
 */
export function ScamWarningCard({ lang, onAcknowledge, onCancel }: ScamWarningCardProps) {
  const t = getTranslations(lang);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <div className="rounded-xl bg-[#121824] border border-amber-500/40 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-400 mb-1">{t.scamTitle}</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-50 leading-snug text-balance">
              {t.scamHeadline}
            </h1>
          </div>
        </div>

        <ul className="mt-6 space-y-3 text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-6">
          <li className="flex items-start gap-3">
            <span className="text-amber-400 font-mono text-xs mt-1 shrink-0">01.</span>
            <span>{t.scamPoint1}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-amber-400 font-mono text-xs mt-1 shrink-0">02.</span>
            <span>{t.scamPoint2}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-amber-400 font-mono text-xs mt-1 shrink-0">03.</span>
            <span>{t.scamPoint3}</span>
          </li>
        </ul>

        <label className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-[#0B0F17] border border-slate-800 cursor-pointer select-none hover:border-slate-700 transition-colors">
          <button
            type="button"
            role="checkbox"
            aria-checked={acknowledged}
            onClick={() => setAcknowledged((v) => !v)}
            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
              acknowledged
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-600 text-transparent'
            }`}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
          <span
            onClick={() => setAcknowledged((v) => !v)}
            className="text-sm text-slate-200 leading-relaxed"
          >
            {t.scamCheckbox}
          </span>
        </label>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.scamCancel}
          </button>

          <button
            type="button"
            disabled={!acknowledged}
            onClick={onAcknowledge}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {t.scamContinue}
          </button>
        </div>
      </div>
    </div>
  );
}
