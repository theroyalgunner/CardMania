import { BottomNav } from "@/components/BottomNav";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SetupPage() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">Production setup</p>
      <h1 className="text-3xl font-black">CardMania V9.1 Setup</h1>
      <p className="mt-2 text-sm text-cm-muted">
        Use this checklist before deployment or cloud sync.
      </p>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <h2 className="text-lg font-black">Environment</h2>
        <div className="mt-4 rounded-2xl bg-black/30 p-4">
          <p className="text-xs text-cm-muted">Supabase status</p>
          <p className={isSupabaseConfigured ? "mt-1 font-black text-cm-green" : "mt-1 font-black text-yellow-300"}>
            {isSupabaseConfigured ? "Configured" : "Missing .env.local keys"}
          </p>
        </div>
      </section>

      <section className="mt-5 space-y-3 rounded-[28px] border border-cm-line bg-cm-surface p-5 text-sm text-cm-muted">
        <h2 className="text-lg font-black text-white">Launch checklist</h2>
        <p>1. Copy <b>.env.example</b> to <b>.env.local</b>.</p>
        <p>2. Paste Supabase URL and anon key.</p>
        <p>3. Run <b>supabase/schema.sql</b> in Supabase SQL Editor.</p>
        <p>4. Create or confirm the <b>card-images</b> storage bucket.</p>
        <p>5. Test sign up / login.</p>
        <p>6. Add one card locally, then upload to cloud from Sync.</p>
        <p>7. Run <b>npm run build</b> before deploying.</p>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <h2 className="text-lg font-black">Vercel variables</h2>
        <pre className="mt-3 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-cm-muted">
{`NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
GEMINI_API_KEY
NEXT_PUBLIC_APP_URL`}
        </pre>
      </section>

      <BottomNav />
    </main>
  );
}
