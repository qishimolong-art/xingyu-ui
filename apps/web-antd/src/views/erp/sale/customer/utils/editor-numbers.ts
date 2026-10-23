const integers = new Set([
  'dailySaleRecentDays',
  'limitAdjustRecentMonths',
  'month',
  'scrapReturnCycleDays',
  'settleDay',
  'sort',
  'stockLowerDays',
  'stockStandardDays',
  'stockUpperDays',
  'year',
]);
const decimals = new Set([
  'amount',
  'baseAmount',
  'commissionRate',
  'limitAdjustMonthlySales',
  'priceMarkupRate',
  'scrapReturnThresholdAmount',
  'taskAmount',
  'longitude',
  'latitude',
]);
const money = new Set([
  'amount',
  'baseAmount',
  'limitAdjustMonthlySales',
  'scrapReturnThresholdAmount',
]);

const labels: Record<string, string> = {
  sort: '排序',
  year: '年份',
  month: '月份',
  settleDay: '月结日',
  baseAmount: '铺底金额',
  amount: '金额',
  taskAmount: '任务量',
  commissionRate: '佣金比例',
  priceMarkupRate: '价格加价率',
  stockUpperDays: '上限天数',
  stockStandardDays: '标准天数',
  stockLowerDays: '下限天数',
  dailySaleRecentDays: '最近天数',
  limitAdjustRecentMonths: '最近月数',
  scrapReturnCycleDays: '报废退货周期',
  scrapReturnThresholdAmount: '报废退货金额',
  limitAdjustMonthlySales: '月销售额',
  accountName: '账户名',
  cardNo: '卡号',
  billNo: '票据号',
  companyName: '企业名称',
  name: '姓名',
  mobile: '移动电话',
  contractNo: '合同编号',
  contractDate: '合同日期',
  extendKey: '字段标识',
};

/** Normalize only at submit; text inputs retain intermediate editing states. */
export function normalizeCustomerEditor(
  type: string,
  values: Record<string, any>,
) {
  const result = { ...values };
  const required: Record<string, string[]> = {
    account: ['accountName', 'cardNo'],
    bill: ['billNo'],
    business: ['creditCode'],
    contact: ['name'],
    contract: ['contractNo'],
    extend: ['extendKey'],
    task: ['year', 'month', 'taskAmount'],
  };
  for (const field of required[type] ?? []) {
    if (
      values[field] === undefined ||
      values[field] === null ||
      String(values[field]).trim() === ''
    )
      throw new Error(`请填写必填项：${labels[field] ?? field}`);
  }
  for (const field of [...integers, ...decimals]) {
    const value = result[field];
    if (value === null || value === undefined || value === '') {
      result[field] = undefined;
      continue;
    }
    const text = String(value).trim();
    if (
      !(integers.has(field) ? /^-?\d+$/ : /^-?(?:\d+(?:\.\d*)?|\.\d+)$/).test(
        text,
      )
    )
      throw new Error(
        `${labels[field] ?? field}请输入合法${integers.has(field) ? '整数' : '数字'}`,
      );
    const parsed = Number(text);
    if (
      !Number.isFinite(parsed) ||
      (integers.has(field) && !Number.isSafeInteger(parsed))
    )
      throw new Error(`${labels[field] ?? field}数值超出范围`);
    if (
      (field === 'month' && (parsed < 1 || parsed > 12)) ||
      (field === 'settleDay' && (parsed < 1 || parsed > 31))
    )
      throw new Error(`${labels[field] ?? field}数值超出范围`);
    if (
      (field === 'longitude' || field === 'latitude') &&
      (Math.abs(parsed) > (field === 'longitude' ? 180 : 90) ||
        (text.split('.')[1]?.length ?? 0) > 6)
    )
      throw new Error('经纬度超出范围或超过六位小数');
    if (money.has(field) && (text.split('.')[1]?.length ?? 0) > 2)
      throw new Error(`${labels[field] ?? field}最多保留两位小数`);
    result[field] = parsed;
  }
  return result;
}
