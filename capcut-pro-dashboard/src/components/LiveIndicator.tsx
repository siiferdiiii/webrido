"use client";

import { RefreshCw } from "lucide-react";

interface LiveIndicatorProps {
  secondsAgo: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  intervalLabel?: string; // e.g. "15 dtk"
}

export default function LiveIndicator({
  secondsAgo,
  isRefreshing,
  onRefresh,
  intervalLabel = "15 dtk",
}: LiveIndicatorProps) {
  const label =
    secondsAgo === 0
      ? "Baru saja"
      : secondsAgo < 60
      ? `${secondsAgo} dtk lalu`
      : `${Math.floor(secondsAgo / 60)} mnt lalu`;

  return (
    <div className="flex items-center gap-2">
      {/* Live dot */}
      <span className="relative flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: "#22c55e",
            boxShadow: "0 0 0 0 rgba(34,197,94,0.6)",
            animation: isRefreshing ? "none" : "live-pulse 2s infinite",
          }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: "#22c55e" }}
        >
          Live
        </span>
      </span>

      {/* Last updated */}
      <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
        · diperbarui {label}
      </span>

      {/* Manual refresh button */}
      <button
        onClick={onRefresh}
        title={`Auto-refresh setiap ${intervalLabel}`}
        className="flex items-center justify-center w-6 h-6 rounded-lg transition-all hover:bg-[rgba(99,102,241,0.15)] text-[var(--text-muted)] hover:text-white"
        style={{ flexShrink: 0 }}
      >
        <RefreshCw
          size={12}
          className={isRefreshing ? "animate-spin text-[#818cf8]" : ""}
        />
      </button>
    </div>
  );
}
