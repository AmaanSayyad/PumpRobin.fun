/** Normalize phone / browser image uploads for IPFS (JPEG/HEIC/etc.). */

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB — iPhone photos

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

/** MIME types we accept before optional HEIC→JPEG conversion. */
export const ACCEPTED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function sniffMagic(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF: ftyp....heic|heif|mif1|msf1
  if (buf.length >= 12) {
    const brand = String.fromCharCode(
      buf[8] ?? 0,
      buf[9] ?? 0,
      buf[10] ?? 0,
      buf[11] ?? 0
    ).toLowerCase();
    if (
      brand === "heic" ||
      brand === "heif" ||
      brand === "mif1" ||
      brand === "msf1" ||
      brand === "hevc"
    ) {
      return "image/heic";
    }
  }
  return null;
}

export function resolveImageMime(
  file: { type?: string; name?: string },
  bytes?: Uint8Array
): string | null {
  const raw = (file.type || "").toLowerCase().trim();
  if (raw && ACCEPTED_IMAGE_MIMES.has(raw)) {
    return raw === "image/jpg" || raw === "image/pjpeg" ? "image/jpeg" : raw;
  }

  const fromExt = EXT_MIME[extOf(file.name || "")];
  if (fromExt) return fromExt;

  if (bytes) {
    const magic = sniffMagic(bytes);
    if (magic) return magic;
  }

  // Browsers sometimes send empty type or octet-stream for camera rolls
  if (!raw || raw === "application/octet-stream") {
    return null;
  }
  return null;
}

function isHeicMime(mime: string): boolean {
  return (
    mime === "image/heic" ||
    mime === "image/heif" ||
    mime.includes("heic") ||
    mime.includes("heif")
  );
}

export type NormalizedImage = {
  blob: Blob;
  filename: string;
  mime: string;
};

/**
 * Validate + normalize an uploaded image. Converts HEIC/HEIF → JPEG for
 * universal display (browsers / GMGN / IPFS gateways).
 */
export async function normalizeImageUpload(
  file: File
): Promise<NormalizedImage> {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be between 1 byte and 12 MB");
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  let mime = resolveImageMime(file, buf);
  if (!mime) {
    throw new Error(
      "Unsupported image. Use JPG, PNG, WebP, GIF, or HEIC (iPhone)."
    );
  }

  const baseName = (file.name || "token-image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 60) || "token-image";

  if (isHeicMime(mime)) {
    // Dynamic import keeps the route light when not converting
    const convert = (await import("heic-convert")).default;
    const output = await convert({
      buffer: Buffer.from(buf),
      format: "JPEG",
      quality: 0.9,
    });
    const jpegBytes = new Uint8Array(output);
    return {
      blob: new Blob([jpegBytes], { type: "image/jpeg" }),
      filename: `${baseName}.jpg`,
      mime: "image/jpeg",
    };
  }

  // Keep animated GIFs as-is (do not re-encode)
  if (mime === "image/gif") {
    return {
      blob: new Blob([buf], { type: "image/gif" }),
      filename: `${baseName}.gif`,
      mime: "image/gif",
    };
  }

  // Normalize odd JPEG MIME labels for Pinata
  if (mime === "image/jpeg") {
    return {
      blob: new Blob([buf], { type: "image/jpeg" }),
      filename: `${baseName}.jpg`,
      mime: "image/jpeg",
    };
  }

  const ext = extOf(file.name || "") || mime.split("/")[1] || "bin";
  return {
    blob: new Blob([buf], { type: mime }),
    filename: `${baseName}.${ext}`,
    mime,
  };
}
