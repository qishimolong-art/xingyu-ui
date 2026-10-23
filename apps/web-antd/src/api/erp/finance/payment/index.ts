import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

import { batchUpdateFinanceByDetail } from '../utils/batch-update';
import type { FinanceQuerySummary } from '../query-summary';

export namespace ErpFinancePaymentApi {
  export interface FinanceImportResult {
    createCount?: number;
    failureCount?: number;
    failureDetails?: Array<{ name?: string; reason?: string; rowNo?: number }>;
    recordId?: number;
    successCount?: number;
    updateCount?: number;
  }

  /** 付款单信息 */
  export interface FinancePayment {
    id?: number; // 付款单编号
    no: string; // 付款单号
    supplierId?: number; // 供应商编号
    supplierName?: string; // 供应商名称
    paymentTime?: Date; // 付款时间
    totalPrice: number | string | null; // 合计金额，单位：元
    discountPrice: number | string | null; // 优惠金额
    paymentPrice: number | string | null; // 实际付款金额
    allocatedPrice?: number | string | null; // 已核销金额
    unallocatedPrice?: number | string | null; // 未核销金额
    writeOffStatus?: number; // 0 未核销、1 部分核销、2 已核销、3 异常
    writeOffCount?: number;
    status: number; // 状态
    remark: string; // 备注
    fileUrl?: string; // 附件
    accountId?: number; // 付款账户
    accountName?: string; // 账户名称
    sourcePayableMiscId?: number;
    sourceTransferAvailableAmount?: number | string | null; // 来源其他应付单
    sourcePayableMiscNo?: string; // 来源其他应付单号
    settleMethod?: string; // 结算方式
    bankName?: string; // 开户行
    paymentVoucherNo?: string; // 凭证号（供应商收款编号等业务侧手工凭据）
    voucherNo?: string; // 会计凭证号
    financeUserId?: number; // 经手人
    financeUserName?: string; // 经手人姓名
    deptId?: number; // 所属部门
    deptName?: string; // 所属部门名称
    creator?: string; // 创建人
    creatorName?: string; // 创建人姓名
    createTime?: string; // 创建时间
    updater?: string; // 修改人
    updaterName?: string; // 修改人姓名
    updateTime?: string; // 修改时间
    auditorName?: string; // 审核人
    auditTime?: string; // 审核日期
    printCount?: number; // 打印次数
    printTime?: string; // 打印时间
    items?: FinancePaymentItem[]; // 付款明细
    bizNo?: string; // 业务单号
  }

  /** 付款单项 */
  export interface FinancePaymentItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    row_id?: number; // 旧前端临时 ID，仅兼容读取
    bizId: number; // 业务ID
    bizType: number; // 业务类型
    bizNo: string; // 业务编号
    totalPrice: number | string | null; // 应付金额
    paidPrice: number | string | null; // 已付金额
    paymentPrice: number | string | null; // 本次付款
    writeOffStatus?: number; // 0 待生效、1 已生效、2 已撤销
    writeOffTime?: string;
    writeOffUserId?: number;
    reverseTime?: string;
    reverseUserId?: number;
    reverseReason?: string;
    remark?: string; // 备注
    bizTime?: Date | number | string; // 业务日期（前端展示）
    supplierName?: string; // 付款供应商（前端展示）
    deptName?: string; // 所属部门（前端展示）
    paymentMethod?: string; // 付款方式（前端展示）
    accountName?: string; // 付款账户（前端展示）
    paymentTime?: Date | number | string; // 付款日期（前端展示）
    financeUserName?: string; // 经办人（前端展示）
  }

  export interface FinancePaymentWriteOffItem {
    paymentItemId?: number;
    paymentId?: number;
    paymentNo?: string;
    paymentTime?: Date | number | string;
    accountName?: string;
    financeUserName?: string;
    paymentPrice?: number | string | null;
    writeOffTime?: Date | number | string;
    writeOffStatus?: number;
    remark?: string;
  }

  export interface FinancePaymentItemPageReq extends PageParam {
    paymentId: number;
    mask?: boolean;
    orderDirection?: string;
    orderField?: string;
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

  export interface FinancePaymentFormCandidate {
    allocatedPrice: number | string | null;
    bizId: number;
    bizNo: string;
    bizTime?: Date | number | string;
    bizType: number;
    bizTypeName?: string;
    createTime?: Date | number | string;
    deptId?: number;
    deptName?: string;
    supplierId?: number;
    supplierName?: string;
    totalPrice: number | string | null;
    unallocatedPrice: number | string | null;
    autoWriteOffPreviewAmount?: number | string | null;
    available?: boolean;
    clientRowKey?: string;
  }

  export interface FinancePaymentCandidateSelection {
    amount: number | string | null;
    bizId: number;
    bizType: number;
  }

  export interface FinancePaymentFormCandidatePageReq extends PageParam {
    deptId?: number;
    documentTotalPrice?: number | string | null;
    no?: string;
    orderDirection?: string;
    orderField?: string;
    selectedItems?: FinancePaymentCandidateSelection[];
    supplierId?: number;
  }

  export interface FinancePaymentFormCandidatePage {
    autoWriteOffAmount: number | string | null;
    autoWriteOffCount: number;
    list: FinancePaymentFormCandidate[];
    total: number;
    unavailableSelectedItems?: FinancePaymentCandidateSelection[];
  }
}

