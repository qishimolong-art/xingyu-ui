import { onBeforeUnmount, ref, shallowRef } from 'vue';

type SummaryFetcher<T> = (
  params: Record<string, any>,
  signal: AbortSignal,
) => Promise<T>;

const IGNORED_KEYS = new Set([
  'includeItems',
  'orderDirection',
  'orderField',
  'pageNo',
  'pageSize',
  'sort',
  'sorts',
]);

function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .toSorted()
      .reduce<Record<string, any>>((result, key) => {
        if (
          !IGNORED_KEYS.has(key) &&
          value[key] !== undefined &&
          value[key] !== ''
        ) {
          result[key] = normalize(value[key]);
        }
        return result;
      }, {});
  }
  return value;
}

export function usePurchaseQuerySummary<T>(fetcher: SummaryFetcher<T>) {
  const summary = shallowRef<T>();
  const loading = ref(false);
  const error = ref(false);
  let controller: AbortController | undefined;
  let requestId = 0;
  let lastKey = '';
  let lastParams: Record<string, any> = {};

  async function load(params: Record<string, any>, force = false) {
    const cleanParams = normalize(params);
    const key = JSON.stringify(cleanParams);
    // prepare() records the newest filter before the page request starts. If an
    // older page request finishes later, it must not start an obsolete summary.
    if (force && lastKey && key !== lastKey) return;
    lastParams = cleanParams;
    if (
      !force &&
      key === lastKey &&
      (summary.value !== undefined || loading.value || error.value)
    )
      return;
    lastKey = key;
    summary.value = undefined;
    error.value = false;
    loading.value = true;
    controller?.abort();
    controller = new AbortController();
    const currentId = ++requestId;
    try {
      const result = await fetcher(cleanParams, controller.signal);
      if (currentId === requestId) summary.value = result;
    } catch (reason: any) {
      if (
        currentId === requestId &&
        reason?.name !== 'CanceledError' &&
        reason?.code !== 'ERR_CANCELED'
      ) {
        error.value = true;
      }
    } finally {
      if (currentId === requestId) loading.value = false;
    }
  }

  function prepare(params: Record<string, any>) {
    const nextParams = normalize(params);
    const nextKey = JSON.stringify(nextParams);
    if (nextKey === lastKey) return false;
    lastParams = nextParams;
    lastKey = nextKey;
    controller?.abort();
    controller = undefined;
    requestId++;
    summary.value = undefined;
    error.value = false;
    loading.value = true;
    return true;
  }

  function cancelPending() {
    if (!controller) loading.value = false;
  }

  function invalidate() {
    lastKey = '';
  }

  function retry() {
    return load(lastParams, true);
  }

  onBeforeUnmount(() => controller?.abort());
  return {
    cancelPending,
    error,
    invalidate,
    load,
    loading,
    prepare,
    retry,
    summary,
  };
}
