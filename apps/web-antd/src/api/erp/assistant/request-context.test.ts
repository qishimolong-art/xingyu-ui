import { afterEach, describe, expect, it, vi } from 'vitest';

import { ask } from './index';

const state = vi.hoisted(() => ({
  access: {
    accessToken: 'token',
    tenantId: 1,
    visitTenantId: 2,
  },
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => ({ userInfo: { id: 9 } }),
}));
vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: 'http://assistant.test' }),
}));
vi.mock('#/api/request', () => ({ requestClient: {} }));

describe('assistant request context', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends page and drawer entry context through the same endpoint', async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'event: done\ndata: {"status":"SUCCESS"}\n\n',
                ),
              );
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' }, status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);

    await ask(
      'c1',
      '本月销售额',
      new AbortController().signal,
      () => {},
      undefined,
      undefined,
      { currentPage: '/erp/sale/out?page=2', entry: 'WEB_DRAWER' },
    );
    await ask(
      'c2',
      '当前库存',
      new AbortController().signal,
      () => {},
      undefined,
      undefined,
      { currentPage: '/erp/assistant', entry: 'WEB_PAGE' },
    );

    const drawerInit = fetch.mock.calls[0]?.[1];
    const pageInit = fetch.mock.calls[1]?.[1];
    expect(JSON.parse(String(drawerInit?.body))).toMatchObject({
      conversationId: 'c1',
      currentPage: '/erp/sale/out?page=2',
      entry: 'WEB_DRAWER',
      question: '本月销售额',
    });
    expect(JSON.parse(String(pageInit?.body))).toMatchObject({
      conversationId: 'c2',
      currentPage: '/erp/assistant',
      entry: 'WEB_PAGE',
      question: '当前库存',
    });
    expect(fetch.mock.calls[0]?.[0]).toBe(fetch.mock.calls[1]?.[0]);
  });
});
