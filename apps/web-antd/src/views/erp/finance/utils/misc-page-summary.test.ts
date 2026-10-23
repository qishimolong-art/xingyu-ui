import { describe, expect, it, vi } from 'vitest';

import {
  MISC_SUMMARY_FIELDS,
  summarizeMiscPage,
  useMiscPageSummary,
} from './misc-page-summary';

const row = (amount = 1000) => ({
  amount,
  settledAmount: 300,
  balanceAmount: 700,
  pendingTransferAmount: 200,
  transferAvailableAmount: 500,
});
const page = (amount = 1000) => ({ list: [row(amount)], total: 100 });

function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

describe('其他应收付本页合计', () => {
  it('shows unknown before loading and zero for a successful empty page', () => {
    expect(Object.values(summarizeMiscPage())).toEqual(
      Array.from({ length: 5 }).fill('—'),
    );
    expect(Object.values(summarizeMiscPage([]))).toEqual(
      Array.from({ length: 5 }).fill('0.00'),
    );
  });

  it('sums all five server fields independently, preserving signed cents', () => {
    expect(
      summarizeMiscPage([
        row(1200.1),
        {
          amount: -200.2,
          settledAmount: -0.1,
          balanceAmount: -200.1,
          pendingTransferAmount: -0.2,
          transferAvailableAmount: 0,
        },
      ]),
    ).toEqual({
      amount: '999.90',
      settledAmount: '299.90',
      balanceAmount: '499.90',
      pendingTransferAmount: '199.80',
      transferAvailableAmount: '500.00',
    });
    expect(summarizeMiscPage([row(0.1), row(0.2)]).amount).toBe('0.30');
    expect(summarizeMiscPage([row(1000)]).amount).toBe('1,000.00');
  });

  it.each(MISC_SUMMARY_FIELDS)(
    'masks the entire %s total if any row is masked',
    (field) => {
      const summary = summarizeMiscPage([row(), { ...row(), [field]: null }]);
      expect(summary[field]).toBe('—');
      expect(
        Object.values(summary).filter((value) => value === '—'),
      ).toHaveLength(1);
    },
  );

  it.each([undefined, '', '***', Number.NaN, Number.POSITIVE_INFINITY])(
    'does not silently treat missing/invalid amounts (%s) as zero',
    (amount) => {
      expect(summarizeMiscPage([{ ...row(), amount }]).amount).toBe('—');
    },
  );

  it('publishes only accepted page data, independent of total record count', async () => {
    const query = vi.fn().mockResolvedValue(page());
    const state = useMiscPageSummary(query);
    const result = await state.query({ pageNo: 2, pageSize: 20 });
    expect(state.summary.value.amount).toBe('—');
    state.accept(result);
    expect(state.summary.value.amount).toBe('1,000.00');
    expect(query).toHaveBeenCalledExactlyOnceWith({ pageNo: 2, pageSize: 20 });
    expect(
      state.footerMethod({
        columns: [
          { field: 'no' },
          { field: 'balanceAmount' },
          { field: 'amount' },
          { field: 'settledAmount' },
          { field: 'remark' },
        ],
      }),
    ).toEqual([['小计', '700.00', '1,000.00', '300.00', '']]);
  });

  it('clears previous totals while querying and after a failed query', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(page())
      .mockRejectedValueOnce(new Error('network'));
    const state = useMiscPageSummary(query);
    state.accept(await state.query({ pageNo: 1 }));
    const request = state.query({ pageNo: 2 });
    expect(state.summary.value.amount).toBe('—');
    await expect(request).rejects.toThrow('network');
    expect(state.summary.value.amount).toBe('—');
    expect(state.footerMethod({ columns: [{ field: 'amount' }] })).toEqual([
      ['—'],
    ]);
  });

  it.each(['success', 'failure'])(
    'prevents an old %s response from restoring stale rows or totals',
    async (status) => {
      const old = deferred<ReturnType<typeof page>>();
      const query = vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(page(2000));
      const state = useMiscPageSummary(query);
      const oldRequest = state.query({ pageNo: 1 });
      const newest = await state.query({ pageNo: 2 });
      state.accept(newest);
      if (status === 'success') old.resolve(page());
      else old.reject(new Error('old error'));
      const oldResponse = await oldRequest;
      expect(oldResponse).toBe(newest);
      state.accept(oldResponse);
      expect(state.summary.value.amount).toBe('2,000.00');
    },
  );

  it('waits for a newer pending request and rejects a late accept from an earlier page', async () => {
    const first = deferred<ReturnType<typeof page>>();
    const second = deferred<ReturnType<typeof page>>();
    const query = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const state = useMiscPageSummary(query);
    const firstRequest = state.query({ pageNo: 1 });
    const secondRequest = state.query({ pageNo: 2 });
    first.resolve(page());
    state.accept(page());
    expect(state.summary.value.amount).toBe('—');
    second.resolve(page(2000));
    expect(await firstRequest).toBe(await secondRequest);
    state.accept(await secondRequest);
    expect(state.summary.value.amount).toBe('2,000.00');
  });
});
