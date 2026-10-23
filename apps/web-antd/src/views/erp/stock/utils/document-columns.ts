import { nextTick, onBeforeUnmount, onMounted } from 'vue';

import {
  applyPurchaseDocumentListColumnCustomization,
  fitPurchaseDocumentColumnsToWidth,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

/** Opt-in explicit width allocation; legacy stock forms keep their layout. */
export function fitStockDocumentColumns(
  columns: any[],
  runtime: object[],
  width: number,
  minimum = 150,
) {
  return fitPurchaseDocumentColumnsToWidth(
    applyPurchaseDocumentListColumnCustomization(columns, runtime, minimum),
    width,
  );
}

export function useStockDocumentColumns(options: {
  afterReload?: () => unknown;
  columns: () => any[];
  data?: () => any[];
  fill?: boolean;
  grid: () => any;
  minimum?: number;
  wrapper: () => HTMLElement | null | undefined;
}) {
  const allocate = (
    columns: any[],
    runtime: object[],
    containerWidth: number,
    minimum?: number,
  ) =>
    options.fill === false
      ? applyPurchaseDocumentListColumnCustomization(columns, runtime, minimum)
      : fitStockDocumentColumns(columns, runtime, containerWidth, minimum);
  let observer: ResizeObserver | undefined;
  let lastWidth = 0;
  let disposed = false;
  let queued = false;
  let updating = false;
  let pendingCustomization: boolean | undefined;

  function width() {
    const wrapper = options.wrapper();
    return (
      wrapper?.querySelector<HTMLElement>(
        '.vxe-table--header-wrapper.body--wrapper',
      )?.clientWidth ??
      wrapper?.clientWidth ??
      0
    );
  }

  async function reload(customized = true) {
    const api = options.grid();
    const table = api?.grid;
    if (!table || disposed) return;
    if (updating) {
      pendingCustomization =
        pendingCustomization === false ? false : customized;
      return;
    }
    updating = true;
    try {
      const defaults = options.columns();
      let columns = allocate(
        defaults,
        customized ? (table.getFullColumns?.() ?? []) : [],
        width(),
        options.minimum,
      );
      if (options.data) {
        const numericFields = new Set([
          'actualCount',
          'costAmount',
          'costPrice',
          'count',
          'productPrice',
          'totalPrice',
          'totalWeight',
          'weight',
        ]);
        columns = columns.map((column) => {
          if (!numericFields.has(column.field)) return column;
          const measured = defaults.find(
            (entry) => entry.field === column.field,
          );
          return {
            ...column,
            width: Math.max(
              Number(column.width) || 0,
              Number(measured?.width) || 0,
            ),
          };
        });
        if (options.fill !== false)
          columns = fitPurchaseDocumentColumnsToWidth(columns, width());
      }
      // The grid adapter clones configured data whenever its options change.
      // Supply current business rows so restoring columns cannot restore stale values.
      api.setGridOptions({
        columns,
        ...(options.data ? { data: options.data() } : {}),
      });
      await table.reloadColumn(columns);
      await nextTick();
      if (disposed) return;
      syncPurchaseDocumentColumnDefaults(
        table.getFullColumns?.() ?? [],
        defaults,
      );
      await syncPurchaseDocumentOperationColumn(table, columns);
      releasePurchaseDocumentTrailingColumnResize(
        table.getFullColumns?.() ?? [],
      );
      await table.refreshColumn?.();
      await table.recalculate?.(true);
      await options.afterReload?.();
    } finally {
      updating = false;
      if (pendingCustomization !== undefined && !disposed) {
        const pending = pendingCustomization;
        pendingCustomization = undefined;
        void nextTick(() => reload(pending));
      }
    }
  }

  function queue() {
    if (queued || disposed) return;
    queued = true;
    void nextTick(async () => {
      queued = false;
      await reload();
    });
  }

  async function custom({ type }: { type?: string }) {
    if (await settleVxeColumnCustomization(options.grid()?.grid, type)) {
      await reload(type !== 'reset');
    }
  }

  function restoreStore({ $table, storeData }: any) {
    const runtime = $table.getFullColumns();
    const order = new Map<string, number>(
      Array.isArray(storeData.sortData)
        ? storeData.sortData.map(({ k }: any, index: number) => [k, index])
        : (Object.entries(storeData.sortData ?? {}) as [string, number][]),
    );
    const customized = runtime
      .map((column: any) => ({
        ...column,
        getKey: () => column.getKey(),
        visible: storeData.visibleData?.[column.getKey()] ?? column.visible,
        fixed: storeData.fixedData?.[column.getKey()] ?? column.fixed,
        resizeWidth: storeData.resizableData?.[column.getKey()] ?? 0,
      }))
      .toSorted(
        (a: any, b: any) =>
          (order.get(a.getKey()) ?? 9999) - (order.get(b.getKey()) ?? 9999),
      );
    const fitted = allocate(
      options.columns(),
      customized,
      width(),
      options.minimum,
    );
    const resizableData = { ...storeData.resizableData };
    const visibleData = { ...storeData.visibleData };
    const fixedData = { ...storeData.fixedData };
    for (const column of runtime) {
      const config = fitted.find((entry: any) =>
        entry.field ? entry.field === column.field : entry.type === column.type,
      );
      if (!config) continue;
      column.width = config.width;
      column.minWidth = config.minWidth;
      if (column.field === 'actions' || column.title === '操作') {
        visibleData[column.getKey()] = config.visible !== false;
        fixedData[column.getKey()] = 'right';
      }
      resizableData[column.getKey()] = Number(config.width) || 0;
    }
    return { ...storeData, resizableData, visibleData, fixedData };
  }

  onMounted(() => {
    lastWidth = width();
    if (typeof ResizeObserver !== 'undefined' && options.wrapper()) {
      observer = new ResizeObserver(() => {
        const nextWidth = width();
        if (Math.abs(nextWidth - lastWidth) > 1) {
          lastWidth = nextWidth;
          queue();
        }
      });
      const wrapper = options.wrapper();
      if (wrapper) observer.observe(wrapper);
    }
    queue();
  });
  onBeforeUnmount(() => {
    disposed = true;
    observer?.disconnect();
  });
  return { custom, queue, reload, restoreStore };
}
