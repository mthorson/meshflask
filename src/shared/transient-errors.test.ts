import { describe, expect, it } from 'vitest';
import { isTransientRenderError, TRANSIENT_RENDER_ERROR_MESSAGES } from './transient-errors';

describe('transient render error classification', () => {
  it('flags pool shutdown messages as transient (both wording variants)', () => {
    expect(isTransientRenderError('ThumbPool is shutting down')).toBe(true);
    // Earlier code paths used this spelling; old DB rows still need to clear.
    expect(isTransientRenderError('ThumbPool shutting down')).toBe(true);
    expect(isTransientRenderError('shutdown')).toBe(true);
  });

  it('does not flag legitimate render failures', () => {
    expect(isTransientRenderError('Render timed out after 30000ms')).toBe(false);
    expect(isTransientRenderError('Worker render process exited: crashed')).toBe(false);
    expect(isTransientRenderError('parse failed')).toBe(false);
    expect(isTransientRenderError('canvas.toBlob returned null')).toBe(false);
    expect(isTransientRenderError('')).toBe(false);
  });

  it('exposes the set so the reconciler can scrub matching DB rows', () => {
    expect(TRANSIENT_RENDER_ERROR_MESSAGES.has('ThumbPool is shutting down')).toBe(true);
    expect(TRANSIENT_RENDER_ERROR_MESSAGES.has('shutdown')).toBe(true);
  });
});
