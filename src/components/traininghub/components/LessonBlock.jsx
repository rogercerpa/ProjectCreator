import React from 'react';
import MediaAsset from './MediaAsset';

const CALLOUT_STYLES = {
  tip: { icon: '💡', box: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' },
  warning: { icon: '⚠️', box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200' },
  info: { icon: 'ℹ️', box: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200' }
};

const LessonBlock = ({ block, courseId }) => {
  if (!block) return null;

  switch (block.type) {
    case 'text':
      return <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{block.content}</p>;

    case 'callout': {
      const style = CALLOUT_STYLES[block.variant] || CALLOUT_STYLES.info;
      return (
        <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${style.box}`}>
          <span className="text-lg leading-none mt-0.5">{style.icon}</span>
          <p className="text-sm leading-relaxed">{block.content}</p>
        </div>
      );
    }

    case 'link':
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          🔗 {block.label || block.url}
        </a>
      );

    case 'image':
    case 'video':
      return <MediaAsset courseId={courseId} block={block} />;

    default:
      return null;
  }
};

export default LessonBlock;
