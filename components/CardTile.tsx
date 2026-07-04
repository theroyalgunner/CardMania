import Link from "next/link";

export function CardTile({ card }: { card: any }) {
  return (
    <Link href={`/collection?card=${card.cmid}`} className="min-w-[210px] rounded-[26px] border border-cm-line bg-cm-surface p-4 shadow-card">
      <div className="flex h-32 items-center justify-center rounded-[20px] bg-gradient-to-br from-violet-600/40 to-white/5 text-4xl font-black">
        {card.player.split(" ").map((p: string) => p[0]).join("")}
      </div>
      <h3 className="mt-3 font-black">{card.player}</h3>
      <p className="text-sm text-cm-muted">{card.title}</p>
      <div className="mt-3 flex justify-between">
        <b>£{card.price}</b>
        <span className="text-cm-green">+{card.trend}%</span>
      </div>
    </Link>
  );
}
