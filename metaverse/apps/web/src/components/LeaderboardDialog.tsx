import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { LeaderboardEntry, LeaderboardPeriod } from "../lib/api";
import { formatDuration } from "../lib/format";
import {
  button,
  cx,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  mutedClass,
} from "../lib/ui";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "all", label: "all time" },
  { key: "daily", label: "today" },
  { key: "weekly", label: "week" },
  { key: "monthly", label: "month" },
];

export default function LeaderboardDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let stale = false;
    setEntries(null);
    api.study
      .leaderboard(period)
      .then((res) => !stale && setEntries(res.entries))
      .catch(() => !stale && setEntries([]));
    return () => {
      stale = true;
    };
  }, [period]);

  return (
    <div className={modalBackdropClass} onClick={onClose}>
      <div
        className={modalPanelClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
      >
        <h2
          id="leaderboard-title"
          className="font-pixel text-[0.95rem] text-coin"
        >
          ranking board
        </h2>
        <p className={`${mutedClass} mt-1`}>
          Total study time across every room.
        </p>

        <div className="my-4 flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={cx(
                "min-h-9 shrink-0 rounded-md border border-line-strong bg-transparent px-3 py-1.5 font-pixel text-[0.62rem] text-fog transition-colors hover:border-fog focus-visible:outline-2 focus-visible:outline-portal",
                period === p.key && "border-coin-deep bg-dusk-raised text-coin",
              )}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {entries === null ? (
          <p className={mutedClass}>Loading...</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-fog">
            No study sessions yet. Start the timer and claim the top spot.
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-2 py-2 text-left font-mono text-xs font-medium text-fog">
                    #
                  </th>
                  <th className="px-2 py-2" aria-label="Avatar" />
                  <th className="px-2 py-2 text-left font-mono text-xs font-medium text-fog">
                    scholar
                  </th>
                  <th className="px-2 py-2 text-right font-mono text-xs font-medium text-fog">
                    time
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.userId} className="border-b border-line">
                    <td className="px-2 py-2 font-mono">{entry.rank}</td>
                    <td className="px-2 py-2">
                      {entry.avatarUrl && (
                        <img
                          src={entry.avatarUrl}
                          alt=""
                          className="block h-[30px] w-auto pixelated"
                        />
                      )}
                    </td>
                    <td className="max-w-48 truncate px-2 py-2">
                      {entry.username}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-mono">
                      {formatDuration(entry.totalSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={modalActionsClass}>
          <button className={button.primary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
