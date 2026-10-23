import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FloatingAssistant from './FloatingAssistant.vue';

const state = vi.hoisted(() => ({
  allowed: true,
  narrow: false,
  path: '/erp/stock/stock',
  pushed: [] as string[],
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.allowed }),
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    props: ['icon'],
    setup: (props) => () => h('i', { 'data-icon': props.icon }),
  }),
}));
vi.mock('@vueuse/core', () => ({
  useMediaQuery: () => ({ value: state.narrow }),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: state.path }),
  useRouter: () => ({
    push: async (path: string) => {
      state.pushed.push(path);
    },
  }),
}));
vi.mock('ant-design-vue', () => ({
  Button: defineComponent({
    inheritAttrs: false,
    setup:
      (_, { attrs, slots }) =>
      () =>
        h('button', attrs, slots.default?.()),
  }),
  Drawer: defineComponent({
    emits: ['update:open'],
    props: ['open', 'width'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h(
          'section',
          {
            'data-open': String(props.open),
            'data-testid': 'assistant-drawer',
            'data-width': String(props.width),
          },
          [
            h(
              'button',
              {
                'data-testid': 'close-drawer',
                onClick: () => emit('update:open', false),
              },
              '关闭',
            ),
            slots.default?.(),
          ],
        ),
  }),
  Tooltip: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));
vi.mock('./AssistantPanel.vue', () => ({
  default: defineComponent({
    emits: ['busyChange', 'openFullPage'],
    props: ['active', 'mode'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'div',
          {
            'data-active': String(props.active),
            'data-testid': 'assistant-panel',
          },
          [
            h(
              'button',
              {
                'data-testid': 'mark-busy',
                onClick: () => emit('busyChange', true),
              },
              '查询中',
            ),
            h(
              'button',
              {
                'data-testid': 'open-full-page',
                onClick: () => emit('openFullPage'),
              },
              '完整页面',
            ),
          ],
        ),
  }),
}));

let app: App;
let root: HTMLDivElement;

async function mount() {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(FloatingAssistant);
  app.mount(root);
  await nextTick();
}

function click(testId: string) {
  const target = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  expect(target).toBeTruthy();
  target?.click();
}

beforeEach(() => {
  state.allowed = true;
  state.narrow = false;
  state.path = '/erp/stock/stock';
  state.pushed = [];
});

afterEach(() => {
  app?.unmount();
  root?.remove();
});

describe('ERP floating assistant', () => {
  it('stays lazy until an authorized user opens it', async () => {
    await mount();
    expect(root.querySelector('[data-testid="assistant-panel"]')).toBeNull();
    click('erp-assistant-float-button');
    await nextTick();
    expect(root.querySelector('[data-testid="assistant-panel"]')).toBeTruthy();
    expect(
      root
        .querySelector('[data-testid="assistant-drawer"]')
        ?.getAttribute('data-width'),
    ).toBe('620');
  });

  it('does not render an entry or initialize data without permission', async () => {
    state.allowed = false;
    await mount();
    expect(
      root.querySelector('[data-testid="erp-assistant-float-button"]'),
    ).toBeNull();
    expect(root.querySelector('[data-testid="assistant-panel"]')).toBeNull();
  });

  it('hides the duplicate entry on the full assistant page', async () => {
    state.path = '/erp/assistant';
    await mount();
    expect(
      root.querySelector('[data-testid="erp-assistant-float-button"]'),
    ).toBeNull();
  });

  it('keeps the initialized panel after the drawer closes', async () => {
    await mount();
    click('erp-assistant-float-button');
    await nextTick();
    click('close-drawer');
    await nextTick();
    expect(root.querySelector('[data-testid="assistant-panel"]')).toBeTruthy();
    expect(
      root
        .querySelector('[data-testid="assistant-drawer"]')
        ?.getAttribute('data-open'),
    ).toBe('false');
  });

  it('shows the querying state on the floating icon', async () => {
    await mount();
    click('erp-assistant-float-button');
    await nextTick();
    click('mark-busy');
    await nextTick();
    expect(
      root.querySelector('[data-icon="lucide:loader-circle"]'),
    ).toBeTruthy();
  });

  it('uses full viewport width on narrow screens', async () => {
    state.narrow = true;
    await mount();
    click('erp-assistant-float-button');
    await nextTick();
    expect(
      root
        .querySelector('[data-testid="assistant-drawer"]')
        ?.getAttribute('data-width'),
    ).toBe('100vw');
  });

  it('opens the retained standalone assistant route', async () => {
    await mount();
    click('erp-assistant-float-button');
    await nextTick();
    click('open-full-page');
    await nextTick();
    expect(state.pushed).toEqual(['/erp/assistant']);
  });
});
