import { computed, shallowReactive, shallowRef, watch } from 'vue';

export const INLINE_STOCK_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
export const INLINE_STOCK_DEFAULT_PAGE_SIZE = 10;

type InlineStockPageSize = (typeof INLINE_STOCK_PAGE_SIZE_OPTIONS)[number];

const pageSizes = shallowReactive(new Map<string, InlineStockPageSize>());

export function inlineStockPageSizeStorageKey(tenant: unknown, user: unknown) {
  if (user === undefined || user === null || user === '') return '';
  return `xingyu-erp:inline-stock-page-size:v1:${encodeURIComponent(String(tenant ?? 'default'))}:${encodeURIComponent(String(user))}`;
}

export function normalizeInlineStockPageSize(
  value: unknown,
): InlineStockPageSize {
  const numberValue = Number(value);
  return INLINE_STOCK_PAGE_SIZE_OPTIONS.includes(
    numberValue as InlineStockPageSize,
  )
    ? (numberValue as InlineStockPageSize)
    : INLINE_STOCK_DEFAULT_PAGE_SIZE;
}

/** Page-size preferences are shared by all inline stock pickers for one tenant/user. */
export function useInlineStockPageSize(key: () => string) {
  const transient = shallowRef<InlineStockPageSize>(
    INLINE_STOCK_DEFAULT_PAGE_SIZE,
  );
  watch(
    key,
    (storageKey) => {
      transient.value = INLINE_STOCK_DEFAULT_PAGE_SIZE;
      if (!storageKey || pageSizes.has(storageKey)) return;
      let saved: unknown;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      } catch {
        /* Storage may be unavailable or contain an invalid legacy value. */
      }
      pageSizes.set(storageKey, normalizeInlineStockPageSize(saved));
    },
    { immediate: true },
  );
  const pageSize = computed(() => pageSizes.get(key()) ?? transient.value);
  function save(value: unknown) {
    const next = normalizeInlineStockPageSize(value);
    const storageKey = key();
    if (!storageKey) {
      transient.value = next;
      return false;
    }
    pageSizes.set(storageKey, next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }
  return { pageSize, save };
}
