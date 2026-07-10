import React from 'react';
import MediaUploader from './MediaUploader';
import MediaAsset from '../components/MediaAsset';

const BLOCK_LABELS = {
  text: 'Text',
  callout: 'Callout',
  link: 'Link',
  image: 'Image',
  video: 'Video'
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const BlockEditor = ({ block, courseId, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const set = (patch) => onChange({ ...block, ...patch });

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{BLOCK_LABELS[block.type] || block.type}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="px-1.5 py-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move down">↓</button>
          <button type="button" onClick={onRemove} className="px-1.5 py-0.5 text-red-400 hover:text-red-600" title="Remove block">✕</button>
        </div>
      </div>

      {block.type === 'text' && (
        <textarea
          value={block.content || ''}
          onChange={(e) => set({ content: e.target.value })}
          rows={3}
          placeholder="Lesson text…"
          className={inputClass}
        />
      )}

      {block.type === 'callout' && (
        <div className="space-y-2">
          <select value={block.variant || 'tip'} onChange={(e) => set({ variant: e.target.value })} className={inputClass}>
            <option value="tip">Tip</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <textarea
            value={block.content || ''}
            onChange={(e) => set({ content: e.target.value })}
            rows={2}
            placeholder="Callout text…"
            className={inputClass}
          />
        </div>
      )}

      {block.type === 'link' && (
        <div className="space-y-2">
          <input value={block.label || ''} onChange={(e) => set({ label: e.target.value })} placeholder="Link label" className={inputClass} />
          <input value={block.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className={inputClass} />
        </div>
      )}

      {block.type === 'image' && (
        <div className="space-y-2">
          {block.assetId ? (
            <MediaAsset courseId={courseId} block={block} />
          ) : (
            <MediaUploader courseId={courseId} kind="image" onUploaded={(res) => set({ assetId: res.assetId })} />
          )}
          <input value={block.alt || ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Alt text (accessibility)" className={inputClass} />
          <input value={block.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)" className={inputClass} />
          {block.assetId && (
            <button type="button" onClick={() => set({ assetId: '' })} className="text-xs text-gray-500 hover:text-red-600">Replace image</button>
          )}
        </div>
      )}

      {block.type === 'video' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set({ source: 'url', assetId: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${(block.source || 'url') === 'url' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
            >
              Link (YouTube / URL)
            </button>
            <button
              type="button"
              onClick={() => set({ source: 'asset', url: '' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${block.source === 'asset' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
            >
              Upload file
            </button>
          </div>

          {block.source === 'asset' ? (
            block.assetId ? (
              <>
                <MediaAsset courseId={courseId} block={block} />
                <button type="button" onClick={() => set({ assetId: '' })} className="text-xs text-gray-500 hover:text-red-600">Replace video</button>
              </>
            ) : (
              <MediaUploader courseId={courseId} kind="video" onUploaded={(res) => set({ assetId: res.assetId })} />
            )
          ) : (
            <input value={block.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://youtube.com/… or video URL" className={inputClass} />
          )}
          <input value={block.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)" className={inputClass} />
        </div>
      )}
    </div>
  );
};

export default BlockEditor;
