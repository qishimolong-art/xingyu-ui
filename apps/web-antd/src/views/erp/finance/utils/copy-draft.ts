import { cloneDeep } from '@vben/utils';

type CleanOptions<T extends Record<string, any>> = {
  extraCleanKeys?: string[];
  extraItemCleanKeys?: string[];
  itemKey?: keyof T & string;
  overrides?: Partial<T>;
};

const DEFAULT_CLEAN_KEYS = [
  'id',
  'no',
  'code',
  'status',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
  'auditor',
  'auditorId',
  'auditorName',
  'auditStatus',
  'auditUserId',
  'auditUserName',
  'auditTime',
  'approveTime',
  'approver',
  'approverId',
  'approverName',
  'settleStatus',
  'settleTime',
  'settleUserId',
  'settleUserName',
  'generatedStatus',
  'generatedTime',
  'generatedUserId',
  'generatedUserName',
  'result',
  'resultMessage',
  'processResult',
  'processTime',
  'processUserId',
  'processUserName',
  'accountName',
  'customerName',
  'customerContact',
  'customerMobile',
  'supplierName',
  'supplierContact',
  'supplierMobile',
  'financeUserName',
  'deptName',
  'handlerName',
  'outAccountName',
  'inAccountName',
  'currentBalance',
  'outAccountBalance',
];

const DEFAULT_ITEM_CLEAN_KEYS = [
  'clientRowKey',
  'id',
  'receiptId',
  'paymentId',
  'transferId',
  'incomeId',
  'expenseId',
  'otherIncomeId',
  'payableExpenseId',
  'financeReceiptId',
  'financePaymentId',
  'createTime',
  'creator',
  'creatorName',
  'updateTime',
  'updater',
  'updaterName',
  'deptName',
  'handlerName',
];

function deleteKeys(target: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    delete target[key];
  }
}

function normalizeItems<T extends Record<string, any>>(
  items: T[] | undefined,
  extraItemCleanKeys: string[],
) {
  return (items ?? []).map((item, index) => {
    const next = cloneDeep(item) as Record<string, any>;
    deleteKeys(next, [...DEFAULT_ITEM_CLEAN_KEYS, ...extraItemCleanKeys]);
    next.row_id = Date.now() + index;
    return next as T;
  });
}

export function buildFinanceCopyDraft<T extends Record<string, any>>(
  source: T,
  options: CleanOptions<T> = {},
) {
  const draft = cloneDeep(source) as T & Record<string, any>;
  const {
    extraCleanKeys = [],
    extraItemCleanKeys = [],
    itemKey = 'items' as keyof T & string,
    overrides,
  } = options;

  deleteKeys(draft, [...DEFAULT_CLEAN_KEYS, ...extraCleanKeys]);

  if (Array.isArray(draft[itemKey])) {
    draft[itemKey] = normalizeItems(draft[itemKey], extraItemCleanKeys);
  }

  const draftRecord = draft as Record<string, any>;
  draftRecord.status = 10;
  if ('no' in draftRecord) {
    draftRecord.no = undefined;
  }

  if (overrides) {
    Object.assign(draft, cloneDeep(overrides));
  }

  return draft as T;
}
