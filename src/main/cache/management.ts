import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenLibrary } from '@main/libraries/manager';
import { queueRunner } from '@main/thumb-pool/queue-runner';

const THUMBS_DIR = '.meshFlask/thumbs';

/**
 * Wipe every `thumbnails` row for a library and re-queue every known file
 * at background priority. The queueRunner's reconcile() walks files needing
 * thumbs and enqueues them, so we only need to clear the table + kick it.
 */
export function rebuildThumbnailCache(library: OpenLibrary): void {
  library.thumbnails.deleteAll();
  library.thumbErrors.clearAll();
  queueRunner.reconcile(library);
}

/**
 * Walk `<root>/.meshFlask/thumbs/**` and delete any sidecar PNG/WebP whose
 * `file_id` (encoded in the filename) is no longer present in the DB.
 * Returns the number of files removed.
 *
 * Sidecar layout: `.meshFlask/thumbs/<aa>/<bb>/<file_id>.webp`
 */
export function purgeOrphanThumbs(library: OpenLibrary): { removed: number } {
  const root = library.resolver.getMountPath();
  const base = join(root, THUMBS_DIR);
  const known = new Set(library.thumbnails.listAllFileIds());
  let removed = 0;

  let l1: string[];
  try {
    l1 = readdirSync(base);
  } catch {
    return { removed: 0 };
  }
  for (const a of l1) {
    const aDir = join(base, a);
    let l2: string[];
    try {
      l2 = readdirSync(aDir);
    } catch {
      continue;
    }
    for (const b of l2) {
      const bDir = join(aDir, b);
      let files: string[];
      try {
        files = readdirSync(bDir);
      } catch {
        continue;
      }
      for (const f of files) {
        // Filename is `<id>.<ext>` — strip extension and parse.
        const dot = f.lastIndexOf('.');
        const idStr = dot < 0 ? f : f.slice(0, dot);
        const id = Number.parseInt(idStr, 10);
        if (Number.isNaN(id) || known.has(id)) continue;
        try {
          rmSync(join(bDir, f), { force: true });
          removed++;
        } catch {
          // best-effort
        }
      }
    }
  }
  void statSync;
  return { removed };
}
