import { unzipSync } from 'fflate';

/**
 * Slicer-exported 3MFs (Bambu Studio, PrusaSlicer, OrcaSlicer) embed a
 * pre-rendered Metadata/thumbnail.png in the zip. Returning that directly
 * avoids a full GL render and matches what users already see in their slicer.
 */
const CANDIDATES = [
  'Metadata/thumbnail.png',
  'Metadata/thumbnail_middle.png',
  'Metadata/plate_1.png',
  'Metadata/plate_no_light_1.png',
  'Metadata/top_1.png'
];

export function extract3MFEmbeddedThumbnail(buffer: ArrayBuffer): Uint8Array | null {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(new Uint8Array(buffer));
  } catch {
    return null;
  }
  for (const name of CANDIDATES) {
    if (unzipped[name] && unzipped[name].byteLength > 0) return unzipped[name];
  }
  // Fallback: any .png anywhere in Metadata/
  for (const [name, data] of Object.entries(unzipped)) {
    if (name.startsWith('Metadata/') && name.endsWith('.png') && data.byteLength > 0) {
      return data;
    }
  }
  return null;
}
