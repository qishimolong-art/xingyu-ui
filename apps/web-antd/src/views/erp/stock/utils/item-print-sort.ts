const ITEM_SORT_LABELS: Record<string, string> = {
  actualCount: '实际库存',
  batchNo: '批次',
  brand: '品牌',
  costAmount: '成本金额',
  costPrice: '成本单价',
  count: '数量',
  drawingNo: '图号',
  featureCode: '特征码',
  fromShelf: '移出货架',
  fromStockCount: '移出库存',
  fromWarehouseDeptName: '调出部门',
  fromWarehouseId: '调出仓库',
  fromWarehouseName: '移出仓库',
  originPlace: '产地',
  packageQty: '包装数',
  pieceCount: '件数',
  productBarCode: '条码',
  productCode: '产品编码',
  productId: '产品名称',
  productName: '产品名称',
  productPrice: '单价',
  productUnitName: '单位',
  remark: '备注',
  standard: '规格',
  stockCount: '当前库存',
  toShelf: '移入货架',
  totalPrice: '金额',
  totalWeight: '总重',
  toStockCount: '移入库存',
  toWarehouseDeptName: '调入部门',
  toWarehouseId: '调入仓库',
  toWarehouseName: '移入仓库',
  vehicleModel: '车型',
  warehouseDeptName: '仓库所属部门',
  warehouseId: '仓库',
  weight: '单重',
};

export type StockDetailPrintPayload = Record<string, any> & {
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
};

export function buildStockDetailPrintPayload(
  document: Record<string, any>,
  orderField?: string,
  orderDirection?: 'asc' | 'desc',
): StockDetailPrintPayload {
  return {
    ...document,
    itemOrderDirection: orderField ? orderDirection : undefined,
    itemOrderField: orderDirection ? orderField : undefined,
  };
}

export function getStockDetailPrintTooltip(
  orderField?: string,
  orderDirection?: 'asc' | 'desc',
) {
  if (!orderField || !orderDirection) return '按原始顺序打印';
  const label = ITEM_SORT_LABELS[orderField] ?? orderField;
  return `按${label}${orderDirection === 'asc' ? '升序' : '降序'}打印`;
}
