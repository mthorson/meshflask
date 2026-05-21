import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

export const THUMB_DIR = '.meshFlask/thumbs';
export const THUMB_EXT = 'png';
const RENDER_SIZE = 512;

export const THUMBNAIL_RENDER_SIZE = RENDER_SIZE;

/**
 * POSIX-relative path for a file's thumbnail. Two-level fanout via SHA1 of the
 * file id keeps any one directory under ~a few hundred entries even at 100k+
 * thumbnails. Stored in the DB as the relative path so it's portable.
 */
export function thumbRelPath(fileId: number): string {
  const hash = createHash('sha1').update(String(fileId)).digest('hex');
  return `${THUMB_DIR}/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${fileId}.${THUMB_EXT}`;
}

/** Absolute on-disk path on this machine. */
export function thumbAbsPath(libraryRoot: string, fileId: number): string {
  const rel = thumbRelPath(fileId).replace(/\//g, sep);
  return join(libraryRoot, rel);
}

export async function writeThumbnailFile(absPath: string, png: Uint8Array): Promise<void> {
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, png);
}

export async function deleteThumbnailFile(absPath: string): Promise<void> {
  await rm(absPath, { force: true });
}
