export type WishlistItem = {
  id: string;
  name: string;
  player?: string;
  team?: string;
  set?: string;
  parallel?: string;
  targetPrice: number;
  currentPrice: number;
  priority: "Low" | "Medium" | "High";
  notes?: string;
  createdAt: string;
};

const KEY = "cardmania_wishlist";

function safeParse(value: string | null): WishlistItem[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(KEY));
}

export function saveWishlist(items: WishlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addWishlistItem(item: WishlistItem) {
  saveWishlist([item, ...getWishlist()]);
}

export function deleteWishlistItem(id: string) {
  saveWishlist(getWishlist().filter((item) => item.id !== id));
}

export function updateWishlistItem(id: string, updates: Partial<WishlistItem>) {
  const updated = getWishlist().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  saveWishlist(updated);
  return updated.find((item) => item.id === id) || null;
}

export function wishlistStats(items = getWishlist()) {
  const targetValue = items.reduce((sum, item) => sum + Number(item.targetPrice || 0), 0);
  const currentValue = items.reduce((sum, item) => sum + Number(item.currentPrice || 0), 0);
  const bargains = items.filter((item) => item.currentPrice > 0 && item.currentPrice <= item.targetPrice);
  return { total: items.length, targetValue, currentValue, bargains: bargains.length };
}
