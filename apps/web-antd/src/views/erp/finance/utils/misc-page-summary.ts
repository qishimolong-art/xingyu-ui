import { computed, shallowRef } from 'vue';

import { sumFinanceAmounts } from '../settlement/money';

export const MISC_SUMMARY_FIELDS = [
  'amount',
  'settledAmount',
  'balanceAmount',
  'pendingTransferAmount',
  'transferAvailableAmount',
] as const;

type SummaryField = (typeof MISC_SUMMARY_FIELDS)[number];
type SummaryRow = Partial<Record<SummaryField, null | number | string>>;
export type MiscPageSummary = Record<SummaryField, string>;

/** 缺失金额可能来自权限遮罩，不能按零参与合计。 */
export function summarizeMiscPage(rows?: SummaryRow[]): MiscPageSummary {
  return Object.fromEntries(
    MISC_SUMMARY_FIELDS.map((field) => {
      const values = rows?.map((row) => row[field]);
      const complete = values?.every(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== '' &&
          Number.isFinite(Number(value)),
      );
      return [
        field,
        complete && values
          ? sumFinanceAmounts(values).toLocaleString('zh-CN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '—',
      ];
    }),
  ) as MiscPageSummary;
}

/** 普通分页和页面激活刷新共用请求版本，过期请求只返回最新结果。 */
export function useMiscPageSummary<P, R extends { list: SummaryRow[] }>(
  queryPage: (params: P) => Promise<R>,
) {
  const rows = shallowRef<SummaryRow[]>();
  const summary = computed(() => summarizeMiscPage(rows.value));
  let version = 0;
  let latestRequest: Promise<R>;
  let latestResult: R | undefined;

  function query(params: P): Promise<R> {
    const requestVersion = ++version;
    rows.value = undefined;
    latestResult = undefined;
    const request = (async () => {
      try {
        const result = await queryPage(params);
        if (requestVersion !== version) return latestRequest;
        latestResult = result;
        return result;
      } catch (error) {
        if (requestVersion !== version) return latestRequest;
        throw error;
      }
    })();
    latestRequest = request;
    return request;
  }

  // 仅在表格接收成功结果后发布合计，避免请求结束但表格尚未更新。
  function accept(result: R) {
    if (result === latestResult) rows.value = result.list;
  }

  function footerMethod({ columns }: { columns: { field?: string }[] }) {
    return [
      columns.map(({ field }) => {
        if (field === 'no') return '小计';
        if (
          field === 'amount' ||
          field === 'settledAmount' ||
          field === 'balanceAmount'
        ) {
          return summary.value[field];
        }
        return '';
      }),
    ];
  }

  return { accept, footerMethod, query, summary };
}
