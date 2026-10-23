import { beforeEach, expect, it, vi } from 'vitest';

import { stockDecimalRequestClient } from './stock-decimal-request';

const state = vi.hoisted(() => ({
  confirm: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({
  Modal: { confirm: state.confirm },
  message: { warning: vi.fn() },
}));
vi.mock('#/api/request', () => ({
  requestClient: { get: state.get, post: state.post, put: state.put },
}));
beforeEach(() => vi.clearAllMocks());
it('opts into exact decimals without changing the request body', async () => {
  await stockDecimalRequestClient.get('/erp/stock-in/item-page', {
    params: { pageNo: 2, pageSize: 10 },
  });
  expect(state.get).toHaveBeenCalledWith('/erp/stock-in/item-page', {
    params: { pageNo: 2, pageSize: 10, decimalMode: 'string' },
  });
});
it('waits for rounding confirmation and cancel preserves all input', async () => {
  const data = {
    items: [
      { count: '0.5', productPrice: '10.111111', totalPrice: '5.055556' },
    ],
  };
  const snapshot = JSON.stringify(data);
  const pending = stockDecimalRequestClient.post('/erp/stock-in/create', data);
  expect(state.post).not.toHaveBeenCalled();
  state.confirm.mock.calls[0]?.[0].onCancel();
  await expect(pending).rejects.toThrow('已取消保存');
  expect(state.post).not.toHaveBeenCalled();
  expect(JSON.stringify(data)).toBe(snapshot);
});
it('confirms once, keeps precise input and lets the server recompute', async () => {
  const data = {
    items: [
      { count: '0.5', productPrice: '10.111111', totalPrice: '5.055556' },
    ],
  };
  const pending = stockDecimalRequestClient.put('/erp/stock-out/update', data);
  state.confirm.mock.calls[0]?.[0].onOk();
  await pending;
  expect(state.confirm).toHaveBeenCalledTimes(1);
  expect(state.put.mock.calls[0]?.[1]).toBe(data);
});
it('does not expose hidden derived prices in rounding disclosure', async () => {
  await stockDecimalRequestClient.post(
    '/erp/stock-in/create',
    { items: [{ count: '0.5', productPrice: '10.111111' }] },
    { decimalHiddenFields: ['item_productPrice'] },
  );
  expect(state.confirm).not.toHaveBeenCalled();
  expect(state.post).toHaveBeenCalledTimes(1);
});
it('does not open dialogs during draft autosave and rejects unrepresentable manual values', async () => {
  await stockDecimalRequestClient.post('/erp/stock-check/create-draft', {
    items: [{ count: '0.5', productPrice: '10.111111' }],
  });
  expect(state.confirm).not.toHaveBeenCalled();
  await expect(
    stockDecimalRequestClient.post('/erp/stock-in/create', {
      items: [{ count: '0.1234567', productPrice: '1' }],
    }),
  ).rejects.toThrow('6 位');
  expect(state.post).toHaveBeenCalledTimes(1);
});

it('requires rounding confirmation for formal transfer submission', async () => {
  const data = { items: [{ count: '0.5', productPrice: '10.111111' }] };
  const pending = stockDecimalRequestClient.post(
    '/erp/stock-transfer-out/create-and-submit',
    data,
  );
  expect(state.post).not.toHaveBeenCalled();
  state.confirm.mock.calls[0]?.[0].onOk();
  await pending;
  expect(state.confirm).toHaveBeenCalledTimes(1);
  expect(state.post).toHaveBeenCalledTimes(1);
});
