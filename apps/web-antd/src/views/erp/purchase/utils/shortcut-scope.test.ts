import { afterEach, describe, expect, it } from 'vitest';

import {
  focusPurchaseShortcutOwner,
  isPurchaseShortcutOwnerActive,
} from './shortcut-scope';

function appendDialog(zIndex: number) {
  const wrap = document.createElement('div');
  wrap.className = 'ant-modal-wrap';
  wrap.style.zIndex = String(zIndex);
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const owner = document.createElement('div');
  dialog.append(owner);
  wrap.append(dialog);
  document.body.append(wrap);
  return { owner, wrap };
}

describe('purchase shortcut scope', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('allows only the visible top-most dialog to own shortcuts', () => {
    const lower = appendDialog(1000);
    const upper = appendDialog(1100);

    expect(isPurchaseShortcutOwnerActive(lower.owner)).toBe(false);
    expect(isPurchaseShortcutOwnerActive(upper.owner)).toBe(true);

    upper.wrap.style.display = 'none';
    expect(isPurchaseShortcutOwnerActive(lower.owner)).toBe(true);
  });

  it('uses DOM order for equal layers and rejects hidden or detached owners', () => {
    const lower = appendDialog(1000);
    const upper = appendDialog(1000);

    expect(isPurchaseShortcutOwnerActive(lower.owner)).toBe(false);
    expect(isPurchaseShortcutOwnerActive(upper.owner)).toBe(true);

    upper.wrap.style.visibility = 'hidden';
    expect(isPurchaseShortcutOwnerActive(lower.owner)).toBe(true);
    expect(isPurchaseShortcutOwnerActive(document.createElement('div'))).toBe(
      false,
    );
  });

  it('returns focus after a row click without stealing editable focus', () => {
    const owner = document.createElement('div');
    owner.tabIndex = -1;
    const rowCell = document.createElement('span');
    const input = document.createElement('input');
    owner.append(rowCell, input);
    document.body.append(owner);

    focusPurchaseShortcutOwner(owner, rowCell);
    expect(document.activeElement).toBe(owner);

    input.focus();
    focusPurchaseShortcutOwner(owner, input);
    expect(document.activeElement).toBe(input);
  });
});
