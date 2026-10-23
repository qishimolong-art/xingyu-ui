import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../utils/batch-update';
import type { FinanceQuerySummary } from '../query-summary';

export namespace ErpFinanceTransferApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface FinanceTransfer {
    id?: number;
    no?: string;
    status?: number;
    transferTime?: Date | number | string;
    voucherNo?: string;
    outAccountId?: number;
    outAccountName?: string;
    inAccountId?: number;
    inAccountName?: string;
    transferPrice?: number | string | null;
    exchangeRate?: number | string | null;
    feePrice?: number | string | null;
    feeExpenseCategory?: string;
    financeUserId?: number;
    financeUserName?: string;
    deptId?: number;
    deptName?: string;
    remark?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: string;
    auditorName?: string;
    auditTime?: string;
  }
}

export function getFinanceTransferPage(params: PageParam) {
  return requestClient.get<PageResult<ErpFinanceTransferApi.FinanceTransfer>>(
    '/erp/finance-transfer/page',
    { params, timeout: 60_000 },
  );
}

export function getFinanceTransferSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/finance-transfer/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getFinanceTransfer(id: number) {
  return requestClient.get<ErpFinanceTransferApi.FinanceTransfer>(
    `/erp/finance-transfer/get?id=${id}`,
  );
}

export function getFinanceTransferDeptSimpleList() {
  return requestClient.get<any[]>('/erp/finance-transfer/dept-simple-list');
}

export function getFinanceTransferDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-transfer/dept-simple-page',
    { params },
  );
}

export function getFinanceTransferUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-transfer/user-simple-page',
    { params },
  );
}

export function createFinanceTransfer(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.post('/erp/finance-transfer/create', data);
}

export function createFinanceTransferDraft(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.post<number>('/erp/finance-transfer/create-draft', data);
}

export function createAndSubmitFinanceTransfer(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.post<number>(
    '/erp/finance-transfer/create-and-submit',
    data,
  );
}

export function updateFinanceTransfer(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.put('/erp/finance-transfer/update', data);
}

export function updateFinanceTransferDraft(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.put('/erp/finance-transfer/update-draft', data);
}

export function updateAndSubmitFinanceTransfer(
  data: ErpFinanceTransferApi.FinanceTransfer,
) {
  return requestClient.put('/erp/finance-transfer/update-and-submit', data);
}

export function submitFinanceTransfer(id: number) {
  return requestClient.put('/erp/finance-transfer/submit', null, {
    params: { id },
  });
}

export function batchUpdateFinanceTransfer(
  data: { ids: number[] } & Partial<ErpFinanceTransferApi.FinanceTransfer>,
) {
  return batchUpdateFinanceByDetail(data, getFinanceTransfer, (detail) =>
    detail.status === 0
      ? updateFinanceTransferDraft(detail)
      : updateFinanceTransfer(detail),
  );
}

export function updateFinanceTransferStatus(id: number, status: number) {
  return requestClient.put('/erp/finance-transfer/update-status', null, {
    params: { id, status },
  });
}

export function deleteFinanceTransfer(ids: number[]) {
  return requestClient.delete('/erp/finance-transfer/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportFinanceTransfer(params?: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/finance-transfer/export-excel', {
    params: exportParams,
  });
}

export function getFinanceTransferExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/finance-transfer/export-fields');
}

export function getFinanceTransferImportTemplate() {
  return requestClient.download('/erp/finance-transfer/get-import-template');
}

export function importFinanceTransfer(file: File) {
  return requestClient.upload<ErpFinanceTransferApi.FinanceImportResult>(
    '/erp/finance-transfer/import',
    { file },
  );
}

export function downloadFinanceTransferImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/finance-transfer/import-failure-details/download',
    { params: { recordId } },
  );
}

export function updateFinanceTransferRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/finance-transfer/update-remark', data);
}
