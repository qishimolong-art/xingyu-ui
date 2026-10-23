import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpReceivableMiscApi {
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

  export interface ReceivableMisc {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    customerId?: number;
    customerName?: string;
    customerContact?: string;
    customerMobile?: string;
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

export function getReceivableMiscPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpReceivableMiscApi.ReceivableMisc>>(
    '/erp/receivable-misc/page',
    { params, timeout: 60_000 },
  );
}

export function getReceivableMiscSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/receivable-misc/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getReceivableMisc(id: number) {
  return requestClient.get<ErpReceivableMiscApi.ReceivableMisc>(
    '/erp/receivable-misc/get',
    { params: { id } },
  );
}

export function getReceivableMiscDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-misc/dept-simple-page',
    { params },
  );
}

export function getReceivableMiscUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-misc/user-simple-page',
    { params },
  );
}

export function createReceivableMisc(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.post<number>('/erp/receivable-misc/create', data);
}

export function createReceivableMiscDraft(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.post<number>('/erp/receivable-misc/create-draft', data);
}

export function createAndSubmitReceivableMisc(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.post<number>(
    '/erp/receivable-misc/create-and-submit',
    data,
  );
}

export function updateReceivableMisc(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.put('/erp/receivable-misc/update', data);
}

export function updateReceivableMiscDraft(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.put('/erp/receivable-misc/update-draft', data);
}

export function updateAndSubmitReceivableMisc(
  data: ErpReceivableMiscApi.ReceivableMisc,
) {
  return requestClient.put('/erp/receivable-misc/update-and-submit', data);
}

export function submitReceivableMisc(id: number) {
  return requestClient.put('/erp/receivable-misc/submit', null, {
    params: { id },
  });
}

export function updateReceivableMiscStatus(id: number, status: number) {
  return requestClient.put('/erp/receivable-misc/update-status', null, {
    params: { id, status },
  });
}

export function deleteReceivableMisc(id: number) {
  return requestClient.delete('/erp/receivable-misc/delete', {
    params: { id },
  });
}

export function exportReceivableMisc(params?: Record<string, any>) {
  return requestClient.download('/erp/receivable-misc/export-excel', {
    params,
  });
}

export function getReceivableMiscExportFields() {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/receivable-misc/export-fields');
}

export function getReceivableMiscImportTemplate() {
  return requestClient.download('/erp/receivable-misc/get-import-template');
}

export function importReceivableMisc(file: File) {
  return requestClient.upload<ErpReceivableMiscApi.FinanceImportResult>(
    '/erp/receivable-misc/import',
    { file },
  );
}
