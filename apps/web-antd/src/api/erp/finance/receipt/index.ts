import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../utils/batch-update';
import type { FinanceQuerySummary } from '../query-summary';

export const FINANCE_RECEIPT_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  APPROVE: 20,
  REJECT: 30,
} as const;

export namespace ErpFinanceReceiptApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  /** 收款单项 */
  export interface FinanceReceiptItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    row_id?: number; // 旧前端临时 ID，仅兼容读取
    bizId: number; // 业务ID
    bizType: number; // 业务类型
    bizNo: string; // 业务编号
    totalPrice: number | string | null; // 应收金额
    receiptedPrice: number | string | null; // 已收金额
    receiptPrice: number | string | null; // 本次收款
    writeOffStatus?: number; // 0 待生效、1 已生效、2 已撤销
    writeOffTime?: string;
    writeOffUserId?: number;
    reverseTime?: string;
    reverseUserId?: number;
    reverseReason?: string;
    remark?: string; // 备注
    bizTime?: Date | number | string; // 业务日期（前端展示）
    customerName?: string; // 收款客户（前端展示）
    deptName?: string; // 所属部门（前端展示）
    receiptMethod?: string; // 收款方式（前端展示）
    accountName?: string; // 收款账户（前端展示）
    receiptTime?: Date | number | string; // 收款日期（前端展示）
    financeUserName?: string; // 经办人（前端展示）
  }

  export interface FinanceReceiptItemPageReq extends PageParam {
    receiptId: number;
    mask?: boolean;
    orderDirection?: string;
    orderField?: string;
  }

  export interface FinanceReceiptWriteOffItem {
    receiptItemId?: number;
    receiptId?: number;
    receiptNo?: string;
    receiptTime?: Date | number | string;
    accountName?: string;
    financeUserName?: string;
    receiptPrice?: number | string | null;
    writeOffTime?: Date | number | string;
    writeOffStatus?: number;
    remark?: string;
  }

  /** 收款单信息 */
  export interface FinanceReceipt {
    id?: number; // 收款单编号
    no: string; // 收款单号
    customerId: number; // 客户编号
    customerName?: string; // 客户名称
    receiptTime: Date | number | string; // 收款时间
    totalPrice: number | string | null; // 合计金额，单位：元
    discountPrice: number | string | null; // 优惠金额
    receiptPrice: number | string | null; // 实际收款金额
    allocatedPrice?: number | string | null; // 已核销金额
    unallocatedPrice?: number | string | null; // 未核销金额
    writeOffStatus?: number; // 0 未核销、1 部分核销、2 已核销、3 异常
    writeOffCount?: number;
    status: number; // 状态
    remark: string; // 备注
    fileUrl?: string; // 附件
    accountId?: number; // 收款账户
    accountName?: string; // 账户名称
    sourceReceivableMiscId?: number;
    sourceTransferAvailableAmount?: number | string | null; // 来源其他应收单
    sourceReceivableMiscNo?: string; // 来源其他应收单号
    settleMethod?: string; // 结算方式
    bankName?: string; // 开户行
    paymentVoucherNo?: string; // 凭证号（客户付款编号）
    voucherNo?: string; // 会计凭证号
    financeUserId?: number; // 财务人员
    financeUserName?: string; // 财务人员姓名
    deptId?: number; // 所属部门
    deptName?: string; // 所属部门名称
    creator?: string; // 创建人
    creatorName?: string; // 创建人姓名
    createTime?: number | string; // 创建时间
    updater?: string; // 修改人
    updaterName?: string; // 修改人姓名
    updateTime?: number | string; // 修改时间
    auditorName?: string; // 审核人
    auditTime?: string; // 审核日期
    items?: FinanceReceiptItem[]; // 收款明细
    bizNo?: string; // 业务单号
  }

  export interface WriteOffCandidate {
    bizType: number;
    bizTypeName: string;
    bizId: number;
    bizNo: string;
    bizTime?: string;
    totalPrice: number | string | null;
    allocatedPrice: number | string | null;
    unallocatedPrice: number | string | null;
    writeOffAmount?: number | string | null;
    remark?: string;
  }

  export interface FinanceReceiptFormCandidate {
    allocatedPrice: number | string | null;
    bizId: number;
    bizNo: string;
    bizTime?: Date | number | string;
    bizType: number;
    bizTypeName?: string;
    createTime?: Date | number | string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    totalPrice: number | string | null;
    unallocatedPrice: number | string | null;
    autoWriteOffPreviewAmount?: number | string | null;
    available?: boolean;
    clientRowKey?: string;
  }

  export interface FinanceReceiptCandidateSelection {
    amount: number | string | null;
    bizId: number;
    bizType: number;
  }

  export interface FinanceReceiptFormCandidatePageReq extends PageParam {
    customerId?: number;
    deptId?: number;
    documentTotalPrice?: number | string | null;
    no?: string;
    orderDirection?: string;
    orderField?: string;
    selectedItems?: FinanceReceiptCandidateSelection[];
  }

  export interface FinanceReceiptFormCandidatePage {
    autoWriteOffAmount: number | string | null;
    autoWriteOffCount: number;
    list: FinanceReceiptFormCandidate[];
    total: number;
    unavailableSelectedItems?: FinanceReceiptCandidateSelection[];
  }
}

/** 查询收款单分页 */
export function getFinanceReceiptPage(params: PageParam) {
  return requestClient.get<PageResult<ErpFinanceReceiptApi.FinanceReceipt>>(
    '/erp/finance-receipt/page',
    {
      params,
    },
  );
}

