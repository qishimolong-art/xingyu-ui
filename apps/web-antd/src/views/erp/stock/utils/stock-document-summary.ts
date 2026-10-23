/* eslint-disable unicorn/require-number-to-fixed-digits-argument -- BigNumber keeps business precision. */
import { stockDecimal, stockNatural } from './stock-decimal';
export type DocumentSummary = Record<
  string,
  null | number | string | undefined
>;

interface BuildRemoteDocumentSummaryOptions<T> {
  base: DocumentSummary;
  calculate: (item: T) => DocumentSummary;
  creates: Map<string, T>;
  deletes: Set<number>;
  edits: Map<number, T>;
  localItems: T[];
  originals: Map<number, T>;
  remotePaging: boolean;
}

function toNumber(value: unknown) {
  return stockNatural(value as null | number | string | undefined, '0');
}

function addSummary(
  target: DocumentSummary,
  value: DocumentSummary | undefined,
  factor = 1,
) {
  if (!value) return;
  Object.entries(value).forEach(([key, amount]) => {
    if (amount === '****' || target[key] === '****') {
      target[key] = '****';
      return;
    }
    target[key] = stockDecimal(toNumber(target[key]))
      .plus(stockDecimal(toNumber(amount)).times(factor))
      .toFixed();
  });
}

/**
 * 以服务端整单聚合为基数，只叠加当前编辑会话中的跨页增量。
 * 未进入远程分页（创建新单）时，直接汇总全部本地明细。
 */
export function buildRemoteDocumentSummary<T>({
  base,
  calculate,
  creates,
  deletes,
  edits,
  localItems,
  originals,
  remotePaging,
}: BuildRemoteDocumentSummaryOptions<T>) {
  if (!remotePaging) {
    const localSummary: DocumentSummary = {};
    localItems.forEach((item) => addSummary(localSummary, calculate(item)));
    return localSummary;
  }

  const result: DocumentSummary = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, toNumber(value)]),
  );

  edits.forEach((item, id) => {
    if (deletes.has(id)) return;
    addSummary(result, calculate(originals.get(id) ?? item), -1);
    addSummary(result, calculate(item));
  });
  deletes.forEach((id) => {
    const original = originals.get(id) ?? edits.get(id);
    addSummary(result, original ? calculate(original) : undefined, -1);
  });
  creates.forEach((item) => addSummary(result, calculate(item)));
  return result;
}
