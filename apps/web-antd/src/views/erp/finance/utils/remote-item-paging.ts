export interface FinanceRemoteItemPageOptions<T> {
  createdRows: T[];
  pageNo: number;
  pageSize: number;
  persistedRows: T[];
  persistedTotal: number;
}

export function getFinanceRemoteItemTotal(
  persistedTotal: number,
  createdCount: number,
) {
  return Math.max(0, persistedTotal) + Math.max(0, createdCount);
}

export function getFinanceRemoteItemLastPageNo(
  total: number,
  pageSize: number,
) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function clampFinanceRemoteItemPageNo(
  pageNo: number,
  pageSize: number,
  total: number,
) {
  return Math.min(
    Math.max(1, pageNo),
    getFinanceRemoteItemLastPageNo(total, pageSize),
  );
}

export function composeFinanceRemoteItemPage<T>({
  createdRows,
  pageNo,
  pageSize,
  persistedRows,
  persistedTotal,
}: FinanceRemoteItemPageOptions<T>) {
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

export function financePageHasPersistedRows(
  pageNo: number,
  pageSize: number,
  persistedTotal: number,
) {
  return (Math.max(1, pageNo) - 1) * Math.max(1, pageSize) < persistedTotal;
}

export function getFinanceCreatedRowPageNo(
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
