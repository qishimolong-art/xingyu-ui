export type PurchaseHistoryShortcutControllerOptions = {
  onHistory: () => void;
  onOrderHistory: () => void;
  shouldIgnore: (event: KeyboardEvent) => boolean;
};

function isStandaloneShiftKey(event: KeyboardEvent) {
  return (
    event.key === 'Shift' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight'
  );
}

export function createPurchaseHistoryShortcutController(
  options: PurchaseHistoryShortcutControllerOptions,
) {
  let pendingOrderHistoryShift = false;

  function reset() {
    pendingOrderHistoryShift = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (pendingOrderHistoryShift && !isStandaloneShiftKey(event)) {
      reset();
    }
    if (options.shouldIgnore(event)) {
      return false;
    }
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      options.onHistory();
      return true;
    }
    if (isStandaloneShiftKey(event)) {
      pendingOrderHistoryShift = true;
      return true;
    }
    return false;
  }

  function handleKeyup(event: KeyboardEvent) {
    if (!isStandaloneShiftKey(event)) {
      reset();
      return false;
    }
    if (!pendingOrderHistoryShift) {
      return false;
    }
    reset();
    if (options.shouldIgnore(event)) {
      return false;
    }
    event.preventDefault();
    options.onOrderHistory();
    return true;
  }

  return { handleKeydown, handleKeyup, reset };
}
