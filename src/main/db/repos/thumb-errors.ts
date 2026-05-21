import type Database from 'better-sqlite3';

export interface ThumbErrorRow {
  fileId: number;
  error: string;
  failedAt: number;
  attempts: number;
  sourceMtimeMs: number;
  rendererVersion: number;
}

export interface ThumbErrorsRepo {
  /** Record (or replace) a persistent failure for a file. */
  upsert(row: ThumbErrorRow): void;
  /** Forget the failure — used on manual rerender. */
  clear(fileId: number): void;
  /** Wipe every error — used when rebuilding the cache from scratch. */
  clearAll(): number;
  getByFileId(fileId: number): ThumbErrorRow | null;
  /**
   * Bulk-clear failures whose recorded error message is in `messages`. Used
   * on app start to scrub spurious "shutting down" entries left behind when
   * the app exited mid-render.
   */
  clearWithMessages(messages: readonly string[]): number;
}

interface RawRow {
  file_id: number;
  error: string;
  failed_at: number;
  attempts: number;
  source_mtime_ms: number;
  renderer_version: number;
}

function toRow(r: RawRow): ThumbErrorRow {
  return {
    fileId: r.file_id,
    error: r.error,
    failedAt: r.failed_at,
    attempts: r.attempts,
    sourceMtimeMs: r.source_mtime_ms,
    rendererVersion: r.renderer_version
  };
}

export function createThumbErrorsRepo(db: Database.Database): ThumbErrorsRepo {
  const upsertStmt = db.prepare(`
    INSERT INTO thumb_errors (file_id, error, failed_at, attempts, source_mtime_ms, renderer_version)
    VALUES (@fileId, @error, @failedAt, @attempts, @sourceMtimeMs, @rendererVersion)
    ON CONFLICT(file_id) DO UPDATE SET
      error = excluded.error,
      failed_at = excluded.failed_at,
      attempts = excluded.attempts,
      source_mtime_ms = excluded.source_mtime_ms,
      renderer_version = excluded.renderer_version
  `);
  const clearStmt = db.prepare<[number]>(`DELETE FROM thumb_errors WHERE file_id = ?`);
  const getStmt = db.prepare<[number]>(`SELECT * FROM thumb_errors WHERE file_id = ?`);

  return {
    upsert(row) {
      upsertStmt.run(row);
    },
    clear(fileId) {
      clearStmt.run(fileId);
    },
    clearAll() {
      return db.prepare(`DELETE FROM thumb_errors`).run().changes;
    },
    getByFileId(fileId) {
      const r = getStmt.get(fileId) as RawRow | undefined;
      return r ? toRow(r) : null;
    },
    clearWithMessages(messages) {
      if (messages.length === 0) return 0;
      const placeholders = messages.map(() => '?').join(',');
      const stmt = db.prepare(`DELETE FROM thumb_errors WHERE error IN (${placeholders})`);
      return stmt.run(...messages).changes;
    }
  };
}
