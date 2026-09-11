import { useId, useState } from 'react';

export default function ItemPhoto({ src, bbox, lazy = false }) {
  const clipId = useId();
  const [image, setImage] = useState(null);
  const validBox = Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isFinite)
    && bbox[0] >= 0 && bbox[1] >= 0 && bbox[2] <= 1 && bbox[3] <= 1
    && bbox[2] > bbox[0] && bbox[3] > bbox[1];

  if (!validBox || image?.src !== src) return <img src={src} alt="" loading={lazy ? 'lazy' : undefined}
    className="block w-full h-full object-contain"
    onLoad={event => setImage({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />;

  const x = bbox[0] * image.width;
  const y = bbox[1] * image.height;
  const width = (bbox[2] - bbox[0]) * image.width;
  const height = (bbox[3] - bbox[1]) * image.height;
  return <svg className="block w-full h-full" viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height} /></clipPath></defs>
    <image href={src} width={image.width} height={image.height} clipPath={`url(#${clipId})`} />
  </svg>;
}
