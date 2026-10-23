import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../utils/batch-update';

export const ACCOUNT_DOCUMENT_STATUS = {
  DRAFT: 0,
  SUBMITTED: 10,
} as const;

export namespace ErpAccountApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }
  /** 结算账户信息 */
  export interface Account {
    id?: number;
    no?: string;
    remark?: string;
    status?: number;
    documentStatus?: number;
    sort?: number;
    defaultStatus?: boolean;
    name?: string;
    accountType?: number;
    bankName?: string;
    bankAccount?: string;
    currentBalance?: number | string | null;
    deptId?: number;
    deptName?: string;
    creator?: string;
    creatorName?: string;
    createTime?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: string;
  }

  export interface AccountTransaction {
    no?: string;
    billType?: 'payment' | 'receipt';
    billTypeName?: string;
    amount?: number | string | null;
    balance?: number | string | null;
    transactionTime?: string;
    bizNo?: string;
    remark?: string;
  }
}

export function getAccountPage(params: PageParam) {
  return requestClient.get<PageResult<ErpAccountApi.Account>>(
    '/erp/account/page',
    { params },
  );
}

export function getAccountTransactionPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpAccountApi.AccountTransaction>>(
    '/erp/account/transaction-page',
    { params },
  );
}

export function getAccountSimpleList() {
  return requestClient.get<ErpAccountApi.Account[]>('/erp/account/simple-list');
}

export function getAccountSimplePage(params: PageParam) {
  return requestClient.get<PageResult<ErpAccountApi.Account>>(
    '/erp/account/simple-page',
    { params },
  );
}

export function getAccountSimple(id: number) {
  return requestClient.get<ErpAccountApi.Account>('/erp/account/simple-get', {
    params: { id },
  });
}

export function getDefaultAccount() {
  return requestClient.get<ErpAccountApi.Account | null>(
    '/erp/account/default',
  );
}

export function getAccountDeptSimpleList() {
  return requestClient.get<any[]>('/erp/account/dept-simple-list');
}

export function getAccountDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/account/dept-simple-page', {
    params,
  });
}

export function getAccount(id: number) {
  return requestClient.get<ErpAccountApi.Account>(`/erp/account/get?id=${id}`);
}

export function createAccount(data: ErpAccountApi.Account) {
  return requestClient.post('/erp/account/create', data);
}

export function createAccountDraft(data: ErpAccountApi.Account) {
  return requestClient.post('/erp/account/create-draft', data);
}

export function createAndSubmitAccount(data: ErpAccountApi.Account) {
  return requestClient.post('/erp/account/create-and-submit', data);
}

export function updateAccount(data: ErpAccountApi.Account) {
  return requestClient.put('/erp/account/update', data);
}

export function updateAccountDraft(data: ErpAccountApi.Account) {
  return requestClient.put('/erp/account/update-draft', data);
}

export function updateAndSubmitAccount(data: ErpAccountApi.Account) {
  return requestClient.put('/erp/account/update-and-submit', data);
}

export function submitAccountDraft(id: number) {
  return requestClient.put(`/erp/account/submit?id=${id}`);
}

export function batchUpdateAccount(
  data: Partial<ErpAccountApi.Account> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(data, getAccount, updateAccount);
}

export function updateAccountDefaultStatus(id: number, defaultStatus: boolean) {
  return requestClient.put('/erp/account/update-default-status', null, {
    params: { id, defaultStatus },
  });
}

export function deleteAccount(id: number) {
  return requestClient.delete(`/erp/account/delete?id=${id}`);
}

export function exportAccount(params?: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/account/export-excel', {
    params: exportParams,
  });
}

export function getAccountExportFields(
  scope: 'account' | 'transaction' = 'account',
) {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/account/export-fields', { params: { scope } });
}

export function exportAccountTransactions(params?: Record<string, any>) {
  return requestClient.download('/erp/account/transaction-export-excel', {
    params,
  });
}

export function getAccountImportTemplate() {
  return requestClient.download('/erp/account/get-import-template');
}

export function importAccount(file: File) {
  return requestClient.upload<ErpAccountApi.FinanceImportResult>(
    '/erp/account/import',
    { file },
  );
}

export function downloadAccountImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/account/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