/** 查询付款单分页 */
export function getFinancePaymentPage(params: PageParam) {
  return requestClient.get<PageResult<ErpFinancePaymentApi.FinancePayment>>(
    '/erp/finance-payment/page',
    {
      params,
    },
  );
}

/** 查询付款单详情 */
export function getFinancePayment(
  id: number,
  options?: { includeItems?: boolean },
) {
  return requestClient.get<ErpFinancePaymentApi.FinancePayment>(
    '/erp/finance-payment/get',
    { params: { id, ...options } },
  );
}

/** 查询付款单明细分页 */
export function getFinancePaymentItemPage(
  params: ErpFinancePaymentApi.FinancePaymentItemPageReq,
) {
  return requestClient.get<PageResult<ErpFinancePaymentApi.FinancePaymentItem>>(
    '/erp/finance-payment/item-page',
    { params, timeout: 60_000 },
  );
}

export function getFinancePaymentSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/finance-payment/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getFinancePaymentWriteOffItems(params: {
  bizId: number;
  bizType: number;
}) {
  return requestClient.get<ErpFinancePaymentApi.FinancePaymentWriteOffItem[]>(
    '/erp/finance-payment/writeoff-items',
    { params },
  );
}

export function getFinancePaymentFormCandidates(params: {
  deptId?: number;
  no?: string;
  supplierId?: number;
}) {
  return requestClient.get<ErpFinancePaymentApi.FinancePaymentFormCandidate[]>(
    '/erp/finance-payment/form-candidates',
    { params },
  );
}

export function getFinancePaymentFormCandidatePage(
  data: ErpFinancePaymentApi.FinancePaymentFormCandidatePageReq,
) {
  return requestClient.post<ErpFinancePaymentApi.FinancePaymentFormCandidatePage>(
    '/erp/finance-payment/form-candidate-page',
    data,
  );
}

export function getFinancePaymentDeptSimpleList() {
  return requestClient.get<any[]>('/erp/finance-payment/dept-simple-list');
}

export function getFinancePaymentDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-payment/dept-simple-page',
    { params },
  );
}

export function getFinancePaymentUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-payment/user-simple-page',
    { params },
  );
}

/** 新增付款单 */
export function createFinancePayment(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.post('/erp/finance-payment/create', data);
}

export function createFinancePaymentDraft(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.post('/erp/finance-payment/create-draft', data);
}

export function createAndSubmitFinancePayment(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.post('/erp/finance-payment/create-and-submit', data);
}

/** 修改付款单 */
export function updateFinancePayment(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.put('/erp/finance-payment/update', data);
}

export function updateFinancePaymentDraft(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.put('/erp/finance-payment/update-draft', data);
}

export function updateAndSubmitFinancePayment(
  data: ErpFinancePaymentApi.FinancePayment,
) {
  return requestClient.put('/erp/finance-payment/update-and-submit', data);
}

export function submitFinancePayment(id: number) {
  return requestClient.put('/erp/finance-payment/submit', null, {
    params: { id },
  });
}

export function batchUpdateFinancePayment(
  data: Partial<ErpFinancePaymentApi.FinancePayment> & { ids: number[] },
) {
  return batchUpdateFinanceByDetail(
    data,
    getFinancePayment,
    updateFinancePayment,
  );
}

/** 审核付款单 */
export function updateFinancePaymentStatus(id: number) {
  return requestClient.put('/erp/finance-payment/update-status', null, {
    params: { id, status: 20 },
  });
}

/** 删除付款单 */
export function deleteFinancePayment(ids: number[]) {
  return requestClient.delete('/erp/finance-payment/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

/** 导出付款单 Excel */
export function exportFinancePayment(params?: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/finance-payment/export-excel', {
    params: exportParams,
  });
}

export function getFinancePaymentExportFields() {
  return requestClient.get<
    Array<{
      field: string;
      group?: string;
      groupLabel?: string;
      label: string;
      required?: boolean;
      sort?: number;
    }>
  >('/erp/finance-payment/export-fields');
}

export function getFinancePaymentImportTemplate() {
  return requestClient.download('/erp/finance-payment/get-import-template');
}

export function importFinancePayment(file: File) {
  return requestClient.upload<ErpFinancePaymentApi.FinanceImportResult>(
    '/erp/finance-payment/import',
    { file },
  );
}

export function downloadFinancePaymentImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/finance-payment/import-failure-details/download',
    { params: { recordId } },
  );
}

export function getFinancePaymentWriteOffCandidates(paymentId: number) {
  return requestClient.get<ErpFinancePaymentApi.WriteOffCandidate[]>(
    '/erp/finance-payment/writeoff-candidates',
    { params: { paymentId } },
  );
}

export function writeOffFinancePayment(data: {
  items: Array<{
    bizId: number;
    bizType: number;
    remark?: string;
    writeOffAmount: number | string | null;
  }>;
  paymentId: number;
}) {
  return requestClient.post('/erp/finance-payment/writeoff', data);
}

export function reverseFinancePaymentWriteOff(data: {
  itemId: number;
  reason: string;
}) {
  return requestClient.post('/erp/finance-payment/writeoff-reverse', data);
}

export function updateFinancePaymentRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/finance-payment/update-remark', data);
}
