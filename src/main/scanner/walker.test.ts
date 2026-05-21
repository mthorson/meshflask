import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PathResolver } from '../../shared/paths';
import { walkLibrary } from './walker';
import type { UpsertInput } from '../db/repos/files';

const TESTFILES = resolve(__dirname, '../../../testfiles');

// Skip the suite if the user hasn't placed sample files there.
const hasFixtures = existsSync(TESTFILES);

describe.runIf(hasFixtures)('walkLibrary against testfiles/', () => {
  it('finds the Manticore 3mf at the root and all 5 stl parts in the subfolder', async () => {
    const resolver = new PathResolver(TESTFILES);
    const collected: UpsertInput[] = [];
    const { totalSeen, seenRelPaths } = await walkLibrary(resolver, {
      onBatch: (batch) => {
        collected.push(...batch);
      }
    });

    expect(totalSeen).toBe(6);
    expect(collected).toHaveLength(6);
    expect(seenRelPaths.size).toBe(6);

    // POSIX paths only — even though the directory name has spaces.
    for (const p of seenRelPaths) {
      expect(p).not.toContain('\\');
    }

    expect(seenRelPaths.has('manticore.3mf')).toBe(true);

    const stlPaths = [...seenRelPaths].filter((p) => p.endsWith('.stl')).sort();
    expect(stlPaths).toHaveLength(5);
    for (const p of stlPaths) {
      expect(p.startsWith('Manticore - Tabletop Miniature - 4441441/files/')).toBe(true);
      expect(p.endsWith('.stl')).toBe(true);
    }

    // Root-level file has parentDir === ''.
    const root3mf = collected.find((c) => c.relPath === 'manticore.3mf')!;
    expect(root3mf.parentDir).toBe('');
    expect(root3mf.ext).toBe('3mf');
    expect(root3mf.sizeBytes).toBeGreaterThan(0);

    // Nested file has the correct POSIX parentDir.
    const oneStl = collected.find((c) => c.ext === 'stl')!;
    expect(oneStl.parentDir).toBe('Manticore - Tabletop Miniature - 4441441/files');
  });

  it('skips the .meshFlask/ cache directory if present', async () => {
    // Just verify the walker doesn't blow up on a real directory and that
    // there is no leakage of dot-files into the result set.
    const resolver = new PathResolver(TESTFILES);
    const { seenRelPaths } = await walkLibrary(resolver);
    for (const p of seenRelPaths) {
      expect(p.split('/').some((seg) => seg.startsWith('.'))).toBe(false);
    }
  });
});
