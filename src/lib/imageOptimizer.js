const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 60_000_000;
const TARGET_BYTES = 350 * 1024;
const OUTPUT_QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.4];
const MAX_SIZE_ATTEMPTS = 8;
const OUTPUT_FORMATS = [
  { type: "image/webp", extension: "webp" },
  { type: "image/jpeg", extension: "jpg" }
];

async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    try {
      await image.decode();
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(objectUrl)
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw new Error("This browser could not read that image. Please try a JPEG, PNG, or WebP file.");
    }
  }
}

export async function optimizeInventoryImage(file) {
  if (!file?.size || !file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Inventory photos must be 15 MB or smaller before optimization.");
  }

  const decoded = await decodeImage(file);
  try {
    if (decoded.width * decoded.height > MAX_SOURCE_PIXELS) {
      throw new Error("This photo is too large to process safely.");
    }

    const imageSource = decoded.source || decoded;
    let scale = Math.min(1, 1200 / decoded.width, 900 / decoded.height);
    let bestBlob = null;
    let bestFormat = null;

    for (let sizeAttempt = 0; sizeAttempt < MAX_SIZE_ATTEMPTS; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      canvas.getContext("2d", { alpha: false }).drawImage(
        imageSource,
        0,
        0,
        canvas.width,
        canvas.height
      );

      for (const format of OUTPUT_FORMATS) {
        for (const quality of OUTPUT_QUALITIES) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, format.type, quality));
          if (!blob || blob.type !== format.type) continue;
          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
            bestFormat = format;
          }
          if (blob.size <= TARGET_BYTES) break;
        }
        if (bestBlob?.size <= TARGET_BYTES) break;
      }

      if (bestBlob?.size <= TARGET_BYTES) break;
      scale *= 0.8;
    }

    if (!bestBlob || !bestFormat) {
      throw new Error("This browser could not convert that image. Please try a JPEG, PNG, or WebP file.");
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "inventory-image";
    return new File([bestBlob], `${name}.${bestFormat.extension}`, {
      type: bestFormat.type,
      lastModified: Date.now()
    });
  } finally {
    decoded.close?.();
  }
}
