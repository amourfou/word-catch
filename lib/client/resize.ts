/**
 * 폰 브라우저에서 사진을 canvas로 다시 그려 긴 변 1600px JPEG로 줄입니다.
 * canvas로 새로 만든 JPEG에는 EXIF(GPS·촬영기기 정보)가 들어가지 않습니다.
 * 회전 정보는 createImageBitmap(imageOrientation: "from-image")로 먼저 반영합니다.
 */
export const MAX_SIDE = 1600;

export async function resizeToJpeg(file: File, maxSide = MAX_SIDE, quality = 0.85): Promise<Blob> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    src = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("사진을 열 수 없어요."));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 사진을 줄일 수 없어요.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("사진 변환에 실패했어요.");
  return blob;
}
