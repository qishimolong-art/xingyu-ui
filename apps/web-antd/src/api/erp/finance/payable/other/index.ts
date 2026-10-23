import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../../utils/batch-update';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpPayableOtherApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface PayableOther {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    supplierId?: number;
    supplierName?: string;
    supplierContact?: string;
    supplierMobile?: string;
    voucherNo?: string;
    settledAmount?: number | string | null;
    deptId?: number;
    deptName?: string;
    payableAmount?: number | string | null;
    increasePayableAmount?: number | string | null;
    project?: string;
    sourceType?: string;
    sourceNo?: string;
    handlerId?: number;
    handlerName?: string;
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
  }
}

export function getPayableOtherPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPayableOtherApi.PayableOther>>(
    '/erp/payable-other/page',
    { params, timeout: 60_000 },
  );
}

export function getPayableOtherSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>('/erp/payable-other/summary', {
    params,
    signal,
    timeout: 30_000,
  });
}

export function getPayableOther(id: number) {
  return requestClient.get<ErpPayableOtherApi.PayableOther>(
    `/erp/payable-other/get?id=${id}`,
  );
}

export function getPayableOtherDeptSimpleList() {
  return requestClient.get<any[]>('/erp/payable-other/dept-simple-list');
}

export function getPayableOtherDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-other/dept-simple-page',
    { params },
  );
}

export function getPayableOtherSupplierDeptSimpleList(supplierId: number) {
  return requestClient.get<any[]>(
    '/erp/payable-other/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPayableOtherSupplierDeptSimplePage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-other/supplier-dept-simple-page',
    { params },
  );
}

export function getPayableOtherUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-other/user-simple-page',
    { params },
  );
}

export function createPayableOther(data: ErpPayableOtherApi.PayableOther) {
  return requestClient.post<number>('/erp/payable-other/create', data);
}

export function createPayableOtherDraft(data: ErpPayableOtherApi.PayableOther) {
  return requestClient.post<number>('/erp/payable-other/create-draft', data);
}

export function createAndSubmitPayableOther(
  data: ErpPayableOtherApi.PayableOther,
) {
  return requestClient.post<number>(
    '/erp/payable-other/create-and-submit',
    data,
  );
}

export function updatePayableOther(data: ErpPayableOtherApi.PayableOther) {
  return requestClient.put('/erp/payable-other/update', data);
}

export function updatePayableOtherDraft(data: ErpPayableOtherApi.PayableOther) {
  return requestClient.put('/erp/payable-other/update-draft', data);
}

export function updateAndSubmitPayableOther(
  data: ErpPayableOtherApi.PayableOther,
) {
  return requestClient.put('/erp/payable-other/update-and-submit', data);
}

export function submitPayableOther(id: number) {
  return requestClient.put('/erp/payable-other/submit', null, {
    params: { id },
  });
}

export function batchUpdatePayableOther(
  data: Partial<ErpPayableOtherApi.PayableOther> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(data, getPayableOther, updatePayableOther);
}

export function updatePayableOtherStatus(id: number, status: number) {
  return requestClient.put('/erp/payable-other/update-status', null, {
    params: { id, status },
  });
}

export function deletePayableOther(id: number) {
  return requestClient.delete('/erp/payable-other/delete', {
    params: { id },
  });
}

export function exportPayableOther(params?: Record<string, any>) {
  return requestClient.download('/erp/payable-other/export-excel', {
    params,
  });
}

export function getPayableOtherExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/payable-other/export-fields');
}

export function getPayableOtherImportTemplate() {
  return requestClient.download('/erp/payable-other/get-import-template');
}

export function importPayableOther(file: File) {
  return requestClient.upload<ErpPayableOtherApi.FinanceImportResult>(
    '/erp/payable-other/import',
    { file },
  );
}

export function downloadPayableOtherImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/payable-other/import-failure-details/download',
    { params: { recordId } },
  );
}

export function updatePayableOtherRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/payable-other/update-remark', data);
}
