import { supabase } from "@/lib/supabase";

export type ImageUploadResult = {
  ok: boolean;
  publicUrl?: string;
  path?: string;
  message?: string;
};

function isBase64Image(value?: string | null) {
  return Boolean(value && value.startsWith("data:image/"));
}

function base64ToFile(dataUrl: string, fileName: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || "image/jpeg";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

export async function uploadCardImage(userId: string, cardId: string, dataUrl?: string | null): Promise<ImageUploadResult> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  if (!isBase64Image(dataUrl)) return { ok: true, publicUrl: dataUrl || undefined };

  const extension = dataUrl?.includes("image/png") ? "png" : dataUrl?.includes("image/webp") ? "webp" : "jpg";
  const path = `${userId}/${cardId}/front.${extension}`;
  const file = base64ToFile(dataUrl!, `card-${cardId}.${extension}`);

  const { error } = await supabase.storage.from("card-images").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) return { ok: false, message: error.message };

  const { data } = supabase.storage.from("card-images").getPublicUrl(path);
  return { ok: true, path, publicUrl: data.publicUrl };
}
