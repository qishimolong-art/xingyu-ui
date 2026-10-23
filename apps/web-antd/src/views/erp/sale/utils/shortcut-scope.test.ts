import { afterEach, describe, expect, it } from 'vitest';

import {
  focusSaleShortcutOwner,
  isSaleShortcutOwnerActive,
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

describe('sale shortcut scope', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('allows only the visible top-most dialog to own shortcuts', () => {
    const lower = appendDialog(1000);
    const upper = appendDialog(1100);

    expect(isSaleShortcutOwnerActive(lower.owner)).toBe(false);
    expect(isSaleShortcutOwnerActive(upper.owner)).toBe(true);

    upper.wrap.style.display = 'none';
    expect(isSaleShortcutOwnerActive(lower.owner)).toBe(true);
  });

  it('uses DOM order when dialog z-index values are equal', () => {
    const lower = appendDialog(1000);
    const upper = appendDialog(1000);

    expect(isSaleShortcutOwnerActive(lower.owner)).toBe(false);
    expect(isSaleShortcutOwnerActive(upper.owner)).toBe(true);
  });

  it('rejects hidden and detached owners while allowing an owner without dialogs', () => {
    const owner = document.createElement('div');
    document.body.append(owner);
    expect(isSaleShortcutOwnerActive(owner)).toBe(true);

    owner.style.display = 'none';
    expect(isSaleShortcutOwnerActive(owner)).toBe(false);

    expect(isSaleShortcutOwnerActive(document.createElement('div'))).toBe(
      false,
    );
  });

  it('returns focus after a row click without stealing focus from a cell editor', () => {
    const owner = document.createElement('div');
    owner.tabIndex = -1;
    const rowCell = document.createElement('span');
    const input = document.createElement('input');
    owner.append(rowCell, input);
    document.body.append(owner);

    focusSaleShortcutOwner(owner, rowCell);
    expect(document.activeElement).toBe(owner);

    input.focus();
    focusSaleShortcutOwner(owner, input);
    expect(document.activeElement).toBe(input);
  });
});
