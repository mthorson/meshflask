import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconArrowsLeftRight,
  IconCircleMinus,
  IconEdit,
  IconRefresh,
  IconRotateClockwise
} from '@tabler/icons-react';
import type {
  CollectionRecord,
  CollectionWithCount,
  ColorLabel,
  FileRecord,
  TagWithCount
} from '@shared/types';
import { UP_AXIS_OPTIONS, type FileOrientation, type UpAxis } from '@shared/orientation';
import { BulkTagEditor } from './BulkTagEditor';
import { AddToCollectionMenu } from './AddToCollectionMenu';
import { RatingWidget } from './RatingWidget';
import { ColorLabelWidget } from './ColorLabelWidget';

interface Props {
  libraryId: string;
  selectedFiles: FileRecord[];
  allTags: TagWithCount[];
  collections: CollectionWithCount[];
  /** When set, the user is viewing this collection; expose "Remove from collection". */
  activeCollectionId: number | null;
  tagRefreshKey: number;
  onBulkAddTag: (tagName: string) => Promise<void>;
  onBulkRemoveTag: (tagId: number) => Promise<void>;
  onBulkSetOrientation: (orientation: FileOrientation | null) => Promise<void>;
  onBulkSetRating: (rating: number) => Promise<void>;
  onBulkSetColorLabel: (label: ColorLabel | null) => Promise<void>;
  onBulkRerender: () => Promise<void>;
  onBatchRename: () => void;
  onCompare: () => void;
  onAddToCollection: (collectionId: number, fileIds: number[]) => Promise<void> | void;
  onRemoveFromCollection: (collectionId: number, fileIds: number[]) => Promise<void> | void;
  onCreateCollection: (name: string) => Promise<CollectionRecord | null>;
}

/**
 * Right-pane content when more than one file is selected. Hides single-file
 * fields (path, geometry stats) and exposes bulk actions: tags, orientation,
 * re-render, collection membership.
 *
 * The orientation block intentionally only lets the user set ONE orientation
 * across the whole selection — yaw rotation is per-file (each file has its
 * own current yaw) and stays in the single-file PreviewPane. Apply yaw=0
 * here to normalize everything.
 */
export function BulkMetadataPanel({
  libraryId,
  selectedFiles,
  allTags,
  collections,
  activeCollectionId,
  tagRefreshKey,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkSetOrientation,
  onBulkSetRating,
  onBulkSetColorLabel,
  onBulkRerender,
  onBatchRename,
  onCompare,
  onAddToCollection,
  onRemoveFromCollection,
  onCreateCollection
}: Props) {
  const fileIds = useMemo(() => selectedFiles.map((f) => f.id), [selectedFiles]);
  const extCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of selectedFiles) m.set(f.ext, (m.get(f.ext) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [selectedFiles]);

  // When every selected file shares the same upAxis, show it as the active
  // segment; otherwise leave the control unselected so the user is making an
  // explicit choice rather than seeing a misleading "current".
  const commonUpAxis = useMemo<UpAxis | ''>(() => {
    if (selectedFiles.length === 0) return '';
    const first = selectedFiles[0].orientation.upAxis;
    for (const f of selectedFiles) if (f.orientation.upAxis !== first) return '';
    return first;
  }, [selectedFiles]);

  // Same idea for rating + color label: only show a "current" value when the
  // whole selection agrees; otherwise the widget renders in mixed mode.
  const commonRating = useMemo<number | 'mixed'>(() => {
    if (selectedFiles.length === 0) return 0;
    const first = selectedFiles[0].rating;
    for (const f of selectedFiles) if (f.rating !== first) return 'mixed';
    return first;
  }, [selectedFiles]);

  const commonLabel = useMemo<ColorLabel | null | 'mixed'>(() => {
    if (selectedFiles.length === 0) return null;
    const first = selectedFiles[0].colorLabel;
    for (const f of selectedFiles) if (f.colorLabel !== first) return 'mixed';
    return first;
  }, [selectedFiles]);

  const [busy, setBusy] = useState(false);
  const wrapBusy =
    <T,>(fn: () => Promise<T>) =>
    async () => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    };

  return (
    <Stack gap="sm" p="md" style={{ height: '100%', overflow: 'auto' }}>
      <Group justify="space-between" align="center">
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
          Selection
        </Text>
        <Badge variant="light" color="indigo" size="sm">
          {selectedFiles.length} files
        </Badge>
      </Group>

      <Group gap={4} wrap="wrap">
        {extCounts.map(([ext, n]) => (
          <Badge key={ext} size="xs" variant="default">
            .{ext} · {n}
          </Badge>
        ))}
      </Group>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
          Triage
        </Text>
        <Group gap="md" wrap="wrap">
          <RatingWidget
            value={commonRating === 'mixed' ? 0 : commonRating}
            mixed={commonRating === 'mixed'}
            onChange={(r) => void onBulkSetRating(r)}
            disabled={busy}
          />
          <ColorLabelWidget
            value={commonLabel === 'mixed' ? null : commonLabel}
            mixed={commonLabel === 'mixed'}
            onChange={(l) => void onBulkSetColorLabel(l)}
            disabled={busy}
          />
        </Group>
      </Stack>

      <Divider />

      <BulkTagEditor
        libraryId={libraryId}
        fileIds={fileIds}
        allTags={allTags}
        refreshKey={tagRefreshKey}
        onBulkAddTag={onBulkAddTag}
        onBulkRemoveTag={onBulkRemoveTag}
      />

      <Divider />

      <Stack gap={6}>
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
            Orientation
          </Text>
          <Tooltip label="Reset all selected to format default">
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconRotateClockwise size={12} />}
              onClick={wrapBusy(() => onBulkSetOrientation(null))}
              disabled={busy}
            >
              reset
            </Button>
          </Tooltip>
        </Group>
        <Group gap={6} wrap="wrap">
          <SegmentedControl
            size="xs"
            value={commonUpAxis}
            data={UP_AXIS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) =>
              void wrapBusy(() => onBulkSetOrientation({ upAxis: v as UpAxis, yaw: 0 }))()
            }
            disabled={busy}
          />
        </Group>
        <Text size="xs" c="dimmed">
          Sets up axis for all selected (yaw resets to 0°). Per-file yaw lives in the preview.
        </Text>
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
          Actions
        </Text>
        <Group gap={6} wrap="wrap">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={wrapBusy(() => onBulkRerender())}
            disabled={busy}
          >
            Re-render thumbnails
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEdit size={14} />}
            onClick={onBatchRename}
          >
            Batch rename…
          </Button>
          {selectedFiles.length === 2 && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconArrowsLeftRight size={14} />}
              onClick={onCompare}
            >
              Compare
            </Button>
          )}
          <AddToCollectionMenu
            collections={collections}
            fileIds={fileIds}
            onAdd={onAddToCollection}
            onCreate={onCreateCollection}
          />
          {activeCollectionId != null && (
            <Tooltip label="Remove selected from this collection">
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconCircleMinus size={14} />}
                onClick={() => void onRemoveFromCollection(activeCollectionId, fileIds)}
              >
                Remove from collection
              </Button>
            </Tooltip>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}
