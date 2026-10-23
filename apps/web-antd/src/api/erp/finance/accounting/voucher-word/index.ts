import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpVoucherWordApi {
  /** ERP 凭证字 */
  export interface VoucherWord {
    id?: number;
    code: string; // 凭证字代码（如：记）
    name: string; // 名称（如：记账凭证）
    enable: boolean; // 是否启用
    sort: number; // 排序
    remark?: string; // 备注
    createTime?: number;
  }
}

/** 查询凭证字分页 */
export function getVoucherWordPage(params: PageParam) {
  return requestClient.get<PageResult<ErpVoucherWordApi.VoucherWord>>(
    '/erp/voucher-word/page',
    { params },
  );
}

/** 查询启用的凭证字精简列表（下拉用） */
export function getVoucherWordSimpleList() {
  return requestClient.get<ErpVoucherWordApi.VoucherWord[]>(
    '/erp/voucher-word/simple-list',
  );
}

/** 查询凭证字详情 */
export function getVoucherWord(id: number) {
  return requestClient.get<ErpVoucherWordApi.VoucherWord>(
    `/erp/voucher-word/get?id=${id}`,
  );
}

/** 新增凭证字 */
export function createVoucherWord(data: ErpVoucherWordApi.VoucherWord) {
  return requestClient.post('/erp/voucher-word/create', data);
}

/** 修改凭证字 */
export function updateVoucherWord(data: ErpVoucherWordApi.VoucherWord) {
  return requestClient.put('/erp/voucher-word/update', data);
}

/** 删除凭证字 */
export function deleteVoucherWord(id: number) {
  return requestClient.delete(`/erp/voucher-word/delete?id=${id}`);
}
