import { describe, expect, it } from 'vitest';
import { emptySmartQuery, isSmartQuery, isSmartQueryEmpty } from './smart-query';

describe('smart-query', () => {
  it('empty query is empty', () => {
    expect(isSmartQueryEmpty(emptySmartQuery())).toBe(true);
    expect(isSmartQueryEmpty({})).toBe(true);
  });

  it('detects non-empty rules', () => {
    expect(isSmartQueryEmpty({ search: 'hero' })).toBe(false);
    expect(isSmartQueryEmpty({ search: '   ' })).toBe(true);
    expect(isSmartQueryEmpty({ extensions: ['stl'] })).toBe(false);
    expect(isSmartQueryEmpty({ extensions: [] })).toBe(true);
    expect(isSmartQueryEmpty({ tagIds: [1] })).toBe(false);
    expect(isSmartQueryEmpty({ minRating: 4 })).toBe(false);
    expect(isSmartQueryEmpty({ minRating: 0 })).toBe(true);
    expect(isSmartQueryEmpty({ colorLabels: ['red'] })).toBe(false);
  });

  it('isSmartQuery validates shape', () => {
    expect(isSmartQuery({})).toBe(true);
    expect(isSmartQuery({ search: 'x', minRating: 3 })).toBe(true);
    expect(isSmartQuery(null)).toBe(false);
    expect(isSmartQuery('not an object')).toBe(false);
    expect(isSmartQuery({ search: 5 })).toBe(false);
    expect(isSmartQuery({ extensions: 'stl' })).toBe(false);
    expect(isSmartQuery({ tagIds: {} })).toBe(false);
  });
});
