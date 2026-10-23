import { effectScope, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INLINE_STOCK_DEFAULT_PAGE_SIZE,
  INLINE_STOCK_PAGE_SIZE_OPTIONS,
  inlineStockPageSizeStorageKey,
  normalizeInlineStockPageSize,
  useInlineStockPageSize,
} from './useInlineStockPageSize';

afterEach(() => vi.restoreAllMocks());

describe('inline stock page-size preference', () => {
  it('only accepts supported sizes and defaults to ten', () => {
    expect(INLINE_STOCK_PAGE_SIZE_OPTIONS).toEqual([5, 10, 20, 50]);
    for (const value of INLINE_STOCK_PAGE_SIZE_OPTIONS)
      expect(normalizeInlineStockPageSize(value)).toBe(value);
    for (const value of [undefined, null, '', 0, 15, 200, 'broken'])
      expect(normalizeInlineStockPageSize(value)).toBe(
        INLINE_STOCK_DEFAULT_PAGE_SIZE,
      );
  });

  it('shares one tenant/user value across business entries and isolates identities', async () => {
    const scope = effectScope();
    const key = ref(inlineStockPageSizeStorageKey(1, 'page-size-user'));
    const sale = scope.run(() => useInlineStockPageSize(() => key.value))!;
    const purchase = scope.run(() =>
      useInlineStockPageSize(() =>
        inlineStockPageSizeStorageKey(1, 'page-size-user'),
      ),
    )!;
    expect(sale.pageSize.value).toBe(10);
    expect(sale.save(20)).toBe(true);
    expect(purchase.pageSize.value).toBe(20);
    expect(localStorage.getItem(key.value)).toBe('20');

    key.value = inlineStockPageSizeStorageKey(2, 'page-size-user');
    await nextTick();
    expect(sale.pageSize.value).toBe(10);
    key.value = inlineStockPageSizeStorageKey(1, 'another-page-size-user');
    await nextTick();
    expect(sale.pageSize.value).toBe(10);
    scope.stop();
  });

  it('loads valid storage, rejects corrupt storage and keeps the applied value when persistence fails', () => {
    const scope = effectScope();
    localStorage.setItem('page-size-loaded', '50');
    localStorage.setItem('page-size-broken', '"unsupported"');
    const loaded = scope.run(() =>
      useInlineStockPageSize(() => 'page-size-loaded'),
    )!;
    const broken = scope.run(() =>
      useInlineStockPageSize(() => 'page-size-broken'),
    )!;
    expect(loaded.pageSize.value).toBe(50);
    expect(broken.pageSize.value).toBe(10);

    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(broken.save(5)).toBe(false);
    expect(broken.pageSize.value).toBe(5);
    scope.stop();
  });
});
