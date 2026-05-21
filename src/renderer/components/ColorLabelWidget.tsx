import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconCircleFilled, IconCircle, IconCircleX } from '@tabler/icons-react';
import { COLOR_LABELS, COLOR_LABEL_HEX, type ColorLabel } from '@shared/ratings';

interface Props {
  value: ColorLabel | null;
  onChange: (label: ColorLabel | null) => void;
  mixed?: boolean;
  size?: number;
  disabled?: boolean;
}

/**
 * Five color swatches + a "no label" clear button. Click an active swatch to
 * clear (equivalent to passing null). `mixed` indicates a selection with
 * varied labels — all swatches render hollow, click still applies uniformly.
 */
export function ColorLabelWidget({ value, onChange, mixed = false, size = 14, disabled }: Props) {
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={mixed ? 'Clear label on all selected' : 'No label'} withinPortal>
        <ActionIcon
          variant="transparent"
          size="xs"
          disabled={disabled}
          onClick={() => onChange(null)}
          aria-label="Clear color label"
        >
          {!mixed && value === null ? (
            <IconCircleX size={size} color="var(--mantine-color-gray-5)" />
          ) : (
            <IconCircle size={size} color="var(--mantine-color-dark-2)" />
          )}
        </ActionIcon>
      </Tooltip>
      {COLOR_LABELS.map((c) => {
        const active = !mixed && value === c;
        return (
          <Tooltip key={c} label={mixed ? `Set ${c} on all selected` : c} withinPortal>
            <ActionIcon
              variant="transparent"
              size="xs"
              disabled={disabled}
              onClick={() => onChange(active ? null : c)}
              aria-label={`${c} label`}
            >
              {active ? (
                <IconCircleFilled size={size} color={COLOR_LABEL_HEX[c]} />
              ) : (
                <IconCircle size={size} color={COLOR_LABEL_HEX[c]} />
              )}
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Group>
  );
}
