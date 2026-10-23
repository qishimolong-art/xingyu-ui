import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpAccountingSubjectApi {
  /** 会计科目 */
  export interface Subject {
    id?: number;
    subjectCode: string; // 科目编码
    subjectName: string; // 科目名称
    shortName?: string; // 科目别名
    subjectCategory: number; // 科目类型：1-资产 2-负债 3-共同 4-权益 5-成本 6-损益
    parentCode?: string; // 父科目编码
    subjectLevel?: number; // 层级
    isLeaf?: boolean; // 是否末级
    balanceDirection?: number; // 余额方向：1-借 2-贷
    openingBalance?: number | string | null | string; // 期初余额
    enable?: boolean; // 是否启用
    sort?: number; // 排序
    voucherType?: number; // 凭证类型：1-客户 2-连锁
    remark?: string; // 备注
    auxiliaryTypes?: string[]; // 辅助核算类型列表
    children?: Subject[]; // 子科目列表
    createTime?: string;
  }

  /** 期初余额批量更新请求 */
  export interface OpeningBalanceUpdateReq {
    items: Array<{
      id: number;
      openingBalance?: number | string | null | string;
    }>;
  }
}

/** 按大类返回科目列表（前端 Tab 切换用） */
export function getAccountingSubjectList(category?: number) {
  return requestClient.get<ErpAccountingSubjectApi.Subject[]>(
    '/erp/accounting-subject/list',
    { params: { category } },
  );
}

/** 返回所有科目树形结构 */
export function getAccountingSubjectTree(category?: number) {
  return requestClient.get<ErpAccountingSubjectApi.Subject[]>(
    '/erp/accounting-subject/tree',
    { params: { category } },
  );
}

/** 获得科目精简列表（凭证录入下拉用） */
export function getAccountingSubjectSimpleList(
  leafOnly?: boolean,
  category?: number,
) {
  return requestClient.get<ErpAccountingSubjectApi.Subject[]>(
    '/erp/accounting-subject/simple-list',
    { params: { leafOnly, category } },
  );
}

/** 会计科目分页 */
export function getAccountingSubjectPage(params: PageParam) {
  return requestClient.get<PageResult<ErpAccountingSubjectApi.Subject>>(
    '/erp/accounting-subject/page',
    { params },
  );
}

/** 查询科目详情 */
export function getAccountingSubject(id: number) {
  return requestClient.get<ErpAccountingSubjectApi.Subject>(
    `/erp/accounting-subject/get?id=${id}`,
  );
}

/** 按科目编码查询 */
export function getAccountingSubjectByCode(code: string) {
  return requestClient.get<ErpAccountingSubjectApi.Subject>(
    '/erp/accounting-subject/get-by-code',
    { params: { code } },
  );
}

/** 查询某科目挂的辅助核算类型列表 */
export function getAuxiliaryListBySubject(subjectId: number) {
  return requestClient.get<string[]>('/erp/accounting-subject/auxiliary-list', {
    params: { subjectId },
  });
}

/** 新增会计科目 */
export function createAccountingSubject(data: ErpAccountingSubjectApi.Subject) {
  return requestClient.post<number>('/erp/accounting-subject/create', data);
}

/** 修改会计科目 */
export function updateAccountingSubject(data: ErpAccountingSubjectApi.Subject) {
  return requestClient.put('/erp/accounting-subject/update', data);
}

/** 删除会计科目 */
export function deleteAccountingSubject(id: number) {
  return requestClient.delete(`/erp/accounting-subject/delete?id=${id}`);
}

/** 批量保存期初余额 */
export function batchUpdateOpeningBalance(
  data: ErpAccountingSubjectApi.OpeningBalanceUpdateReq,
) {
  return requestClient.put(
    '/erp/accounting-subject/batch-update-opening-balance',
    data,
  );
}

/** 导出会计科目 Excel */
export function exportAccountingSubject(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/accounting-subject/export-excel', {
    params: exportParams,
  });
}

/** 下载期初余额导入模板 */
export function getImportTemplate() {
  return requestClient.download('/erp/accounting-subject/export-template');
}

/** 导入期初余额 Excel */
export function importOpeningBalance(file: File) {
  return requestClient.upload<Record<string, string>>(
    '/erp/accounting-subject/import-excel',
    { file },
  );
}

/** 导入会计科目（支持新增 + 重复处理） */
export function importSubjects(
  file: File,
  mode: 'DRY_RUN' | 'OVERWRITE' | 'SKIP' = 'DRY_RUN',
) {
  return requestClient.upload<{
    existedCodes?: string[];
    createdCodes?: string[];
    updatedCodes?: string[];
    skippedCodes?: string[];
    failures?: Array<{ subjectCode: string; reason: string }>;
    dryRun?: boolean;
  }>(`/erp/accounting-subject/import-subjects?mode=${mode}`, { file });
}
