/**
 * Non-blocking replacements for window.alert / window.confirm that can be called
 * from any event handler or service. ErrorNotificationProvider registers the
 * real toast + dialog implementations; before that (or in isolated tests) the
 * native browser dialogs are used.
 */

let handlers = null;

export function registerFeedbackHandlers(nextHandlers) {
  handlers = nextHandlers;
  return () => {
    if (handlers === nextHandlers) handlers = null;
  };
}

const ERROR_PATTERN = /^\s*❌|\b(errors?|failed|failure|could not|couldn't|unable to)\b/i;
const WARNING_PATTERN = /^\s*⚠️?|\b(please|required|must|invalid|cannot be empty|no .* (found|available|selected)|not (found|available|configured))\b/i;
const SUCCESS_PATTERN = /^\s*✅|\b(success(fully)?|saved|copied|created|deleted|removed|updated|imported|exported|opened|uploaded|completed)\b/i;

export function inferFeedbackType(message) {
  const text = String(message ?? '');
  if (ERROR_PATTERN.test(text)) return 'error';
  if (WARNING_PATTERN.test(text)) return 'warning';
  if (SUCCESS_PATTERN.test(text)) return 'success';
  return 'info';
}

/**
 * Show a toast. `type` is inferred from the wording when omitted, so existing
 * alert() messages map to sensible colors without rewriting each one.
 */
export function notify(message, type = inferFeedbackType(message), options = {}) {
  const text = String(message ?? '');
  if (!handlers) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text);
    return null;
  }
  return handlers.notify(text, type, options);
}

/**
 * Ask the user to confirm an action. Resolves to true/false.
 * Options: { title, confirmLabel, cancelLabel, destructive }
 */
export function confirmAction(message, options = {}) {
  const text = String(message ?? '');
  if (!handlers) {
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(text) : false);
  }
  return handlers.confirm(text, options);
}
