import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { LeaderboardEntry, LeaderboardPeriod } from "../lib/api";
import { formatDuration } from "../lib/format";

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal board" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: "0.95rem", color: "var(--coin)" }}>
          ranking board
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Total study time across every room.
        </p>

        <div className="board-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={period === p.key ? "active" : ""}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {entries === null ? (
          <p className="muted">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="empty">
            No study sessions yet. Start the timer and claim the top spot.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>scholar</th>
                <th style={{ textAlign: "right" }}>time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.userId}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {entry.rank}
                  </td>
                  <td>
                    {entry.avatarUrl && (
                      <img src={entry.avatarUrl} alt="" className="pixel" />
                    )}
                  </td>
                  <td>{entry.username}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {formatDuration(entry.totalSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
