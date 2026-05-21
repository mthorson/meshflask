import type { ExtractedMetadata } from './types';
import type { PrintBed } from './preferences';

/**
 * Does the model's bounding box fit within the given bed? Tries the natural
 * axis mapping first; if `allowRotation` is true and the natural fit fails,
 * we test every permutation of the size triplet against (x,y,z) — useful
 * because the user typically lays prints down at any orientation.
 */
export function fitsBed(
  size: [number, number, number],
  bed: PrintBed,
  allowRotation = true
): boolean {
  if (naturalFit(size, bed)) return true;
  if (!allowRotation) return false;
  // 6 permutations of three axes. Most will be redundant when X==Y so dedup-
  // by-bed-tuple isn't worth the bother; just try them.
  const perms: Array<[number, number, number]> = [
    [size[0], size[1], size[2]],
    [size[0], size[2], size[1]],
    [size[1], size[0], size[2]],
    [size[1], size[2], size[0]],
    [size[2], size[0], size[1]],
    [size[2], size[1], size[0]]
  ];
  return perms.some((p) => naturalFit(p, bed));
}

function naturalFit(size: [number, number, number], bed: PrintBed): boolean {
  return size[0] <= bed.x && size[1] <= bed.y && size[2] <= bed.z;
}

export function modelFitsAnyBed(metadata: ExtractedMetadata | null, beds: PrintBed[]): boolean {
  if (beds.length === 0) return true; // no bed registered = no warning
  if (!metadata) return true; // unrendered = unknown, don't warn
  const size = metadata.boundingBox.size;
  // A zero-size box means the mesh was empty / 3MF embedded — also unknown.
  if (size[0] === 0 && size[1] === 0 && size[2] === 0) return true;
  return beds.some((b) => fitsBed(size, b));
}

export function modelFitsSpecificBed(
  metadata: ExtractedMetadata | null,
  bed: PrintBed | null
): boolean {
  if (!bed || !metadata) return true;
  const size = metadata.boundingBox.size;
  if (size[0] === 0 && size[1] === 0 && size[2] === 0) return true;
  return fitsBed(size, bed);
}
