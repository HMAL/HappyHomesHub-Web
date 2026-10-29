import imageCompression from 'browser-image-compression';

/**
 * Compresses an image before upload so a tenant snapping a repair photo on mobile
 * data uploads in seconds rather than stalling on a multi-MB file. Falls back to
 * the original file if compression fails (e.g. unusual format).
 */
export async function compressImage(file: File, maxMB = 1): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: maxMB,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
}
