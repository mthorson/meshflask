/**
 * Lighting style identifiers shared between renderer (LightingRig
 * implementation, UI picker) and main / worker (passed through IPC + render
 * requests).
 *
 * Only the IDs live here — the visual definitions (label, description,
 * lights, exposure, etc.) live in `src/renderer/three/lighting-presets.ts`
 * so they can be tweaked in isolation without touching IPC contracts.
 */

export const LIGHTING_STYLE_IDS = [
  'studio',
  'normals',
  'dramatic',
  'product',
  'outdoor'
] as const;

export type LightingStyle = (typeof LIGHTING_STYLE_IDS)[number];

export const DEFAULT_LIGHTING_STYLE: LightingStyle = 'studio';

export function isLightingStyle(value: unknown): value is LightingStyle {
  return typeof value === 'string' && (LIGHTING_STYLE_IDS as readonly string[]).includes(value);
}
