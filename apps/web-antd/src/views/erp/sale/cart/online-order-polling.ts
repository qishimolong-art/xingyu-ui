import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

export const ONLINE_ORDER_POLL_INTERVAL = 10_000;

interface OnlineOrderPollingOptions {
  fetchLatest: () => Promise<ErpSaleCartApi.LatestOnlineOrder | null>;
  intervalMs?: number;
  isVisible?: () => boolean;
  onNewOrder: (order: ErpSaleCartApi.LatestOnlineOrder) => Promise<void> | void;
}

export function createOnlineOrderPolling(options: OnlineOrderPollingOptions) {
  let active = false;
  let checkingVersion: null | number = null;
  let initialized = false;
  let latestOrderId = 0;
  let lifecycleVersion = 0;
  let timer: number | undefined;

  const isVisible = options.isVisible ?? (() => true);

  async function checkNow() {
    const currentVersion = lifecycleVersion;
    if (!active || checkingVersion === currentVersion || !isVisible()) {
      return;
    }
    checkingVersion = currentVersion;
    try {
      const latestOrder = await options.fetchLatest();
      if (!active || currentVersion !== lifecycleVersion) return;

      const currentOrderId = Number(latestOrder?.id || 0);
      if (!initialized) {
        initialized = true;
        latestOrderId = currentOrderId;
        return;
      }
      if (!latestOrder || currentOrderId <= latestOrderId) return;

      latestOrderId = currentOrderId;
      await options.onNewOrder(latestOrder);
    } catch (error) {
      console.warn('检查最新网上订单失败，将在下一轮自动重试', error);
    } finally {
      if (checkingVersion === currentVersion) {
        checkingVersion = null;
      }
    }
  }

  function start() {
    if (active) return;
    active = true;
    lifecycleVersion++;
    void checkNow();
    timer = window.setInterval(
      () => void checkNow(),
      options.intervalMs ?? ONLINE_ORDER_POLL_INTERVAL,
    );
  }

  function stop() {
    if (!active && timer === undefined) return;
    active = false;
    lifecycleVersion++;
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  }

  return { checkNow, start, stop };
}
