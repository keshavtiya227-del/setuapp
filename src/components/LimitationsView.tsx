import type { Language } from '../types/session';
import { getTranslations } from '../i18n/translations';

interface LimitationsViewProps {
  lang: Language;
}

/**
 * Transparent engineering breakdown of what a browser-only WebRTC prototype
 * cannot do compared to native desktop remote-access software.
 */
export function LimitationsView({ lang }: LimitationsViewProps) {
  const t = getTranslations(lang);

  const items =
    lang === 'hi'
      ? [
          {
            num: '01',
            title: 'रिमोट माउस और कीबोर्ड नियंत्रण नहीं (No Remote Input Control)',
            body: 'ब्राउज़र सैंडबॉक्स सुरक्षा के कारण कोई भी वेबसाइट आपके ऑपरेटिंग सिस्टम में माउस क्लिक या कीबोर्ड इनपुट इंजेक्ट नहीं कर सकती। इसके लिए नेटिव डेस्कटॉप एजेंट (Rust/C++/Electron + OS Accessibility / Input APIs) चाहिए।',
          },
          {
            num: '02',
            title: 'विंडो मास्किंग या प्राइवेसी कर्टेन नहीं (No Window Masking)',
            body: 'नेटिव ऐप्स पासवर्ड मैनेजर, बैंकिंग विंडो या संवेदनशील ऐप्स को OS कंपोज़िटर स्तर पर काला कर सकते हैं। ब्राउज़र का getDisplayMedia() पूरी चुनी हुई स्क्रीन या विंडो को वैसे ही कैप्चर करता है।',
          },
          {
            num: '03',
            title: 'अनअटेंडेड एक्सेस और बैकग्राउंड सर्विस नहीं (No Unattended Access)',
            body: 'ब्राउज़र टैब बंद होने, सिस्टम लॉक होने या रीबूट होने पर सत्र खत्म हो जाता है। स्क्रीन शेयरिंग के लिए हर बार यूज़र द्वारा मैनुअल ब्राउज़र पिकर स्वीकृति अनिवार्य है; UAC या लॉगिन स्क्रीन भी कैप्चर नहीं हो सकती।',
          },
          {
            num: '04',
            title: 'कठोर कॉर्पोरेट NAT / फ़ायरवॉल बिना TURN सर्वर के',
            body: 'यह प्रोटोटाइप शुद्ध पीयर-टू-पीयर (STUN) का उपयोग करता है और कोई मीडिया सर्वर रिले नहीं रखता। कुछ सख्त सिमेट्रिक NAT या कॉर्पोरेट फ़ायरवॉल नेटवर्क पर सीधा P2P विफल हो सकता है, जिसके लिए सेल्फ-होस्टेड TURN (coturn) चाहिए।',
          },
          {
            num: '05',
            title: 'सिस्टम-वाइड ऑडियो की सीमाएँ',
            body: 'ब्राउज़र के अनुसार सिस्टम ऑडियो कैप्चर अलग-अलग होता है (जैसे macOS/Firefox पर अक्सर केवल ब्राउज़र टैब ऑडियो मिलता है, पूरा सिस्टम ऑडियो नहीं)।',
          },
        ]
      : [
          {
            num: '01',
            title: 'No Remote Mouse or Keyboard Input Control',
            body: 'By browser sandbox design, JavaScript cannot inject OS-level mouse clicks, cursor movement, or keystrokes into other desktop applications. True remote control requires a native OS agent (e.g., Rust/C++ using Windows SendInput, macOS CGEvent, or Linux uinput/Wayland portals).',
          },
          {
            num: '02',
            title: 'No OS-Level Window Masking or Privacy Curtain',
            body: 'Native tools can exclude specific windows (password managers, banking apps, OTP popups) at the OS compositor level or black out the local monitor. Browser getDisplayMedia() captures the entire chosen monitor or window verbatim.',
          },
          {
            num: '03',
            title: 'No Unattended Access, Background Daemon, or UAC Elevation',
            body: 'Browsers enforce an explicit interactive picker prompt on every share. Sessions stop when the tab closes or the machine sleeps, and browsers cannot capture OS lock screens, login prompts, or Windows UAC admin dialogs.',
          },
          {
            num: '04',
            title: 'Strict Symmetric NAT / Corporate Firewalls Without TURN',
            body: 'Because all media flows strictly peer-to-peer with no relay server, connections between two strict symmetric NATs or UDP-blocked firewalls may fail to establish ICE connectivity. Production apps run self-hosted TURN relays (coturn) for DTLS-encrypted fallback.',
          },
          {
            num: '05',
            title: 'Browser-Dependent System Audio Capture',
            body: 'Full desktop audio sharing varies by browser and OS (for example, macOS Chrome and Firefox often limit audio capture to individual browser tabs rather than system-wide audio).',
          },
        ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">{t.limitsTitle}</h1>
        <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{t.limitsSubtitle}</p>
      </div>

      <div className="mt-6 divide-y divide-slate-800/80 rounded-xl bg-[#121824] border border-slate-800">
        {items.map((item) => (
          <div key={item.num} className="p-5 sm:p-6 flex items-start gap-4">
            <span className="font-mono text-xs font-semibold text-slate-500 mt-1 shrink-0 tabular-nums">
              {item.num}.
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-100">{item.title}</h2>
              <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
