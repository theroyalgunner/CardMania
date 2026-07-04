import { BreakdownItem, PortfolioInsight } from "@/services/portfolioInsights";

export function BreakdownBars({ title, items }: { title: string; items: BreakdownItem[] }) {
  return (
    <section className="rounded-[28px] border border-cm-line bg-cm-surface p-4">
      <h2 className="text-lg font-black">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-cm-muted">No data yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold">{item.label}</span>
                <span className="text-cm-muted">{item.count} • £{Math.round(item.value).toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full bg-black/40">
                <div className="h-3 rounded-full bg-cm-purple" style={{ width: `${Math.max(item.percent, item.value > 0 ? 4 : 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function InsightCards({ insights }: { insights: PortfolioInsight[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {insights.map((insight) => (
        <div
          key={insight.title}
          className={
            insight.tone === "good"
              ? "rounded-[24px] border border-green-500/30 bg-green-500/10 p-4"
              : insight.tone === "warning"
                ? "rounded-[24px] border border-yellow-500/30 bg-yellow-500/10 p-4"
                : "rounded-[24px] border border-cm-line bg-cm-surface p-4"
          }
        >
          <h3 className="font-black">{insight.title}</h3>
          <p className="mt-1 text-sm text-cm-muted">{insight.detail}</p>
        </div>
      ))}
    </section>
  );
}
