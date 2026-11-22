import type { AppView, Language } from '../types/session';
import { getTranslations } from '../i18n/translations';

interface TopBarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  lang: Language;
  onToggleLang: (lang: Language) => void;
  sessionActive: boolean;
}

/**
 * Minimal single-row 3-zone top navigation bar:
 * [Wordmark] — [Text nav links] — [Language toggle]
 */
export function TopBar({
  currentView,
  onNavigate,
  lang,
  onToggleLang,
  sessionActive,
}: TopBarProps) {
  const t = getTranslations(lang);

  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'home', label: t.navHome },
    { id: 'audit', label: t.navAudit },
    { id: 'limitations', label: t.navLimitations },
  ];

  return (
    <header className="border-b border-slate-800/90 bg-[#0B0F17]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (!sessionActive) onNavigate('home');
          }}
          disabled={sessionActive}
          className="text-lg font-semibold tracking-tight text-slate-50 whitespace-nowrap shrink-0 disabled:cursor-default"
        >
          {t.appName}
        </button>

        {/* Zone 2: Clean text navigation links */}
        <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium overflow-x-auto">
          {navItems.map((item) => {
            const isActive =
              currentView === item.id ||
              (item.id === 'home' && (currentView === 'host' || currentView === 'viewer'));
            return (
              <button
                key={item.id}
                type="button"
                disabled={sessionActive && item.id !== currentView}
                onClick={() => onNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  isActive
                    ? 'text-slate-50 border-blue-500'
                    : 'text-slate-400 border-transparent hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Bilingual EN / Hindi toggle */}
        <div
          className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0"
          role="group"
          aria-label="Language"
        >
          <button
            type="button"
            onClick={() => onToggleLang('en')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              lang === 'en'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onToggleLang('hi')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              lang === 'hi'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>
    </header>
  );
}
