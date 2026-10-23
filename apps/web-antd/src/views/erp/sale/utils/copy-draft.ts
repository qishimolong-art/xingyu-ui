import { cloneDeep } from '@vben/utils';

type CleanOptions<T extends Record<string, any>> = {
  itemKey?: keyof T & string;
  extraCleanKeys?: string[];
  extraItemCleanKeys?: string[];
  overrides?: Partial<T>;
};

const DEFAULT_CLEAN_KEYS = [
  'id',
  'no',
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
  'firstAuditUserId',
  'firstAuditTime',
  'finalAuditUserId',
  'finalAuditTime',
  'printTime',
  'printCount',
  'settleStatus',
  'settleTime',
  'settleUserId',
  'settleUserName',
  'settleNo',
  'billNo',
  'deliveryNo',
  'logisticsNo',
  'orderNo',
  'receiptNo',
  'sourceType',
  'sourceId',
  'sourceNo',
  'sourceCreateTime',
  'sourceOrderId',
  'sourceOrderNo',
  'sourceItemId',
  'sourceItemNo',
  'ticketNo',
  'thirdPartyNo',
  'thirdPartyUpstreamNo',
  'generatedSaleOutNo',
  'generatedNo',
  'convertedCount',
  'convertedOrderId',
  'convertedNo',
  'executeStatus',
  'executeResult',
  'executeTime',
  'executeUserId',
  'executeUserName',
  'result',
  'resultMessage',
  'remark2',
  'sourceType2',
];

const DEFAULT_ITEM_CLEAN_KEYS = [
  'clientRowKey',
  'seq',
  'id',
  'orderId',
  'outId',
  'cartId',
  'quoteId',
  'returnId',
  'sourceId',
  'sourceItemId',
  'sourceOutId',
  'sourceOutItemId',
  'saleOutId',
  'saleOutItemId',
  'sourceOrderId',
  'sourceOrderItemId',
  'executedCount',
  'executeCount',
  'executePrice',
  'executeResult',
  'executeTime',
  'executor',
  'executorId',
  'executorName',
  'auditor',
  'auditorId',
  'auditorName',
  'auditStatus',
  'auditUserId',
  'auditUserName',
  'auditTime',
  'approveTime',
  'createTime',
  'creator',
  'creatorName',
  'updateTime',
  'updater',
  'updaterName',
  'printCount',
  'sourceNo',
  'sourceItemNo',
];

function deleteKeys(target: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    delete target[key];
  }
}

function normalizeItems<TI extends Record<string, any>>(
  items: TI[] | undefined,
  extraItemCleanKeys: string[] = [],
) {
  return (items ?? []).map((item) => {
    const next = cloneDeep(item) as TI;
    deleteKeys(next, [...DEFAULT_ITEM_CLEAN_KEYS, ...extraItemCleanKeys]);
    return next;
  });
}

export function buildSaleCopyDraft<T extends Record<string, any>>(
  source: T,
  options: CleanOptions<T> = {},
) {
  const draft = cloneDeep(source) as T & Record<string, any>;
  const {
    itemKey,
    extraCleanKeys = [],
    extraItemCleanKeys = [],
    overrides,
  } = options;
  const detailKey = itemKey ?? 'items';

  deleteKeys(draft, [...DEFAULT_CLEAN_KEYS, ...extraCleanKeys]);

  if (Array.isArray(draft[detailKey])) {
    draft[detailKey] = normalizeItems(draft[detailKey], extraItemCleanKeys);
  }

  (draft as any).status = 10;
  (draft as any).printCount = 0;

  if ('no' in draft) {
    (draft as any).no = undefined;
  }

  if (overrides) {
    Object.assign(draft, cloneDeep(overrides));
  }

  return draft;
}
