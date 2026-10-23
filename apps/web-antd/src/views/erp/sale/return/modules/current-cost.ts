import type { SaleReturnCurrentCostApi } from '#/api/erp/sale/return/current-cost';
import { getSaleReturnCurrentCostItems } from '#/api/erp/sale/return/current-cost';

export const currentCostStatusLabels: Record<string, string> = {
  POSTED: '已过账成本（历史快照）',
  HISTORICAL_COST_MISSING: '历史成本未记录',
  DISABLED: '新核算未启用',
  NOT_APPLICABLE: '不适用',
  READY: '成本可用于审核',
  CONFIRMATION_REQUIRED: '成本需要补齐或重新确认',
  SCHEMA_MISSING: '核算结构未就绪',
  STOCK_RECONCILIATION_REQUIRED: '库存需要先核对',
};
export const currentCostSourceLabels: Record<string, string> = {
  CURRENT_AVERAGE: '两套当前均价',
  MANUAL_CONFIRMED: '已确认成本',
  MISSING: '成本缺失',
};
export function currentCostText(value: unknown, masked = false) {
  if (masked) return '****';
  return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
    ? value
    : '不可用';
}
export function currentCostRowText(
  row: Record<string, unknown>,
  field: unknown,
  masked = false,
): string {
  if (typeof field !== 'string') return '未记录';
  if (field === 'financialAmount' || field === 'settlementAmount')
    return currentCostText(row[field], masked);
  if (field === 'quantity') return currentCostText(row.quantity);
  if (field === 'warehouseName')
    return String(row.warehouseName || `仓库 #${row.warehouseId}`);
  if (field === 'productName')
    return String(
      row.productName || row.productCode || `配件 #${row.productId}`,
    );
  if (field === 'costSource')
    return typeof row.costSource === 'string'
      ? currentCostSourceLabels[row.costSource] || '未记录'
      : '未记录';
  return row[field] === null || row[field] === undefined
    ? '未记录'
    : String(row[field]);
}
export function assertCostPage(
  header: SaleReturnCurrentCostApi.Header,
  page: { list: SaleReturnCurrentCostApi.Item[]; total: number },
) {
  if (
    page.total !== header.sourceItemCount ||
    page.list.some(
      (row) =>
        row.sourceSignature !== header.sourceSignature ||
        row.basisSignature !== header.basisSignature,
    )
  )
    throw new Error('来源或库存成本已变化，请重新预览核对');
}
export async function loadCompleteCurrentCostItems(
  header: SaleReturnCurrentCostApi.Header,
) {
  if (
    !Number.isSafeInteger(header.sourceItemCount) ||
    header.sourceItemCount <= 0
  )
    throw new Error('没有可确认的完整来源明细');
  const rows: SaleReturnCurrentCostApi.Item[] = [];
  const ids = new Set<number>();
  for (let pageNo = 1; rows.length < header.sourceItemCount; pageNo++) {
    const page = await getSaleReturnCurrentCostItems(header, pageNo, 100);
    assertCostPage(header, page);
    if (!page.list.length) throw new Error('来源明细不完整，请重新预览');
    for (const row of page.list) {
      if (
        !Number.isSafeInteger(row.sourceItemId) ||
        row.sourceItemId <= 0 ||
        ids.has(row.sourceItemId)
      )
        throw new Error('来源明细重复或无效');
      ids.add(row.sourceItemId);
      rows.push(row);
    }
    if (rows.length > header.sourceItemCount)
      throw new Error('来源明细数量不一致');
  }
  return rows;
}
export function validateCurrentCost(
  rows: SaleReturnCurrentCostApi.Item[],
  evidence: string,
) {
  if (!rows.length) return '没有可确认的完整来源明细';
  if (!evidence.trim() || evidence.trim().length > 500)
    return '请填写核对依据（1至500字）';
  if (
    rows.some(
      (row) =>
        ![row.financialAmount, row.settlementAmount].every(
          (value) =>
            typeof value === 'string' && /^\d{1,18}(\.\d{1,6})?$/.test(value),
        ),
    )
  )
    return '每行两套成本总额均需明确填写，最多18位整数6位小数，不能将未填写当零';
  if (rows.some((row) => (row.evidence?.length ?? 0) > 500))
    return '明细依据最多500字';
  return undefined;
}
