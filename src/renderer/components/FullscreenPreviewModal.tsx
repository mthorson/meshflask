import { Modal, Stack, Text } from '@mantine/core';
import type { FileRecord } from '@shared/types';
import type { LightingStyle } from '@shared/lighting-types';
import { ModelViewer } from '../three/ModelViewer';
import { usePreferences } from '../util/use-preferences';
import { DEFAULT_RENDER_QUALITY } from '@shared/render-quality';

interface Props {
  opened: boolean;
  onClose: () => void;
  libraryId: string | null;
  file: FileRecord | null;
  lightingStyle: LightingStyle;
}

/**
 * Spacebar-launched fullscreen viewer. Hosts the same ModelViewer used by
 * PreviewPane, but stretched to fill the whole window. Arrow-key navigation
 * lives in the parent's global keydown handler — when the modal is open it
 * walks through `files` via `handleTileClick`, which updates the primary file
 * and so re-renders this modal with the new file.
 */
export function FullscreenPreviewModal({
  opened,
  onClose,
  libraryId,
  file,
  lightingStyle
}: Props) {
  const { prefs } = usePreferences();
  const renderQuality = prefs?.renderQuality ?? DEFAULT_RENDER_QUALITY;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      title={file?.filename ?? 'Preview'}
      padding={0}
      styles={{
        body: { height: 'calc(100vh - 60px)', padding: 0 },
        content: { background: '#101113' }
      }}
    >
      {!file || !libraryId ? (
        <Stack align="center" justify="center" h="100%">
          <Text c="dimmed">Select a file to preview.</Text>
        </Stack>
      ) : (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
          <ModelViewer
            libraryId={libraryId}
            file={file}
            lightingStyle={lightingStyle}
            renderQuality={renderQuality}
          />
        </div>
      )}
    </Modal>
  );
}
