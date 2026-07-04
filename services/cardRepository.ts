import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  CollectionCard,
  addToCollection,
  deleteFromCollection,
  getCollection,
  saveCollection,
  updateCard as updateLocalCard,
} from "@/services/collectionStore";
import { uploadCardImage } from "@/services/imageStorage";

export type RepositoryResult<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
  source?: "cloud" | "local";
};

export function canUseCloud() {
  return Boolean(isSupabaseConfigured && supabase);
}

export async function getCurrentUser() {
  if (!canUseCloud() || !supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export function rowToCard(row: any): CollectionCard {
  return {
    id: row.id,
    image: row.image || undefined,
    backImage: row.back_image || undefined,
    player: row.player || undefined,
    team: row.team || undefined,
    manufacturer: row.manufacturer || undefined,
    league: row.league || undefined,
    country: row.country || undefined,
    set: row.set_name || undefined,
    year: row.year || undefined,
    parallel: row.parallel || undefined,
    serialNumber: row.serial_number || undefined,
    cardNumber: row.card_number || undefined,
    grade: row.grade || undefined,
    condition: row.condition || undefined,
    notes: row.notes || undefined,
    purchasePrice: Number(row.purchase_price || 0),
    estimatedValue: Number(row.estimated_value || 0),
    confidence: Number(row.confidence || 0),
    source: row.source || "manual",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
  };
}

export function cardToRow(card: CollectionCard, userId: string, imageUrl?: string) {
  return {
    id: card.id,
    user_id: userId,
    image: imageUrl || card.image || null,
    back_image: card.backImage || null,
    player: card.player || null,
    team: card.team || null,
    manufacturer: card.manufacturer || null,
    league: card.league || null,
    country: card.country || null,
    set_name: card.set || null,
    year: card.year || null,
    parallel: card.parallel || null,
    serial_number: card.serialNumber || null,
    card_number: card.cardNumber || null,
    grade: card.grade || null,
    condition: card.condition || null,
    notes: card.notes || null,
    purchase_price: Number(card.purchasePrice || 0),
    estimated_value: Number(card.estimatedValue || 0),
    confidence: Number(card.confidence || 0),
    source: card.source || "manual",
    created_at: card.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function listCards(): Promise<RepositoryResult<CollectionCard[]>> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    return { ok: true, data: getCollection(), source: "local", message: "Using local cards." };
  }

  const { data, error } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, data: getCollection(), source: "local", message: error.message };
  }

  const cards = (data || []).map(rowToCard);
  saveCollection(cards);
  return { ok: true, data: cards, source: "cloud", message: "Cloud collection loaded." };
}

export async function getCard(id: string): Promise<RepositoryResult<CollectionCard | null>> {
  const user = await getCurrentUser();

  if (!user || !supabase) {
    return { ok: true, data: getCollection().find((card) => card.id === id) || null, source: "local" };
  }

  const { data, error } = await supabase
    .from("collection_cards")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, data: null, source: "cloud", message: error.message };
  return { ok: true, data: data ? rowToCard(data) : null, source: "cloud" };
}

export async function saveCard(card: CollectionCard): Promise<RepositoryResult<CollectionCard>> {
  const prepared: CollectionCard = {
    ...card,
    id: card.id || crypto.randomUUID(),
    createdAt: card.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const user = await getCurrentUser();

  if (!user || !supabase) {
    addToCollection(prepared);
    return { ok: true, data: prepared, source: "local", message: "Saved locally. Log in to save to cloud." };
  }

  const imageUpload = await uploadCardImage(user.id, prepared.id, prepared.image);
  const row = cardToRow(prepared, user.id, imageUpload.publicUrl);

  const { error } = await supabase.from("collection_cards").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, data: prepared, source: "cloud", message: error.message };

  const savedCard = { ...prepared, image: imageUpload.publicUrl || prepared.image };
  const local = getCollection().filter((item) => item.id !== savedCard.id);
  saveCollection([savedCard, ...local]);

  return { ok: true, data: savedCard, source: "cloud", message: "Saved to cloud collection." };
}

export async function updateCard(id: string, updates: Partial<CollectionCard>): Promise<RepositoryResult<CollectionCard | null>> {
  const current = (await getCard(id)).data;
  if (!current) return { ok: false, data: null, message: "Card not found." };

  const next: CollectionCard = { ...current, ...updates, updatedAt: new Date().toISOString() };
  const user = await getCurrentUser();

  updateLocalCard(id, next);

  if (!user || !supabase) {
    return { ok: true, data: next, source: "local", message: "Updated locally." };
  }

  const imageUpload = await uploadCardImage(user.id, next.id, next.image);
  const { error } = await supabase
    .from("collection_cards")
    .update(cardToRow(next, user.id, imageUpload.publicUrl))
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, data: next, source: "cloud", message: error.message };
  return { ok: true, data: { ...next, image: imageUpload.publicUrl || next.image }, source: "cloud", message: "Updated in cloud." };
}

export async function deleteCard(id: string): Promise<RepositoryResult> {
  deleteFromCollection(id);

  const user = await getCurrentUser();
  if (!user || !supabase) return { ok: true, source: "local", message: "Deleted locally." };

  const { error } = await supabase.from("collection_cards").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, source: "cloud", message: error.message };
  return { ok: true, source: "cloud", message: "Deleted from cloud." };
}

export async function pushLocalToCloud(): Promise<RepositoryResult<number>> {
  const user = await getCurrentUser();
  if (!user || !supabase) return { ok: false, data: 0, message: "Please sign in before syncing." };

  const cards = getCollection();
  if (!cards.length) return { ok: true, data: 0, source: "cloud", message: "No local cards to upload." };

  const rows = [];
  for (const card of cards) {
    const imageUpload = await uploadCardImage(user.id, card.id, card.image);
    rows.push(cardToRow(card, user.id, imageUpload.publicUrl));
  }

  const { error } = await supabase.from("collection_cards").upsert(rows, { onConflict: "id" });
  if (error) return { ok: false, data: 0, source: "cloud", message: error.message };

  return { ok: true, data: rows.length, source: "cloud", message: `Uploaded ${rows.length} cards to cloud.` };
}
