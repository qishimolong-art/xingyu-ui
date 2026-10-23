export interface StockItemClientRow {
  clientRowKey?: string;
  id?: number | string;
  seq?: number | string;
}

export interface EnsureStockItemClientRowKeyOptions {
  forceNew?: boolean;
  usedKeys?: Set<string>;
}

let managerSequence = 0;

function hasValue(value: unknown): value is number | string {
  return value !== undefined && value !== null && value !== '';
}

/** 为一张库存单据表单创建独立、稳定的前端行身份管理器。 */
export function createStockItemClientRowKeyManager(scope: string) {
  let lifecycleSequence = ++managerSequence;
  let rowSequence = 0;

  function createNewKey() {
    rowSequence += 1;
    return `${scope}:local:${lifecycleSequence}:${rowSequence}`;
  }

  function ensureRowKey<T extends StockItemClientRow>(
    row: T,
    options: EnsureStockItemClientRowKeyOptions = {},
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

  function ensureRowKeys<T extends StockItemClientRow>(rows: T[]) {
    const usedKeys = new Set<string>();
    rows.forEach((row) => ensureRowKey(row, { usedKeys }));
    return rows;
  }

  function reset() {
    lifecycleSequence = ++managerSequence;
    rowSequence = 0;
  }

  return { ensureRowKey, ensureRowKeys, reset };
}

export function stripStockItemClientFields<T extends StockItemClientRow>(
  item: T,
) {
  const { clientRowKey: _clientRowKey, seq: _seq, ...businessFields } = item;
  return businessFields;
}
