import { PortfolioHistoryPoint } from "@/services/portfolioHistoryStore";

function money(value: number) {
  return `£${Math.round(value).toLocaleString()}`;
}

export function PortfolioHistoryChart({ points }: { points: PortfolioHistoryPoint[] }) {
  const ordered = [...points].reverse().slice(-14);
  const max = Math.max(...ordered.map((point) => point.value), 1);

  return (
    <section className="rounded-[28px] border border-cm-line bg-cm-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Value History</h2>
          <p className="mt-1 text-sm text-cm-muted">Last {ordered.length || 0} saved portfolio snapshots</p>
        </div>
        {points[0] && <div className="text-right text-sm font-black">{money(points[0].value)}</div>}
      </div>

      {ordered.length < 2 ? (
        <p className="mt-4 text-sm text-cm-muted">Portfolio history will appear after more daily snapshots.</p>
      ) : (
        <div className="mt-5 flex h-40 items-end gap-2 rounded-2xl border border-cm-line bg-black/20 p-3">
          {ordered.map((point) => {
            const height = Math.max(8, Math.round((point.value / max) * 100));
            return (
              <div key={point.createdAt} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div title={`${new Date(point.createdAt).toLocaleDateString()} • ${money(point.value)}`} className="w-full rounded-t-xl bg-cm-purple" style={{ height: `${height}%` }} />
                <span className="truncate text-[10px] text-cm-muted">{new Date(point.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
