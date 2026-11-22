import { useRef, useState } from 'react';
import { Clipboard, Copy, Check, Send, Upload, Download, Lock } from 'lucide-react';
import type {
  ClipboardMessage,
  Language,
  SessionPermissions,
  TransferredFile,
} from '../types/session';
import { MAX_FILE_SIZE_BYTES } from '../types/session';
import { getTranslations } from '../i18n/translations';
import { formatBytes } from '../utils/webrtc';

interface DataChannelToolsProps {
  lang: Language;
  role: 'host' | 'viewer';
  permissions: SessionPermissions;
  clipboardHistory: ClipboardMessage[];
  onSendClipboard: (text: string) => void;
  files: TransferredFile[];
  fileTransferProgress: { name: string; percent: number; direction: 'sending' | 'receiving' } | null;
  fileError: string | null;
  onSendFile: (file: File) => void;
}

/**
 * Shared encrypted WebRTC DataChannel panels for Clipboard Text and File Transfer.
 * Strictly gated by Host per-session permissions (both OFF by default).
 */
export function DataChannelTools({
  lang,
  role,
  permissions,
  clipboardHistory,
  onSendClipboard,
  files,
  fileTransferProgress,
  fileError,
  onSendFile,
}: DataChannelToolsProps) {
  const t = getTranslations(lang);
  const [draftText, setDraftText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setDraftText(text);
    } catch {
      // Browser clipboard read permission may require manual paste
    }
  };

  const handleCopyItem = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Fallback ignored gracefully
    }
  };

  const handleSubmitClipboard = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed || !permissions.clipboard) return;
    onSendClipboard(trimmed);
    setDraftText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setLocalError(t.fileTooLarge);
      return;
    }
    onSendFile(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Clipboard Text Panel */}
      <section className="rounded-xl bg-[#121824] border border-slate-800 p-5 flex flex-col">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Clipboard className="w-4 h-4 text-slate-400" />
            <span>{t.clipboardTitle}</span>
          </div>
          <span
            className={`text-xs font-mono ${
              permissions.clipboard ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {permissions.clipboard ? t.onLabel : t.clipboardDisabled}
          </span>
        </div>

        {!permissions.clipboard ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            <span>{t.clipboardDisabled}</span>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmitClipboard} className="mt-4 space-y-2.5">
              <textarea
                rows={2}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={t.clipboardPlaceholder}
                className="w-full rounded-lg bg-[#0B0F17] border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none resize-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {t.clipboardPasteLocal}
                </button>
                <button
                  type="submit"
                  disabled={!draftText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  {t.clipboardSend}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5 max-h-48 overflow-y-auto">
              {clipboardHistory.length === 0 ? (
                <p className="text-xs text-slate-500">{t.clipboardEmpty}</p>
              ) : (
                clipboardHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800/80 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.sender === role ? 'You' : item.sender.toUpperCase()} ·{' '}
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                      <p className="mt-1 text-xs text-slate-200 break-words whitespace-pre-wrap font-mono">
                        {item.text}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyItem(item.id, item.text)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
                      title={t.clipboardCopy}
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* File Transfer Panel */}
      <section className="rounded-xl bg-[#121824] border border-slate-800 p-5 flex flex-col">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Upload className="w-4 h-4 text-slate-400" />
            <span>{t.fileTitle}</span>
          </div>
          <span
            className={`text-xs font-mono ${
              permissions.fileTransfer ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {permissions.fileTransfer ? t.onLabel : t.fileDisabled}
          </span>
        </div>

        {!permissions.fileTransfer ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-sm text-slate-400 gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            <span>{t.fileDisabled}</span>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">{t.fileLimitNote}</p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={Boolean(fileTransferProgress)}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                {t.fileChooseBtn}
              </button>
            </div>

            {(localError || fileError) && (
              <p className="mt-3 text-xs text-red-400">{localError || fileError}</p>
            )}

            {fileTransferProgress && (
              <div className="mt-3 p-3 rounded-lg bg-[#0B0F17] border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate max-w-[70%]">
                    {fileTransferProgress.direction === 'sending' ? t.fileSending : t.fileReceiving}:{' '}
                    {fileTransferProgress.name}
                  </span>
                  <span className="font-mono tabular-nums">{fileTransferProgress.percent}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150"
                    style={{ width: `${fileTransferProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5 max-h-48 overflow-y-auto">
              {files.length === 0 ? (
                <p className="text-xs text-slate-500">{t.fileEmpty}</p>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800/80 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {file.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 font-mono tabular-nums">
                        {formatBytes(file.size)} · {file.direction.toUpperCase()} ·{' '}
                        <span className={file.verified ? 'text-emerald-400' : 'text-red-400'}>
                          {file.verified ? t.fileVerified : t.fileTampered}
                        </span>
                      </div>
                    </div>
                    {file.downloadUrl && (
                      <a
                        href={file.downloadUrl}
                        download={file.name}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t.fileDownload}
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
