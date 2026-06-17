/**
 * Canvas helpers for the profile-photo cropper (react-easy-crop).
 *
 * `getCroppedBlob` takes the source image, the crop rectangle (in source pixels,
 * as produced by react-easy-crop's onCropComplete) and a rotation, and returns a
 * square cropped JPEG Blob ready to upload.
 */

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns a cropped (and optionally rotated) image as a JPEG Blob.
 *
 * @param imageSrc    object URL / data URL of the chosen image
 * @param crop        crop area in source-image pixels
 * @param rotation    rotation in degrees (0/90/180/270 or arbitrary)
 * @param maxSize     cap the output to this many px on the long edge (default 512)
 */
export async function getCroppedBlob(
  imageSrc: string,
  crop: PixelCrop,
  rotation = 0,
  maxSize = 512,
): Promise<Blob> {
  const image = await createImage(imageSrc);

  // Stage 1 — draw the (rotated) full image onto a canvas large enough to hold it.
  const rotRad = toRadians(rotation);
  const { width: bWidth, height: bHeight } = rotatedSize(
    image.width,
    image.height,
    rotation,
  );

  const stage = document.createElement("canvas");
  const stageCtx = stage.getContext("2d");
  if (!stageCtx) throw new Error("Could not get canvas context");

  stage.width = bWidth;
  stage.height = bHeight;

  stageCtx.translate(bWidth / 2, bHeight / 2);
  stageCtx.rotate(rotRad);
  stageCtx.translate(-image.width / 2, -image.height / 2);
  stageCtx.drawImage(image, 0, 0);

  // Stage 2 — copy just the crop rectangle into the output canvas, scaled down
  // to maxSize if needed (keeps uploads small and square).
  const outSize = Math.min(maxSize, Math.round(crop.width));
  const out = document.createElement("canvas");
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Could not get canvas context");

  out.width = outSize;
  out.height = outSize;

  outCtx.drawImage(
    stage,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outSize,
    outSize,
  );

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

/** Bounding-box size of an image after rotation. */
function rotatedSize(width: number, height: number, rotation: number) {
  const rotRad = toRadians(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}
