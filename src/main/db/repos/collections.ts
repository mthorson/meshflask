import type Database from 'better-sqlite3';
import type { CollectionRecord, CollectionWithCount } from '@shared/types';
import { isSmartQuery, type SmartQuery } from '@shared/smart-query';

export interface CollectionsRepo {
  create(name: string): CollectionRecord;
  /** Create a smart collection whose membership is derived from `query`. */
  createSmart(name: string, query: SmartQuery): CollectionRecord;
  rename(id: number, newName: string): CollectionRecord | null;
  /** Replace the stored query on a smart collection. */
  updateSmartQuery(id: number, query: SmartQuery): CollectionRecord | null;
  delete(id: number): void;
  getById(id: number): CollectionRecord | null;
  list(): CollectionRecord[];
  listWithCounts(): CollectionWithCount[];
  /**
   * Append the given files to the collection in the supplied order. Files
   * already present are skipped (their position is preserved). Returns the
   * number of newly added rows.
   */
  addFiles(collectionId: number, fileIds: number[]): number;
  /**
   * Remove files from a collection. Other files' positions are NOT compacted
   * — `position` is only meaningful for ordering, gaps are fine.
   */
  removeFiles(collectionId: number, fileIds: number[]): number;
  /** File ids currently in the collection, ordered by position. */
  listFileIds(collectionId: number): number[];
}

interface RawRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
  query_json: string | null;
}

interface RawWithCount extends RawRow {
  file_count: number;
}

function parseQuery(json: string | null): SmartQuery | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return isSmartQuery(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rowToRecord(row: RawRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    smartQuery: parseQuery(row.query_json)
  };
}

export function createCollectionsRepo(db: Database.Database): CollectionsRepo {
  const insertStmt = db.prepare<[string, number, number, string | null]>(
    `INSERT INTO collections (name, created_at, updated_at, query_json) VALUES (?, ?, ?, ?)`
  );
  const renameStmt = db.prepare<[string, number, number]>(
    `UPDATE collections SET name = ?, updated_at = ? WHERE id = ?`
  );
  const updateQueryStmt = db.prepare<[string, number, number]>(
    `UPDATE collections SET query_json = ?, updated_at = ? WHERE id = ?`
  );
  const deleteStmt = db.prepare<[number]>(`DELETE FROM collections WHERE id = ?`);
  const getByIdStmt = db.prepare<[number]>(
    `SELECT id, name, created_at, updated_at, query_json FROM collections WHERE id = ?`
  );
  const listStmt = db.prepare(
    `SELECT id, name, created_at, updated_at, query_json
     FROM collections ORDER BY name COLLATE NOCASE`
  );
  const listWithCountsStmt = db.prepare(`
    SELECT c.id, c.name, c.created_at, c.updated_at, c.query_json,
      COUNT(cf.file_id) AS file_count
    FROM collections c
    LEFT JOIN collection_files cf ON cf.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `);
  const maxPositionStmt = db.prepare<[number]>(
    `SELECT COALESCE(MAX(position), -1) AS m FROM collection_files WHERE collection_id = ?`
  );
  const insertFileStmt = db.prepare<[number, number, number, number]>(
    `INSERT OR IGNORE INTO collection_files (collection_id, file_id, position, added_at)
     VALUES (?, ?, ?, ?)`
  );
  const removeFileStmt = db.prepare<[number, number]>(
    `DELETE FROM collection_files WHERE collection_id = ? AND file_id = ?`
  );
  const listFileIdsStmt = db.prepare<[number]>(
    `SELECT file_id FROM collection_files WHERE collection_id = ? ORDER BY position`
  );
  const touchStmt = db.prepare<[number, number]>(
    `UPDATE collections SET updated_at = ? WHERE id = ?`
  );

  return {
    create(name) {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Collection name cannot be empty');
      const now = Date.now();
      const result = insertStmt.run(trimmed, now, now, null);
      return {
        id: Number(result.lastInsertRowid),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        smartQuery: null
      };
    },
    createSmart(name, query) {
      const trimmed = name.trim();
      if (trimmed === '') throw new Error('Collection name cannot be empty');
      const now = Date.now();
      const result = insertStmt.run(trimmed, now, now, JSON.stringify(query));
      return {
        id: Number(result.lastInsertRowid),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        smartQuery: query
      };
    },
    updateSmartQuery(id, query) {
      updateQueryStmt.run(JSON.stringify(query), Date.now(), id);
      const row = getByIdStmt.get(id) as RawRow | undefined;
      return row ? rowToRecord(row) : null;
    },
    rename(id, newName) {
      const trimmed = newName.trim();
      if (trimmed === '') throw new Error('Collection name cannot be empty');
      renameStmt.run(trimmed, Date.now(), id);
      const row = getByIdStmt.get(id) as RawRow | undefined;
      return row ? rowToRecord(row) : null;
    },
    delete(id) {
      deleteStmt.run(id);
    },
    getById(id) {
      const row = getByIdStmt.get(id) as RawRow | undefined;
      return row ? rowToRecord(row) : null;
    },
    list() {
      return (listStmt.all() as RawRow[]).map(rowToRecord);
    },
    listWithCounts() {
      return (listWithCountsStmt.all() as RawWithCount[]).map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        smartQuery: parseQuery(r.query_json),
        fileCount: r.file_count
      }));
    },
    addFiles(collectionId, fileIds) {
      if (fileIds.length === 0) return 0;
      let added = 0;
      const tx = db.transaction((ids: number[]) => {
        const startRow = maxPositionStmt.get(collectionId) as { m: number };
        let pos = startRow.m + 1;
        const now = Date.now();
        for (const fid of ids) {
          const res = insertFileStmt.run(collectionId, fid, pos, now);
          if (res.changes > 0) {
            added++;
            pos++;
          }
        }
        if (added > 0) touchStmt.run(now, collectionId);
      });
      tx(fileIds);
      return added;
    },
    removeFiles(collectionId, fileIds) {
      if (fileIds.length === 0) return 0;
      let removed = 0;
      const tx = db.transaction((ids: number[]) => {
        for (const fid of ids) {
          removed += removeFileStmt.run(collectionId, fid).changes;
        }
        if (removed > 0) touchStmt.run(Date.now(), collectionId);
      });
      tx(fileIds);
      return removed;
    },
    listFileIds(collectionId) {
      const rows = listFileIdsStmt.all(collectionId) as { file_id: number }[];
      return rows.map((r) => r.file_id);
    }
  };
}
