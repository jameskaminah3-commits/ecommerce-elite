import { useSyncExternalStore } from 'react';

// ── Photo preparation ─────────────────────────────────────────────────────
// Phone cameras produce 4–15 MB photos (often 4000px+). Uploaded as-is they can
// exceed the server limit, and they load painfully slowly for shoppers on mobile
// data. So before uploading we shrink the long edge to 1600px and re-encode as
// WebP (JPEG where WebP isn't supported) — typically 150–400 KB, visually identical.

const MAX_EDGE = 1600;
const QUALITY = 0.85;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // imageOrientation keeps phone photos the right way up.
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Returns a smaller web-ready copy of a photo, or the original if it can't (or needn't) be improved. */
export async function preparePhoto(file: File): Promise<File> {
  const type = (file.type || '').toLowerCase();
  // Animations and vector art must keep their format.
  if (type === 'image/gif' || type === 'image/svg+xml' || /\.(gif|svg)$/i.test(file.name)) return file;
  try {
    const img = await decode(file);
    const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
    const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    // Already small and light: keep the original.
    if (scale === 1 && file.size <= 400 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    if ('close' in img) (img as ImageBitmap).close();
    let blob = await canvasToBlob(canvas, 'image/webp', QUALITY);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', QUALITY);
      ext = 'jpg';
    }
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    // e.g. HEIC on a browser that can't decode it — the server will explain.
    return file;
  }
}

// ── Uploads in progress ───────────────────────────────────────────────────
// Lets a form's Save button wait for photos still uploading, so a product is
// never saved without the picture the admin just chose.
let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function trackUpload<T>(p: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return p.finally(() => {
    pending -= 1;
    emit();
  });
}

export function useUploadsPending(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
    () => 0,
  );
}
