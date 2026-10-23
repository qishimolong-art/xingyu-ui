import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpPayableMiscApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: {
      name?: string;
      reason?: string;
      rowNo?: number;
    }[];
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  export interface PayableMisc {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    supplierId?: number;
    supplierName?: string;
    supplierContact?: string;
    supplierMobile?: string;
    accountId?: number;
    accountName?: string;
    amount?: number | string | null;
    settledAmount?: number | string | null;
    balanceAmount?: number | string | null;
    pendingTransferAmount?: number | string | null;
    transferAvailableAmount?: number | string | null;
    remark?: string;
    fileUrl?: string;
    sourceType?: string;
    sourceId?: number;
    sourceNo?: string;
    sourceItemId?: number;
    sourceMiscId?: number;
    sourceMiscNo?: string;
    generatedOffset?: boolean;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
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

export function getPayableMiscPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPayableMiscApi.PayableMisc>>(
    '/erp/payable-misc/page',
    { params, timeout: 60_000 },
  );
}

export function getPayableMiscSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>('/erp/payable-misc/summary', {
    params,
    signal,
    timeout: 30_000,
  });
}

export function getPayableMisc(id: number) {
  return requestClient.get<ErpPayableMiscApi.PayableMisc>(
    '/erp/payable-misc/get',
    { params: { id } },
  );
}

export function getPayableMiscDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-misc/dept-simple-page',
    { params },
  );
}

export function getPayableMiscUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-misc/user-simple-page',
    { params },
  );
}

export function createPayableMisc(data: ErpPayableMiscApi.PayableMisc) {
  return requestClient.post<number>('/erp/payable-misc/create', data);
}

export function createPayableMiscDraft(data: ErpPayableMiscApi.PayableMisc) {
  return requestClient.post<number>('/erp/payable-misc/create-draft', data);
}

export function createAndSubmitPayableMisc(
  data: ErpPayableMiscApi.PayableMisc,
) {
  return requestClient.post<number>(
    '/erp/payable-misc/create-and-submit',
    data,
  );
}

export function updatePayableMisc(data: ErpPayableMiscApi.PayableMisc) {
  return requestClient.put('/erp/payable-misc/update', data);
}

export function updatePayableMiscDraft(data: ErpPayableMiscApi.PayableMisc) {
  return requestClient.put('/erp/payable-misc/update-draft', data);
}

export function updateAndSubmitPayableMisc(
  data: ErpPayableMiscApi.PayableMisc,
) {
  return requestClient.put('/erp/payable-misc/update-and-submit', data);
}

export function submitPayableMisc(id: number) {
  return requestClient.put('/erp/payable-misc/submit', null, {
    params: { id },
  });
}

export function updatePayableMiscStatus(id: number, status: number) {
  return requestClient.put('/erp/payable-misc/update-status', null, {
    params: { id, status },
  });
}

export function deletePayableMisc(id: number) {
  return requestClient.delete('/erp/payable-misc/delete', {
    params: { id },
  });
}

export function exportPayableMisc(params?: Record<string, any>) {
  return requestClient.download('/erp/payable-misc/export-excel', {
    params,
  });
}

export function getPayableMiscExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/payable-misc/export-fields');
}

export function getPayableMiscImportTemplate() {
  return requestClient.download('/erp/payable-misc/get-import-template');
}

export function importPayableMisc(file: File) {
  return requestClient.upload<ErpPayableMiscApi.FinanceImportResult>(
    '/erp/payable-misc/import',
    { file },
  );
}
