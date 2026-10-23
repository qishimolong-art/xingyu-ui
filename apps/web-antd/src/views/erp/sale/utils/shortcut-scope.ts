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

/**
 * Only the visible, top-most document dialog owns its global shortcuts.
 * Teleported child dialogs are normalized to their modal/drawer wrapper so a
 * lower document form cannot consume the same key before the child layer.
 */
export function isSaleShortcutOwnerActive(owner: HTMLElement | null) {
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

/**
 * A table row itself is not focusable, so clicking it can leave focus on the
 * button that opened or switched the document form. Return focus to the form
 * scope without stealing it from real editors and controls inside a cell.
 */
export function focusSaleShortcutOwner(
  owner: HTMLElement | null,
  target: EventTarget | null,
) {
  if (!owner || isEditableEnterTarget(target)) {
    return;
  }
  owner.focus({ preventScroll: true });
}
