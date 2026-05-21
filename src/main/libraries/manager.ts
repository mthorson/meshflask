import { existsSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import type { LibrarySummary } from '@shared/types';
import {
  DB_FILENAME,
  insertLibraryRow,
  openLibraryDatabase,
  readLibraryRow
} from '@main/db/connection';
import { createFilesRepo, type FilesRepo } from '@main/db/repos/files';
import { createTagsRepo, type TagsRepo } from '@main/db/repos/tags';
import { createThumbnailsRepo, type ThumbnailsRepo } from '@main/db/repos/thumbnails';
import { createThumbJobsRepo, type ThumbJobsRepo } from '@main/db/repos/thumb-jobs';
import { createThumbErrorsRepo, type ThumbErrorsRepo } from '@main/db/repos/thumb-errors';
import { createCollectionsRepo, type CollectionsRepo } from '@main/db/repos/collections';
import { scanner } from '@main/scanner/service';
import { PathResolver } from '@shared/paths';
import * as registry from './registry';

/**
 * One open library: the per-machine registry entry plus a live DB handle and
 * cached repos. Held in memory for the app's lifetime so IPC doesn't reopen
 * the DB on every call.
 */
export interface OpenLibrary {
  entry: registry.RegistryEntry;
  db: Database.Database;
  resolver: PathResolver;
  files: FilesRepo;
  tags: TagsRepo;
  thumbnails: ThumbnailsRepo;
  thumbJobs: ThumbJobsRepo;
  thumbErrors: ThumbErrorsRepo;
  collections: CollectionsRepo;
}

const open = new Map<string, OpenLibrary>();

function toSummary(entry: registry.RegistryEntry, online: boolean): LibrarySummary {
  return {
    id: entry.id,
    name: entry.label,
    mountPath: entry.mountPath,
    online,
    lastSeen: entry.lastSeen
  };
}

function attachLibrary(entry: registry.RegistryEntry, db: Database.Database): OpenLibrary {
  const handle: OpenLibrary = {
    entry,
    db,
    resolver: new PathResolver(entry.mountPath),
    files: createFilesRepo(db, entry.id),
    tags: createTagsRepo(db),
    thumbnails: createThumbnailsRepo(db),
    thumbJobs: createThumbJobsRepo(db),
    thumbErrors: createThumbErrorsRepo(db),
    collections: createCollectionsRepo(db)
  };
  open.set(entry.id, handle);
  scanner.attach(entry.id, db, entry.mountPath);
  return handle;
}

function detachLibrary(id: string): void {
  scanner.detach(id);
  const handle = open.get(id);
  if (handle) {
    try {
      handle.db.close();
    } catch {
      // best-effort
    }
    open.delete(id);
  }
}

/**
 * Try to open every library in the registry. Missing mounts and id mismatches
 * are reported as offline rather than throwing — the user can still see the
 * library in the sidebar and remediate.
 */
export function openAllFromRegistry(): LibrarySummary[] {
  const summaries: LibrarySummary[] = [];
  for (const entry of registry.listEntries()) {
    if (open.has(entry.id)) {
      summaries.push(toSummary(entry, true));
      continue;
    }
    const dbPath = join(entry.mountPath, DB_FILENAME);
    if (!existsSync(dbPath)) {
      summaries.push(toSummary(entry, false));
      continue;
    }
    try {
      const db = openLibraryDatabase(entry.mountPath);
      const row = readLibraryRow(db);
      if (!row || row.id !== entry.id) {
        db.close();
        summaries.push(toSummary(entry, false));
        continue;
      }
      attachLibrary(entry, db);
      registry.touchLastSeen(entry.id);
      summaries.push(toSummary({ ...entry, lastSeen: Date.now() }, true));
    } catch {
      summaries.push(toSummary(entry, false));
    }
  }
  return summaries;
}

export function listLibraries(): LibrarySummary[] {
  return registry.listEntries().map((entry) => toSummary(entry, open.has(entry.id)));
}

export function getOpenLibrary(id: string): OpenLibrary | undefined {
  return open.get(id);
}

export function listOpenLibraries(): OpenLibrary[] {
  return [...open.values()];
}

export function addLibrary(args: {
  mountPath: string;
  name?: string;
}): { ok: true; library: LibrarySummary } | { ok: false; error: string } {
  const { mountPath } = args;

  if (!existsSync(mountPath)) {
    return { ok: false, error: `Folder does not exist: ${mountPath}` };
  }
  if (!statSync(mountPath).isDirectory()) {
    return { ok: false, error: `Not a directory: ${mountPath}` };
  }

  let db: Database.Database;
  try {
    db = openLibraryDatabase(mountPath);
  } catch (e) {
    return { ok: false, error: `Failed to open DB: ${(e as Error).message}` };
  }

  let id: string;
  let name: string;
  try {
    const existing = readLibraryRow(db);
    if (existing) {
      id = existing.id;
      name = existing.name;
    } else {
      id = uuid();
      name = args.name?.trim() || basename(mountPath) || 'Library';
      insertLibraryRow(db, { id, name });
    }
  } catch (e) {
    db.close();
    return { ok: false, error: `Failed to read/write library row: ${(e as Error).message}` };
  }

  // Upsert covers both first-add and re-mounting an existing library at a
  // new path (the supported way to "move" a library between mounts).
  registry.upsertEntry({ id, label: name, mountPath, lastSeen: Date.now() });

  // Detach any prior handle for this id (different mount) and re-attach.
  if (open.has(id)) detachLibrary(id);
  const entry = registry.findById(id)!;
  attachLibrary(entry, db);

  return { ok: true, library: toSummary(entry, true) };
}

export function renameLibrary(args: {
  id: string;
  name: string;
}): { ok: true; library: LibrarySummary } | { ok: false; error: string } {
  const name = args.name.trim();
  if (!name) return { ok: false, error: 'Name cannot be empty' };
  const entry = registry.findById(args.id);
  if (!entry) return { ok: false, error: 'Library not found' };

  const handle = open.get(args.id);
  if (handle) {
    try {
      handle.db.prepare('UPDATE library SET name = ?').run(name);
    } catch (e) {
      return { ok: false, error: `Failed to update DB: ${(e as Error).message}` };
    }
  }
  registry.upsertEntry({ ...entry, label: name });
  return { ok: true, library: toSummary({ ...entry, label: name }, !!handle) };
}

export function removeLibrary(args: {
  id: string;
  deleteCache?: boolean;
}): { ok: true } | { ok: false; error: string } {
  detachLibrary(args.id);
  const entry = registry.findById(args.id);
  registry.removeEntry(args.id);

  if (args.deleteCache && entry) {
    try {
      rmSync(join(entry.mountPath, DB_FILENAME), { force: true });
      rmSync(join(entry.mountPath, '.meshFlask'), { recursive: true, force: true });
    } catch (e) {
      return {
        ok: false,
        error: `Removed registry entry but cache delete failed: ${(e as Error).message}`
      };
    }
  }
  return { ok: true };
}

export function shutdown(): void {
  scanner.detachAll();
  for (const { db } of open.values()) {
    try {
      db.close();
    } catch {
      // best-effort
    }
  }
  open.clear();
}
