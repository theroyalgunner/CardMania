"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  getCurrentUser,
  pullCloudCollectionToLocal,
  pushLocalCollectionToCloud,
  SyncResult,
} from "@/services/cloudCollection";
import { getCollection } from "@/services/collectionStore";

export default function SyncPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLocalCount(getCollection().length);
    const user = await getCurrentUser();
    setUserEmail(user?.email || null);
  }

  useEffect(() => {
    load();
  }, []);

  async function runSync(action: "push" | "pull") {
    setLoading(true);
    setMessage("");
    const result: SyncResult =
      action === "push"
        ? await pushLocalCollectionToCloud()
        : await pullCloudCollectionToLocal();
    setMessage(`${result.ok ? "✅" : "⚠️"} ${result.message}${typeof result.count === "number" ? ` (${result.count})` : ""}`);
    await load();
    setLoading(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUserEmail(null);
    setMessage("Signed out.");
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <h1 className="text-3xl font-black">Cloud Sync</h1>
      <p className="mt-1 text-sm text-cm-muted">
        Sync your local CardMania collection with Supabase.
      </p>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Supabase</p>
          <div className={isSupabaseConfigured ? "mt-1 text-xl font-black text-cm-green" : "mt-1 text-xl font-black text-yellow-300"}>
            {isSupabaseConfigured ? "Configured" : "Missing Keys"}
          </div>
        </div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Local Cards</p>
          <div className="mt-1 text-3xl font-black">{localCount}</div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <p className="text-sm text-cm-muted">Account</p>
        <h2 className="mt-1 text-xl font-black">{userEmail || "Not logged in"}</h2>

        {!userEmail ? (
          <Link href="/login" className="mt-4 block rounded-2xl bg-cm-purple py-3 text-center font-black">
            Login / Create Account
          </Link>
        ) : (
          <button onClick={signOut} className="mt-4 w-full rounded-2xl border border-cm-line py-3 font-black">
            Sign Out
          </button>
        )}
      </section>

      <section className="mt-5 space-y-3 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <button
          disabled={loading || !userEmail}
          onClick={() => runSync("push")}
          className="w-full rounded-2xl bg-cm-purple py-3 font-black disabled:opacity-50"
        >
          {loading ? "Syncing..." : "Upload Local Collection to Cloud"}
        </button>

        <button
          disabled={loading || !userEmail}
          onClick={() => runSync("pull")}
          className="w-full rounded-2xl border border-cm-line py-3 font-black disabled:opacity-50"
        >
          Download Cloud Collection to This Device
        </button>

        {message && <p className="text-sm text-cm-muted">{message}</p>}
      </section>

      <div className="mt-5 rounded-[24px] border border-cm-line bg-black/30 p-4 text-sm text-cm-muted">
        Tip: upload first if this Mac has your newest cards. Download only when you want to replace local cards with the cloud version.
      </div>

      <BottomNav />
    </main>
  );
}
