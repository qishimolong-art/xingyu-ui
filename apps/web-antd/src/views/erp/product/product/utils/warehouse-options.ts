interface WarehouseOption {
  id?: number;
  name?: string;
  [key: string]: any;
}

interface SelectedWarehouse {
  defaultWarehouseId?: number;
  defaultWarehouseName?: string;
}

interface WarehouseVisibilityContext {
  readonly?: boolean;
  readonlyBySaleDistribution?: boolean;
}

/**
 * 详情态需要覆盖“本部门数据 + 销售仓分配”的交叉范围；编辑态仍只加载可编辑仓库。
 */
export function shouldUseStockVisibleWarehouseOptions(
  context?: WarehouseVisibilityContext,
) {
  return Boolean(context?.readonly || context?.readonlyBySaleDistribution);
}

/**
 * 当已选默认仓库不在当前用户的可选仓库中时，仍保留名称用于详情和编辑回显。
 */
export function includeSelectedWarehouseOption<T extends WarehouseOption>(
  options: T[] = [],
  selected?: SelectedWarehouse,
): T[] {
  const selectedId = selected?.defaultWarehouseId;
  const selectedName = selected?.defaultWarehouseName?.trim();
  if (!selectedId || !selectedName) {
    return options;
  }
  if (options.some((option) => Number(option.id) === Number(selectedId))) {
    return options;
  }
  return [{ id: selectedId, name: selectedName } as T, ...options];
}
