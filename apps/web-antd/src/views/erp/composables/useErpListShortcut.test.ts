import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent } from 'vue';

import { useErpListShortcut } from './useErpListShortcut';

function mountShortcut(options: Parameters<typeof useErpListShortcut>[0]) {
  const root = document.createElement('div');
  document.body.append(root);

  const app = createApp(
    defineComponent({
      setup() {
        useErpListShortcut(options);
        return () => null;
      },
    }),
  );

  app.mount(root);

  return () => {
    app.unmount();
    root.remove();
  };
}

function dispatchKeydown(
  target: EventTarget,
  init: KeyboardEventInit & { isComposing?: boolean } = {},
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    ...init,
  });

  if (init.isComposing !== undefined) {
    Object.defineProperty(event, 'isComposing', {
      value: init.isComposing,
    });
  }

  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ERP list shortcut listener', () => {
  it('creates from the Insert shortcut when global shortcuts are available', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });

    dispatchKeydown(window, { key: 'Insert' });

    expect(onCreate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not create from zero', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });

    dispatchKeydown(window, { code: 'Digit0', key: '0' });
    dispatchKeydown(window, { code: 'Numpad0', key: '0' });

    expect(onCreate).not.toHaveBeenCalled();
    unmount();
  });

  it('imports from the i shortcut without changing existing import behavior', () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    const unmount = mountShortcut({ onCreate, onImport });

    dispatchKeydown(window, { key: 'i' });

    expect(onCreate).not.toHaveBeenCalled();
    expect(onImport).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores shortcuts from editable targets', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const input = document.createElement('input');
    document.body.append(input);

    dispatchKeydown(input, { key: 'Insert' });

    expect(onCreate).not.toHaveBeenCalled();
    unmount();
  });

  it('creates from Insert when focus remains on navigation or action targets', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const button = document.createElement('button');
    const link = document.createElement('a');
    const roleButton = document.createElement('div');

    roleButton.setAttribute('role', 'button');
    document.body.append(button, link, roleButton);

    dispatchKeydown(button, { key: 'Insert' });
    dispatchKeydown(link, { key: 'Insert' });
    dispatchKeydown(roleButton, { key: 'Insert' });

    expect(onCreate).toHaveBeenCalledTimes(3);
    unmount();
  });

  it('creates from Insert when the event target is a hidden stale input', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const input = document.createElement('input');
    input.style.display = 'none';
    document.body.append(input);

    dispatchKeydown(input, { key: 'Insert' });

    expect(onCreate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores shortcuts while a dialog overlay is open', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const modal = document.createElement('div');
    modal.className = 'ant-modal-wrap';
    document.body.append(modal);

    dispatchKeydown(window, { key: 'Insert' });

    expect(onCreate).not.toHaveBeenCalled();
    unmount();
  });

  it('does not block Insert when a closed dialog overlay remains in the DOM', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const modal = document.createElement('div');
    modal.className = 'ant-modal-wrap';
    modal.style.display = 'none';
    document.body.append(modal);

    dispatchKeydown(window, { key: 'Insert' });

    expect(onCreate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores repeated, composing, prevented, and modifier-conflicted events', () => {
    const onCreate = vi.fn();
    const unmount = mountShortcut({ onCreate });
    const prevented = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Insert',
    });
    prevented.preventDefault();

    dispatchKeydown(window, { key: 'Insert', repeat: true });
    dispatchKeydown(window, { key: 'Insert', isComposing: true });
    window.dispatchEvent(prevented);
    dispatchKeydown(window, { ctrlKey: true, key: 'Insert' });
    dispatchKeydown(window, { altKey: true, key: 'Insert' });
    dispatchKeydown(window, { key: 'Insert', metaKey: true });

    expect(onCreate).not.toHaveBeenCalled();
    unmount();
  });
});
