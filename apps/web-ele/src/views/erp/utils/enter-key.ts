import type { Ref } from 'vue';

import { onBeforeUnmount, onMounted } from 'vue';

type EnterConfirmHandler = () => void;
type EnterGuardEnabled = () => boolean;

let erpEnterInputGuardInitialized = false;

function isKeyboardComposing(event: KeyboardEvent) {
  return event.isComposing || event.keyCode === 229;
}

function isTextarea(target: EventTarget | null) {
  return target instanceof HTMLTextAreaElement;
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && target.isContentEditable;
}

function isInput(target: EventTarget | null) {
  return target instanceof HTMLInputElement;
}

function shouldIgnoreEnter(event: KeyboardEvent) {
  return (
    event.key !== 'Enter' ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    isKeyboardComposing(event) ||
    isTextarea(event.target) ||
    isEditable(event.target)
  );
}

export function initErpEnterInputGuard(
  isEnabled: EnterGuardEnabled = () => true,
) {
  if (erpEnterInputGuardInitialized) {
    return;
  }

  erpEnterInputGuardInitialized = true;

  document.addEventListener(
    'keydown',
    (event) => {
      const target = event.target;

      if (!isEnabled() || shouldIgnoreEnter(event) || !isInput(target)) {
        return;
      }

      if (
        target.closest('[data-erp-enter-confirm="true"]') ||
        target.closest('.el-message-box')
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      target.blur();
    },
    true,
  );
}

export function useErpEnterConfirm(
  open: Ref<boolean>,
  confirm: EnterConfirmHandler,
) {
  const handleKeydown = (event: KeyboardEvent) => {
    if (!open.value || shouldIgnoreEnter(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    confirm();
  };

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown, true);
  });
}
