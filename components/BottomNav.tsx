import Link from "next/link";
import { Award, Bot, Camera, Cloud, Heart, Home, Layers, LineChart, PieChart, Rocket, Settings, User } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/collection", label: "Cards", icon: Layers },
  { href: "/scanner", label: "Scan", icon: Camera },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/market", label: "Market", icon: LineChart },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/assistant", label: "AI", icon: Bot },
  { href: "/grading", label: "Grade", icon: Award },
  { href: "/sync", label: "Sync", icon: Cloud },
  { href: "/setup", label: "Setup", icon: Rocket },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex w-[96%] max-w-4xl -translate-x-1/2 justify-around overflow-x-auto rounded-[28px] border border-cm-line bg-cm-surface/95 p-3 shadow-card backdrop-blur">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex min-w-[52px] flex-col items-center gap-1 text-[8px] text-cm-muted hover:text-white">
          <Icon size={18} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
