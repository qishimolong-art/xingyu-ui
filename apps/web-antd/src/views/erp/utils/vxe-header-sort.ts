import { nextTick, ref } from 'vue';

type SortOrder = 'asc' | 'desc';
type ActiveSortState = { field: string; order: SortOrder };

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

function normalizeSortList(sorts?: any | any[], sort?: any) {
  let sortList: any[] = [];
  if (Array.isArray(sorts)) {
    sortList = sorts;
  } else if (sorts) {
    sortList = [sorts];
  }
  if (sort && !sortList.some((item) => item?.order)) {
    sortList = [sort, ...sortList];
  }
  return sortList;
}

function getSortField(sort: any) {
  return sort?.field || sort?.property || sort?.column?.field;
}

export function createVxeHeaderSort(
  fieldMap: Record<string, string>,
  defaultSort: ActiveSortState | null = null,
) {
  const currentSort = ref<ActiveSortState | null>(defaultSort);

  function getKnownSortList(sorts?: any | any[], sort?: any) {
    return normalizeSortList(sorts, sort).filter((item) => {
      const field = getSortField(item);
      return field && fieldMap[field];
    });
  }

  function getActiveSort(sorts?: any | any[], sort?: any) {
    const activeSort = getKnownSortList(sorts, sort).find(
      (item) => item?.order,
    );
    const field = getSortField(activeSort);
    if (
      field &&
      fieldMap[field] &&
      (activeSort.order === 'asc' || activeSort.order === 'desc')
    ) {
      return {
        field,
        order: activeSort.order,
      } as ActiveSortState;
    }
    return null;
  }

  function syncSortState(
    sorts?: any | any[],
    sort?: any,
    clearWhenNoActiveSort = false,
  ) {
    const activeSort = getActiveSort(sorts, sort);
    if (activeSort) {
      currentSort.value = activeSort;
      return currentSort.value;
    }

    if (clearWhenNoActiveSort) {
      currentSort.value = defaultSort;
    }
    return currentSort.value;
  }

  function buildSortParams(sorts?: any | any[], sort?: any) {
    const hasExplicitSortInput = sorts !== undefined || sort !== undefined;
    const activeSort = syncSortState(sorts, sort, hasExplicitSortInput);
    const orderField = activeSort ? fieldMap[activeSort.field] : undefined;
    const orderDirection = activeSort?.order;

    return orderField && orderDirection
      ? {
          orderField,
          orderDirection,
        }
      : {};
  }

  function syncColumnSortState(grid: any, activeSort: ActiveSortState | null) {
    const fullColumns = grid?.getFullColumns?.() ?? [];
    fullColumns.forEach((column: any) => {
      const field = getSortField(column);
      if (!field || !fieldMap[field]) {
        return;
      }
      if (activeSort && field === activeSort.field) {
        column.order = activeSort.order;
        column.sortTime = Date.now();
      } else {
        column.order = null;
      }
    });
  }

  async function refreshSortHeader(grid: any) {
    await grid?.refreshColumn?.();
    await grid?.recalculate?.();
    await nextTick();
  }

  function handleSortChange(params: any) {
    const { sort, sortList, sorts } = params ?? {};
    const currentSortEvent = sort ?? params;
    const field = getSortField(currentSortEvent);
    const order = currentSortEvent?.order;

    // User clicked the sorted header to clear sorting.
    if (field && fieldMap[field] && !order) {
      currentSort.value = defaultSort;
      return;
    }

    syncSortState(sortList || sorts, currentSortEvent, false);
  }

  async function restoreSortState(gridApi: { grid?: any }) {
    const activeSort = currentSort.value;
    await nextTick();
    await waitForFrame();
    const grid = gridApi?.grid;
    if (!grid) {
      return;
    }
    if (!activeSort) {
      syncColumnSortState(grid, null);
      await refreshSortHeader(grid);
      return;
    }

    syncColumnSortState(grid, activeSort);
    await refreshSortHeader(grid);
    await waitForFrame();
    syncColumnSortState(grid, activeSort);
    await refreshSortHeader(grid);
  }

  async function resetSortState(gridApi?: { grid?: any }) {
    currentSort.value = defaultSort;
    const grid = gridApi?.grid;
    if (!grid) {
      return;
    }
    syncColumnSortState(grid, null);
    await refreshSortHeader(grid);
  }

  return {
    buildSortParams,
    handleSortChange,
    resetSortState,
    restoreSortState,
  };
}
