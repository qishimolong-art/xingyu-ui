export interface RemoteItemPageOptions<T> {
  createdRows: T[];
  pageNo: number;
  pageSize: number;
  persistedRows: T[];
  persistedTotal: number;
}

export function getRemoteItemTotal(
  persistedTotal: number,
  createdCount: number,
) {
  return Math.max(0, persistedTotal) + Math.max(0, createdCount);
}

export function getRemoteItemLastPageNo(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function clampRemoteItemPageNo(
  pageNo: number,
  pageSize: number,
  total: number,
) {
  return Math.min(
    Math.max(1, pageNo),
    getRemoteItemLastPageNo(total, pageSize),
  );
}

/**
 * 服务端行始终在新增缓存之前。调用方只需传入目标页对应的服务端行，
 * 本方法会按整单偏移截取新增缓存并严格限制单页行数。
 */
export function composeRemoteItemPage<T>({
  createdRows,
  pageNo,
  pageSize,
  persistedRows,
  persistedTotal,
}: RemoteItemPageOptions<T>) {
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

export function pageHasPersistedRows(
  pageNo: number,
  pageSize: number,
  persistedTotal: number,
) {
  return (Math.max(1, pageNo) - 1) * Math.max(1, pageSize) < persistedTotal;
}

export function getCreatedRowPageNo(
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
