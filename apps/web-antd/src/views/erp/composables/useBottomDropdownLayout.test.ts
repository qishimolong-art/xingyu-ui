import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getBottomDropdownSpace,
  useBottomDropdownLayout,
} from './useBottomDropdownLayout';

const disposers: Array<() => void> = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('bottom dropdown space', () => {
  it('shows the full table when there is room', () => {
    expect(getBottomDropdownSpace(300, 700, 224, 40)).toEqual({
      missing: 0,
      tableMaxHeight: 224,
    });
  });
  it('reserves the footer before shrinking the table', () => {
    expect(getBottomDropdownSpace(500, 700, 224, 40)).toEqual({
      missing: 76,
      tableMaxHeight: 148,
    });
  });
  it('clamps exhausted space without negative CSS heights', () => {
    expect(getBottomDropdownSpace(700, 700, 224, 40)).toEqual({
      missing: 264,
      tableMaxHeight: 0,
    });
  });
});

function harness(maxTableHeight?: number) {
  vi.useFakeTimers();
  let notifyResize = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
  let naturalHeight = 224;
  let footerHeight = 40;
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const viewport = document.createElement('div');
  viewport.style.overflowY = 'auto';
  const anchor = document.createElement('input');
  viewport.append(anchor);
  dialog.append(viewport);
  document.body.append(dialog);
  const rect = (top: number, bottom: number) =>
    ({ top, bottom, left: 20, width: 160, height: bottom - top }) as DOMRect;
  dialog.getBoundingClientRect = () => rect(0, 750);
  viewport.getBoundingClientRect = () => rect(100, 700);
  anchor.getBoundingClientRect = () =>
    rect(600 - viewport.scrollTop, 632 - viewport.scrollTop);
  Object.defineProperties(viewport, {
    clientHeight: { value: 600 },
    scrollHeight: {
      get: () =>
        600 +
        Number.parseFloat(
          viewport.lastElementChild
            ?.getAttribute('style')
            ?.match(/height:\s*([\d.]+)px/)?.[1] || '0',
        ),
    },
  });
  const table = ref<HTMLElement>();
  const footer = ref<HTMLElement>();
  const open = ref(false);
  const version = ref(0);
  let layout!: ReturnType<typeof useBottomDropdownLayout>;
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(
    defineComponent({
      setup() {
        layout = useBottomDropdownLayout({
          anchor: () => anchor,
          contentVersion: () => version.value,
          footer,
          loading: () => false,
          maxTableHeight,
          open: () => open.value,
          reservedTableHeight: 224,
          table,
        });
        return () => h('div');
      },
    }),
  );
  app.mount(host);
  table.value = document.createElement('div');
  footer.value = document.createElement('div');
  Object.defineProperties(table.value, {
    scrollHeight: { get: () => naturalHeight },
    offsetHeight: { get: () => naturalHeight },
    clientHeight: { get: () => naturalHeight },
  });
  Object.defineProperty(footer.value, 'offsetHeight', {
    get: () => footerHeight,
  });
  disposers.push(() => {
    app.unmount();
    dialog.remove();
    host.remove();
  });
  const flush = async () => {
    await nextTick();
    await nextTick();
    await vi.advanceTimersByTimeAsync(32);
  };
  return {
    app,
    flush,
    layout,
    open,
    version,
    viewport,
    resize: () => notifyResize(),
    measure: (height: number, footer: number) => {
      naturalHeight = height;
      footerHeight = footer;
    },
  };
}

describe('bottom dropdown lifecycle', () => {
  it('caps a long result set at the configured candidate-table height', async () => {
    const { open, flush, layout, measure, viewport } = harness(224);
    measure(600, 40);
    open.value = true;
    await flush();
    expect(layout.tableMaxHeight.value).toBe(224);
    expect(viewport.scrollTop).toBe(208);
  });

  it('makes room after a hidden popup gains its real content height', async () => {
    const { open, flush, viewport, measure, resize, layout } = harness();
    measure(0, 0);
    open.value = true;
    await flush();
    expect(viewport.scrollTop).toBe(0);
    measure(224, 40);
    resize();
    await flush();
    expect(viewport.scrollTop).toBe(208);
    expect(layout.tableMaxHeight.value).toBe(224);
  });
  it('scrolls only the missing distance and releases short-form space on close', async () => {
    const { open, flush, layout, viewport } = harness();
    open.value = true;
    await flush();
    expect(viewport.scrollTop).toBe(208);
    expect(layout.tableMaxHeight.value).toBe(224);
    expect(viewport.querySelector('[aria-hidden="true"]')).not.toBeNull();
    open.value = false;
    await flush();
    expect(viewport.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('manual scrolling recalculates height without scrolling the form back', async () => {
    const { open, flush, layout, viewport } = harness();
    open.value = true;
    await flush();
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    await flush();
    expect(viewport.scrollTop).toBe(100);
    expect(layout.tableMaxHeight.value).toBe(116);
  });

  it('unmount cancels queued layout and removes listeners and reserved space', async () => {
    const { app, open, flush, viewport } = harness();
    const removeListener = vi.spyOn(window, 'removeEventListener');
    open.value = true;
    await flush();
    window.dispatchEvent(new Event('resize'));
    app.unmount();
    const scrollTop = viewport.scrollTop;
    await flush();
    expect(viewport.scrollTop).toBe(scrollTop);
    expect(viewport.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(removeListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true,
    );
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
