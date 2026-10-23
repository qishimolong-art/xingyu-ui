type PickDeliveryTableColumn = {
  dataIndex?: string;
  field?: string;
  fixed?: unknown;
  minWidth?: number | string;
  type?: unknown;
  visible?: boolean;
  width?: number | string;
};

function getColumnField(column: PickDeliveryTableColumn) {
  return column.field ?? column.dataIndex ?? '';
}

function getColumnWidth(column: PickDeliveryTableColumn) {
  const width = Number(column.width ?? column.minWidth ?? 0);
  return Number.isFinite(width) && width > 0 ? width : 0;
}

function isFlexibleBusinessColumn(column: PickDeliveryTableColumn) {
  const field = getColumnField(column);
  return Boolean(
    field &&
    field !== 'actions' &&
    field !== 'operation' &&
    column.visible !== false &&
    !column.type &&
    !column.fixed,
  );
}

/**
 * Keep every column at its measured minimum on narrow screens and let the last
 * visible business column absorb only the real remaining space on wide screens.
 */
export function fitPickDeliveryTableColumns<T extends object>(
  columns: T[] = [],
  availableWidth = 0,
  reservedWidth = 0,
): T[] {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return columns;

  const typedColumns = columns as Array<PickDeliveryTableColumn & T>;
  const targetIndex = typedColumns.findLastIndex(isFlexibleBusinessColumn);
  if (targetIndex === -1) return columns;

  const target = typedColumns[targetIndex];
  if (!target) return columns;

  let occupiedWidth = Math.max(Number(reservedWidth) || 0, 0);
  typedColumns.forEach((column, index) => {
    if (index !== targetIndex && column.visible !== false) {
      occupiedWidth += getColumnWidth(column);
    }
  });

  const minimumWidth = getColumnWidth(target);
  const fittedWidth = Math.max(
    minimumWidth,
    Math.floor(availableWidth - occupiedWidth),
  );
  const fittedColumns = [...typedColumns];
  fittedColumns[targetIndex] = {
    ...target,
    minWidth: fittedWidth,
    width: fittedWidth,
  };
  return fittedColumns as T[];
}

export function getPickDeliveryTableScrollWidth(
  columns: object[] = [],
  reservedWidth = 0,
) {
  return (columns as PickDeliveryTableColumn[]).reduce(
    (total, column) =>
      column.visible === false ? total : total + getColumnWidth(column),
    Math.max(Number(reservedWidth) || 0, 0),
  );
}
