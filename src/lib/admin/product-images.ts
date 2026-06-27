import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";

// Product image storage helpers — service-role only. Uploads go to the public
// `product-images` bucket so the marketing catalog can display photos without
// auth, but the write itself always happens here on the server with the
// service-role key. The browser anon key is never trusted to write to Storage.

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Map of accepted MIME types to file extensions. HEIC (common on iPhones) is
// intentionally absent — browsers can't reliably display it — so it falls into
// the "unsupported type" message below.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function uploadProductImage(file: File): Promise<UploadResult> {
  const admin = getAdminClient();
  if (!admin) return { ok: false, message: "Supabase is not configured." };

  if (!file || file.size === 0) return { ok: false, message: "No file selected." };
  if (file.size > MAX_BYTES)
    return { ok: false, message: "Image is too large. Maximum size is 5 MB." };

  const ext = ALLOWED[file.type];
  if (!ext)
    return {
      ok: false,
      message: "Unsupported image type. Please use a JPG, PNG, or WebP file.",
    };

  // UUID filename, decoupled from the product id so uploads work during create
  // (before any row exists). Each upload is a fresh object; replacements clean
  // up the old one via deleteProductImageByUrl().
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[admin] product image upload failed:", error.message);
    return { ok: false, message: "Could not upload the image. Please try again." };
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

// Best-effort delete of a previously uploaded image, given its public URL. Used
// when an image is replaced or removed. Failures are logged, never thrown, so
// a storage hiccup can't block a product save or leave the row inconsistent.
export async function deleteProductImageByUrl(url: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin || !url) return;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // not one of our storage URLs — leave it alone

  const path = url.slice(idx + marker.length);
  if (!path) return;

  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("[admin] product image delete failed:", error.message);
  }
}
