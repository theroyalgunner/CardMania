import { listCards, pushLocalToCloud } from "@/services/cardRepository";
import { saveCollection } from "@/services/collectionStore";

export type SyncResult = {
  ok: boolean;
  message: string;
  count?: number;
};

export { canUseCloud, getCurrentUser } from "@/services/cardRepository";

export async function pushLocalCollectionToCloud(): Promise<SyncResult> {
  const result = await pushLocalToCloud();
  return { ok: result.ok, message: result.message || "Sync finished.", count: result.data || 0 };
}

export async function pullCloudCollectionToLocal(): Promise<SyncResult> {
  const result = await listCards();
  if (!result.ok) return { ok: false, message: result.message || "Cloud download failed." };
  saveCollection(result.data || []);
  return { ok: true, message: "Cloud collection loaded locally.", count: result.data?.length || 0 };
}
