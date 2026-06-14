export interface LoadedImage {
  /** Object URL for displaying the original reference image. */
  url: string;
  /** Natural source dimensions. */
  sourceWidth: number;
  sourceHeight: number;
  /** Downscaled pixels the pipeline runs on. */
  imageData: ImageData;
}

/**
 * Read a File into an ImageData buffer downscaled so its longest edge is at
 * most `maxDimension`, while remembering the original dimensions so the stroke
 * plan can be expressed in full-resolution coordinates.
 */
export function loadImageFile(file: File, maxDimension: number): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth;
      const sourceHeight = img.naturalHeight;
      const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      const w = Math.max(1, Math.round(sourceWidth * scale));
      const h = Math.max(1, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Could not get 2D canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      resolve({ url, sourceWidth, sourceHeight, imageData });
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}
