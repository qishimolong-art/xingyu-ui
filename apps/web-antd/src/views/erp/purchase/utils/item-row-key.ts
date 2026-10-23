export interface PurchaseItemClientRow {
  clientRowKey?: string;
  id?: number | string;
  seq?: number;
}

export interface EnsurePurchaseItemClientRowKeyOptions {
  forceNew?: boolean;
  usedKeys?: Set<string>;
}

let managerSequence = 0;

function hasValue(value: unknown): value is number | string {
  return value !== undefined && value !== null && value !== '';
}

/**
 * 为一张采购表单创建独立的前端行身份管理器。
 * 已保存行使用数据库明细 ID；待新增行使用当前管理器生命周期内的递增键。
 */
export function createPurchaseItemClientRowKeyManager(scope: string) {
  let lifecycleSequence = ++managerSequence;
  let rowSequence = 0;

  function createNewKey() {
    rowSequence += 1;
    return `${scope}:local:${lifecycleSequence}:${rowSequence}`;
  }

  function ensureRowKey<T extends PurchaseItemClientRow>(
    row: T,
    options: EnsurePurchaseItemClientRowKeyOptions = {},
  ) {
    const { forceNew = false, usedKeys } = options;
    let rowKey = forceNew ? undefined : row.clientRowKey?.trim();
    if (!rowKey && !forceNew && hasValue(row.id)) {
      rowKey = `${scope}:id:${row.id}`;
    }
    if (!rowKey || usedKeys?.has(rowKey)) {
      do {
        rowKey = createNewKey();
      } while (usedKeys?.has(rowKey));
    }
    row.clientRowKey = rowKey;
    usedKeys?.add(rowKey);
    return rowKey;
  }

  function ensureRowKeys<T extends PurchaseItemClientRow>(rows: T[]) {
    const usedKeys = new Set<string>();
    rows.forEach((row) => ensureRowKey(row, { usedKeys }));
    return rows;
  }

  function reset() {
    lifecycleSequence = ++managerSequence;
    rowSequence = 0;
  }

  return {
    ensureRowKey,
    ensureRowKeys,
    reset,
  };
}

export function stripPurchaseItemClientFields<T extends PurchaseItemClientRow>(
  item: T,
) {
  const { clientRowKey: _clientRowKey, seq: _seq, ...businessFields } = item;
  return businessFields;
}
