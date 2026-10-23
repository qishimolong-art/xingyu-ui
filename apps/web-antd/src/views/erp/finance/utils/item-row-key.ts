export interface FinanceItemClientRow {
  clientRowKey?: string;
  id?: number | string;
  row_id?: number | string;
  seq?: number;
}

export interface EnsureFinanceItemClientRowKeyOptions {
  forceNew?: boolean;
  sourceKey?: string;
  usedKeys?: Set<string>;
}

let managerSequence = 0;

function hasValue(value: unknown): value is number | string {
  return value !== undefined && value !== null && value !== '';
}

/** 为一张资金表单创建独立的前端行身份管理器。 */
export function createFinanceItemClientRowKeyManager(scope: string) {
  let lifecycleSequence = ++managerSequence;
  let rowSequence = 0;

  function createNewKey() {
    rowSequence += 1;
    return `${scope}:local:${lifecycleSequence}:${rowSequence}`;
  }

  function ensureRowKey<T extends object>(
    row: T,
    options: EnsureFinanceItemClientRowKeyOptions = {},
  ) {
    const keyedRow = row as T & FinanceItemClientRow;
    const { forceNew = false, sourceKey, usedKeys } = options;
    let rowKey = forceNew ? undefined : keyedRow.clientRowKey?.trim();
    if (!rowKey && !forceNew && hasValue(keyedRow.id)) {
      rowKey = `${scope}:id:${keyedRow.id}`;
    }
    if (!rowKey && !forceNew && sourceKey) {
      rowKey = `${scope}:source:${sourceKey}`;
    }
    if (!rowKey || usedKeys?.has(rowKey)) {
      do {
        rowKey = createNewKey();
      } while (usedKeys?.has(rowKey));
    }
    keyedRow.clientRowKey = rowKey;
    usedKeys?.add(rowKey);
    return rowKey;
  }

  function ensureRowKeys<T extends object>(rows: T[]) {
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

export function stripFinanceItemClientFields<T extends FinanceItemClientRow>(
  item: T,
) {
  const {
    clientRowKey: _clientRowKey,
    row_id: _rowId,
    seq: _seq,
    ...businessFields
  } = item;
  return businessFields;
}
