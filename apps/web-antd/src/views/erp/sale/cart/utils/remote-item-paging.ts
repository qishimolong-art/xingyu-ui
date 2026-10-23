export interface ComposeRemoteItemPageOptions<T> {
  createdRows: T[];
  pageNo: number;
  pageSize: number;
  persistedRows: T[];
  persistedTotal: number;
}

export interface RemoteCreatedItemNavigationOptions {
  createdKeys: string[];
  currentPageNo: number;
  orderField?: string;
  pageSize: number;
  persistedTotal: number;
  targetKey: string;
}

export interface RemoteCreatedItemNavigationPlan {
  requiresPageRequest: boolean;
  targetPageHasPersistedRows: boolean;
  targetPageNo: number;
}

export interface RemoteCreatedItemsNavigationPlan extends RemoteCreatedItemNavigationPlan {
  focusKey: string;
}

export function getRemoteItemTotal(
  persistedTotal: number,
  createdCount: number,
) {
  return Math.max(0, persistedTotal) + Math.max(0, createdCount);
}

export function clampRemoteItemPageNo(
  pageNo: number,
  pageSize: number,
  total: number,
) {
  const safePageSize = Math.max(1, pageSize);
  const lastPageNo = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  return Math.min(Math.max(1, pageNo), lastPageNo);
}

export function composeRemoteItemPage<T>({
  createdRows,
  pageNo,
  pageSize,
  persistedRows,
  persistedTotal,
}: ComposeRemoteItemPageOptions<T>) {
  const safePageSize = Math.max(1, pageSize);
  const startIndex = (Math.max(1, pageNo) - 1) * safePageSize;
  const createdStartIndex = Math.max(0, startIndex - persistedTotal);
  const pagePersistedRows = persistedRows.slice(0, safePageSize);
  const remainingSize = Math.max(0, safePageSize - pagePersistedRows.length);
  return [
    ...pagePersistedRows,
    ...createdRows.slice(createdStartIndex, createdStartIndex + remainingSize),
  ];
}

export function getRemoteCreatedItemPageNo(
  persistedTotal: number,
  createdKeys: string[],
  targetKey: string,
  pageSize: number,
) {
  const createIndex = createdKeys.indexOf(targetKey);
  if (createIndex === -1) return undefined;
  return (
    Math.floor(
      (Math.max(0, persistedTotal) + createIndex) / Math.max(1, pageSize),
    ) + 1
  );
}

export function getRemoteCreatedItemNavigationPlan({
  createdKeys,
  currentPageNo,
  orderField,
  pageSize,
  persistedTotal,
  targetKey,
}: RemoteCreatedItemNavigationOptions):
  | RemoteCreatedItemNavigationPlan
  | undefined {
  const targetPageNo = getRemoteCreatedItemPageNo(
    persistedTotal,
    createdKeys,
    targetKey,
    pageSize,
  );
  if (!targetPageNo) return undefined;

  const safePageSize = Math.max(1, pageSize);
  const targetPageStartIndex = (targetPageNo - 1) * safePageSize;
  const targetPageHasPersistedRows =
    targetPageStartIndex < Math.max(0, persistedTotal);
  const currentPageCanSupplyPersistedRows =
    targetPageNo === Math.max(1, currentPageNo) && !orderField;

  return {
    requiresPageRequest:
      targetPageHasPersistedRows && !currentPageCanSupplyPersistedRows,
    targetPageHasPersistedRows,
    targetPageNo,
  };
}

export function getRemoteCreatedItemsNavigationPlan(
  options: Omit<RemoteCreatedItemNavigationOptions, 'targetKey'> & {
    targetKeys: string[];
  },
): RemoteCreatedItemsNavigationPlan | undefined {
  const targetKey = options.targetKeys.at(-1);
  if (!targetKey) return undefined;
  const plan = getRemoteCreatedItemNavigationPlan({
    ...options,
    targetKey,
  });
  if (!plan) return undefined;
  const focusKey = options.targetKeys.find(
    (key) =>
      getRemoteCreatedItemPageNo(
        options.persistedTotal,
        options.createdKeys,
        key,
        options.pageSize,
      ) === plan.targetPageNo,
  );
  if (!focusKey) return undefined;
  return {
    ...plan,
    focusKey,
  };
}
