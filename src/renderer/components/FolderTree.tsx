import { useMemo, useState } from 'react';
import type React from 'react';
import { ActionIcon, Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFolder, IconFolderOpen } from '@tabler/icons-react';
import type { FolderTreeNode } from '@shared/types';

interface Props {
  root: FolderTreeNode | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** Called when files are dropped onto a folder row. Optional. */
  onDropFiles?: (toParentDir: string, fileIds: number[]) => void;
}

/**
 * Lightweight recursive folder tree. Folders that contain no indexed files
 * (immediately or below) never appear because the underlying record set is
 * sparse; every node we render has at least one descendant 3D file.
 */
export function FolderTree({ root, selectedPath, onSelect, onDropFiles }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));

  // Auto-expand the path to the selected folder when selection changes externally.
  const ensureExpanded = useMemo(() => {
    if (!selectedPath) return expanded;
    if (expanded.has(selectedPath)) return expanded;
    const next = new Set(expanded);
    let cur = '';
    for (const seg of selectedPath.split('/').filter(Boolean)) {
      next.add(cur);
      cur = cur ? `${cur}/${seg}` : seg;
    }
    next.add(selectedPath);
    return next;
  }, [selectedPath, expanded]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!root) {
    return (
      <Text c="dimmed" size="sm">
        No library selected
      </Text>
    );
  }

  if (root.recursiveFileCount === 0) {
    return (
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          No 3D files found yet.
        </Text>
        <Text size="xs" c="dimmed">
          Supported: glb, gltf, obj, stl, ply, 3mf
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      <TreeRow
        node={root}
        depth={0}
        expanded={ensureExpanded}
        toggle={toggle}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onDropFiles={onDropFiles}
      />
    </Stack>
  );
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  selectedPath,
  onSelect,
  onDropFiles
}: {
  node: FolderTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onDropFiles?: (toParentDir: string, fileIds: number[]) => void;
}) {
  const isExpanded = expanded.has(node.path);
  const isSelected = node.path === selectedPath;
  const hasChildren = node.children.length > 0;
  const [dragHover, setDragHover] = useState(false);

  const acceptsDrop = onDropFiles != null;
  const handleDragOver = (e: React.DragEvent) => {
    if (!acceptsDrop) return;
    if (!e.dataTransfer.types.includes('application/x-wh3d-file-ids')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragHover(true);
  };
  const handleDragLeave = () => setDragHover(false);
  const handleDrop = (e: React.DragEvent) => {
    setDragHover(false);
    if (!acceptsDrop) return;
    const raw = e.dataTransfer.getData('application/x-wh3d-file-ids');
    if (!raw) return;
    e.preventDefault();
    try {
      const ids = JSON.parse(raw) as number[];
      if (Array.isArray(ids) && ids.every((n) => typeof n === 'number')) {
        onDropFiles(node.path, ids);
      }
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Group
        gap={2}
        wrap="nowrap"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          paddingLeft: depth * 12,
          borderRadius: 4,
          background: dragHover
            ? 'var(--mantine-color-indigo-9)'
            : isSelected
              ? 'var(--mantine-color-dark-5)'
              : undefined,
          outline: dragHover ? '1px dashed var(--mantine-color-indigo-4)' : undefined
        }}
      >
        <ActionIcon
          variant="transparent"
          size="sm"
          onClick={() => hasChildren && toggle(node.path)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
        <UnstyledButton
          onClick={() => onSelect(node.path)}
          style={{ flex: 1, padding: '4px 4px', minWidth: 0 }}
        >
          <Group gap={6} wrap="nowrap">
            {isExpanded && hasChildren ? (
              <IconFolderOpen size={14} />
            ) : (
              <IconFolder size={14} />
            )}
            <Text size="sm" truncate style={{ flex: 1 }}>
              {node.name}
            </Text>
            <Badge size="xs" variant="light" color="gray">
              {node.recursiveFileCount}
            </Badge>
          </Group>
        </UnstyledButton>
      </Group>
      {isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onDropFiles={onDropFiles}
          />
        ))}
    </>
  );
}
