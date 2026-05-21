import { useState, type ReactNode } from 'react';
import { Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

interface Props {
  title: string;
  /** Optional content rendered on the right side of the header (e.g. a
   *  filter-active badge or clear button). The header click region excludes
   *  this slot so right-side actions don't accidentally toggle the section. */
  right?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * A header + collapsible body. Used in the pinned-bottom area of the left
 * sidebar so navigators like Favorites/Recent/Triage/Tags can be tucked away
 * without affecting the directory tree's vertical real estate above.
 */
export function CollapsibleSection({
  title,
  right,
  defaultExpanded = false,
  children
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Stack gap={2}>
      <Group gap={4} wrap="nowrap" justify="space-between">
        <UnstyledButton
          onClick={() => setExpanded((v) => !v)}
          style={{ flex: 1, minWidth: 0, padding: '2px 0' }}
          aria-expanded={expanded}
        >
          <Group gap={4} wrap="nowrap">
            {expanded ? (
              <IconChevronDown size={11} />
            ) : (
              <IconChevronRight size={11} />
            )}
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              {title}
            </Text>
          </Group>
        </UnstyledButton>
        {right}
      </Group>
      <Collapse in={expanded}>{children}</Collapse>
    </Stack>
  );
}
