export interface RemoteStockItemPageOptions<T> {
  createdRows: T[];
  pageNo: number;
  pageSize: number;
  persistedRows: T[];
  persistedTotal: number;
}

export function getRemoteStockItemTotal(
  persistedTotal: number,
  createdCount: number,
) {
  return Math.max(0, persistedTotal) + Math.max(0, createdCount);
}

export function getRemoteStockItemLastPageNo(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function clampRemoteStockItemPageNo(
  pageNo: number,
  pageSize: number,
  total: number,
) {
  return Math.min(
    Math.max(1, pageNo),
    getRemoteStockItemLastPageNo(total, pageSize),
  );
}

/** 历史行排在新增缓存之前，最终页面严格限制为 pageSize。 */
export function composeRemoteStockItemPage<T>({
  createdRows,
  pageNo,
  pageSize,
  persistedRows,
  persistedTotal,
}: RemoteStockItemPageOptions<T>) {
  const safePageSize = Math.max(1, pageSize);
  const startIndex = (Math.max(1, pageNo) - 1) * safePageSize;
  const pagePersistedRows = persistedRows.slice(0, safePageSize);
  const createdStartIndex = Math.max(
    0,
    startIndex - Math.max(0, persistedTotal),
  );
  return [
    ...pagePersistedRows,
    ...createdRows.slice(
      createdStartIndex,
      createdStartIndex + safePageSize - pagePersistedRows.length,
    ),
  ];
}

export function stockPageHasPersistedRows(
  pageNo: number,
  pageSize: number,
  persistedTotal: number,
) {
  return (Math.max(1, pageNo) - 1) * Math.max(1, pageSize) < persistedTotal;
}

export function getCreatedStockRowPageNo(
  persistedTotal: number,
  createdIndex: number,
  pageSize: number,
) {
  return (
    Math.floor(
      (Math.max(0, persistedTotal) + Math.max(0, createdIndex)) /
        Math.max(1, pageSize),
    ) + 1
  );
}

/** 检查一批即将提交的业务键是否与缓存行或批次内部冲突。 */
export function findFirstDuplicateStockItemKey(
  candidateKeys: string[],
  existingKeys: Iterable<string> = [],
) {
  const usedKeys = new Set(Array.from(existingKeys).filter(Boolean));
  for (const key of candidateKeys) {
    if (!key) continue;
    if (usedKeys.has(key)) return key;
    usedKeys.add(key);
  }
  return undefined;
}

/** 串行化同一表单的新增、删除和分页状态变更，避免异步响应交叉覆盖缓存。 */
export function createRemoteStockItemOperationQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T> | T) {
    const current = tail.then(operation, operation);
    tail = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  };
}
