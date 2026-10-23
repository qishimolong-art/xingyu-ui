type LayoutColumn = {
  field?: string;
  fixed?: unknown;
  getKey: () => null | string;
  minWidth?: number | string;
  resizeWidth?: number;
  visible?: boolean;
  width?: number | string;
};

type ColumnStore = {
  fixedData?: Record<string, unknown>;
  resizableData?: Record<string, number>;
  sortData?: Array<{ k: string }> | Record<string, number>;
  visibleData?: Record<string, boolean>;
};

/** Run before VXE restores storage, so even the first mount has a flexible column. */
export function restoreSaleOutItemColumnLayout<T extends ColumnStore>({
  $table,
  storeData,
}: {
  $table: { getFullColumns: () => LayoutColumn[] };
  storeData: T;
}): T {
  const columns = $table.getFullColumns();
  const sortData = storeData.sortData;
  const order = new Map(
    (Array.isArray(sortData)
      ? sortData.map(({ k }, index) => [k, index] as const)
      : Object.entries(sortData ?? {})
    ).map(([key, index]) => [key, Number(index)]),
  );
  const visibleColumns = columns
    .filter((column) => {
      const key = column.getKey();
      return key && (storeData.visibleData?.[key] ?? column.visible) !== false;
    })
    .toSorted(
      (left, right) =>
        (order.get(left.getKey()!) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.getKey()!) ?? Number.MAX_SAFE_INTEGER),
    );
  // Fixed columns are rendered outside the scrollable center. Keep their
  // personal widths; the last center business column must consume the slack.
  const trailingColumn = visibleColumns.findLast((column) => {
    const key = column.getKey()!;
    return (
      column.field &&
      column.field !== 'actions' &&
      column.field !== 'operation' &&
      !(storeData.fixedData?.[key] ?? column.fixed)
    );
  });
  if (!trailingColumn) return storeData;

  // A previously flexible column may now be hidden, reordered, or fixed.
  // Normalize it too, leaving exactly one center column eligible for fill.
  for (const column of columns) {
    if (column === trailingColumn || !column.field) continue;
    if (!column.width && column.minWidth) column.width = column.minWidth;
    delete column.minWidth;
  }
  const key = trailingColumn.getKey()!;
  const savedWidth = storeData.resizableData?.[key] ?? 0;
  trailingColumn.minWidth = Math.max(
    Number(trailingColumn.width) || 0,
    Number(trailingColumn.minWidth) || 0,
    savedWidth,
    150,
  );
  delete trailingColumn.width;
  trailingColumn.resizeWidth = 0;
  // Only change the runtime restore input, never erase the user's storage.
  // resizeWidth has priority over minWidth in VXE's width allocator.
  return {
    ...storeData,
    resizableData: { ...storeData.resizableData, [key]: 0 },
  };
}
