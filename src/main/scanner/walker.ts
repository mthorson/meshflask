import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { PathResolver } from '@shared/paths';
import { extensionOf, isSupportedExtension } from '@shared/formats';
import type { UpsertInput } from '@main/db/repos/files';

export interface WalkOptions {
  /** Directory names to skip entirely (matched case-sensitively, no slashes). */
  ignoreDirNames?: Set<string>;
  /** How many entries to gather before yielding via the onBatch callback. */
  batchSize?: number;
  /** Called with each batch of supported files as the walk progresses. */
  onBatch?: (batch: UpsertInput[]) => Promise<void> | void;
}

const DEFAULT_IGNORE: ReadonlySet<string> = new Set([
  '.meshFlask',
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.DS_Store',
  '@eaDir' // Synology NAS thumbnail folder
]);

/**
 * Recursively walk a library root, batching supported 3D files for upsert.
 * Hidden directories (any starting with '.') and a small ignore-list are
 * skipped. Returns the total count of supported files seen and the set of
 * relative paths so callers can compute stale rows for deletion.
 */
export async function walkLibrary(
  resolver: PathResolver,
  options: WalkOptions = {}
): Promise<{ totalSeen: number; seenRelPaths: Set<string> }> {
  const ignore = new Set([...DEFAULT_IGNORE, ...(options.ignoreDirNames ?? [])]);
  const batchSize = options.batchSize ?? 200;
  const root = resolver.getMountPath();

  let buffer: UpsertInput[] = [];
  const seenRelPaths = new Set<string>();
  let totalSeen = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    if (options.onBatch) await options.onBatch(buffer);
    buffer = [];
  };

  const visit = async (absDir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(absDir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      // Permission denied or transient FS error — skip this subtree silently.
      return;
    }

    for (const entry of entries) {
      const absChild = join(absDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || ignore.has(entry.name)) continue;
        await visit(absChild);
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue;

      const ext = extensionOf(entry.name);
      if (!isSupportedExtension(ext)) continue;

      // Symlinks need an explicit stat to get size/mtime of the target.
      let sizeBytes: number;
      let mtimeMs: number;
      try {
        const s = entry.isSymbolicLink() ? await stat(absChild) : await stat(absChild);
        sizeBytes = s.size;
        mtimeMs = Math.floor(s.mtimeMs);
      } catch {
        continue;
      }

      const relPath = resolver.toRelative(absChild);
      const slash = relPath.lastIndexOf('/');
      const parentDir = slash < 0 ? '' : relPath.slice(0, slash);

      seenRelPaths.add(relPath);
      totalSeen++;

      buffer.push({
        relPath,
        parentDir,
        filename: entry.name,
        ext,
        sizeBytes,
        mtimeMs
      });

      if (buffer.length >= batchSize) await flush();
    }
  };

  await visit(root);
  await flush();
  return { totalSeen, seenRelPaths };
}
