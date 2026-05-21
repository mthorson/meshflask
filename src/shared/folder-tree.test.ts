import { describe, expect, it } from 'vitest';
import { buildFolderTree } from './folder-tree';

describe('buildFolderTree', () => {
  it('returns a root with the given name when there are no records', () => {
    const root = buildFolderTree([], 'My Lib');
    expect(root.path).toBe('');
    expect(root.name).toBe('My Lib');
    expect(root.children).toEqual([]);
    expect(root.immediateFileCount).toBe(0);
    expect(root.recursiveFileCount).toBe(0);
  });

  it('attaches files at the root', () => {
    const root = buildFolderTree([{ parentDir: '', fileCount: 3 }], 'Lib');
    expect(root.immediateFileCount).toBe(3);
    expect(root.recursiveFileCount).toBe(3);
  });

  it('infers intermediate ancestors that contain no direct files', () => {
    const root = buildFolderTree(
      [{ parentDir: 'a/b/c', fileCount: 5 }],
      'Lib'
    );
    const a = root.children[0];
    expect(a.path).toBe('a');
    expect(a.immediateFileCount).toBe(0);
    expect(a.recursiveFileCount).toBe(5);
    const b = a.children[0];
    expect(b.path).toBe('a/b');
    const c = b.children[0];
    expect(c.path).toBe('a/b/c');
    expect(c.immediateFileCount).toBe(5);
  });

  it('aggregates recursive counts across siblings', () => {
    const root = buildFolderTree(
      [
        { parentDir: '', fileCount: 1 },
        { parentDir: 'models', fileCount: 4 },
        { parentDir: 'models/heroes', fileCount: 2 },
        { parentDir: 'models/props', fileCount: 7 }
      ],
      'Lib'
    );
    expect(root.immediateFileCount).toBe(1);
    expect(root.recursiveFileCount).toBe(14);
    const models = root.children.find((c) => c.path === 'models')!;
    expect(models.immediateFileCount).toBe(4);
    expect(models.recursiveFileCount).toBe(13);
    expect(models.children.map((c) => c.name)).toEqual(['heroes', 'props']);
  });

  it('sorts children case-insensitively', () => {
    const root = buildFolderTree(
      [
        { parentDir: 'Zebra', fileCount: 1 },
        { parentDir: 'apple', fileCount: 1 },
        { parentDir: 'Banana', fileCount: 1 }
      ],
      'Lib'
    );
    expect(root.children.map((c) => c.name)).toEqual(['apple', 'Banana', 'Zebra']);
  });
});
