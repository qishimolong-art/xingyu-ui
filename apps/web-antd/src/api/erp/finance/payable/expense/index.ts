import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../../utils/batch-update';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpPayableExpenseApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface PayableExpenseItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    expenseId?: number;
    itemName?: string;
    amount?: number | string | null;
    invoiceNo?: string;
    party?: string;
    deptId?: number;
    deptName?: string;
    bizDate?: string;
    handlerId?: number;
    handlerName?: string;
    qty?: number;
    expenseCategory?: string;
    remark?: string;
    fileUrl?: string;
  }

  export interface PayableExpenseItemPageReq extends PageParam {
    excludedItemIds?: number[];
    expenseId: number;
    mask?: boolean;
    orderDirection?: string;
    orderField?: string;
  }

  export interface PayableExpense {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    settleMethod?: string;
    accountId?: number;
    accountName?: string;
    voucherNo?: string;
    expenseBizType?: string;
    expenseType?: string;
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
    items?: PayableExpenseItem[];
  }
}

export function getPayableExpensePage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPayableExpenseApi.PayableExpense>>(
    '/erp/payable-expense/page',
    { params, timeout: 60_000 },
  );
}

export function getPayableExpenseSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/payable-expense/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getPayableExpense(
  id: number,
  options?: { includeItems?: boolean },
) {
  return requestClient.get<ErpPayableExpenseApi.PayableExpense>(
    '/erp/payable-expense/get',
    { params: { id, ...options } },
  );
}

export function getPayableExpenseItemPage(
  params: ErpPayableExpenseApi.PayableExpenseItemPageReq,
) {
  return requestClient.get<PageResult<ErpPayableExpenseApi.PayableExpenseItem>>(
    '/erp/payable-expense/item-page',
    { params },
  );
}

export function postPayableExpenseItemPage(
  data: ErpPayableExpenseApi.PayableExpenseItemPageReq,
) {
  return requestClient.post<
    PageResult<ErpPayableExpenseApi.PayableExpenseItem>
  >('/erp/payable-expense/item-page', data);
}

export function getPayableExpenseDeptSimpleList() {
  return requestClient.get<any[]>('/erp/payable-expense/dept-simple-list');
}

export function getPayableExpenseDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-expense/dept-simple-page',
    { params },
  );
}

export function getPayableExpenseUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-expense/user-simple-page',
    { params },
  );
}

export function createPayableExpense(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.post<number>('/erp/payable-expense/create', data);
}

export function createPayableExpenseDraft(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.post<number>('/erp/payable-expense/create-draft', data);
}

export function createAndSubmitPayableExpense(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.post<number>(
    '/erp/payable-expense/create-and-submit',
    data,
  );
}

export function updatePayableExpense(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.put('/erp/payable-expense/update', data);
}

export function updatePayableExpenseDraft(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.put('/erp/payable-expense/update-draft', data);
}

export function updateAndSubmitPayableExpense(
  data: ErpPayableExpenseApi.PayableExpense,
) {
  return requestClient.put('/erp/payable-expense/update-and-submit', data);
}

export function submitPayableExpense(id: number) {
  return requestClient.put('/erp/payable-expense/submit', null, {
    params: { id },
  });
}

export function batchUpdatePayableExpense(
  data: Partial<ErpPayableExpenseApi.PayableExpense> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(
    data,
    getPayableExpense,
    updatePayableExpense,
  );
}

export function updatePayableExpenseStatus(id: number, status: number) {
  return requestClient.put('/erp/payable-expense/update-status', null, {
    params: { id, status },
  });
}

export function deletePayableExpense(ids: number[]) {
  return requestClient.delete('/erp/payable-expense/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportPayableExpense(params?: Record<string, any>) {
  return requestClient.download('/erp/payable-expense/export-excel', {
    params,
  });
}

export function getPayableExpenseExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/payable-expense/export-fields');
}

export function getPayableExpenseImportTemplate() {
  return requestClient.download('/erp/payable-expense/get-import-template');
}

export function importPayableExpense(file: File) {
  return requestClient.upload<ErpPayableExpenseApi.FinanceImportResult>(
    '/erp/payable-expense/import',
    { file },
  );
}

export function downloadPayableExpenseImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/payable-expense/import-failure-details/download',
    { params: { recordId } },
  );
}

export function updatePayableExpenseRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/payable-expense/update-remark', data);
}
