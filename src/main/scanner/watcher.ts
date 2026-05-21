import chokidar from 'chokidar';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { looksLikeNetworkMount, type PathResolver } from '@shared/paths';
import { extensionOf, isSupportedExtension } from '@shared/formats';
import type { FilesRepo } from '@main/db/repos/files';

// fsevents (mac) and inotify (linux) don't fire on network mounts, so chokidar
// is silent there unless we fall back to polling. 10s keeps NAS load low at
// the cost of changes taking up to ~10s to appear. Configurable via prefs
// (`nasPollIntervalSec`), threaded in at watcher construction.
const DEFAULT_NAS_POLL_INTERVAL_MS = 10_000;
const NAS_BINARY_POLL_MULTIPLIER = 3;

export interface WatcherCallbacks {
  onChange: () => void;
  onError?: (err: Error) => void;
}

export interface WatcherOptions {
  /** Override poll interval in ms (network mounts only). */
  nasPollIntervalMs?: number;
}

const IGNORE_DIR_NAMES: ReadonlySet<string> = new Set([
  '.warehouse3d',
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '@eaDir'
]);

/** How long to hold an unlink before treating it as a real delete. */
const RENAME_WINDOW_MS = 1500;

function shouldIgnore(absPath: string): boolean {
  const name = basename(absPath);
  if (name.startsWith('.') && IGNORE_DIR_NAMES.has(name)) return true;
  if (name.startsWith('.') && name !== '.' && name !== '..') return true;
  if (IGNORE_DIR_NAMES.has(name)) return true;
  return false;
}

export interface LibraryWatcher {
  close(): Promise<void>;
}

interface PendingUnlink {
  fileId: number;
  relPath: string;
  filename: string;
  ext: string;
  sizeBytes: number;
  mtimeMs: number;
  timer: NodeJS.Timeout;
}

export function startWatcher(
  resolver: PathResolver,
  files: FilesRepo,
  cb: WatcherCallbacks,
  opts: WatcherOptions = {}
): LibraryWatcher {
  const root = resolver.getMountPath();
  const isNetwork = looksLikeNetworkMount(root);
  const pollMs = opts.nasPollIntervalMs ?? DEFAULT_NAS_POLL_INTERVAL_MS;

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    ignored: shouldIgnore,
    awaitWriteFinish: {
      stabilityThreshold: 750,
      pollInterval: 150
    },
    depth: 99,
    // fsevents/inotify don't fire on network mounts. Fall back to polling so
    // external Finder changes still propagate; accept the staleness window.
    usePolling: isNetwork,
    interval: isNetwork ? pollMs : undefined,
    binaryInterval: isNetwork ? pollMs * NAS_BINARY_POLL_MULTIPLIER : undefined
  });

  // Pending unlinks bucketed by (size, mtime). When an add arrives matching
  // any bucket within RENAME_WINDOW_MS, we treat the pair as a rename and
  // preserve the file's id, thumbnail, and tags. Otherwise the timer fires
  // and the unlink becomes a real delete.
  const pending = new Map<string, PendingUnlink[]>();

  const sigKey = (size: number, mtime: number) => `${size}:${mtime}`;

  const removePending = (entry: PendingUnlink): void => {
    const key = sigKey(entry.sizeBytes, entry.mtimeMs);
    const list = pending.get(key);
    if (!list) return;
    const idx = list.indexOf(entry);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) pending.delete(key);
  };

  const handleAddOrChange = async (absPath: string) => {
    const ext = extensionOf(absPath);
    if (!isSupportedExtension(ext)) return;

    let s: Awaited<ReturnType<typeof stat>>;
    try {
      s = await stat(absPath);
    } catch {
      return;
    }
    let relPath: string;
    try {
      relPath = resolver.toRelative(absPath);
    } catch {
      return;
    }
    const sizeBytes = s.size;
    const mtimeMs = Math.floor(s.mtimeMs);
    const slash = relPath.lastIndexOf('/');
    const parentDir = slash < 0 ? '' : relPath.slice(0, slash);
    const filename = basename(absPath);

    // Rename match: an unlink with the same (size, mtime) is waiting in the
    // pending bucket. Pair them, cancel the delete timer, rename in place.
    const key = sigKey(sizeBytes, mtimeMs);
    const bucket = pending.get(key);
    if (bucket && bucket.length > 0 && ext === bucket[0].ext) {
      const match = bucket.shift()!;
      if (bucket.length === 0) pending.delete(key);
      clearTimeout(match.timer);
      files.applyRenames([
        {
          id: match.fileId,
          toRelPath: relPath,
          toParentDir: parentDir,
          toFilename: filename
        }
      ]);
      cb.onChange();
      return;
    }

    files.upsert({ relPath, parentDir, filename, ext, sizeBytes, mtimeMs });
    cb.onChange();
  };

  const handleUnlink = (absPath: string) => {
    const ext = extensionOf(absPath);
    if (!isSupportedExtension(ext)) return;
    let relPath: string;
    try {
      relPath = resolver.toRelative(absPath);
    } catch {
      return;
    }
    const file = files.getByRelPath(relPath);
    if (!file) return;

    const entry: PendingUnlink = {
      fileId: file.id,
      relPath: file.relPath,
      filename: file.filename,
      ext: file.ext,
      sizeBytes: file.sizeBytes,
      mtimeMs: file.mtimeMs,
      timer: setTimeout(() => {
        removePending(entry);
        if (files.deleteByRelPath(file.relPath)) cb.onChange();
      }, RENAME_WINDOW_MS)
    };
    const key = sigKey(file.sizeBytes, file.mtimeMs);
    const list = pending.get(key);
    if (list) list.push(entry);
    else pending.set(key, [entry]);
  };

  watcher.on('add', (p) => void handleAddOrChange(p));
  watcher.on('change', (p) => void handleAddOrChange(p));
  watcher.on('unlink', (p) => handleUnlink(p));
  watcher.on('error', (err) => cb.onError?.(err as Error));

  return {
    async close() {
      // Flush any pending unlinks to real deletes so we don't leak rows.
      for (const list of pending.values()) {
        for (const entry of list) {
          clearTimeout(entry.timer);
          if (files.deleteByRelPath(entry.relPath)) cb.onChange();
        }
      }
      pending.clear();
      await watcher.close();
    }
  };
}
