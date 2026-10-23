import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../../utils/batch-update';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpReceivableOtherIncomeApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface Item {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    incomeId?: number;
    itemName?: string;
    amount?: number | string | null;
    invoiceNo?: string;
    party?: string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    bizDate?: string;
    handlerId?: number;
    handlerName?: string;
    qty?: number;
    freightType?: string;
    remark?: string;
    fileUrl?: string;
  }

  export interface ItemPageReq extends PageParam {
    excludedItemIds?: number[];
    incomeId: number;
    mask?: boolean;
    orderDirection?: string;
    orderField?: string;
  }

  export interface OtherIncome {
    id?: number;
    no?: string;
    status?: number;
    approveTime?: string;
    bizTime?: number | string;
    settleMethod?: string;
    accountId?: number;
    accountName?: string;
    voucherNo?: string;
    incomeType?: string;
    totalAmount?: number | string | null;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
    party?: string;
    relatedBiz?: string;
    docType?: string;
    remark?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: string;
    auditorName?: string;
    auditTime?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: string;
    items?: Item[];
  }
}

export function getOtherIncomePage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpReceivableOtherIncomeApi.OtherIncome>>(
    '/erp/receivable-other-income/page',
    { params, timeout: 60_000 },
  );
}

export function getOtherIncomeSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/receivable-other-income/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getOtherIncome(
  id: number,
  options?: { includeItems?: boolean },
) {
  return requestClient.get<ErpReceivableOtherIncomeApi.OtherIncome>(
    '/erp/receivable-other-income/get',
    { params: { id, ...options } },
  );
}

export function getOtherIncomeItemPage(
  params: ErpReceivableOtherIncomeApi.ItemPageReq,
) {
  return requestClient.get<PageResult<ErpReceivableOtherIncomeApi.Item>>(
    '/erp/receivable-other-income/item-page',
    { params },
  );
}

export function postOtherIncomeItemPage(
  data: ErpReceivableOtherIncomeApi.ItemPageReq,
) {
  return requestClient.post<PageResult<ErpReceivableOtherIncomeApi.Item>>(
    '/erp/receivable-other-income/item-page',
    data,
  );
}

export function getOtherIncomeDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/receivable-other-income/dept-simple-list',
  );
}

export function getOtherIncomeDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-other-income/dept-simple-page',
    { params },
  );
}

export function getOtherIncomeUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-other-income/user-simple-page',
    { params },
  );
}

export function createOtherIncome(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.post<number>(
    '/erp/receivable-other-income/create',
    data,
  );
}

export function createOtherIncomeDraft(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.post<number>(
    '/erp/receivable-other-income/create-draft',
    data,
  );
}

export function createAndSubmitOtherIncome(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.post<number>(
    '/erp/receivable-other-income/create-and-submit',
    data,
  );
}

export function updateOtherIncome(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.put('/erp/receivable-other-income/update', data);
}

export function updateOtherIncomeDraft(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.put('/erp/receivable-other-income/update-draft', data);
}

export function updateAndSubmitOtherIncome(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return requestClient.put(
    '/erp/receivable-other-income/update-and-submit',
    data,
  );
}

export function submitOtherIncome(id: number) {
  return requestClient.put('/erp/receivable-other-income/submit', null, {
    params: { id },
  });
}

export function batchUpdateOtherIncome(
  data: { ids: number[] } & Partial<ErpReceivableOtherIncomeApi.OtherIncome>,
) {
  return batchUpdateFinanceByDetail(data, getOtherIncome, (detail) =>
    detail.status === 0
      ? updateOtherIncomeDraft(detail)
      : updateOtherIncome(detail),
  );
}

export function updateOtherIncomeStatus(id: number, status: number) {
  return requestClient.put('/erp/receivable-other-income/update-status', null, {
    params: { id, status },
  });
}

export function deleteOtherIncome(ids: number[]) {
  return requestClient.delete('/erp/receivable-other-income/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportOtherIncome(params?: Record<string, any>) {
  return requestClient.download('/erp/receivable-other-income/export-excel', {
    params,
  });
}

export function getOtherIncomeExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/receivable-other-income/export-fields');
}

export function getOtherIncomeImportTemplate() {
  return requestClient.download(
    '/erp/receivable-other-income/get-import-template',
  );
}

export function importOtherIncome(file: File) {
  return requestClient.upload<ErpReceivableOtherIncomeApi.FinanceImportResult>(
    '/erp/receivable-other-income/import',
    { file },
  );
}

export function downloadOtherIncomeImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/receivable-other-income/import-failure-details/download',
    { params: { recordId } },
  );
}

export function updateOtherIncomeRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/receivable-other-income/update-remark', data);
}
