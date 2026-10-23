/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test fixtures guarantee these rows and elements. */
import { effectScope, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  columnStorageKey,
  defaultColumns,
  normalizeColumns,
  useInlineColumnSettings,
  validateColumns,
} from './useInlineColumnSettings';

const definitions = Array.from({ length: 6 }, (_, index) => ({
  field: `field${index}`,
  title: `列${index}`,
  width: 100,
}));
afterEach(() => vi.restoreAllMocks());

describe('inline column preferences', () => {
  it('merges new fields, ignores obsolete/duplicate fields and normalizes broken settings', () => {
    expect(normalizeColumns(null, definitions)).toEqual(
      defaultColumns(definitions),
    );
    const result = normalizeColumns(
      [
        { field: 'old' },
        { field: 'field2', width: 260, visible: false, fixed: 'right' },
        { field: 'field2' },
        { field: 'field0', width: -1, fixed: 'bad' },
      ],
      definitions,
    );
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({
      field: 'field2',
      width: 260,
      visible: false,
      fixed: 'right',
    });
    expect(result[1]?.width).toBe(100);
    expect(
      normalizeColumns(
        defaultColumns(definitions).map((column) => ({
          ...column,
          visible: false,
        })),
        definitions,
      ),
    ).toEqual(defaultColumns(definitions));
  });

  it('validates visibility, integer widths, count and actual frozen width budget', () => {
    const columns = defaultColumns(definitions);
    expect(validateColumns(columns, 800)).toBe('');
    expect(
      validateColumns(
        columns.map((column) => ({ ...column, visible: false })),
        800,
      ),
    ).toContain('至少');
    for (const width of [0, 59, 601, 100.5, Number.NaN])
      expect(validateColumns([{ ...columns[0]!, width }], 800)).toContain(
        '整数',
      );
    expect(
      validateColumns(
        columns.map((column) => ({ ...column, fixed: 'left' })),
        800,
      ),
    ).toContain('最多');
    expect(
      validateColumns([{ ...columns[0]!, width: 600, fixed: 'right' }], 600),
    ).toContain('过宽');
    expect(
      validateColumns(
        [
          { ...columns[0]!, width: 600, fixed: 'right', visible: false },
          columns[1]!,
        ],
        600,
      ),
    ).toBe('');
  });

  it('isolates scopes/accounts/tenants and shares applied preferences with mounted peers', async () => {
    const scope = effectScope();
    const key = ref(columnStorageKey(1, 'user1', 'order'));
    const first = scope.run(() =>
      useInlineColumnSettings(() => key.value, definitions),
    )!;
    const peer = scope.run(() =>
      useInlineColumnSettings(
        () => columnStorageKey(1, 'user1', 'order'),
        definitions,
      ),
    )!;
    const draft = defaultColumns(definitions);
    draft[0]!.visible = false;
    expect(first.save(draft)).toBe(true);
    draft[0]!.visible = true;
    expect(peer.applied.value[0]?.visible).toBe(false);
    expect(JSON.parse(localStorage.getItem(key.value)!)[0].visible).toBe(false);
    for (const next of [
      columnStorageKey(1, 'user1', 'in'),
      columnStorageKey(2, 'user1', 'order'),
      columnStorageKey(1, 'user2', 'order'),
    ]) {
      key.value = next;
      await nextTick();
      expect(first.applied.value[0]?.visible).toBe(true);
    }
    scope.stop();
  });

  it('loads saved configuration on first use, tolerates corrupt storage and applies despite write failure', () => {
    const scope = effectScope();
    const stored = defaultColumns(definitions);
    stored[0]!.width = 240;
    localStorage.setItem('columns-loaded', JSON.stringify(stored));
    localStorage.setItem('columns-broken', '{');
    const loaded = scope.run(() =>
      useInlineColumnSettings(() => 'columns-loaded', definitions),
    )!;
    expect(loaded.applied.value[0]?.width).toBe(240);
    const broken = scope.run(() =>
      useInlineColumnSettings(() => 'columns-broken', definitions),
    )!;
    expect(broken.applied.value).toEqual(defaultColumns(definitions));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(broken.save(stored)).toBe(false);
    expect(broken.applied.value[0]?.width).toBe(240);
    scope.stop();
  });
});
