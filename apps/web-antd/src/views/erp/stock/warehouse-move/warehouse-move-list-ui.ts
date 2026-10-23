export const WAREHOUSE_MOVE_APPROVED_STATUS = 20;
export const WAREHOUSE_MOVE_PICKING_STATUS = 15;

type WarehouseMoveRow = {
  status?: number;
};

export function isWarehouseMoveRowDeletable(row: WarehouseMoveRow) {
  return row.status === 0 || row.status === 10;
}
