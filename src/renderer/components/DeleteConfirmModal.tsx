import { Button, Group, List, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import type { FileRecord } from '@shared/types';

interface Props {
  opened: boolean;
  files: FileRecord[];
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Always-on confirm for delete (per user preference). Lists up to ~15
 * filenames; beyond that shows a count summary. Files move to OS trash, so
 * recovery is one drag-out away — but we still confirm.
 */
export function DeleteConfirmModal({ opened, files, onCancel, onConfirm }: Props) {
  const visible = files.slice(0, 15);
  const hidden = files.length - visible.length;

  return (
    <Modal opened={opened} onClose={onCancel} centered size="md" title="Move to Trash?">
      <Stack gap="md">
        <Text size="sm">
          Move {files.length} file{files.length === 1 ? '' : 's'} to the system Trash? You can
          restore from Finder if you change your mind.
        </Text>
        <ScrollArea h={Math.min(200, visible.length * 22 + 12)}>
          <List size="xs" spacing={2}>
            {visible.map((f) => (
              <List.Item key={f.id}>{f.filename}</List.Item>
            ))}
          </List>
          {hidden > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              …and {hidden} more.
            </Text>
          )}
        </ScrollArea>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm}>
            Move to Trash
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
