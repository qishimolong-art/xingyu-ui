type RemoteItem = Record<string, any>;

const DEFAULT_IGNORED_KEYS = new Set([
  '_X_ROW_KEY',
  'accountName',
  'allocatedPrice',
  'auditTime',
  'auditorName',
  'bizTime',
  'createTime',
  'creator',
  'creatorName',
  'customerName',
  'clientRowKey',
  'deptName',
  'expenseId',
  'financeUserName',
  'handlerName',
  'incomeId',
  'operation',
  'paidPrice',
  'paymentId',
  'receiptId',
  'receiptMethod',
  'reverseReason',
  'reverseTime',
  'reverseUserId',
  'row_id',
  'seq',
  'supplierName',
  'updateTime',
  'updater',
  'updaterName',
  'writeOffStatus',
  'writeOffTime',
  'writeOffUserId',
]);

function normalizeRemoteComparableValue(value: any) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

export function normalizeRemoteItemForCompare(
  item: RemoteItem,
  ignoredKeys: Set<string> = DEFAULT_IGNORED_KEYS,
) {
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key]) => !ignoredKeys.has(key))
      .map(([key, value]) => [key, normalizeRemoteComparableValue(value)])
      .filter(([, value]) => value !== null)
      .toSorted(([first], [second]) => first.localeCompare(second)),
  );
}

export function isSameRemoteItem(
  left?: RemoteItem,
  right?: RemoteItem,
  ignoredKeys?: Set<string>,
) {
  return (
    JSON.stringify(normalizeRemoteItemForCompare(left ?? {}, ignoredKeys)) ===
    JSON.stringify(normalizeRemoteItemForCompare(right ?? {}, ignoredKeys))
  );
}

export function buildIncrementalRemoteItems<T extends RemoteItem>(
  edits: Map<number, T>,
  deletes: Set<number>,
  creates: Map<string, T>,
) {
  const deleteItems = [...deletes].map((id) => ({
    id,
    operation: 'delete' as const,
  }));
  const updateItems = [...edits.values()].map((item) => {
    const rest = { ...item };
    delete rest.clientRowKey;
    delete rest.row_id;
    delete rest.seq;
    return { ...rest, operation: 'update' as const };
  });
  const insertItems = [...creates.values()].map((item) => {
    const rest = { ...item };
    delete rest.createTime;
    delete rest.clientRowKey;
    delete rest.creator;
    delete rest.expenseId;
    delete rest.id;
    delete rest.incomeId;
    delete rest.paymentId;
    delete rest.receiptId;
    delete rest.row_id;
    delete rest.seq;
    delete rest.updateTime;
    delete rest.updater;
    return {
      ...rest,
      operation: 'insert' as const,
    };
  });
  return [...deleteItems, ...updateItems, ...insertItems] as T[];
}
