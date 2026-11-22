import { useState } from 'react';
import { MonitorUp, MonitorPlay, ArrowRight, ShieldCheck, KeyRound, FileCheck2 } from 'lucide-react';
import type { AppView, Language } from './types/session';
import { getTranslations } from './i18n/translations';
import { TopBar } from './components/TopBar';
import { HostSessionView } from './components/HostSessionView';
import { ViewerSessionView } from './components/ViewerSessionView';
import { AuditLogView } from './components/AuditLogView';
import { LimitationsView } from './components/LimitationsView';

/**
 * SetuScreen root application.
 * Lightweight, privacy-first, peer-to-peer WebRTC screen sharing prototype
 * with zero tracking, zero external scripts (beyond PeerJS signaling),
 * and full English / Hindi localization.
 */
export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [lang, setLang] = useState<Language>('en');
  const [sessionActive, setSessionActive] = useState(false);

  const t = getTranslations(lang);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <TopBar
        currentView={view}
        onNavigate={setView}
        lang={lang}
        onToggleLang={setLang}
        sessionActive={sessionActive}
      />

      <main className="flex-1">
        {view === 'home' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            {/* Hero Header */}
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{t.metaEncryption}</span>
                <span aria-hidden="true">·</span>
                <span>{t.metaP2P}</span>
                <span aria-hidden="true">·</span>
                <span>{t.metaNoTracking}</span>
              </div>

              <h1 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight text-slate-50 leading-[1.15] text-balance">
                {t.heroTitle}
              </h1>

              <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-2xl">
                {t.heroSubtitle}
              </p>
            </div>

            {/* Two Primary Modes: Share my screen (Host) & Connect (Viewer) */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="rounded-xl bg-[#121824] border border-slate-800 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <MonitorUp className="w-5 h-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-50">{t.modeHostTitle}</h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t.modeHostDesc}</p>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setView('host')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors whitespace-nowrap"
                  >
                    <span>{t.modeHostCta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#121824] border border-slate-800 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                    <MonitorPlay className="w-5 h-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-50">{t.modeViewerTitle}</h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t.modeViewerDesc}</p>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setView('viewer')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-100 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    <span>{t.modeViewerCta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Concise Security Architecture Summary Strip */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-800/80">
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {lang === 'hi'
                      ? '6-शब्द वन-टाइम कोड + SAS सत्यापन'
                      : '6-Word One-Time Code & SAS Check'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {lang === 'hi'
                      ? 'कोड 5 मिनट या पहली बार उपयोग के बाद समाप्त होता है; DTLS फ़िंगरप्रिंट से बना 3-शब्द SAS MITM हमलों को रोकता है।'
                      : 'Codes expire after 5 minutes or first use; DTLS certificate fingerprints derive a 3-word SAS phrase to block MITM.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {lang === 'hi'
                      ? 'डिफ़ॉल्ट रूप से बंद अनुमतियाँ + पैनिक स्टॉप'
                      : 'Zero-Default Permissions & Panic Kill'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {lang === 'hi'
                      ? 'व्यू-ओनली, ऑडियो, क्लिपबोर्ड और फ़ाइल ट्रांसफ़र शुरू में बंद रहते हैं। Ctrl+Shift+K तुरंत सत्र और कुंजियाँ नष्ट करता है।'
                      : 'View-only, audio, clipboard, and file transfer all start OFF. Press Ctrl+Shift+K anytime to kill the session and keys.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileCheck2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {lang === 'hi'
                      ? 'छेड़छाड़-रोधी SHA-256 ऑडिट चेन'
                      : 'Tamper-Evident SHA-256 Audit Chain'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {lang === 'hi'
                      ? 'हर कनेक्शन, अनुमति बदलाव और डिस्कनेक्ट आपके ब्राउज़र में SHA-256 हैश चेन के रूप में दर्ज होता है।'
                      : 'Every connect, approval, permission toggle, and disconnect is hash-chained locally in localStorage and verifiable.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'host' && (
          <HostSessionView
            lang={lang}
            onExit={() => setView('home')}
            onActiveStateChange={setSessionActive}
          />
        )}

        {view === 'viewer' && (
          <ViewerSessionView
            lang={lang}
            onExit={() => setView('home')}
            onActiveStateChange={setSessionActive}
          />
        )}

        {view === 'audit' && <AuditLogView lang={lang} />}

        {view === 'limitations' && <LimitationsView lang={lang} />}
      </main>

      <footer className="border-t border-slate-800/80 py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span>
            {t.appName} · {t.metaP2P}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (!sessionActive) setView('audit');
              }}
              className="hover:text-slate-300 transition-colors"
            >
              {t.navAudit}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!sessionActive) setView('limitations');
              }}
              className="hover:text-slate-300 transition-colors"
            >
              {t.navLimitations}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
