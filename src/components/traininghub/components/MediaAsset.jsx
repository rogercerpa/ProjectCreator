import React, { useEffect, useState } from 'react';

const { electronAPI } = window;

function toEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { type: 'file', src: url };
}

/**
 * Renders an image or video content block. Images resolve to a data URL and
 * uploaded videos to a Blob URL via IPC; external URLs render directly.
 */
const MediaAsset = ({ courseId, block }) => {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);

  const isImage = block.type === 'image';
  const isAsset = isImage ? !!block.assetId : (block.source === 'asset' || (!block.url && block.assetId));

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    async function resolve() {
      setError(null);
      setSrc(null);
      try {
        if (isImage) {
          if (block.url) { setSrc(block.url); return; }
          if (block.assetId && courseId) {
            const res = await electronAPI.trainingHubMediaDataUrl(courseId, block.assetId);
            if (active && res?.success) setSrc(res.dataUrl);
            else if (active) setError('Image unavailable');
          }
        } else {
          if (block.source === 'url' || (block.url && !block.assetId)) return; // handled in render
          if (block.assetId && courseId) {
            const res = await electronAPI.trainingHubMediaBuffer(courseId, block.assetId);
            if (active && res?.success && res.data) {
              const bytes = res.data instanceof Uint8Array ? res.data : new Uint8Array(res.data.data || res.data);
              objectUrl = URL.createObjectURL(new Blob([bytes], { type: res.mimeType || 'video/mp4' }));
              setSrc(objectUrl);
            } else if (active) {
              setError('Video unavailable');
            }
          }
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    resolve();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, block, isImage]);

  if (isImage) {
    return (
      <figure className="my-1">
        {src ? (
          <img src={src} alt={block.alt || ''} className="rounded-2xl border border-gray-100 dark:border-gray-700 max-h-96 w-auto mx-auto" />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-600 py-10 text-center text-sm text-gray-400">
            {error || 'Loading image…'}
          </div>
        )}
        {block.caption && <figcaption className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1.5">{block.caption}</figcaption>}
      </figure>
    );
  }

  // Video
  const externalUrl = (block.source === 'url' || (block.url && !block.assetId)) ? block.url : null;
  const embed = externalUrl ? toEmbedUrl(externalUrl) : null;

  return (
    <figure className="my-1">
      {embed?.type === 'iframe' ? (
        <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700" style={{ paddingTop: '56.25%' }}>
          <iframe
            src={embed.src}
            title={block.caption || 'Video'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (embed?.src || src) ? (
        <video src={embed?.src || src} controls className="rounded-2xl border border-gray-100 dark:border-gray-700 max-h-96 w-full" />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-600 py-10 text-center text-sm text-gray-400">
          {error || 'Loading video…'}
        </div>
      )}
      {block.caption && <figcaption className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1.5">{block.caption}</figcaption>}
    </figure>
  );
};

export default MediaAsset;
