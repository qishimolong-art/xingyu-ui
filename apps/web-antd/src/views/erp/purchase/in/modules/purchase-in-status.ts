import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

export type PurchaseInStatusColorToken =
  | 'primary'
  | 'purple'
  | 'success'
  | 'warning';

export interface PurchaseInStatusMarker {
  colorToken: PurchaseInStatusColorToken;
  description: string;
  explanation: string;
  key: 'adjusted' | 'invoice' | 'return' | 'transfer';
  label: string;
}

const STATUS_LEGEND: PurchaseInStatusMarker[] = [
  {
    key: 'invoice',
    label: '已开票',
    colorToken: 'success',
    description: '已开票',
    explanation: '绿色点表示当前入库单存在已审批的采购发票记录。',
  },
  {
    key: 'adjusted',
    label: '已调价',
    colorToken: 'primary',
    description: '已调价',
    explanation: '蓝色点表示当前入库单存在已审批并已生效的采购调价记录。',
  },
  {
    key: 'return',
    label: '已退货',
    colorToken: 'warning',
    description: '已退货',
    explanation:
      '橙色点表示当前入库单存在已审批的采购退货记录，悬浮单号后的圆点可查看部分或全部退货及数量。',
  },
  {
    key: 'transfer',
    label: '已调拨',
    colorToken: 'purple',
    description: '已调拨',
    explanation:
      '紫色点表示当前入库单存在由本单生成的调拨出库记录，悬浮单号后的圆点可查看部分或全部调拨及数量。',
  },
];

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCount(value: number) {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: 3,
  });
}

function buildQuantityDescription(options: {
  actionLabel: string;
  count: unknown;
  documentCount: unknown;
  documentLabel: string;
  status: unknown;
}) {
  const count = toFiniteNumber(options.count);
  const documentCount = toFiniteNumber(options.documentCount);
  const status = toFiniteNumber(options.status);
  const isAll =
    status === 2 || (count > 0 && documentCount > 0 && count >= documentCount);
  const progressLabel = isAll ? '全部' : '部分';

  if (count > 0 && documentCount > 0) {
    return `${options.actionLabel}（${progressLabel}，${options.actionLabel.slice(1)} ${formatCount(count)} / ${options.documentLabel} ${formatCount(documentCount)}）`;
  }
  if (count > 0) {
    return `${options.actionLabel}（${progressLabel}，${options.actionLabel.slice(1)} ${formatCount(count)}）`;
  }
  return `${options.actionLabel}（${progressLabel}）`;
}

export function getPurchaseInStatusLegend() {
  return STATUS_LEGEND.map((marker) => ({ ...marker }));
}

export function getPurchaseInStatusMarkers(
  row: ErpPurchaseInApi.PurchaseIn,
): PurchaseInStatusMarker[] {
  const markers: PurchaseInStatusMarker[] = [];

  if (row.hasInvoice === true) {
    markers.push({ ...STATUS_LEGEND[0]! });
  }
  if (row.adjusted === true) {
    markers.push({ ...STATUS_LEGEND[1]! });
  }
  if (
    toFiniteNumber(row.returnCount) > 0 ||
    toFiniteNumber(row.returnStatus) > 0
  ) {
    markers.push({
      ...STATUS_LEGEND[2]!,
      description: buildQuantityDescription({
        actionLabel: '已退货',
        count: row.returnCount,
        documentCount: row.totalCount,
        documentLabel: '入库',
        status: row.returnStatus,
      }),
    });
  }
  if (
    toFiniteNumber(row.transferOutCount) > 0 ||
    toFiniteNumber(row.transferOutStatus) > 0
  ) {
    markers.push({
      ...STATUS_LEGEND[3]!,
      description: buildQuantityDescription({
        actionLabel: '已调拨',
        count: row.transferOutCount,
        documentCount: row.totalCount,
        documentLabel: '入库',
        status: row.transferOutStatus,
      }),
    });
  }

  return markers;
}
