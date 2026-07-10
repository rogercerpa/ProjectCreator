import React, { useState } from 'react';
import BlockEditor from './BlockEditor';

const NEW_BLOCK = {
  text: () => ({ type: 'text', content: '' }),
  callout: () => ({ type: 'callout', variant: 'tip', content: '' }),
  link: () => ({ type: 'link', label: '', url: '' }),
  image: () => ({ type: 'image', assetId: '', alt: '', caption: '' }),
  video: () => ({ type: 'video', source: 'url', url: '', assetId: '', caption: '' })
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

const LessonEditor = ({ lesson, index, courseId, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const [showAdd, setShowAdd] = useState(false);
  const blocks = lesson.blocks || [];

  const setBlock = (i, next) => {
    const nextBlocks = blocks.slice();
    nextBlocks[i] = next;
    onChange({ ...lesson, blocks: nextBlocks });
  };

  const removeBlock = (i) => {
    onChange({ ...lesson, blocks: blocks.filter((_, idx) => idx !== i) });
  };

  const moveBlock = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const nextBlocks = blocks.slice();
    [nextBlocks[i], nextBlocks[j]] = [nextBlocks[j], nextBlocks[i]];
    onChange({ ...lesson, blocks: nextBlocks });
  };

  const addBlock = (type) => {
    onChange({ ...lesson, blocks: [...blocks, NEW_BLOCK[type]()] });
    setShowAdd(false);
  };

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-semibold flex items-center justify-center">{index + 1}</span>
        <input
          value={lesson.title || ''}
          onChange={(e) => onChange({ ...lesson, title: e.target.value })}
          placeholder={`Lesson ${index + 1} title`}
          className={`${inputClass} font-medium`}
        />
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move lesson up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30" title="Move lesson down">↓</button>
          <button type="button" onClick={onRemove} className="px-2 py-1 text-red-400 hover:text-red-600" title="Remove lesson">🗑</button>
        </div>
      </div>

      <div className="space-y-2 pl-9">
        {blocks.map((block, i) => (
          <BlockEditor
            key={i}
            block={block}
            courseId={courseId}
            onChange={(next) => setBlock(i, next)}
            onRemove={() => removeBlock(i)}
            onMoveUp={() => moveBlock(i, -1)}
            onMoveDown={() => moveBlock(i, 1)}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
          />
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdd(s => !s)}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Add block
          </button>
          {showAdd && (
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.keys(NEW_BLOCK).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonEditor;
