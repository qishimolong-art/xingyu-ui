/** 历史状态保留原值；待领记录必须核对，不能在取消领货后改称完成。 */
export function stockOutBillHistoryStatus(status: unknown): string {
  if (status === 30) return '历史已完成';
  if (status === 20) return '历史部分领货（待核对）';
  if (status === 10) return '历史待领（待核对）';
  return '历史状态未记录';
}

export function stockOutBillHistorySummary(statuses: unknown[]): string {
  if (!statuses.length) return '无历史出仓记录';
  if (statuses.every((status) => status === 30))
    return stockOutBillHistoryStatus(30);
  if (statuses.every((status) => status === 10))
    return stockOutBillHistoryStatus(10);
  if (
    statuses.every((status) => status === 10 || status === 20 || status === 30)
  )
    return stockOutBillHistoryStatus(20);
  return '历史状态未记录';
}
