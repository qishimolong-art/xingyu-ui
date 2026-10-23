import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOnlineOrderPolling,
  ONLINE_ORDER_POLL_INTERVAL,
} from './online-order-polling';

function order(id: number): ErpSaleCartApi.LatestOnlineOrder {
  return {
    id,
    no: `SC${id}`,
    sourceNo: `MO${id}`,
    createTime: '2026-10-20 10:00:00',
  };
}

describe('网上订单轮询', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('首次检查只建立基准，10 秒后仅提醒更新的订单', async () => {
    const fetchLatest = vi
      .fn()
      .mockResolvedValueOnce(order(10))
      .mockResolvedValue(order(11));
    const onNewOrder = vi.fn();
    const polling = createOnlineOrderPolling({ fetchLatest, onNewOrder });

    polling.start();
    await vi.waitFor(() => expect(fetchLatest).toHaveBeenCalledTimes(1));
    expect(onNewOrder).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL);
    expect(onNewOrder).toHaveBeenCalledOnce();
    expect(onNewOrder).toHaveBeenCalledWith(order(11));
    polling.stop();
  });

  it('忽略重复或更旧的订单标记', async () => {
    const fetchLatest = vi
      .fn()
      .mockResolvedValueOnce(order(10))
      .mockResolvedValueOnce(order(10))
      .mockResolvedValueOnce(order(9));
    const onNewOrder = vi.fn();
    const polling = createOnlineOrderPolling({ fetchLatest, onNewOrder });

    polling.start();
    await vi.waitFor(() => expect(fetchLatest).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL * 2);

    expect(onNewOrder).not.toHaveBeenCalled();
    polling.stop();
  });

  it('停止期间不请求，重新启动后立即检查并保留原基准', async () => {
    const fetchLatest = vi
      .fn()
      .mockResolvedValueOnce(order(10))
      .mockResolvedValue(order(12));
    const onNewOrder = vi.fn();
    const polling = createOnlineOrderPolling({ fetchLatest, onNewOrder });

    polling.start();
    await vi.waitFor(() => expect(fetchLatest).toHaveBeenCalledTimes(1));
    polling.stop();
    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL * 2);
    expect(fetchLatest).toHaveBeenCalledTimes(1);

    polling.start();
    await vi.waitFor(() => expect(onNewOrder).toHaveBeenCalledWith(order(12)));
    polling.stop();
  });

  it('页面不可见时跳过检查，请求失败后下一轮继续重试', async () => {
    let visible = false;
    const fetchLatest = vi
      .fn()
      .mockResolvedValueOnce(order(10))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(order(11));
    const onNewOrder = vi.fn();
    const polling = createOnlineOrderPolling({
      fetchLatest,
      isVisible: () => visible,
      onNewOrder,
    });

    polling.start();
    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL);
    expect(fetchLatest).not.toHaveBeenCalled();

    visible = true;
    await polling.checkNow();
    expect(onNewOrder).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL);
    await vi.advanceTimersByTimeAsync(ONLINE_ORDER_POLL_INTERVAL);
    expect(onNewOrder).toHaveBeenCalledWith(order(11));
    polling.stop();
  });
});
