import type { Language } from '../types/session';

/**
 * Complete bilingual dictionary (English & Hindi) for SetuScreen.
 * Every visible UI string, security warning, permission toggle, and status label
 * is translated cleanly in both languages.
 */
export const TRANSLATIONS = {
  en: {
    appName: 'SetuScreen',
    navHome: 'Home',
    navAudit: 'Audit Log',
    navLimitations: 'Browser Limits',
    heroTitle: 'Direct, encrypted screen sharing in your browser',
    heroSubtitle:
      'All screen video, audio, clipboard text, and files travel strictly peer-to-peer over WebRTC (DTLS-SRTP). PeerJS is used only for initial connection handshake.',
    metaEncryption: 'DTLS-SRTP End-to-End Encrypted',
    metaP2P: 'Direct Peer-to-Peer',
    metaNoTracking: 'Zero Analytics or Server Relay',

    modeHostTitle: 'Share my screen',
    modeHostDesc:
      'Generate a one-time 6-word pairing code, review who connects, confirm the verification phrase, and control every permission.',
    modeHostCta: 'Start as Host',

    modeViewerTitle: 'Connect',
    modeViewerDesc:
      'Enter a host’s 6-word pairing code to request view access, confirm the anti-MITM verification phrase, and view their screen.',
    modeViewerCta: 'Connect as Viewer',

    // Scam warning
    scamTitle: 'Security Check Before Sharing',
    scamHeadline:
      'Never allow access to someone who called you claiming to be from a bank, KYC, or tech support.',
    scamPoint1:
      'Legitimate banks, UPI apps, government offices, and KYC agents will never ask to view your screen.',
    scamPoint2:
      'Anyone who sees your screen can read OTPs, banking passwords, Aadhaar/PAN details, and private messages.',
    scamPoint3:
      'All permissions start OFF by default, and you can press Ctrl+Shift+K at any moment to instantly end the session.',
    scamCheckbox:
      'I know and trust the person I am sharing with, and nobody asked me to open this over an unsolicited call.',
    scamContinue: 'I Understand — Generate Pairing Code',
    scamCancel: 'Go Back',

    // Host setup & pairing
    hostPanelTitle: 'Host Session',
    pairingCodeLabel: 'One-Time 6-Word Pairing Code',
    pairingCodeHint: 'Share this code only with the person you trust. Expires in 5 minutes or after first use.',
    codeExpiresIn: 'Code expires in',
    codeExpired: 'Pairing code expired',
    codeUsed: 'Code consumed (one-time use)',
    copyCode: 'Copy Code',
    copied: 'Copied',
    regenerateCode: 'Generate New Code',
    waitingForViewer: 'Waiting for viewer to enter this code...',
    signalingConnecting: 'Connecting to PeerJS signaling...',
    signalingReady: 'Signaling ready · Waiting for peer',
    signalingError: 'Signaling connection error',

    sessionDurationLabel: 'Auto-expire session after',
    dur15m: '15 min',
    dur1h: '1 hr',
    dur4h: '4 hr',

    // Approval popup
    approvalTitle: 'Incoming Connection Request',
    approvalBody: 'Someone wants to view your screen.',
    approvalDevice: 'Viewer browser',
    approvalWarning:
      'Reminder: Never allow access to callers claiming to be bank, KYC, or tech support.',
    allowBtn: 'Allow',
    denyBtn: 'Deny',

    // SAS verification
    sasTitle: 'Verify Connection Fingerprint (SAS)',
    sasSubtitle:
      'Compare this 3-word phrase with the other person over voice or chat. Confirm ONLY if both screens show the exact same phrase — this prevents man-in-the-middle attacks.',
    sasPhraseLabel: 'Verification Phrase',
    sasChecksumLabel: 'Fingerprint Checksum',
    sasDtlsBound: 'Derived from live WebRTC DTLS certificates',
    sasConfirmBtn: 'Phrase Matches — Confirm',
    sasMismatchBtn: 'Does Not Match — Abort',
    sasWaitingOther: 'Confirmed on your side · Waiting for the other peer to confirm...',
    sasBothConfirmed: 'Verified end-to-end',

    // Host active banner & panic
    hostViewingBanner: 'Your screen is being viewed',
    hostSessionRemaining: 'Auto-ends in',
    panicButton: 'PANIC STOP',
    panicHotkeyHint: 'Ctrl+Shift+K',
    panicKilledTitle: 'Session Instantly Terminated',
    panicKilledDesc:
      'All media tracks were stopped, the WebRTC connection was closed, ephemeral session keys were destroyed, and the event was logged to your local audit chain.',
    startNewSession: 'Return to Home',
    endSessionBtn: 'End Session',

    // Permissions (ALL OFF by default)
    permissionsTitle: 'Per-Session Permissions',
    permissionsSubtitle: 'Every permission starts OFF by default. Changes apply immediately.',
    permViewOnly: 'View-only screen',
    permViewOnlyDesc: 'Transmit your shared screen video to the viewer.',
    permAudio: 'Audio',
    permAudioDesc: 'Transmit shared tab or system audio (if selected in picker).',
    permClipboard: 'Clipboard text',
    permClipboardDesc: 'Allow sending plain text snippets over the encrypted data channel.',
    permFileTransfer: 'File transfer',
    permFileTransferDesc: 'Allow encrypted P2P file transfer (max 10 MB per file).',
    noAudioTrackHint:
      'No audio track was captured by the browser picker. Click below to re-select a tab or screen with audio.',
    repickScreenBtn: 'Change Shared Screen / Audio',
    offLabel: 'OFF',
    onLabel: 'ON',

    // Performance & telemetry
    performanceTitle: 'Stream Performance & Stats',
    lowBandwidthLabel: 'Low-bandwidth mode',
    lowBandwidthDesc: 'Caps stream at 720p, 10 fps, and adaptive ~450 kbps bitrate.',
    statLatency: 'Latency',
    statFps: 'Frame Rate',
    statBitrate: 'Bitrate',
    statResolution: 'Resolution',
    statMeasuring: '—',

    // Viewer view
    viewerPanelTitle: 'Connect to a Host',
    enterCodeLabel: 'Enter the 6-word pairing code',
    enterCodePlaceholder: 'e.g. amber falcon prism lotus canyon cedar',
    connectBtn: 'Request Connection',
    connectingPeer: 'Connecting to host via PeerJS...',
    waitingApproval: 'Connected to host · Waiting for host to click Allow...',
    invalidCodeError: 'Please enter all 6 words separated by spaces or hyphens.',
    rejectedDenied: 'The host denied your connection request.',
    rejectedExpired: 'This pairing code has expired (5-minute limit). Ask the host for a new code.',
    rejectedUsed: 'This pairing code was already used. Pairing codes are strictly one-time.',
    rejectedBusy: 'The host already has an active session.',
    hostEndedMsg: 'The host ended the session.',
    panicEndedMsg: 'The host triggered Panic Stop and destroyed the session.',
    expiredEndedMsg: 'Session auto-expired after reaching the host time limit.',
    sasMismatchEndedMsg: 'Aborted: Verification phrase did not match.',
    viewerPausedByHost: 'Screen viewing is currently OFF',
    viewerPausedByHostDesc:
      'The host has not enabled the "View-only screen" permission yet (all permissions start OFF by default).',
    viewerEncryptedVerified: 'Verified DTLS-SRTP P2P Session',
    fullscreenBtn: 'Fullscreen',
    exitFullscreenBtn: 'Exit Fullscreen',
    disconnectBtn: 'Disconnect',

    // Clipboard & Files
    clipboardTitle: 'Clipboard Text',
    clipboardDisabled: 'Disabled by Host',
    clipboardPlaceholder: 'Type or paste text to send to the connected peer...',
    clipboardPasteLocal: 'Read Local Clipboard',
    clipboardSend: 'Send Text',
    clipboardCopy: 'Copy',
    clipboardEmpty: 'No clipboard text shared in this session yet.',

    fileTitle: 'Encrypted File Transfer',
    fileDisabled: 'Disabled by Host',
    fileLimitNote: 'Direct P2P DataChannel · Max 10 MB · SHA-256 verified',
    fileChooseBtn: 'Select File to Send',
    fileTooLarge: 'File exceeds the 10 MB transfer limit.',
    fileSending: 'Sending',
    fileReceiving: 'Receiving',
    fileVerified: 'SHA-256 verified',
    fileTampered: 'Checksum mismatch',
    fileDownload: 'Download',
    fileEmpty: 'No files transferred in this session.',

    // Audit log
    auditTitle: 'Tamper-Evident Local Audit Log',
    auditSubtitle:
      'Every session event is stored locally in your browser as a SHA-256 hash chain. Each record embeds the hash of the previous record.',
    auditVerifyBtn: 'Verify Log Integrity',
    auditExportBtn: 'Export JSON',
    auditClearBtn: 'Clear Log',
    auditClearConfirm: 'Clear all local audit log entries?',
    auditValidMsg: 'Hash chain verified intact',
    auditBrokenMsg: 'Tampering detected in hash chain',
    auditEntriesCount: 'entries',
    auditHeadHash: 'Chain head',
    auditEmpty: 'No security events recorded yet. Start a host or viewer session to log events.',
    auditColIndex: '#',
    auditColTime: 'Timestamp',
    auditColRole: 'Role',
    auditColEvent: 'Event',
    auditColDetails: 'Details',
    auditColHash: 'SHA-256 Hash',

    // Limitations view
    limitsTitle: 'What This Browser Prototype Cannot Do',
    limitsSubtitle:
      'Honest security and technical boundaries of a pure browser WebRTC application compared to native remote desktop software (such as AnyDesk or RustDesk).',
  },

  hi: {
    appName: 'SetuScreen',
    navHome: 'होम',
    navAudit: 'ऑडिट लॉग',
    navLimitations: 'ब्राउज़र सीमाएँ',
    heroTitle: 'ब्राउज़र में सीधा, एन्क्रिप्टेड स्क्रीन शेयरिंग',
    heroSubtitle:
      'सारा स्क्रीन वीडियो, ऑडियो, क्लिपबोर्ड टेक्स्ट और फ़ाइलें सीधे WebRTC (DTLS-SRTP) के ज़रिए पीयर-टू-पीयर जाती हैं। PeerJS का उपयोग केवल शुरुआती कनेक्शन सेटअप के लिए होता है।',
    metaEncryption: 'DTLS-SRTP एंड-टू-एंड एन्क्रिप्टेड',
    metaP2P: 'सीधा पीयर-टू-पीयर',
    metaNoTracking: 'कोई ट्रैकिंग या सर्वर रिले नहीं',

    modeHostTitle: 'अपनी स्क्रीन शेयर करें',
    modeHostDesc:
      '6 शब्दों का वन-टाइम पेयरिंग कोड बनाएं, कनेक्शन अनुरोध की जांच करें, वेरिफ़िकेशन वाक्यांश मिलाएं और हर अनुमति नियंत्रित करें।',
    modeHostCta: 'होस्ट के रूप में शुरू करें',

    modeViewerTitle: 'कनेक्ट करें',
    modeViewerDesc:
      'होस्ट का 6 शब्दों का पेयरिंग कोड दर्ज करें, सुरक्षा वाक्यांश सत्यापित करें और लाइव स्क्रीन देखें।',
    modeViewerCta: 'व्यूअर के रूप में कनेक्ट करें',

    // Scam warning
    scamTitle: 'स्क्रीन शेयर करने से पहले सुरक्षा चेतावनी',
    scamHeadline:
      'कभी भी किसी ऐसे व्यक्ति को एक्सेस न दें जिसने आपको बैंक, केवाईसी (KYC), या टेक सपोर्ट से होने का दावा करके कॉल किया हो।',
    scamPoint1:
      'असली बैंक, UPI ऐप, सरकारी दफ़्तर या KYC एजेंट कभी भी आपकी स्क्रीन देखने के लिए नहीं कहते।',
    scamPoint2:
      'आपकी स्क्रीन देखने वाला व्यक्ति OTP, बैंकिंग पासवर्ड, आधार/पैन और निजी संदेश पढ़ सकता है।',
    scamPoint3:
      'सभी अनुमतियाँ शुरू में बंद (OFF) रहती हैं, और आप किसी भी समय Ctrl+Shift+K दबाकर तुरंत सत्र समाप्त कर सकते हैं।',
    scamCheckbox:
      'मैं उस व्यक्ति को जानता/जानती हूँ और भरोसा करता/करती हूँ जिसे मैं स्क्रीन दिखा रहा/रही हूँ, और किसी अनजान कॉल पर यह नहीं खोला गया है।',
    scamContinue: 'मैं समझ गया/गई — पेयरिंग कोड बनाएं',
    scamCancel: 'वापस जाएं',

    // Host setup & pairing
    hostPanelTitle: 'होस्ट सत्र',
    pairingCodeLabel: 'वन-टाइम 6-शब्द पेयरिंग कोड',
    pairingCodeHint: 'यह कोड केवल भरोसेमंद व्यक्ति को दें। 5 मिनट में या पहली बार उपयोग के बाद समाप्त हो जाएगा।',
    codeExpiresIn: 'कोड समाप्ति समय',
    codeExpired: 'पेयरिंग कोड समाप्त हो गया',
    codeUsed: 'कोड उपयोग हो चुका है (केवल एक बार)',
    copyCode: 'कोड कॉपी करें',
    copied: 'कॉपी हो गया',
    regenerateCode: 'नया कोड बनाएं',
    waitingForViewer: 'व्यूअर के कोड दर्ज करने की प्रतीक्षा है...',
    signalingConnecting: 'PeerJS सिग्नलिंग से जुड़ रहा है...',
    signalingReady: 'सिग्नलिंग तैयार · पीयर की प्रतीक्षा',
    signalingError: 'सिग्नलिंग कनेक्शन त्रुटि',

    sessionDurationLabel: 'सत्र स्वतः समाप्ति समय',
    dur15m: '15 मिनट',
    dur1h: '1 घंटा',
    dur4h: '4 घंटे',

    // Approval popup
    approvalTitle: 'नया कनेक्शन अनुरोध',
    approvalBody: 'कोई व्यक्ति आपकी स्क्रीन देखना चाहता है।',
    approvalDevice: 'व्यूअर ब्राउज़र',
    approvalWarning:
      'याद रखें: बैंक, KYC या टेक सपोर्ट का दावा करने वाले किसी भी कॉलर को अनुमति न दें।',
    allowBtn: 'अनुमति दें (Allow)',
    denyBtn: 'अस्वीकार करें (Deny)',

    // SAS verification
    sasTitle: 'कनेक्शन फ़िंगरप्रिंट सत्यापन (SAS)',
    sasSubtitle:
      'कॉल या चैट पर दूसरे व्यक्ति के साथ ये 3 शब्द मिलाएं। तभी पुष्टि करें जब दोनों स्क्रीन पर बिल्कुल एक जैसे शब्द दिखें — इससे मैन-इन-द-मिडल हमले रुकते हैं।',
    sasPhraseLabel: 'सत्यापन वाक्यांश (SAS)',
    sasChecksumLabel: 'फ़िंगरप्रिंट चेकसम',
    sasDtlsBound: 'लाइव WebRTC DTLS प्रमाणपत्रों से उत्पन्न',
    sasConfirmBtn: 'शब्द मेल खाते हैं — पुष्टि करें',
    sasMismatchBtn: 'मेल नहीं खाते — तुरंत रद्द करें',
    sasWaitingOther: 'आपकी ओर से पुष्टि हो गई · दूसरे पक्ष की पुष्टि की प्रतीक्षा...',
    sasBothConfirmed: 'एंड-टू-एंड सत्यापित',

    // Host active banner & panic
    hostViewingBanner: 'आपकी स्क्रीन देखी जा रही है',
    hostSessionRemaining: 'सत्र शेष समय',
    panicButton: 'पैनिक स्टॉप',
    panicHotkeyHint: 'Ctrl+Shift+K',
    panicKilledTitle: 'सत्र तुरंत समाप्त कर दिया गया',
    panicKilledDesc:
      'सभी मीडिया ट्रैक रोक दिए गए, WebRTC कनेक्शन बंद कर दिया गया, अस्थायी सत्र कुंजियाँ नष्ट कर दी गईं और यह घटना लोकल ऑडिट लॉग में दर्ज हो गई।',
    startNewSession: 'होम पर लौटें',
    endSessionBtn: 'सत्र समाप्त करें',

    // Permissions
    permissionsTitle: 'सत्र अनुमतियाँ (Permissions)',
    permissionsSubtitle: 'प्रत्येक अनुमति शुरू में बंद (OFF) रहती है। बदलाव तुरंत लागू होते हैं।',
    permViewOnly: 'केवल स्क्रीन देखें (View-only)',
    permViewOnlyDesc: 'व्यूअर को अपनी शेयर की गई स्क्रीन का वीडियो भेजें।',
    permAudio: 'ऑडियो',
    permAudioDesc: 'शेयर किए गए टैब या सिस्टम का ऑडियो भेजें।',
    permClipboard: 'क्लिपबोर्ड टेक्स्ट',
    permClipboardDesc: 'एन्क्रिप्टेड डेटा चैनल पर सादा टेक्स्ट साझा करने दें।',
    permFileTransfer: 'फ़ाइल ट्रांसफ़र',
    permFileTransferDesc: 'एन्क्रिप्टेड P2P फ़ाइल ट्रांसफ़र की अनुमति दें (अधिकतम 10 MB)।',
    noAudioTrackHint:
      'ब्राउज़र पिकर में कोई ऑडियो ट्रैक नहीं चुना गया था। ऑडियो के साथ स्क्रीन या टैब फिर से चुनें।',
    repickScreenBtn: 'स्क्रीन / ऑडियो बदलें',
    offLabel: 'बंद',
    onLabel: 'चालू',

    // Performance & telemetry
    performanceTitle: 'स्ट्रीम प्रदर्शन और लाइव आँकड़े',
    lowBandwidthLabel: 'लो-बैंडविड्थ मोड',
    lowBandwidthDesc: 'स्ट्रीम को 720p, 10 fps और लगभग 450 kbps बिटरेट तक सीमित करता है।',
    statLatency: 'लेटेंसी (पिंग)',
    statFps: 'फ़्रेम दर (FPS)',
    statBitrate: 'बिटरेट',
    statResolution: 'रिज़ॉल्यूशन',
    statMeasuring: '—',

    // Viewer view
    viewerPanelTitle: 'होस्ट से कनेक्ट करें',
    enterCodeLabel: '6 शब्दों का पेयरिंग कोड दर्ज करें',
    enterCodePlaceholder: 'उदा. amber falcon prism lotus canyon cedar',
    connectBtn: 'कनेक्शन अनुरोध भेजें',
    connectingPeer: 'PeerJS के ज़रिए होस्ट से जुड़ रहा है...',
    waitingApproval: 'होस्ट से जुड़ा · होस्ट की अनुमति की प्रतीक्षा है...',
    invalidCodeError: 'कृपया स्पेस या हाइफ़न से अलग किए गए सभी 6 शब्द दर्ज करें।',
    rejectedDenied: 'होस्ट ने आपका कनेक्शन अनुरोध अस्वीकार कर दिया।',
    rejectedExpired: 'यह पेयरिंग कोड समाप्त हो चुका है (5 मिनट की सीमा)। होस्ट से नया कोड मांगें।',
    rejectedUsed: 'यह पेयरिंग कोड पहले ही उपयोग हो चुका है। कोड केवल एक बार काम करता है।',
    rejectedBusy: 'होस्ट के पास पहले से एक सक्रिय सत्र चल रहा है।',
    hostEndedMsg: 'होस्ट ने सत्र समाप्त कर दिया।',
    panicEndedMsg: 'होस्ट ने पैनिक स्टॉप दबाया और सत्र नष्ट कर दिया।',
    expiredEndedMsg: 'होस्ट द्वारा तय समय सीमा पूरी होने पर सत्र समाप्त हो गया।',
    sasMismatchEndedMsg: 'रद्द किया गया: सत्यापन वाक्यांश मेल नहीं खाया।',
    viewerPausedByHost: 'स्क्रीन देखना अभी बंद (OFF) है',
    viewerPausedByHostDesc:
      'होस्ट ने अभी "केवल स्क्रीन देखें" अनुमति चालू नहीं की है (सभी अनुमतियाँ शुरू में बंद रहती हैं)।',
    viewerEncryptedVerified: 'सत्यापित DTLS-SRTP पीयर-टू-पीयर सत्र',
    fullscreenBtn: 'फ़ुलस्क्रीन',
    exitFullscreenBtn: 'फ़ुलस्क्रीन बंद करें',
    disconnectBtn: 'डिस्कनेक्ट करें',

    // Clipboard & Files
    clipboardTitle: 'क्लिपबोर्ड टेक्स्ट',
    clipboardDisabled: 'होस्ट द्वारा बंद',
    clipboardPlaceholder: 'दूसरे पीयर को भेजने के लिए टेक्स्ट लिखें या पेस्ट करें...',
    clipboardPasteLocal: 'लोकल क्लिपबोर्ड पढ़ें',
    clipboardSend: 'टेक्स्ट भेजें',
    clipboardCopy: 'कॉपी करें',
    clipboardEmpty: 'इस सत्र में अभी तक कोई क्लिपबोर्ड टेक्स्ट साझा नहीं हुआ है।',

    fileTitle: 'एन्क्रिप्टेड फ़ाइल ट्रांसफ़र',
    fileDisabled: 'होस्ट द्वारा बंद',
    fileLimitNote: 'सीधा P2P डेटा चैनल · अधिकतम 10 MB · SHA-256 सत्यापित',
    fileChooseBtn: 'भेजने के लिए फ़ाइल चुनें',
    fileTooLarge: 'फ़ाइल 10 MB की सीमा से बड़ी है।',
    fileSending: 'भेजा जा रहा है',
    fileReceiving: 'प्राप्त हो रहा है',
    fileVerified: 'SHA-256 सत्यापित',
    fileTampered: 'चेकसम मेल नहीं खाया',
    fileDownload: 'डाउनलोड करें',
    fileEmpty: 'इस सत्र में अभी तक कोई फ़ाइल ट्रांसफ़र नहीं हुई है।',

    // Audit log
    auditTitle: 'छेड़छाड़-रोधी लोकल ऑडिट लॉग',
    auditSubtitle:
      'हर सत्र की घटना आपके ब्राउज़र में SHA-256 हैश चेन के रूप में स्थानीय रूप से सहेजी जाती है। हर प्रविष्टि में पिछली प्रविष्टि का हैश जुड़ा होता है।',
    auditVerifyBtn: 'लॉग अखंडता जांचें',
    auditExportBtn: 'JSON निर्यात करें',
    auditClearBtn: 'लॉग साफ़ करें',
    auditClearConfirm: 'क्या सभी स्थानीय ऑडिट लॉग प्रविष्टियाँ मिटा दें?',
    auditValidMsg: 'हैश चेन पूरी तरह सुरक्षित और अक्षुण्ण है',
    auditBrokenMsg: 'हैश चेन में छेड़छाड़ पाई गई है',
    auditEntriesCount: 'प्रविष्टियाँ',
    auditHeadHash: 'चेन हेड',
    auditEmpty: 'अभी तक कोई सुरक्षा घटना दर्ज नहीं हुई है।',
    auditColIndex: '#',
    auditColTime: 'समय',
    auditColRole: 'भूमिका',
    auditColEvent: 'घटना',
    auditColDetails: 'विवरण',
    auditColHash: 'SHA-256 हैश',

    // Limitations view
    limitsTitle: 'यह ब्राउज़र प्रोटोटाइप क्या नहीं कर सकता',
    limitsSubtitle:
      'नेटिव डेस्कटॉप ऐप (जैसे AnyDesk या RustDesk) की तुलना में शुद्ध ब्राउज़र WebRTC ऐप की ईमानदार तकनीकी और सुरक्षा सीमाएँ।',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function getTranslations(lang: Language) {
  return TRANSLATIONS[lang];
}
