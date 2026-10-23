export interface RefreshSalePriceAdjustGridColumnsOptions<T> {
  columns: T[];
  isOpen: boolean;
  nextTick: () => Promise<void>;
  reloadColumns?: (columns: T[]) => Promise<unknown> | unknown;
  setColumns: (columns: T[]) => void;
}

/**
 * 同步销售调价选择弹窗列配置。
 *
 * 弹窗关闭时 VXE Grid 尚未挂载，只更新 wrapper 配置；打开后再尝试刷新
 * 已挂载表格。列刷新属于展示增强，失败不能阻断主表单的模式切换。
 */
export async function refreshSalePriceAdjustGridColumns<T>({
  columns,
  isOpen,
  nextTick,
  reloadColumns,
  setColumns,
}: RefreshSalePriceAdjustGridColumnsOptions<T>) {
  try {
    setColumns(columns);
  } catch {
    return false;
  }
  if (!isOpen || typeof reloadColumns !== 'function') {
    return false;
  }
  try {
    await nextTick();
    await reloadColumns(columns);
    return true;
  } catch {
    return false;
  }
}
