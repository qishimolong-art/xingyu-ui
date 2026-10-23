import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { ensurePurchaseModalReady } from './lazy-modal';

describe('purchase lazy modal helper', () => {
  it('waits for an async connected component to register its modal API', async () => {
    const shouldRender = ref(false);
    const modalApi: Record<string, unknown> = {};
    const loadComponent = vi.fn().mockResolvedValue(undefined);

    setTimeout(() => {
      modalApi.open = () => undefined;
      modalApi.setData = () => modalApi;
    }, 0);

    await ensurePurchaseModalReady(shouldRender, modalApi, loadComponent);

    expect(loadComponent).toHaveBeenCalledOnce();
    expect(shouldRender.value).toBe(true);
    expect(modalApi.open).toBeTypeOf('function');
    expect(modalApi.setData).toBeTypeOf('function');
  });

  it('supports a synchronously registered connected component', async () => {
    const shouldRender = ref(false);
    const modalApi = {
      open: () => undefined,
      setData: () => modalApi,
    };

    await ensurePurchaseModalReady(shouldRender, modalApi);

    expect(shouldRender.value).toBe(true);
  });
});
