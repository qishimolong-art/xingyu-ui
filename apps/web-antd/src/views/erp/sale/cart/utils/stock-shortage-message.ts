import { formatSaleDecimal } from '#/views/erp/sale/utils/decimal';


export interface SaleCartStockShortageMessageItem {
  productCode?: string;
  productName?: string;
  requiredCount?: number | string;
  shortageCount?: number | string;
  stockCount?: number | string;
  warehouseName?: string;
}

export function buildSaleCartStockShortageText(
  shortages: SaleCartStockShortageMessageItem[],
  limit = 3,
) {
  const lines = shortages.slice(0, limit).map((item) => {
    const productName = item.productName || item.productCode || '未命名产品';
    const warehouseName = item.warehouseName || '当前仓库';
    return `${productName}（${warehouseName}）：需要 ${formatSaleDecimal(item.requiredCount)}，库存 ${formatSaleDecimal(item.stockCount)}，缺 ${formatSaleDecimal(item.shortageCount)}`;
  });
  if (shortages.length > limit) {
    lines.push(`另有 ${shortages.length - limit} 项库存不足`);
  }
  return lines.join('\n');
}
