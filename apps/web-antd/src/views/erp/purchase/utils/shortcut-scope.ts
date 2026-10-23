import { isEditableEnterTarget } from '#/views/erp/utils/keyboard';

const SHORTCUT_DIALOG_SELECTOR =
  '.ant-modal-wrap, .ant-drawer-content-wrapper, [role="dialog"], [aria-modal="true"]';

function isShortcutElementVisible(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.hidden || current.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      style.pointerEvents === 'none'
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function normalizeShortcutDialog(element: HTMLElement) {
  return (
    element.closest<HTMLElement>(
      '.ant-modal-wrap, .ant-drawer-content-wrapper',
    ) ?? element
  );
}

function getShortcutDialogZIndex(element: HTMLElement) {
  const parsed = Number.parseInt(window.getComputedStyle(element).zIndex, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Only the visible, top-most purchase document dialog owns its shortcuts. */
export function isPurchaseShortcutOwnerActive(owner: HTMLElement | null) {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    !owner ||
    !owner.isConnected ||
    !isShortcutElementVisible(owner)
  ) {
    return false;
  }

  const ownerDialogElement = owner.closest<HTMLElement>(
    SHORTCUT_DIALOG_SELECTOR,
  );
  const ownerDialog = ownerDialogElement
    ? normalizeShortcutDialog(ownerDialogElement)
    : null;
  const dialogs = [
    ...document.querySelectorAll<HTMLElement>(SHORTCUT_DIALOG_SELECTOR),
  ]
    .map(normalizeShortcutDialog)
    .filter((dialog, index, all) => all.indexOf(dialog) === index)
    .filter(isShortcutElementVisible);

  if (!ownerDialog) {
    return dialogs.length === 0;
  }
  if (!dialogs.includes(ownerDialog)) {
    return false;
  }

  const topDialog = dialogs.reduce((top, dialog) => {
    const topZIndex = getShortcutDialogZIndex(top);
    const dialogZIndex = getShortcutDialogZIndex(dialog);
    if (dialogZIndex > topZIndex) {
      return dialog;
    }
    if (dialogZIndex < topZIndex) {
      return top;
    }
    return dialogs.indexOf(dialog) > dialogs.indexOf(top) ? dialog : top;
  });

  return topDialog === ownerDialog;
}

/** Return focus to a non-editable purchase table after a row click. */
export function focusPurchaseShortcutOwner(
  owner: HTMLElement | null,
  target: EventTarget | null,
) {
  if (!owner || isEditableEnterTarget(target)) {
    return;
  }
  owner.focus({ preventScroll: true });
}
