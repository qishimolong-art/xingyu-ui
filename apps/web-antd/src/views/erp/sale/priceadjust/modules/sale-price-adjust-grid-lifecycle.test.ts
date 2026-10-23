import { describe, expect, it, vi } from 'vitest';

import { refreshSalePriceAdjustGridColumns } from './sale-price-adjust-grid-lifecycle';

describe('sale price adjust selector grid column lifecycle', () => {
  it('only stores columns while the selector is closed', async () => {
    const setColumns = vi.fn();
    const nextTick = vi.fn(async () => undefined);
    const reloadColumns = vi.fn();

    await expect(
      refreshSalePriceAdjustGridColumns({
        columns: ['partName'],
        isOpen: false,
        nextTick,
        reloadColumns,
        setColumns,
      }),
    ).resolves.toBe(false);

    expect(setColumns).toHaveBeenCalledWith(['partName']);
    expect(nextTick).not.toHaveBeenCalled();
    expect(reloadColumns).not.toHaveBeenCalled();
  });

  it('reloads permission columns after the open grid has mounted', async () => {
    const calls: string[] = [];

    await expect(
      refreshSalePriceAdjustGridColumns({
        columns: ['partCode'],
        isOpen: true,
        nextTick: async () => {
          calls.push('nextTick');
        },
        reloadColumns: async () => {
          calls.push('reload');
        },
        setColumns: () => {
          calls.push('set');
        },
      }),
    ).resolves.toBe(true);

    expect(calls).toEqual(['set', 'nextTick', 'reload']);
  });

  it('does not let a grid refresh failure escape into the parent form', async () => {
    await expect(
      refreshSalePriceAdjustGridColumns({
        columns: ['stockCount'],
        isOpen: true,
        nextTick: async () => undefined,
        reloadColumns: async () => {
          throw new TypeError('reloadColumn is not a function');
        },
        setColumns: () => undefined,
      }),
    ).resolves.toBe(false);
  });

  it('contains a wrapper column update failure while the grid is unavailable', async () => {
    const nextTick = vi.fn(async () => undefined);
    const reloadColumns = vi.fn();

    await expect(
      refreshSalePriceAdjustGridColumns({
        columns: ['outCount'],
        isOpen: false,
        nextTick,
        reloadColumns,
        setColumns: () => {
          throw new TypeError('grid wrapper is unavailable');
        },
      }),
    ).resolves.toBe(false);

    expect(nextTick).not.toHaveBeenCalled();
    expect(reloadColumns).not.toHaveBeenCalled();
  });
});
