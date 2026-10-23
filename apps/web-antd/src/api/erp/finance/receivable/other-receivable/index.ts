import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../../utils/batch-update';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpReceivableOtherApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface OtherReceivable {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    customerId?: number;
    customerName?: string;
    customerContact?: string;
    customerMobile?: string;
    saleUserId?: number;
    saleUserName?: string;
    voucherNo?: string;
    settledAmount?: number | string | null;
    deptId?: number;
    deptName?: string;
    receivableAmount?: number | string | null;
    increaseReceivableAmount?: number | string | null;
    project?: string;
    sourceType?: string;
    handlerId?: number;
    handlerName?: string;
    receivableType?: string;
    costAmount?: number | string | null;
    remark?: string;
    isPaperNote?: boolean;
    paperNoteDesc?: string;
    sourceNo?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: string;
    auditorName?: string;
    auditTime?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: string;
  }
}

export function getOtherReceivablePage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpReceivableOtherApi.OtherReceivable>>(
    '/erp/receivable-other/page',
    { params, timeout: 60_000 },
  );
}

export function getOtherReceivableSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/receivable-other/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getOtherReceivable(id: number) {
  return requestClient.get<ErpReceivableOtherApi.OtherReceivable>(
    '/erp/receivable-other/get',
    { params: { id } },
  );
}

export function getOtherReceivableDeptSimpleList() {
  return requestClient.get<any[]>('/erp/receivable-other/dept-simple-list');
}

export function getOtherReceivableDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-other/dept-simple-page',
    { params },
  );
}

export function getOtherReceivableCustomerDeptSimpleList(customerId: number) {
  return requestClient.get<any[]>(
    '/erp/receivable-other/customer-dept-simple-list',
    { params: { customerId } },
  );
}

export function getOtherReceivableCustomerDeptSimplePage(
  params: PageParam & { customerId: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-other/customer-dept-simple-page',
    { params },
  );
}

export function getOtherReceivableUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-other/user-simple-page',
    { params },
  );
}

export function createOtherReceivable(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.post<number>('/erp/receivable-other/create', data);
}

export function createOtherReceivableDraft(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.post<number>('/erp/receivable-other/create-draft', data);
}

export function createAndSubmitOtherReceivable(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.post<number>(
    '/erp/receivable-other/create-and-submit',
    data,
  );
}

export function updateOtherReceivable(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.put('/erp/receivable-other/update', data);
}

export function updateOtherReceivableDraft(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.put('/erp/receivable-other/update-draft', data);
}

export function updateAndSubmitOtherReceivable(
  data: ErpReceivableOtherApi.OtherReceivable,
) {
  return requestClient.put('/erp/receivable-other/update-and-submit', data);
}

export function submitOtherReceivable(id: number) {
  return requestClient.put('/erp/receivable-other/submit', null, {
    params: { id },
  });
}

export function batchUpdateOtherReceivable(
  data: Partial<ErpReceivableOtherApi.OtherReceivable> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(
    data,
    getOtherReceivable,
    updateOtherReceivable,
  );
}

export function updateOtherReceivableStatus(id: number, status: number) {
  return requestClient.put('/erp/receivable-other/update-status', null, {
    params: { id, status },
  });
}

export function deleteOtherReceivable(id: number) {
  return requestClient.delete('/erp/receivable-other/delete', {
    params: { id },
  });
}

export function exportOtherReceivable(params?: Record<string, any>) {
  return requestClient.download('/erp/receivable-other/export-excel', {
    params,
  });
}

export function getOtherReceivableExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/receivable-other/export-fields');
}

export function getOtherReceivableImportTemplate() {
  return requestClient.download('/erp/receivable-other/get-import-template');
}

export function importOtherReceivable(file: File) {
  return requestClient.upload<ErpReceivableOtherApi.FinanceImportResult>(
    '/erp/receivable-other/import',
    { file },
  );
}

export function downloadOtherReceivableImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/receivable-other/import-failure-details/download',
    { params: { recordId } },
  );
}

export function updateOtherReceivableRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/receivable-other/update-remark', data);
}
