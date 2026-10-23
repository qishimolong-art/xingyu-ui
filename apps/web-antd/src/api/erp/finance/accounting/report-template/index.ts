import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReportItemTemplateApi {
  /** ERP 报表项目模板 */
  export interface ReportItemTemplate {
    id?: number;
    reportType: number; // 报表类型：1=资产负债表 2=利润表 3=现金流量表
    side?: number; // 区域：1=左侧 2=右侧
    itemName: string; // 项目名称
    rowNo?: number; // 行次
    formula?: string; // 取数公式
    parentId?: number; // 父项编号
    sort: number; // 排序
    enable: boolean; // 是否启用
    remark?: string; // 备注
    createTime?: number;
  }
}

/** 查询报表项目模板分页 */
export function getReportItemTemplatePage(params: PageParam) {
  return requestClient.get<
    PageResult<ErpReportItemTemplateApi.ReportItemTemplate>
  >('/erp/report-item-template/page', { params });
}

/** 查询报表项目模板列表（树形渲染用） */
export function getReportItemTemplateList(reportType: number, side?: number) {
  return requestClient.get<ErpReportItemTemplateApi.ReportItemTemplate[]>(
    '/erp/report-item-template/list',
    { params: { reportType, side } },
  );
}

/** 查询报表项目模板详情 */
export function getReportItemTemplate(id: number) {
  return requestClient.get<ErpReportItemTemplateApi.ReportItemTemplate>(
    `/erp/report-item-template/get?id=${id}`,
  );
}

/** 新增报表项目 */
export function createReportItemTemplate(
  data: ErpReportItemTemplateApi.ReportItemTemplate,
) {
  return requestClient.post('/erp/report-item-template/create', data);
}

/** 修改报表项目（用于配公式） */
export function updateReportItemTemplate(
  data: ErpReportItemTemplateApi.ReportItemTemplate,
) {
  return requestClient.put('/erp/report-item-template/update', data);
}

/** 删除报表项目 */
export function deleteReportItemTemplate(id: number) {
  return requestClient.delete(`/erp/report-item-template/delete?id=${id}`);
}
