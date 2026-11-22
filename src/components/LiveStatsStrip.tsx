import type { Language, LiveStats } from '../types/session';
import { getTranslations } from '../i18n/translations';

interface LiveStatsStripProps {
  lang: Language;
  stats: LiveStats;
}

/**
 * Clean 4-column tabular telemetry bar displaying live WebRTC latency, FPS,
 * bitrate, and video resolution polled from RTCPeerConnection.getStats().
 */
export function LiveStatsStrip({ lang, stats }: LiveStatsStripProps) {
  const t = getTranslations(lang);

  const formattedBitrate =
    stats.bitrateKbps === null
      ? t.statMeasuring
      : stats.bitrateKbps >= 1000
        ? `${(stats.bitrateKbps / 1000).toFixed(2)} Mbps`
        : `${stats.bitrateKbps} kbps`;

  const items = [
    {
      label: t.statLatency,
      value: stats.latencyMs !== null ? `${stats.latencyMs} ms` : t.statMeasuring,
    },
    {
      label: t.statFps,
      value: stats.fps !== null ? `${stats.fps} fps` : t.statMeasuring,
    },
    {
      label: t.statBitrate,
      value: formattedBitrate,
    },
    {
      label: t.statResolution,
      value: stats.resolution ?? t.statMeasuring,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 rounded-lg bg-[#0B0F17] border border-slate-800">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3">
          <div className="text-xs text-slate-400">{item.label}</div>
          <div className="mt-1 text-base font-mono font-semibold text-slate-100 tabular-nums">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
