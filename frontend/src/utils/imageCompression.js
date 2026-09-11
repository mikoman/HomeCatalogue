export function fitImageSize(width, height, maxWidth = 1920, maxHeight = 1920) {
  if (![width, height, maxWidth, maxHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('The photo dimensions are invalid. Choose another photo.');
  }
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function compressImage(file, options = {}) {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.85, mimeType = 'image/jpeg' } = options;
  if (!file || file.size === 0) throw new Error('The photo is empty. Choose another photo.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose a photo smaller than 50 MB.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Choose an image file.');

  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This photo format could not open. Choose a JPEG, PNG, or WebP photo.'));
      image.src = sourceUrl;
    });
    const { width, height } = fitImageSize(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The photo could not be prepared. Try another browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('The photo could not be prepared. Try again.')), mimeType, quality);
    });
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1));
  return `${parseFloat((bytes / 1024 ** index).toFixed(1))} ${sizes[index]}`;
}
