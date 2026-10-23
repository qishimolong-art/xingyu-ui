import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPurchaseHistoryShortcutController } from './history-shortcut';

const listeners: Array<{
  keydown: (event: KeyboardEvent) => void;
  keyup: (event: KeyboardEvent) => void;
}> = [];

function mountController(shouldIgnore = () => false) {
  const onHistory = vi.fn();
  const onOrderHistory = vi.fn();
  const controller = createPurchaseHistoryShortcutController({
    onHistory,
    onOrderHistory,
    shouldIgnore,
  });
  const keydown = (event: KeyboardEvent) => controller.handleKeydown(event);
  const keyup = (event: KeyboardEvent) => controller.handleKeyup(event);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  listeners.push({ keydown, keyup });
  return { controller, onHistory, onOrderHistory };
}

function dispatchKey(
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code: key === ' ' ? 'Space' : key,
    key,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

describe('purchase history shortcut controller', () => {
  afterEach(() => {
    for (const { keydown, keyup } of listeners.splice(0)) {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    }
  });

  it('dispatches Space and standalone Shift through real keyboard events', () => {
    const { onHistory, onOrderHistory } = mountController();

    expect(dispatchKey('keydown', ' ').defaultPrevented).toBe(true);
    expect(onHistory).toHaveBeenCalledTimes(1);

    dispatchKey('keydown', 'Shift', { code: 'ShiftLeft' });
    expect(onOrderHistory).not.toHaveBeenCalled();
    expect(
      dispatchKey('keyup', 'Shift', { code: 'ShiftLeft' }).defaultPrevented,
    ).toBe(true);
    expect(onOrderHistory).toHaveBeenCalledTimes(1);
  });

  it('does not treat Shift+Tab as standalone Shift', () => {
    const { onOrderHistory } = mountController();

    dispatchKey('keydown', 'Shift', { code: 'ShiftLeft' });
    dispatchKey('keydown', 'Tab', { code: 'Tab', shiftKey: true });
    dispatchKey('keyup', 'Shift', { code: 'ShiftLeft' });

    expect(onOrderHistory).not.toHaveBeenCalled();
  });

  it('respects ignored events and clears pending Shift when suspended', () => {
    let suspended = true;
    const { controller, onHistory, onOrderHistory } = mountController(
      () => suspended,
    );

    dispatchKey('keydown', ' ');
    dispatchKey('keydown', 'Shift', { code: 'ShiftLeft' });
    suspended = false;
    dispatchKey('keyup', 'Shift', { code: 'ShiftLeft' });
    expect(onHistory).not.toHaveBeenCalled();
    expect(onOrderHistory).not.toHaveBeenCalled();

    dispatchKey('keydown', 'Shift', { code: 'ShiftLeft' });
    controller.reset();
    dispatchKey('keyup', 'Shift', { code: 'ShiftLeft' });
    expect(onOrderHistory).not.toHaveBeenCalled();
  });
});
