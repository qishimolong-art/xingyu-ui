import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import DetailLinkInput from './DetailLinkInput.vue';

const InputStub = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    value: [Number, String],
  },
  setup(props, { attrs }) {
    return () =>
      h('input', {
        ...attrs,
        disabled: props.disabled,
        value: props.value,
      });
  },
});

function mountDetailLinkInput(props: {
  navigable?: boolean;
  onOpen?: () => void;
  value?: null | number | string;
}) {
  const container = document.createElement('div');
  const app = createApp(DetailLinkInput, props);
  app.component('AInput', InputStub);
  app.mount(container);
  document.body.append(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

describe('ERP detail link input', () => {
  const unmounts: (() => void)[] = [];

  afterEach(() => {
    unmounts.splice(0).forEach((unmount) => unmount());
  });

  it('keeps the disabled-input appearance and opens by click or Enter', async () => {
    const handleOpen = vi.fn();
    const mounted = mountDetailLinkInput({
      navigable: true,
      onOpen: handleOpen,
      value: 'CG202607150001',
    });
    unmounts.push(mounted.unmount);
    await nextTick();

    const link = mounted.container.querySelector('a');
    const input = mounted.container.querySelector('input');
    expect(link?.getAttribute('role')).toBe('link');
    expect(link?.getAttribute('tabindex')).toBe('0');
    expect(input?.disabled).toBe(true);
    expect(input?.value).toBe('CG202607150001');
    expect(mounted.container.querySelector('.absolute.inset-0')).not.toBeNull();

    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    link?.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
    );
    await nextTick();

    expect(handleOpen).toHaveBeenCalledTimes(2);
  });

  it('renders a non-interactive dash when the target is unavailable', async () => {
    const handleOpen = vi.fn();
    const mounted = mountDetailLinkInput({ onOpen: handleOpen, value: null });
    unmounts.push(mounted.unmount);
    await nextTick();

    const link = mounted.container.querySelector('a');
    const input = mounted.container.querySelector('input');
    expect(link?.hasAttribute('role')).toBe(false);
    expect(link?.hasAttribute('tabindex')).toBe(false);
    expect(input?.disabled).toBe(true);
    expect(input?.value).toBe('-');
    expect(mounted.container.querySelector('.absolute.inset-0')).toBeNull();

    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    link?.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
    );
    await nextTick();

    expect(handleOpen).not.toHaveBeenCalled();
  });

  it('keeps numeric zero visible without making it navigable by itself', async () => {
    const mounted = mountDetailLinkInput({ value: 0 });
    unmounts.push(mounted.unmount);
    await nextTick();

    const link = mounted.container.querySelector('a');
    const input = mounted.container.querySelector('input');
    expect(input?.value).toBe('0');
    expect(link?.hasAttribute('role')).toBe(false);
    expect(link?.hasAttribute('tabindex')).toBe(false);
  });
});
