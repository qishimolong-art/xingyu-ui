import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';

import {
  isCreateShortcutKey,
  shouldIgnoreGlobalShortcut,
} from '#/views/erp/utils/keyboard';

export interface UseErpListShortcutOptions {
  onCreate: () => void;
  onImport?: () => void;
}

export { isCreateShortcutKey } from '#/views/erp/utils/keyboard';

export function useErpListShortcut({
  onCreate,
  onImport,
}: UseErpListShortcutOptions) {
  let isListening = false;

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (shouldIgnoreGlobalShortcut(event)) {
      return;
    }

    if (isCreateShortcutKey(event)) {
      event.preventDefault();
      onCreate();
      return;
    }

    if (onImport && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      onImport();
    }
  }

  function startListening() {
    if (isListening) {
      return;
    }

    window.addEventListener('keydown', handleGlobalKeydown);
    isListening = true;
  }

  function stopListening() {
    if (!isListening) {
      return;
    }

    window.removeEventListener('keydown', handleGlobalKeydown);
    isListening = false;
  }

  onMounted(startListening);
  onActivated(startListening);
  onDeactivated(stopListening);
  onBeforeUnmount(stopListening);
}
