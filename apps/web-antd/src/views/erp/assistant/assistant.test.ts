import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssistantPanel from './AssistantPanel.vue';
import Assistant from './index.vue';

const state = vi.hoisted(() => ({
  allowed: true,
  auditAllowed: false,
  callback: undefined as any,
  messageError: vi.fn(),
  permissionProbe: vi.fn(),
  renderEcharts: vi.fn(),
}));
const api = vi.hoisted(() => ({
  identity: vi.fn(() => 'isolated-test-identity'),
  listConversations: vi.fn(async () => [{ id: 'c1', title: '测试会话' }]),
  createConversation: vi.fn(async () => 'c1'),
  deleteConversation: vi.fn(async () => true),
  history: vi.fn(async () => []),
  details: vi.fn(async () => ({ list: [], total: 0 })),
  audit: vi.fn(async () => ({
    elapsed_ms: 12,
    route_type: 'BUSINESS_TOOL',
    status: 'SUCCESS',
    tokens: 8,
    tool_name: 'query_purchase_documents',
  })),
  ask: vi.fn(),
  readiness: vi.fn(async () => ({
    status: 'READY',
    text: '可查询',
    metrics: ['SALE', 'STOCK', 'STOCK_SKU', 'RECEIPT'].map((id) => ({
      id,
      title: id,
      available: true,
    })),
  })),
  cancelRequest: vi.fn(async () => true),
  rerun: vi.fn(async () => {}),
}));
vi.mock('#/api/erp/assistant', () => api);
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) => {
      state.permissionProbe();
      return codes.includes('erp:assistant:audit')
        ? state.auditAllowed
        : state.allowed;
    },
  }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
}));
vi.mock('@vben/plugins/echarts', () => ({
  EchartsUI: defineComponent({ setup: () => () => h('div') }),
  useEcharts: () => ({ renderEcharts: state.renderEcharts }),
}));
vi.mock('ant-design-vue', () => {
  const container = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('aside', p.message),
    }),
    Button: defineComponent({
      inheritAttrs: false,
      setup:
        (_, { attrs, slots }) =>
        () =>
          h('button', attrs, slots.default?.()),
    }),
    Drawer: container,
    Pagination: container,
    Select: defineComponent({
      inheritAttrs: false,
      emits: ['popupScroll'],
      setup:
        (_, { attrs, emit }) =>
        () =>
          h('div', {
            ...attrs,
            onScroll: (event: Event) => emit('popupScroll', event),
          }),
    }),
    Table: defineComponent({
      props: ['columns', 'dataSource', 'scroll'],
      setup:
        (props, { slots }) =>
        () =>
          h(
            'div',
            {
              'data-scroll-x': props.scroll?.x,
            },
            [
              ...(props.columns || []).map((column: any) =>
                h('span', column.title),
              ),
              ...(props.dataSource || []).flatMap((row: Record<string, any>) =>
                (props.columns || []).map((column: any) => {
                  const dataIndex = column.dataIndex || column.key;
                  const text = row[dataIndex];
                  if (
                    slots.bodyCell &&
                    ['prices', 'warehouseStocks'].includes(column.key)
                  ) {
                    return h(
                      'span',
                      slots.bodyCell({ column, record: row, text }),
                    );
                  }
                  return h(
                    'span',
                    column.customRender
                      ? column.customRender({ record: row, text })
                      : text,
                  );
                }),
              ),
            ],
          ),
    }),
    Tag: container,
    message: { error: state.messageError },
    Input: {
      TextArea: defineComponent({
        inheritAttrs: false,
        emits: ['update:value'],
        props: ['value'],
        setup:
          (props, { attrs, emit }) =>
          () =>
            h('textarea', {
              ...attrs,
              value: props.value,
              onInput: (event: Event) =>
                emit(
                  'update:value',
                  (event.target as HTMLTextAreaElement).value,
                ),
            }),
      }),
    },
  };
});
let app: App;
let root: HTMLDivElement;
const credentialSignal = ref('token-a');
const identitySignal = ref('isolated-test-identity');
const permissionSignal = ref(0);
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}
async function mount() {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(Assistant);
  app.mount(root);
  await settle();
}
async function mountDrawer() {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(AssistantPanel, { mode: 'drawer' });
  app.mount(root);
  await settle();
}
function click(text: string) {
  const button = [...root.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  button?.click();
}
function composer() {
  const input = root.querySelector<HTMLTextAreaElement>('.composer textarea');
  expect(input).toBeTruthy();
  return input as HTMLTextAreaElement;
}
async function inputQuestion(text: string) {
  const input = composer();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
function pressComposerEnter(
  init: KeyboardEventInit & {
    isComposing?: boolean;
    legacyKeyCode?: number;
  } = {},
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    ...init,
  });
  if (init.isComposing !== undefined) {
    Object.defineProperty(event, 'isComposing', {
      value: init.isComposing,
    });
  }
  if (init.legacyKeyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', {
      value: init.legacyKeyCode,
    });
  }
  composer().dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  state.auditAllowed = false;
  state.callback = undefined;
  credentialSignal.value = 'token-a';
  identitySignal.value = 'isolated-test-identity';
  permissionSignal.value = 0;
  state.permissionProbe.mockImplementation(() => permissionSignal.value);
  api.identity.mockImplementation(() =>
    JSON.stringify([Boolean(credentialSignal.value), identitySignal.value]),
  );
  state.messageError.mockReset();
  state.renderEcharts.mockReset();
  api.listConversations
    .mockReset()
    .mockResolvedValue([{ id: 'c1', title: '测试会话' }]);
  api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
    receive({
      event: 'clarification',
      data: { clarification: '选择口径', choices: ['有库存'] },
    });
  });
});
afterEach(() => {
  app?.unmount();
  root?.remove();
});
describe('ERP assistant page', () => {
  it('does not load conversations without permission', async () => {
    state.allowed = false;
    await mount();
    expect(root.textContent).toContain('没有智能问数访问权限');
    expect(api.listConversations).not.toHaveBeenCalled();
  });
  it('keeps normal readiness details out of the user-facing page', async () => {
    await mount();

    expect(root.textContent).not.toContain('可查询');
    expect(root.textContent).not.toContain('已开放：');
    expect(root.textContent).not.toContain('刷新可用状态');
    expect(root.textContent).toContain('本月销售情况');
  });
  it('keeps the current conversation and result across access-token rotation', async () => {
    api.history.mockResolvedValueOnce([
      {
        canRerun: true,
        id: 'm-token-refresh',
        question: '本月销售情况',
        status: 'SUCCESS',
      },
    ] as any);
    api.ask.mockImplementationOnce(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          columns: [],
          messageId: 'm-token-refresh',
          presentation: {
            headline: '令牌轮换保留结果',
            mode: 'SUMMARY',
            showChart: false,
            showSummary: false,
            showTable: false,
          },
          queriedAt: '2026-10-07T10:00:00',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [],
          title: '令牌轮换保留结果',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    const readinessCalls = api.readiness.mock.calls.length;
    const conversationCalls = api.listConversations.mock.calls.length;

    expect(root.textContent).toContain('令牌轮换保留结果');
    expect(root.textContent).toContain('最近提问');
    credentialSignal.value = 'token-b';
    await settle();

    expect(root.textContent).toContain('令牌轮换保留结果');
    expect(root.textContent).toContain('最近提问');
    expect(api.readiness).toHaveBeenCalledTimes(readinessCalls);
    expect(api.listConversations).toHaveBeenCalledTimes(conversationCalls);
    expect(api.cancelRequest).not.toHaveBeenCalled();
  });
  it('resets and reloads when the effective user or tenant identity changes', async () => {
    api.ask.mockImplementationOnce((_id, _q, _signal, receive) => {
      state.callback = receive;
      receive({ event: 'started', data: { requestId: 'r-identity' } });
      return new Promise(() => {});
    });
    await mount();
    click('本月销售情况');
    await settle();
    const readinessCalls = api.readiness.mock.calls.length;
    const conversationCalls = api.listConversations.mock.calls.length;

    identitySignal.value = 'other-user-or-tenant';
    await settle();

    expect(api.cancelRequest).toHaveBeenCalledWith('r-identity');
    expect(api.readiness).toHaveBeenCalledTimes(readinessCalls + 1);
    expect(api.listConversations).toHaveBeenCalledTimes(conversationCalls + 1);
    state.callback({
      event: 'result',
      data: {
        rows: [],
        status: 'SUCCESS',
        summary: [],
        title: '旧身份迟到结果',
      },
    });
    await settle();
    expect(root.textContent).not.toContain('旧身份迟到结果');
  });
  it('clears the current state when the assistant permission is revoked', async () => {
    api.ask.mockImplementationOnce(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          columns: [],
          messageId: 'm-permission-revoked',
          presentation: {
            headline: '撤权前结果',
            mode: 'SUMMARY',
            showChart: false,
            showSummary: false,
            showTable: false,
          },
          rows: [],
          status: 'SUCCESS',
          summary: [],
          title: '撤权前结果',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    expect(root.textContent).toContain('撤权前结果');

    state.allowed = false;
    permissionSignal.value += 1;
    await settle();

    expect(root.textContent).toContain('没有智能问数访问权限');
    expect(root.textContent).not.toContain('撤权前结果');
  });
  it('shows the phonetic correction notice returned with a result', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          correctionNotice: '已按同音/近音识别：“销瘦额”→“销售额”',
          corrections: [
            {
              confidence: 100,
              corrected: '销售额',
              matchType: 'ALIAS',
              original: '销瘦额',
              source: 'CONTROLLED_LEXICON',
            },
          ],
          messageId: 'm-phonetic',
          normalizedQuestion: '本月销售额是多少',
          queriedAt: '2026-10-06T18:00:00',
          rows: [],
          scope: '当前 ERP 用户实时权限',
          status: 'SUCCESS',
          summary: [],
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('已按同音/近音识别');
    expect(root.textContent).toContain('“销瘦额”→“销售额”');
  });
  it('loads ten conversations first and appends the next page on sidebar scroll', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      id: `c${index + 1}`,
      title: `首个问题${index + 1}`,
    }));
    api.listConversations
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        { id: 'c10', title: '重复问题' },
        { id: 'c11', title: '追加问题' },
      ]);
    await mount();

    expect(api.listConversations).toHaveBeenNthCalledWith(1, 1, 10);
    expect(root.textContent).not.toContain('更多会话');
    const list = root.querySelector<HTMLElement>('.conversation-list')!;
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 180 },
    });
    list.dispatchEvent(new Event('scroll'));
    await settle();

    expect(api.listConversations).toHaveBeenNthCalledWith(2, 2, 10);
    expect(root.textContent).toContain('追加问题');
    expect(root.querySelectorAll('[title="重复问题"]')).toHaveLength(1);
  });
  it('does not request another conversation page after a short first page', async () => {
    await mount();
    const list = root.querySelector<HTMLElement>('.conversation-list')!;
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 0 },
    });

    list.dispatchEvent(new Event('scroll'));
    await settle();

    expect(api.listConversations).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[title="测试会话"]')).toBeTruthy();
  });
  it('loads more conversations from the drawer dropdown scroll', async () => {
    api.listConversations
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, index) => ({
          id: `c${index + 1}`,
          title: `问题${index + 1}`,
        })),
      )
      .mockResolvedValueOnce([{ id: 'c11', title: '下拉追加问题' }]);
    await mountDrawer();
    const select = root.querySelector<HTMLElement>('.conversation-select')!;
    Object.defineProperties(select, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 90 },
    });

    select.dispatchEvent(new Event('scroll'));
    await settle();

    expect(api.listConversations).toHaveBeenNthCalledWith(2, 2, 10);
    expect(root.textContent).not.toContain('更多');
  });
  it('keeps loaded conversations and allows retry after a paging failure', async () => {
    api.listConversations
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, index) => ({
          id: `c${index + 1}`,
          title: `问题${index + 1}`,
        })),
      )
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce([{ id: 'c11', title: '重试成功' }]);
    await mount();
    const list = root.querySelector<HTMLElement>('.conversation-list')!;
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 180 },
    });

    list.dispatchEvent(new Event('scroll'));
    await settle();
    expect(state.messageError).toHaveBeenCalledWith(
      '更多会话加载失败，请稍后重试',
    );
    expect(root.textContent).toContain('问题1');

    list.dispatchEvent(new Event('scroll'));
    await settle();
    expect(api.listConversations).toHaveBeenLastCalledWith(2, 10);
    expect(root.textContent).toContain('重试成功');
  });
  it('does not send duplicate conversation page requests while loading', async () => {
    let resolvePage:
      | ((rows: Array<{ id: string; title: string }>) => void)
      | undefined;
    api.listConversations
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, index) => ({
          id: `c${index + 1}`,
          title: `问题${index + 1}`,
        })),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    await mount();
    const list = root.querySelector<HTMLElement>('.conversation-list')!;
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 180 },
    });

    list.dispatchEvent(new Event('scroll'));
    list.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(api.listConversations).toHaveBeenCalledTimes(2);
    resolvePage?.([{ id: 'c11', title: '加载完成' }]);
    await settle();
    expect(root.textContent).toContain('加载完成');
  });
  it('creates a conversation and carries clarification back into the original question', async () => {
    await mount();
    click('本月销售情况');
    await settle();
    expect(api.ask).toHaveBeenCalledWith(
      'c1',
      '本月销售情况',
      expect.any(AbortSignal),
      expect.any(Function),
      undefined,
      undefined,
      {
        currentPage: '/erp/assistant',
        entry: 'WEB_PAGE',
      },
    );
    click('有库存');
    await settle();
    expect(api.ask.mock.calls[1]?.[1]).toBe('本月销售情况；补充：有库存');
  });
  it('starts the first query without waiting for the initial conversation list', async () => {
    let resolveConversations:
      | ((rows: Array<{ id: string; title: string }>) => void)
      | undefined;
    api.listConversations.mockReset().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConversations = resolve;
        }),
    );
    api.createConversation.mockResolvedValueOnce('c-new');
    api.ask.mockImplementationOnce(() => new Promise(() => {}));
    await mount();
    await inputQuestion('首次提问');

    pressComposerEnter();
    await settle();

    expect(api.createConversation).toHaveBeenCalledTimes(1);
    expect(api.ask).toHaveBeenCalledWith(
      'c-new',
      '首次提问',
      expect.any(AbortSignal),
      expect.any(Function),
      undefined,
      undefined,
      {
        currentPage: '/erp/assistant',
        entry: 'WEB_PAGE',
      },
    );
    expect(api.listConversations).toHaveBeenCalledTimes(1);
    expect(api.history).not.toHaveBeenCalled();

    resolveConversations?.([{ id: 'c-old', title: '旧会话' }]);
    await settle();
    expect(root.textContent).toContain('新会话');
    expect(root.textContent).toContain('旧会话');
    expect(api.listConversations).toHaveBeenCalledTimes(1);
  });
  it('blocks duplicate sends while the first conversation is being created', async () => {
    let resolveConversation: ((id: string) => void) | undefined;
    api.createConversation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConversation = resolve;
        }),
    );
    api.ask.mockImplementationOnce(() => new Promise(() => {}));
    await mount();
    await inputQuestion('只发送一次');

    pressComposerEnter();
    pressComposerEnter();
    await nextTick();
    expect(api.createConversation).toHaveBeenCalledTimes(1);

    resolveConversation?.('c-created-once');
    await settle();
    expect(api.ask).toHaveBeenCalledTimes(1);
    expect(api.ask.mock.calls[0]?.[0]).toBe('c-created-once');
  });
  it('keeps the question when creating the first conversation fails', async () => {
    api.createConversation.mockRejectedValueOnce(new Error('创建会话失败'));
    await mount();
    await inputQuestion('失败后可重试');

    pressComposerEnter();
    await settle();

    expect(api.ask).not.toHaveBeenCalled();
    expect(composer().value).toBe('失败后可重试');
    expect(root.textContent).toContain('创建会话失败');
  });
  it('does not start a late first query after cancellation during conversation creation', async () => {
    let resolveConversation: ((id: string) => void) | undefined;
    api.createConversation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConversation = resolve;
        }),
    );
    await mount();
    await inputQuestion('创建中取消');
    pressComposerEnter();
    await nextTick();

    click('停止');
    resolveConversation?.('c-late');
    await settle();

    expect(api.ask).not.toHaveBeenCalled();
    expect(root.textContent).toContain('本次查询已停止');
  });
  it('does not start a late first query after identity changes during conversation creation', async () => {
    let resolveConversation: ((id: string) => void) | undefined;
    api.createConversation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConversation = resolve;
        }),
    );
    await mount();
    await inputQuestion('旧身份首次提问');
    pressComposerEnter();
    await nextTick();

    identitySignal.value = 'new-identity-during-create';
    await settle();
    resolveConversation?.('c-old-identity');
    await settle();

    expect(api.ask).not.toHaveBeenCalled();
    expect(composer().value).toBe('');
  });
  it('activates an explicitly created empty conversation without reloading list or history', async () => {
    api.createConversation.mockResolvedValueOnce('c-explicit');
    await mount();
    const conversationCalls = api.listConversations.mock.calls.length;

    click('新建会话');
    await settle();

    expect(api.createConversation).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(api.history).not.toHaveBeenCalled();
    expect(api.listConversations).toHaveBeenCalledTimes(conversationCalls);
    expect(root.textContent).toContain('新会话');
  });
  it('sends the composer question once on Enter and clears the input', async () => {
    await mount();
    await inputQuestion('本月销售额');

    const event = pressComposerEnter();
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(api.ask).toHaveBeenCalledTimes(1);
    expect(api.ask).toHaveBeenCalledWith(
      'c1',
      '本月销售额',
      expect.any(AbortSignal),
      expect.any(Function),
      undefined,
      undefined,
      {
        currentPage: '/erp/assistant',
        entry: 'WEB_PAGE',
      },
    );
    expect(composer().value).toBe('');
  });
  it('uses the same Enter behavior in the floating drawer panel', async () => {
    await mountDrawer();
    await inputQuestion('停用客户有多少');

    pressComposerEnter();
    await settle();

    expect(api.ask).toHaveBeenCalledTimes(1);
    expect(api.ask.mock.calls[0]?.[1]).toBe('停用客户有多少');
    expect(root.querySelector('.assistant-layout--drawer')).toBeTruthy();
  });
  it('keeps Shift+Enter available for multiline questions', async () => {
    await mount();
    await inputQuestion('第一行');

    const event = pressComposerEnter({ shiftKey: true });
    await inputQuestion('第一行\n第二行');

    expect(event.defaultPrevented).toBe(false);
    expect(api.ask).not.toHaveBeenCalled();
    expect(composer().value).toBe('第一行\n第二行');
  });
  it('does not send while an input method is composing', async () => {
    await mount();
    await inputQuestion('本月销售额');
    composer().dispatchEvent(new Event('compositionstart', { bubbles: true }));

    const composingEvent = pressComposerEnter({ isComposing: true });
    await settle();
    expect(composingEvent.defaultPrevented).toBe(false);
    expect(api.ask).not.toHaveBeenCalled();

    composer().dispatchEvent(new Event('compositionend', { bubbles: true }));
    pressComposerEnter({ legacyKeyCode: 229 });
    expect(api.ask).not.toHaveBeenCalled();

    pressComposerEnter();
    await settle();
    expect(api.ask).toHaveBeenCalledTimes(1);
  });
  it('ignores empty, unavailable, repeated, and busy keyboard sends', async () => {
    await mount();
    pressComposerEnter();
    await inputQuestion('本月销售额');
    pressComposerEnter({ repeat: true });
    expect(api.ask).not.toHaveBeenCalled();

    api.ask.mockImplementationOnce(() => new Promise(() => {}));
    pressComposerEnter();
    await settle();
    pressComposerEnter();
    expect(api.ask).toHaveBeenCalledTimes(1);
  });
  it('does not send from the keyboard when the assistant is not ready', async () => {
    api.readiness.mockResolvedValueOnce({
      status: 'UNPUBLISHED',
      text: '业务指标尚未完成核验发布',
      metrics: [],
    });
    await mount();
    await inputQuestion('本月销售额');

    pressComposerEnter();

    expect(api.ask).not.toHaveBeenCalled();
    expect(composer().value).toBe('本月销售额');
  });
  it('keeps the Send button behavior unchanged', async () => {
    await mount();
    await inputQuestion('本周收款情况');

    click('发送');
    await settle();

    expect(api.ask).toHaveBeenCalledTimes(1);
    expect(api.ask.mock.calls[0]?.[1]).toBe('本周收款情况');
  });
  it('carries the selected product into a purpose choice', async () => {
    api.ask.mockImplementationOnce(async (_id, _q, _signal, receive) => {
      receive({
        event: 'clarification',
        data: {
          clarification: '已识别“专属服务产品”，请选择要查询的内容',
          choices: ['查询价格/当前库存'],
          selectedEntity: {
            entityType: 'PRODUCT',
            field: 'resolved:PRODUCT',
            id: 99,
            name: '专属服务产品',
          },
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    click('查询价格/当前库存');
    await settle();

    expect(api.ask.mock.calls[1]?.[1]).toBe(
      '这个产品；补充：查询价格/当前库存',
    );
    expect(api.ask.mock.calls[1]?.[4]).toEqual({
      field: 'resolved:PRODUCT',
      id: 99,
    });
  });
  it('carries the selected customer into a receipt purpose choice', async () => {
    api.ask.mockImplementationOnce(async (_id, _q, _signal, receive) => {
      receive({
        event: 'clarification',
        data: {
          clarification: '已识别“成都路通源”，请选择要查询的内容',
          choices: ['查询本月收款'],
          selectedEntity: {
            entityType: 'CUSTOMER',
            field: 'resolved:CUSTOMER',
            id: 91,
            name: '成都路通源',
          },
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    click('查询本月收款');
    await settle();

    expect(api.ask.mock.calls[1]?.[1]).toBe('这个客户；补充：查询本月收款');
    expect(api.ask.mock.calls[1]?.[4]).toEqual({
      field: 'resolved:CUSTOMER',
      id: 91,
    });
  });
  it('shows authorized entity metadata and submits the candidate-specific field', async () => {
    api.ask.mockImplementationOnce(async (_id, _q, _signal, receive) => {
      receive({
        event: 'clarification',
        data: {
          clarification: '请选择业务对象',
          field: 'entity',
          candidates: [
            {
              code: '145988',
              description: '厂家编码：WSC56208/WSC20856',
              entityType: 'PRODUCT',
              field: 'entity:PRODUCT',
              id: 99,
              matchType: 'CODE',
              name: '卫斯卡空调滤清器',
            },
          ],
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    const candidate = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('卫斯卡空调滤清器'),
    );
    expect(candidate?.textContent).toContain('145988');
    expect(candidate?.textContent).toContain('产品');
    candidate?.click();
    await settle();
    expect(api.ask.mock.calls[1]?.[4]).toEqual({
      field: 'entity:PRODUCT',
      id: 99,
    });
  });
  it('keeps query errors distinct from zero or empty results', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({ event: 'error', data: { text: '没有该指标权限' } });
    });
    await mount();
    click('本月销售情况');
    await settle();
    expect(root.textContent).toContain('没有该指标权限');
    expect(root.textContent).not.toContain('未查到记录');
  });
  it('keeps the fixed fallback explanation consistent with hidden query metadata', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          messageId: 'm-explanation',
          queriedAt: '2026-09-30T11:00:00',
          rows: [],
          scope: '当前权限',
          status: 'EMPTY',
          summary: [],
        },
      });
      receive({
        event: 'explanation',
        data: {
          text: '汇总已完成，统计范围、口径及查询时间见结果卡片，可查看来源明细核对。',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain(
      '汇总已完成，可查看统计口径或来源明细进行核对。',
    );
    expect(root.textContent).not.toContain('查询时间见结果卡片');
  });
  it('ignores late events after cancellation', async () => {
    api.ask.mockImplementation((_id, _q, _signal, receive) => {
      state.callback = receive;
      return new Promise(() => {});
    });
    await mount();
    click('本月销售情况');
    await settle();
    click('停止');
    await settle();
    state.callback({
      event: 'clarification',
      data: { clarification: '过期结果', choices: [] },
    });
    await settle();
    expect(root.textContent).toContain('本次查询已停止');
    expect(root.textContent).not.toContain('过期结果');
  });
  it('deleting a conversation clears its history and refreshes the sidebar', async () => {
    await mount();
    click('测试会话');
    await settle();
    click('删除当前会话');
    await settle();
    expect(api.deleteConversation).toHaveBeenCalledWith('c1');
    expect(api.listConversations).toHaveBeenCalledTimes(2);
  });
  it('does not offer unavailable metrics as executable examples', async () => {
    api.readiness.mockResolvedValueOnce({
      status: 'UNPUBLISHED',
      text: '业务指标尚未完成核验发布',
      metrics: [],
    });
    await mount();
    expect(root.textContent).toContain('智能问数暂不可用，请稍后重新检测。');
    expect(root.textContent).not.toContain('业务指标尚未完成核验发布');
    expect(
      [...root.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === '本月销售情况',
      ),
    ).toBe(false);
    expect(api.ask).not.toHaveBeenCalled();
  });
  it('hides unavailable metric details and retries readiness on demand', async () => {
    api.readiness.mockResolvedValueOnce({
      status: 'UNPUBLISHED',
      text: '业务指标尚未完成核验发布',
      metrics: [
        {
          id: 'SALE',
          title: '销售概况',
          available: false,
          reasonText: '该统计涉及当前不可见字段',
        },
      ],
    } as any);
    await mount();
    expect(root.textContent).not.toContain(
      '销售概况：该统计涉及当前不可见字段',
    );
    expect(root.textContent).toContain('重新检测');

    click('重新检测');
    await settle();
    expect(api.readiness).toHaveBeenCalledTimes(2);
    expect(api.readiness).toHaveBeenLastCalledWith(true);
    expect(root.textContent).not.toContain('智能问数暂不可用');
    expect(root.textContent).toContain('本月销售情况');
  });
  it('sends server cancellation with the active request id', async () => {
    api.ask.mockImplementation((_id, _q, _signal, receive) => {
      receive({ event: 'started', data: { requestId: 'r1' } });
      return new Promise(() => {});
    });
    await mount();
    click('本月销售情况');
    await settle();
    click('停止');
    expect(api.cancelRequest).toHaveBeenCalledWith('r1');
  });
  it('fills the composer from recent questions without querying immediately', async () => {
    api.history.mockResolvedValueOnce([
      { id: 'm-old', question: '换成上周', status: 'SUCCESS', canRerun: true },
    ] as any);
    await mount();
    await inputQuestion('即将被替换的问题');
    click('测试会话');
    await settle();
    click('换成上周');
    await settle();
    expect(composer().value).toBe('换成上周');
    expect(document.activeElement).toBe(composer());
    expect(api.rerun).not.toHaveBeenCalled();
    expect(api.ask).not.toHaveBeenCalled();

    click('发送');
    await settle();
    expect(api.ask.mock.calls[0]?.[1]).toBe('换成上周');
    expect(api.rerun).not.toHaveBeenCalled();
  });
  it('shows three recent questions and expands, loads, and collapses inline', async () => {
    api.history
      .mockResolvedValueOnce([
        { id: 'm1', question: '问题一', status: 'SUCCESS', canRerun: true },
        { id: 'm2', question: '问题二', status: 'SUCCESS', canRerun: true },
        { id: 'm3', question: '问题三', status: 'SUCCESS', canRerun: true },
        { id: 'm4', question: '问题四', status: 'SUCCESS', canRerun: true },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'm5', question: '问题五', status: 'SUCCESS', canRerun: true },
      ] as any)
      .mockResolvedValueOnce([]);
    await mount();
    click('测试会话');
    await settle();

    expect(root.textContent).toContain('最近提问');
    expect(root.textContent).toContain('问题三');
    expect(root.textContent).not.toContain('问题四');

    click('查看全部');
    await nextTick();
    expect(root.textContent).toContain('问题四');
    click('加载更多');
    await settle();
    expect(api.history).toHaveBeenLastCalledWith('c1', 2);
    expect(root.textContent).toContain('问题五');

    click('加载更多');
    await settle();
    expect(api.history).toHaveBeenLastCalledWith('c1', 3);
    expect(root.textContent).not.toContain('加载更多');

    click('收起');
    await nextTick();
    expect(root.textContent).not.toContain('问题四');
    expect(root.textContent).not.toContain('问题五');
  });
  it('does not show a recent-question section when history is empty', async () => {
    await mount();
    click('测试会话');
    await settle();
    expect(root.textContent).not.toContain('最近提问');
  });
  it('renders generic business-tool columns without requiring a legacy plan', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({ event: 'route', data: { mode: 'HYBRID' } });
      receive({ event: 'tool-progress', data: { text: '正在查询采购订单' } });
      receive({
        event: 'result',
        data: {
          columns: [{ key: 'document_count', title: '订单数' }],
          messageId: 'm2',
          queryType: 'BUSINESS_TOOL',
          queriedAt: '2026-09-28T10:00:00',
          rows: [{ document_count: 3 }],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [],
          title: '采购订单查询',
          toolName: 'query_purchase_documents',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    const resultPanel = root.querySelector('.result-panel');
    expect(root.textContent).not.toContain('采购订单查询');
    expect(root.textContent).not.toContain('业务工具');
    expect(resultPanel?.textContent).not.toContain('当前权限');
    expect(resultPanel?.textContent).not.toContain('查询时间');
    expect(root.textContent).toContain('查询方式：采购单据查询');
  });
  it('renders source details with server columns and readable stock movement values', async () => {
    api.details.mockResolvedValueOnce({
      columns: [
        { key: 'product_name', title: '产品名称' },
        { key: 'biz_type', title: '业务类型' },
        { key: 'biz_date', title: '业务日期' },
      ],
      list: [
        {
          biz_date: 1_789_980_970_000,
          biz_type: 50,
          product_name: '路通源化油器清洗剂',
        },
      ],
      total: 1,
    } as any);
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          columns: [{ key: 'biz_type', title: '业务类型' }],
          messageId: 'm-detail',
          queriedAt: '2026-09-28T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [{ biz_type: 32 }],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [],
          title: '库存流水查询',
          toolName: 'query_stock_movements',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    expect(root.textContent).toContain('调拨出库');
    click('查看来源明细');
    await settle();
    expect(api.details).toHaveBeenCalledWith('m-detail', 1);
    expect(root.textContent).toContain('路通源化油器清洗剂');
    expect(root.textContent).toContain('销售出库');
    expect(root.textContent).toContain('2026-09-21 16:56:10');
    expect(
      [...root.querySelectorAll('[data-scroll-x]')].some(
        (item) => item.getAttribute('data-scroll-x') === 'max-content',
      ),
    ).toBe(true);
  });
  it('renders stock inbound summary labels and counts without the monetary fallback', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          answerText:
            '上周在当前权限范围内有入库记录，共2条；其中调拨入库1条、盘盈入库1条。',
          messageId: 'm-inbound-summary',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-10-08T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [
            {
              amount: 2,
              businessObject: '全部库存入库',
              label: '全部库存入库',
              record_count: 2,
              unit: '条',
            },
            {
              amount: 1,
              businessObject: '调拨入库',
              label: '调拨入库',
              record_count: 1,
              unit: '条',
            },
            {
              amount: 1,
              businessObject: '盘盈入库',
              label: '盘盈入库',
              record_count: 1,
              unit: '条',
            },
          ],
          title: '上周库存入库记录',
          toolName: 'query_stock_movements',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('全部库存入库2 条');
    expect(root.textContent).toContain('调拨入库1 条');
    expect(root.textContent).toContain('盘盈入库1 条');
    expect(root.textContent).not.toContain('已审核实际金额');
  });
  it('renders legacy stock inbound summaries and hides zero-count categories', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          emptyText: '上周在当前权限范围内没有入库记录。',
          messageId: 'm-inbound-legacy',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-10-08T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [
            { businessObject: '全部库存入库', record_count: 2 },
            { businessObject: '其它入库', record_count: 0 },
            { businessObject: '调拨入库', record_count: 1 },
            { businessObject: '盘盈入库', record_count: 1 },
            { businessObject: '采购入库', record_count: 0 },
          ],
          title: '上周库存入库记录',
          toolName: 'query_stock_movements',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('全部库存入库2 条');
    expect(root.textContent).toContain('调拨入库1 条');
    expect(root.textContent).toContain('盘盈入库1 条');
    expect(root.textContent).not.toContain('其它入库');
    expect(root.textContent).not.toContain('采购入库');
    expect(root.textContent).not.toContain('已审核实际金额');
  });
  it('does not render stock inbound summary cards for an empty result', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          emptyText: '上周在当前权限范围内没有入库记录。',
          messageId: 'm-inbound-empty',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-10-08T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前权限',
          status: 'EMPTY',
          summary: [
            { businessObject: '全部库存入库', record_count: 0 },
            { businessObject: '调拨入库', record_count: 0 },
          ],
          title: '上周库存入库记录',
          toolName: 'query_stock_movements',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('上周在当前权限范围内没有入库记录。');
    expect(root.textContent).not.toContain('全部库存入库');
    expect(root.textContent).not.toContain('已审核实际金额');
  });
  it.each([
    ['SALE', '净额', '元'],
    ['PURCHASE', '净额', '元'],
    ['RECEIPT', '已审核实际金额', '元'],
    ['PAYMENT', '已审核实际金额', '元'],
    ['STOCK', '库存数量', '件'],
    ['STOCK_SKU', 'SKU 数', '种'],
    ['RECEIVABLE', '当前余额', '元'],
  ])(
    'keeps the %s metric summary label unchanged',
    async (metric, expected, unit) => {
      api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
        receive({
          event: 'result',
          data: {
            messageId: `m-${metric.toLowerCase()}`,
            plan: {
              group: 'NONE',
              metric,
              period: 'THIS_MONTH',
              stockMode: 'ALL',
            },
            presentation: {
              mode: 'SUMMARY',
              showChart: false,
              showSummary: true,
              showTable: false,
            },
            queriedAt: '2026-10-08T10:00:00',
            queryType: 'VERIFIED_METRIC',
            rows: [],
            scope: '当前权限',
            status: 'SUCCESS',
            summary: [{ amount: 1, label: '合计', unit }],
            title: metric,
            toolName: 'query_verified_metric',
          },
        });
      });
      await mount();
      click('本月销售情况');
      await settle();

      expect(root.textContent).toContain(expected);
    },
  );
  it('renders product price stock fields only when returned by the backend', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          basis: ['产品价格/库存工具'],
          columns: [
            { key: 'label', title: '产品/分组' },
            { key: 'amount', title: '库存数量' },
            { key: 'unit', title: '单位' },
            { key: 'retailPrice', title: '零售价' },
          ],
          messageId: 'm-price',
          plan: {
            group: 'NONE',
            metric: 'STOCK',
            period: 'CURRENT',
            stockMode: 'ALL',
          },
          priceFields: [{ key: 'retailPrice', title: '零售价' }],
          missingPriceFields: [{ key: 'sharePrice', title: '股份价' }],
          priceNotice: '以下价格暂无数据：股份价',
          priceStatus: 'PARTIAL',
          queriedAt: '2026-09-28T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          stockNotice: '系统有产品档案，但当前授权仓库范围内没有库存数量',
          summary: [{ amount: 0, label: '合计', retailPrice: 128, unit: '桶' }],
          title: '产品价格/库存查询',
          toolName: 'query_product_stock',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    expect(root.textContent).toContain('产品价格/库存查询');
    expect(root.textContent).toContain('当前库存');
    expect(root.textContent).toContain('零售价 128');
    expect(root.textContent).toContain('以下价格暂无数据：股份价');
    expect(root.textContent).toContain('当前授权仓库范围内没有库存数量');
    expect(root.textContent).toContain('查询方式：产品价格/库存查询');
  });
  it('renders the dedicated compact product price and warehouse stock table', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          messageId: 'm-product-table',
          plan: {
            group: 'NONE',
            metric: 'STOCK',
            period: 'CURRENT',
            stockMode: 'ALL',
          },
          productMatchTruncated: true,
          productResults: [
            {
              prices: [
                { key: 'sharePrice', title: '股份价', unit: '元', value: 369 },
              ],
              productId: 1,
              productName: '黑霸王 K60',
              warehouseStocks: [
                { amount: 415, warehouseId: 1, warehouseName: '大塘' },
                { amount: 251, warehouseId: 2, warehouseName: '拉萨' },
                { amount: 29, warehouseId: 3, warehouseName: '双流' },
                { amount: 10, warehouseId: 4, warehouseName: '波密' },
                { amount: 10, warehouseId: 5, warehouseName: '林芝' },
                { amount: -2, warehouseId: 6, warehouseName: '其他仓' },
              ],
            },
            {
              prices: [],
              productId: 2,
              productName: '无库存产品',
              warehouseStocks: [],
            },
            {
              priceDisplayText: '当前账号没有可见的产品价格字段',
              prices: [],
              productId: 3,
              productName: '无价格权限产品',
              warehouseStocks: [
                { amount: 3, warehouseId: 7, warehouseName: '成都' },
              ],
            },
          ],
          queriedAt: '2026-10-09T10:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [{ amount: 713, label: '合计', unit: '桶' }],
          title: '产品价格/库存查询',
          toolName: 'query_product_stock',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('序号产品价格仓库库存');
    expect(root.textContent).toContain('黑霸王 K60');
    expect(root.textContent).toContain('股份价 369.00');
    expect(root.textContent).toContain('其他1仓 -2.00');
    expect(root.textContent).toContain('无库存产品');
    expect(root.textContent).toContain('当前账号可见的价格尚未维护');
    expect(root.textContent).toContain('当前账号没有可见的产品价格字段');
    expect(root.textContent).toContain('无库存');
    expect(root.textContent).toContain('已展示前 10 个产品');
    expect(root.textContent).not.toContain('其他仓 -2.00');

    click('展开全部仓库');
    await settle();
    expect(root.textContent).toContain('其他仓 -2.00');
    expect(root.textContent).toContain('收起');

    click('收起');
    await settle();
    expect(root.textContent).not.toContain('其他仓 -2.00');
  });
  it('renders receivable balances by business document department', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          accountPartyLimit: 10,
          accountPartyTruncated: true,
          accountResults: [
            {
              amount: 10_830,
              deptId: 11,
              deptName: '甘孜分公司',
              partyId: 1,
              partyName: '理塘众鑫进口汽修',
              unit: '元',
            },
            {
              amount: -10_000,
              deptId: 12,
              deptName: '兴宇路通',
              partyId: 1,
              partyName: '理塘众鑫进口汽修',
              unit: '元',
            },
          ],
          messageId: 'm-account-table',
          plan: {
            group: 'PARTY',
            metric: 'RECEIVABLE',
            period: 'CURRENT',
            stockMode: 'ALL',
          },
          presentation: {
            mode: 'DISTRIBUTION',
            showChart: false,
            showSummary: true,
            showTable: true,
          },
          queriedAt: '2026-10-09T10:00:00',
          rows: [{ amount: 830, label: '不应重复显示的通用行', unit: '元' }],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [{ amount: 830, label: '合计', unit: '元' }],
          summaryLabel: '应收余额合计',
          toolName: 'query_verified_metric',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('应收余额合计');
    expect(root.textContent).toContain('830.00');
    expect(root.textContent).toContain('序号客户单据所属部门应收余额');
    expect(root.textContent).toContain('理塘众鑫进口汽修');
    expect(root.textContent).toContain('甘孜分公司');
    expect(root.textContent).toContain('10830.00');
    expect(root.textContent).toContain('-10000.00');
    expect(root.textContent).toContain('已展示前 10 个客户及其部门明细');
    expect(root.textContent).not.toContain('不应重复显示的通用行');
  });
  it('renders master-data counts with the server label and without a detail entry', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          basis: ['客户档案页面同权限、同状态口径'],
          columns: [],
          messageId: 'm-master-data',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-09-29T16:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          scope: '当前登录用户有权限查看的客户档案',
          status: 'SUCCESS',
          summary: [{ amount: 204, label: '启用客户', unit: '个' }],
          summaryLabel: '启用客户数量',
          title: '客户档案数量统计',
          toolName: 'query_master_data_stats',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).not.toContain('客户档案数量统计');
    expect(root.textContent).toContain('启用客户数量');
    expect(root.textContent).toContain('204');
    expect(root.textContent).not.toContain('已审核实际金额');
    expect(root.textContent).not.toContain('记录数');
    expect(root.textContent).not.toContain('查看来源明细');
  });
  it('renders company knowledge answers and hides database detail actions', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          basis: ['《四川兴宇公司概况》'],
          messageId: 'm-company-knowledge',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: false,
            showTable: false,
          },
          queriedAt: '2026-09-30T18:00:00',
          queryType: 'KNOWLEDGE',
          rows: [],
          scope: '公司公共知识',
          status: 'SUCCESS',
          summary: [],
          title: '公司知识问答',
          toolName: 'answer_company_knowledge',
        },
      });
      receive({
        event: 'explanation',
        data: { text: '四川兴宇主要提供润滑油相关产品与服务。' },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain(
      '四川兴宇主要提供润滑油相关产品与服务。',
    );
    expect(root.textContent).toContain('依据：《四川兴宇公司概况》');
    expect(root.textContent).toContain('查询方式：公司知识问答');
    expect(root.textContent).not.toContain('查看来源明细');
  });
  it('never renders an ERP amount card for company knowledge responses', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          basis: ['《兴宇区域市场格局》'],
          freshness: 'LATEST_REVIEWED',
          freshnessNotice:
            '依据最新已审核资料回答；所用资料最新更新时间为 2026-09-30，不代表实时业务、网点或人员清单。',
          messageId: 'm-company-region',
          queriedAt: '2026-10-08T10:00:00',
          queryType: 'KNOWLEDGE',
          rows: [],
          scope: '公司公共知识',
          status: 'SUCCESS',
          summary: [{ amount: 999, label: '错误遗留汇总', unit: '元' }],
          title: '公司知识问答',
          toolName: 'answer_company_knowledge',
          warnings: [
            '依据最新已审核资料回答；所用资料最新更新时间为 2026-09-30，不代表实时业务、网点或人员清单。',
          ],
        },
      });
      receive({
        event: 'explanation',
        data: { text: '兴宇业务覆盖以已审核区域资料为准。[S1]' },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain(
      '兴宇业务覆盖以已审核区域资料为准。[S1]',
    );
    expect(root.textContent).toContain('不代表实时业务、网点或人员清单');
    expect(root.textContent).not.toContain('错误遗留汇总');
    expect(root.textContent).not.toContain('999');
    expect(root.textContent).not.toContain('已审核实际金额');
  });
  it('renders mixed knowledge and realtime data with citations and partial warning', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          basis: ['[S1]《美孚黑霸王产品总览》', '实时数据：当前账面库存'],
          dataStatus: 'SUCCESS',
          dataToolName: 'query_product_stock',
          knowledgeStatus: 'UNVERIFIED_KNOWLEDGE',
          messageId: 'm-mixed',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-10-02T23:00:00',
          queryType: 'MIXED',
          rows: [],
          scope: '当前 ERP 用户实时权限与公司公共知识',
          sources: [
            {
              citation: 'S1',
              id: 'kb-1',
              path: '知识库/16-公司产品与销售知识/02_产品知识/黑霸王.md',
              reason: '认证口径仍待核实',
              section: '产品定位',
              title: '美孚黑霸王产品总览',
              updated: '2026-07-28',
              verificationStatus: 'UNVERIFIED',
            },
          ],
          status: 'PARTIAL_SUCCESS',
          summary: [{ amount: 12, label: '黑霸王', unit: '桶' }],
          title: '公司知识与实时数据',
          toolName: 'answer_mixed_question',
          warnings: ['部分知识仍处于待核实状态'],
        },
      });
      receive({
        event: 'explanation',
        data: { text: '黑霸王是商用车润滑产品系列。[S1]' },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('黑霸王是商用车润滑产品系列。[S1]');
    expect(root.textContent).toContain('部分知识仍处于待核实状态');
    expect(root.textContent).toContain('[S1]《美孚黑霸王产品总览》');
    expect(root.textContent).toContain('认证口径仍待核实');
    expect(root.textContent).toContain('12');
    expect(root.textContent).toContain('查询方式：公司知识与实时数据组合查询');
    expect(root.textContent).toContain('查看来源明细');
  });
  it('renders separate enabled and disabled labels for master-data split counts', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          columns: [],
          messageId: 'm-master-data-split',
          presentation: {
            mode: 'SUMMARY',
            showChart: false,
            showSummary: true,
            showTable: false,
          },
          queriedAt: '2026-09-29T16:00:00',
          queryType: 'BUSINESS_TOOL',
          rows: [],
          status: 'SUCCESS',
          summary: [
            { amount: 204, label: '启用客户', unit: '个' },
            { amount: 3, label: '停用客户', unit: '个' },
          ],
          summaryLabel: '客户数量',
          title: '客户档案数量统计',
          toolName: 'query_master_data_stats',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(root.textContent).toContain('启用客户数量');
    expect(root.textContent).toContain('停用客户数量');
  });
  it('renders one stock ranking chart even when products have different units', async () => {
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          messageId: 'm-ranking',
          plan: {
            group: 'PRODUCT',
            limit: 2,
            metric: 'STOCK',
            period: 'CURRENT',
            rankOrder: 'DESC',
            stockMode: 'ALL',
          },
          queriedAt: '2026-09-28T10:00:00',
          presentation: {
            headline: '库存最多的产品是产品A，当前库存为20 件。',
            mode: 'RANKING',
            showChart: true,
            showSummary: false,
            showTable: true,
          },
          queryType: 'VERIFIED_METRIC',
          rows: [
            { amount: 20, label: '产品A', unit: '件' },
            { amount: 18, label: '产品B', unit: '箱' },
          ],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [
            { amount: 152_092, label: '合计', unit: '瓶' },
            { amount: 13_860, label: '合计', unit: '桶' },
          ],
          title: '当前库存',
          toolName: 'query_verified_metric',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();

    expect(state.renderEcharts).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain('库存最多的产品是产品A');
    expect(root.textContent).not.toContain('152092');
    expect(root.textContent).not.toContain('13860');
    expect(root.textContent).toContain(
      '排名口径：按库存数量统一排名，计量单位仅展示，不参与分组和排序。',
    );
    const options = state.renderEcharts.mock.calls[0]?.[0];
    expect(options.series[0].data).toEqual([20, 18]);
    expect(options.tooltip.formatter([{ dataIndex: 1 }])).toContain('18 箱');
  });
  it('loads sanitized audit only for users with the audit permission', async () => {
    state.auditAllowed = true;
    api.ask.mockImplementation(async (_id, _q, _signal, receive) => {
      receive({
        event: 'result',
        data: {
          columns: [],
          messageId: 'm-audit',
          plan: {
            group: 'NONE',
            metric: 'SALE',
            period: 'THIS_MONTH',
            stockMode: 'ALL',
          },
          queriedAt: '2026-09-28T10:00:00',
          rows: [],
          scope: '当前权限',
          status: 'SUCCESS',
          summary: [],
          title: '销售',
          queryType: 'VERIFIED_METRIC',
        },
      });
    });
    await mount();
    click('本月销售情况');
    await settle();
    click('查看查询审计');
    await settle();
    expect(api.audit).toHaveBeenCalledWith('m-audit');
    expect(root.textContent).toContain('query_purchase_documents');
  });
});
