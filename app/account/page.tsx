import { BottomNav } from "@/components/BottomNav";
import { isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <h1 className="mb-5 text-3xl font-black">Account</h1>

      <section className="rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <p className="text-cm-muted">Supabase status</p>
        <h2 className={isSupabaseConfigured ? "text-cm-green text-xl font-black" : "text-yellow-400 text-xl font-black"}>
          {isSupabaseConfigured ? "Connected" : "Demo Mode"}
        </h2>
        <p className="mt-3 text-sm text-cm-muted">
          V3 adds cloud sync. Add your Supabase keys, log in, then use Cloud Sync to upload or download your collection.
        </p>
      </section>

      <section className="mt-5 grid gap-3">
        <Link href="/login" className="rounded-2xl bg-cm-purple py-3 text-center font-black">
          Login / Create Account
        </Link>
        <Link href="/sync" className="rounded-2xl border border-cm-line bg-cm-surface py-3 text-center font-black">
          Cloud Sync
        </Link>
      </section>

      <BottomNav />
    </main>
  );
}
