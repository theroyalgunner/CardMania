"use client";
import { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { BottomNav } from "@/components/BottomNav";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signUp() {
    if (!isSupabaseConfigured || !supabase) return setMessage("Supabase not configured yet. Add .env.local first.");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Check your email to confirm signup.");
  }

  async function signIn() {
    if (!isSupabaseConfigured || !supabase) return setMessage("Supabase not configured yet. Add .env.local first.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Logged in.");
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <h1 className="mb-5 text-3xl font-black">Login</h1>
      <div className="space-y-3 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <input className="w-full rounded-2xl bg-black/30 p-4 outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full rounded-2xl bg-black/30 p-4 outline-none" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={signIn} className="w-full rounded-2xl bg-cm-purple py-3 font-black">Sign In</button>
        <button onClick={signUp} className="w-full rounded-2xl border border-cm-line py-3 font-black">Create Account</button>
        {message && <p className="text-sm text-cm-muted">{message}</p>}
      </div>
      <BottomNav />
    </main>
  );
}
