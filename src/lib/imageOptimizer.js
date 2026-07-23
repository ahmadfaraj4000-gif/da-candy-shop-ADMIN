const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 60_000_000;
const TARGET_BYTES = 350 * 1024;
const MAX_OUTPUT_BYTES = 500 * 1024;

export async function optimizeInventoryImage(file) {
  if (!file?.size || !file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Inventory photos must be 15 MB or smaller before optimization.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
      throw new Error("This photo is too large to process safely.");
    }

    let scale = Math.min(1, 1200 / bitmap.width, 900 / bitmap.height);
    let bestBlob = null;

    for (let sizeAttempt = 0; sizeAttempt < 3; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d", { alpha: false }).drawImage(
        bitmap,
        0,
        0,
        canvas.width,
        canvas.height
      );

      for (const quality of [0.8, 0.7, 0.6]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob) continue;
        bestBlob = blob;
        if (blob.size <= TARGET_BYTES) break;
      }

      if (bestBlob?.size <= TARGET_BYTES) break;
      scale *= 0.82;
    }

    if (!bestBlob || bestBlob.type !== "image/webp" || bestBlob.size > MAX_OUTPUT_BYTES) {
      throw new Error("This image could not be reduced enough. Please choose a different image.");
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "inventory-image";
    return new File([bestBlob], `${name}.webp`, {
      type: "image/webp",
      lastModified: Date.now()
    });
  } finally {
    bitmap.close();
  }
}
