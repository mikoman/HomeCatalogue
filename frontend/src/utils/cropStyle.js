// CSS-crop a thumbnail to the detector's bbox region (normalized 0..1) — no image
// processing, just background sizing/positioning of the stored scan photo.
// Returns a style object suitable for a div with a fixed width/height, or null
// when the bbox is degenerate and a plain <img> fallback should be used instead.
export function cropStyle(imageUrl, bbox) {
  const [x1, y1, x2, y2] = bbox;
  const bw = x2 - x1, bh = y2 - y1;
  if (!(bw > 0 && bh > 0)) return null;
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${100 / bw}% ${100 / bh}%`,
    backgroundPosition: `${bw < 1 ? (x1 / (1 - bw)) * 100 : 0}% ${bh < 1 ? (y1 / (1 - bh)) * 100 : 0}%`,
    backgroundRepeat: 'no-repeat',
  };
}
