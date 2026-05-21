import type { FolderRecord, FolderTreeNode } from './types';

/**
 * Build a folder tree from the flat list of (parentDir, fileCount) records the
 * DB returns. Intermediate ancestor directories that contain no files
 * directly are inferred as nodes with `immediateFileCount: 0`. The root node
 * always exists and uses `rootName` for display.
 */
export function buildFolderTree(records: FolderRecord[], rootName: string): FolderTreeNode {
  const nodes = new Map<string, FolderTreeNode>();

  const ensure = (path: string): FolderTreeNode => {
    let node = nodes.get(path);
    if (node) return node;
    const slash = path.lastIndexOf('/');
    const name = path === '' ? rootName : path.slice(slash + 1);
    node = {
      path,
      name,
      immediateFileCount: 0,
      recursiveFileCount: 0,
      children: []
    };
    nodes.set(path, node);
    if (path !== '') {
      const parentPath = slash < 0 ? '' : path.slice(0, slash);
      const parent = ensure(parentPath);
      parent.children.push(node);
    }
    return node;
  };

  ensure('');

  for (const rec of records) {
    const node = ensure(rec.parentDir);
    node.immediateFileCount = rec.fileCount;
  }

  // Recursive counts: bubble up from leaves. Sort deepest-first so each node
  // is processed after all its descendants. Root ('') is depth 0; everything
  // else is the slash-count + 1.
  const depth = (p: string) => (p === '' ? 0 : p.split('/').length);
  const sortedByDepth = [...nodes.values()].sort((a, b) => depth(b.path) - depth(a.path));
  for (const node of sortedByDepth) {
    node.recursiveFileCount =
      node.immediateFileCount +
      node.children.reduce((sum, c) => sum + c.recursiveFileCount, 0);
    node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  return nodes.get('')!;
}
