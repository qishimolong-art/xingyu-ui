import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useFinanceQuerySummary } from './utils/use-finance-query-summary';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pages = [
  [
    'settlement/receipt',
    'receipt',
    'getFinanceReceiptPage',
    'getFinanceReceiptSummary',
  ],
  [
    'settlement/payment',
    'payment',
    'getFinancePaymentPage',
    'getFinancePaymentSummary',
  ],
  [
    'cash-bank/transfer',
    'transfer',
    'getFinanceTransferPage',
    'getFinanceTransferSummary',
  ],
  [
    'payable/expense',
    'payable/expense',
    'getPayableExpensePage',
    'getPayableExpenseSummary',
  ],
  [
    'receivable/other-income',
    'receivable/other-income',
    'getOtherIncomePage',
    'getOtherIncomeSummary',
  ],
  [
    'receivable/misc',
    'receivable/misc',
    'getReceivableMiscPage',
    'getReceivableMiscSummary',
  ],
  [
    'payable/misc',
    'payable/misc',
    'getPayableMiscPage',
    'getPayableMiscSummary',
  ],
  [
    'receivable/other-receivable',
    'receivable/other-receivable',
    'getOtherReceivablePage',
    'getOtherReceivableSummary',
  ],
  [
    'payable/other',
    'payable/other',
    'getPayableOtherPage',
    'getPayableOtherSummary',
  ],
  [
    'settlement/offset',
    'settlement/offset',
    'getSettlementOffsetPage',
    'getSettlementOffsetSummary',
  ],
  [
    'receivable/account',
    'receivable/account',
    'getReceivableAccountPage',
    'getReceivableAccountSummary',
  ],
  [
    'payable/account',
    'payable/account',
    'getPayableAccountPage',
    'getPayableAccountSummary',
  ],
] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function mountSummary<T>(
  fetcher: Parameters<typeof useFinanceQuerySummary<T>>[0],
) {
  let state!: ReturnType<typeof useFinanceQuerySummary<T>>;
  const container = document.createElement('div');
  const app = createApp({
    setup() {
      state = useFinanceQuerySummary(fetcher);
      return () => h('div');
    },
  });
  app.mount(container);
  return { app, state };
}

describe('finance list query summaries', () => {
  it.each(pages)(
    '%s keeps page and summary requests independent',
    (pagePath, _apiPath, pageApi, summaryApi) => {
      const source = readFileSync(
        join(currentDir, pagePath, 'index.vue'),
        'utf8',
      );
      const pageCall = source.indexOf(`await ${pageApi}`);
      const summaryCall = source.indexOf('querySummaryState.load', pageCall);

      expect(pageCall).toBeGreaterThan(-1);
      expect(summaryCall).toBeGreaterThan(pageCall);
      expect(source).toContain(summaryApi);
      expect(source).toContain('querySummaryState.prepare(');
      expect(source).toContain('querySummaryState.cancelPending()');
      expect(source).toContain('pageRequestFailed = true');
      expect(source).toContain('if (!pageRequestFailed)');
      expect(source).toContain('@retry="querySummaryState.retry"');
      expect(source.slice(pageCall, summaryCall)).not.toContain('Promise.all');
      expect(source).not.toContain('本页合计');
      expect(source).not.toContain('当前页合计');
      expect(source).not.toContain('footerMethod:');
      expect(source).not.toContain('showFooter: true');
    },
  );

  it.each(pages)(
    '%s uses explicit page and summary timeouts',
    (_pagePath, apiPath) => {
      const source = readFileSync(
        join(
          currentDir,
          '..',
          '..',
          '..',
          'api',
          'erp',
          'finance',
          apiPath,
          'index.ts',
        ),
        'utf8',
      );
      expect(source).toContain('timeout: 60_000');
      expect(source).toContain('timeout: 30_000');
      expect(source).toContain('signal');
    },
  );

  it('drops an obsolete result after a newer filter starts', async () => {
    const request = deferred<{ total: number }>();
    const fetcher = vi.fn(() => request.promise);
    const { app, state } = mountSummary(fetcher);

    expect(state.prepare({ keyword: 'old', pageNo: 1 })).toBe(true);
    expect(state.prepare({ keyword: 'new', pageNo: 1 })).toBe(true);
    await state.load({ keyword: 'old', pageNo: 1 }, true);
    expect(fetcher).not.toHaveBeenCalled();

    const currentLoad = state.load({ keyword: 'new', pageNo: 1 }, true);
    request.resolve({ total: 2 });
    await currentLoad;
    expect(state.summary.value).toEqual({ total: 2 });
    app.unmount();
  });

  it('ignores paging changes and retries only a failed summary', async () => {
    const failed = deferred<{ total: number }>();
    const retried = deferred<{ total: number }>();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => failed.promise)
      .mockImplementationOnce(() => retried.promise);
    const { app, state } = mountSummary(fetcher);

    expect(state.prepare({ keyword: 'same', pageNo: 1, pageSize: 10 })).toBe(
      true,
    );
    const firstLoad = state.load(
      { keyword: 'same', pageNo: 1, pageSize: 10 },
      true,
    );
    failed.reject(new Error('timeout'));
    await firstLoad;
    expect(state.error.value).toBe(true);
    expect(state.summary.value).toBeUndefined();

    expect(state.prepare({ keyword: 'same', pageNo: 2, pageSize: 20 })).toBe(
      false,
    );
    await state.load({ keyword: 'same', pageNo: 2, pageSize: 20 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const retry = state.retry();
    retried.resolve({ total: 8 });
    await retry;
    await nextTick();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(state.error.value).toBe(false);
    expect(state.summary.value).toEqual({ total: 8 });
    app.unmount();
  });
});
