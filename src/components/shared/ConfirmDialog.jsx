import React, { useEffect, useId, useRef } from 'react';

const DESTRUCTIVE_PATTERN = /\b(delete|remove|clear|discard|reset|stop|cannot be undone)\b/i;

/** Accessible replacement for window.confirm, rendered by ErrorNotificationProvider. */
export default function ConfirmDialog({ request, onResolve }) {
  const titleId = useId();
  const messageId = useId();
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const previouslyFocused = useRef(null);

  const {
    message,
    title = 'Please confirm',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = DESTRUCTIVE_PATTERN.test(message)
  } = request;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    // Destructive actions focus Cancel so a stray Enter doesn't delete anything.
    (destructive ? cancelRef : confirmRef).current?.focus();
    return () => previouslyFocused.current?.focus?.();
  }, [destructive]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onResolve(false);
    } else if (event.key === 'Tab') {
      // Keep focus inside the two buttons.
      const focusable = [cancelRef.current, confirmRef.current];
      const index = focusable.indexOf(document.activeElement);
      event.preventDefault();
      focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
      >
        <h2 id={titleId} className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <p id={messageId} className="mb-6 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onResolve(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={destructive ? 'btn bg-error-600 text-white hover:bg-error-700' : 'btn btn-primary'}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
