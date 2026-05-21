/**
 * Sortable fields exposed in the grid toolbar. The metadata-derived fields
 * (`vertices`, `triangles`, `bboxVolume`) require the file to have been
 * rendered at least once; files without metadata sort to the end via
 * NULLS LAST.
 */
export const SORT_FIELDS = [
  'filename',
  'mtime',
  'size',
  'ext',
  'rating',
  'vertices',
  'triangles',
  'bboxVolume'
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortSpec = { field: 'filename', direction: 'asc' };

const SORT_FIELD_SET: ReadonlySet<string> = new Set(SORT_FIELDS);

export function isSortField(value: unknown): value is SortField {
  return typeof value === 'string' && SORT_FIELD_SET.has(value);
}

export function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function isSortSpec(value: unknown): value is SortSpec {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { field?: unknown; direction?: unknown };
  return isSortField(v.field) && isSortDirection(v.direction);
}

export const SORT_LABELS: Record<SortField, string> = {
  filename: 'Name',
  mtime: 'Modified',
  size: 'Size',
  ext: 'Type',
  rating: 'Rating',
  vertices: 'Vertices',
  triangles: 'Triangles',
  bboxVolume: 'Volume'
};
