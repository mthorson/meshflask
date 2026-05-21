/**
 * Render-failure messages that are NOT actual model failures — they happen
 * when the app is shutting down between dispatch and result. Treat these as
 * "abandoned, retry next session" rather than persisting to thumb_errors.
 *
 * The pool throws these messages from its shutdown paths and the queue
 * runner classifies them on the catch side. Keeping the strings here means
 * adding a new shutdown path can't drift the two ends apart.
 */
export const POOL_SHUTDOWN_ERROR = 'ThumbPool is shutting down';
export const WORKER_SHUTDOWN_ERROR = 'shutdown';

export const TRANSIENT_RENDER_ERROR_MESSAGES: ReadonlySet<string> = new Set([
  POOL_SHUTDOWN_ERROR,
  WORKER_SHUTDOWN_ERROR,
  // Earlier code paths used a slightly different wording; keep it in the set
  // so DBs that already recorded it as a failure get cleaned up on reconcile.
  'ThumbPool shutting down'
]);

export function isTransientRenderError(message: string): boolean {
  return TRANSIENT_RENDER_ERROR_MESSAGES.has(message);
}