/** 查询收款单详情 */
export function getFinanceReceipt(
  id: number,
  options?: { includeItems?: boolean },
) {
  return requestClient.get<ErpFinanceReceiptApi.FinanceReceipt>(
    '/erp/finance-receipt/get',
    { params: { id, ...options } },
  );
}

/** 查询收款单明细分页 */
export function getFinanceReceiptItemPage(
  params: ErpFinanceReceiptApi.FinanceReceiptItemPageReq,
) {
  return requestClient.get<PageResult<ErpFinanceReceiptApi.FinanceReceiptItem>>(
    '/erp/finance-receipt/item-page',
    { params, timeout: 60_000 },
  );
}

export function getFinanceReceiptSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/finance-receipt/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getFinanceReceiptWriteOffItems(params: {
  bizId: number;
  bizType: number;
}) {
  return requestClient.get<ErpFinanceReceiptApi.FinanceReceiptWriteOffItem[]>(
    '/erp/finance-receipt/writeoff-items',
    { params },
  );
}

export function getFinanceReceiptFormCandidates(params: {
  customerId?: number;
  deptId?: number;
  no?: string;
}) {
  return requestClient.get<ErpFinanceReceiptApi.FinanceReceiptFormCandidate[]>(
    '/erp/finance-receipt/form-candidates',
    { params },
  );
}

export function getFinanceReceiptFormCandidatePage(
  data: ErpFinanceReceiptApi.FinanceReceiptFormCandidatePageReq,
) {
  return requestClient.post<ErpFinanceReceiptApi.FinanceReceiptFormCandidatePage>(
    '/erp/finance-receipt/form-candidate-page',
    data,
  );
}

export function getFinanceReceiptDeptSimpleList() {
  return requestClient.get<any[]>('/erp/finance-receipt/dept-simple-list');
}

export function getFinanceReceiptDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-receipt/dept-simple-page',
    { params },
  );
}

export function getFinanceReceiptUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-receipt/user-simple-page',
    { params },
  );
}

export function getFinanceReceiptCustomerDeptSimpleList(customerId: number) {
  return requestClient.get<any[]>(
    `/erp/finance-receipt/customer-dept-simple-list?customerId=${customerId}`,
  );
}

/** 新增收款单 */
export function createFinanceReceipt(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.post('/erp/finance-receipt/create', data);
}

export function createFinanceReceiptDraft(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.post('/erp/finance-receipt/create-draft', data);
}

export function createAndSubmitFinanceReceipt(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.post('/erp/finance-receipt/create-and-submit', data);
}

/** 修改收款单 */
export function updateFinanceReceipt(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.put('/erp/finance-receipt/update', data);
}

export function updateFinanceReceiptDraft(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.put('/erp/finance-receipt/update-draft', data);
}

export function updateAndSubmitFinanceReceipt(
  data: ErpFinanceReceiptApi.FinanceReceipt,
) {
  return requestClient.put('/erp/finance-receipt/update-and-submit', data);
}

export function submitFinanceReceipt(id: number) {
  return requestClient.put('/erp/finance-receipt/submit', null, {
    params: { id },
  });
}

export function batchUpdateFinanceReceipt(
  data: Partial<ErpFinanceReceiptApi.FinanceReceipt> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(
    data,
    getFinanceReceipt,
    updateFinanceReceipt,
  );
}

/** 审核收款单 */
export function updateFinanceReceiptStatus(id: number) {
  return requestClient.put('/erp/finance-receipt/update-status', null, {
    params: { id, status: 20 },
  });
}

/** 删除收款单 */
export function deleteFinanceReceipt(ids: number[]) {
  return requestClient.delete('/erp/finance-receipt/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

/** 导出收款单 Excel */
export function exportFinanceReceipt(params?: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/finance-receipt/export-excel', {
    params: exportParams,
  });
}

export function getFinanceReceiptExportFields() {
  return requestClient.get<
    Array<{
      field: string;
      group?: string;
      groupLabel?: string;
      label: string;
      required?: boolean;
      sort?: number;
    }>
  >('/erp/finance-receipt/export-fields');
}

export function getFinanceReceiptImportTemplate() {
  return requestClient.download('/erp/finance-receipt/get-import-template');
}

export function importFinanceReceipt(file: File) {
  return requestClient.upload<ErpFinanceReceiptApi.FinanceImportResult>(
    '/erp/finance-receipt/import',
    { file },
  );
}

export function downloadFinanceReceiptImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/finance-receipt/import-failure-details/download',
    { params: { recordId } },
  );
}

export function getFinanceReceiptWriteOffCandidates(receiptId: number) {
  return requestClient.get<ErpFinanceReceiptApi.WriteOffCandidate[]>(
    '/erp/finance-receipt/writeoff-candidates',
    { params: { receiptId } },
  );
}

export function writeOffFinanceReceipt(data: {
  items: Array<{
    bizId: number;
    bizType: number;
    remark?: string;
    writeOffAmount: number | string | null;
  }>;
  receiptId: number;
}) {
  return requestClient.post('/erp/finance-receipt/writeoff', data);
}

export function reverseFinanceReceiptWriteOff(data: {
  itemId: number;
  reason: string;
}) {
  return requestClient.post('/erp/finance-receipt/writeoff-reverse', data);
}

export function updateFinanceReceiptRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/finance-receipt/update-remark', data);
}
