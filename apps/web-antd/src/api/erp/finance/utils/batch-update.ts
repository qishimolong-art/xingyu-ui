export interface FinanceBatchUpdatePayload {
  ids: number[];
  [key: string]: any;
}

export async function batchUpdateFinanceByDetail<
  T extends { id?: number; status?: number },
>(
  payload: FinanceBatchUpdatePayload,
  getDetail: (id: number) => Promise<T>,
  updateDetail: (data: T) => Promise<unknown>,
) {
  const { ids, ...changes } = payload;
  let updateCount = 0;
  for (const id of ids) {
    const detail = await getDetail(id);
    if (detail?.status === 20) {
      continue;
    }
    await updateDetail({
      ...detail,
      ...changes,
      id,
    });
    updateCount += 1;
  }
  return updateCount;
}
