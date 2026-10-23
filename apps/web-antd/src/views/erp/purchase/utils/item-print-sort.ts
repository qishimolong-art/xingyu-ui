const ITEM_SORT_LABELS: Record<string, string> = {
  adjustPrice: '调价差额',
  adjustRatio: '调价比率',
  adjustStatus: '调价状态',
  arrivalCount: '到货数',
  batchNo: '批次',
  brand: '品牌',
  count: '数量',
  deptId: '部门',
  drawingNo: '图号',
  factoryCode: '厂家编码',
  featureCode: '特征码',
  gift: '赠品',
  inCount: '原入库数量',
  inNo: '入库单号',
  inStatus: '入库状态',
  invoiceStatus: '开票状态',
  lastPurchasePrice: '最后采购价',
  newPrice: '调价后单价',
  oldPrice: '原单价',
  originPlace: '产地',
  packageQty: '包装数',
  partCode: '配件编码',
  partName: '配件名称',
  pieceCount: '件数',
  productBarCode: '条码',
  productCode: '产品编码',
  productCostAmount: '成本金额',
  productCostPrice: '成本单价',
  productId: '产品名称',
  productName: '产品名称',
  productPrice: '单价',
  productUnitName: '单位',
  remark: '备注',
  returnableCount: '可退数量',
  returnCount: '已退数量',
  returnStatus: '退货状态',
  sourceDocNo: '来源单号',
  sourceInNo: '原入库单',
  sourceRemainingCount: '剩余可开数量',
  sourceType: '来源类型',
  sourceTypeName: '来源类型',
  standard: '规格',
  stockCount: '库存',
  stockInBillStatus: '入仓状态',
  taxExclusivePrice: '不含税单价',
  taxPercent: '税率',
  taxPrice: '税额',
  totalPrice: '合计金额',
  totalProductPrice: '商品金额',
  vehicleModel: '车型',
  warehouseId: '仓库',
  warehousePosition: '仓位',
  weight: '重量',
  wholeQty: '整件数',
};

export type PurchaseDetailPrintPayload = Record<string, any> & {
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
};

export function buildPurchaseDetailPrintPayload(
  document: Record<string, any>,
  orderField?: string,
  orderDirection?: 'asc' | 'desc',
): PurchaseDetailPrintPayload {
  return {
    ...document,
    itemOrderDirection: orderField ? orderDirection : undefined,
    itemOrderField: orderDirection ? orderField : undefined,
  };
}

export function getPurchaseDetailPrintTooltip(
  orderField?: string,
  orderDirection?: 'asc' | 'desc',
) {
  if (!orderField || !orderDirection) return '按原始顺序打印';
  const label = ITEM_SORT_LABELS[orderField] ?? orderField;
  return `按${label}${orderDirection === 'asc' ? '升序' : '降序'}打印`;
}
