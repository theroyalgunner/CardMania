"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { exportCollection, importCollection } from "@/services/collectionStore";
import { CardManiaSettings, getSettings, saveSettings } from "@/services/settingsStore";

export default function SettingsPage() {
  const [settings, setSettings] = useState<CardManiaSettings | null>(null);
  const [backup, setBackup] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => setSettings(getSettings()), []);

  function update(next: CardManiaSettings) {
    setSettings(next);
    saveSettings(next);
    setStatus("Settings saved.");
  }

  function makeBackup() {
    setBackup(exportCollection());
    setStatus("Collection export generated below.");
  }

  function importBackup() {
    try {
      importCollection(backup);
      setStatus("Collection imported. Refresh Collection page to confirm.");
    } catch {
      setStatus("Import failed. Check the JSON format.");
    }
  }

  function clearLocalData() {
    if (!confirm("Clear local CardMania collection and wishlist data?")) return;
    localStorage.removeItem("cardmania_collection");
    localStorage.removeItem("cardmania_wishlist");
    setStatus("Local collection and wishlist cleared.");
  }

  if (!settings) return null;

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">CardMania V9.1</p>
      <h1 className="text-3xl font-black">Settings</h1>
      <p className="mt-1 text-sm text-cm-muted">Control currency, AI output, backups, and local data.</p>

      {status && <div className="mt-5 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-green">{status}</div>}

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Preferences</h2>
        <label className="mt-4 block text-xs text-cm-muted">
          Currency
          <select
            value={settings.currency}
            onChange={(e) => update({ ...settings, currency: e.target.value as CardManiaSettings["currency"] })}
            className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
          >
            <option value="GBP">GBP (£)</option>
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="SAR">SAR</option>
          </select>
        </label>

        <label className="mt-4 flex items-center justify-between rounded-2xl border border-cm-line bg-black/20 p-3 text-sm">
          Show raw AI output
          <input
            type="checkbox"
            checked={settings.showAiRawOutput}
            onChange={(e) => update({ ...settings, showAiRawOutput: e.target.checked })}
          />
        </label>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Backup / Import</h2>
        <p className="mt-1 text-sm text-cm-muted">Export local cards as JSON before replacing versions.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={makeBackup} className="rounded-2xl bg-cm-purple py-3 font-black">Export</button>
          <button onClick={importBackup} className="rounded-2xl bg-white/10 py-3 font-black">Import</button>
        </div>
        <textarea
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
          placeholder="Export appears here. Paste backup JSON here to import."
          className="mt-4 h-48 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-xs outline-none"
        />
      </section>

      <section className="mt-5 rounded-[28px] border border-red-500/40 bg-red-500/10 p-4">
        <h2 className="text-lg font-black text-red-200">Danger Zone</h2>
        <button onClick={clearLocalData} className="mt-4 w-full rounded-2xl border border-red-500/50 py-3 font-black text-red-200">
          Clear Local Data
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
