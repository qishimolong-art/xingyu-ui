const CREATE_SHORTCUT_KEY_ALIASES = new Set(['Insert', 'Help']);

export function isCreateShortcutKey(event: KeyboardEvent) {
  const legacyKeyCode = event.keyCode || event.which;

  return (
    CREATE_SHORTCUT_KEY_ALIASES.has(event.key) ||
    event.code === 'Insert' ||
    legacyKeyCode === 45 ||
    (event.key === 'Enter' &&
      typeof event.getModifierState === 'function' &&
      event.getModifierState('Fn'))
  );
}

export function isQueryShortcutKey(event: KeyboardEvent) {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    event.key === 'Enter'
  );
}

function isElementConnectedToDocument(element: HTMLElement) {
  if (typeof document === 'undefined') {
    return true;
  }
  return document.documentElement.contains(element);
}

function hasHiddenShortcutClass(element: HTMLElement) {
  return [...element.classList].some(
    (className) => className === 'hidden' || /^ant-.+-hidden$/.test(className),
  );
}

function isElementStyleHidden(element: HTMLElement) {
  if (typeof window === 'undefined') {
    return false;
  }
  const style = window.getComputedStyle(element);

  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    style.pointerEvents === 'none'
  );
}

function isShortcutElementHidden(element: HTMLElement) {
  return (
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true' ||
    hasHiddenShortcutClass(element) ||
    isElementStyleHidden(element)
  );
}

function isVisibleShortcutElement(element: HTMLElement) {
  if (!isElementConnectedToDocument(element)) {
    return false;
  }

  let current: HTMLElement | null = element;
  while (current) {
    if (isShortcutElementHidden(current)) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

function isVisibleShortcutOverlayElement(element: HTMLElement) {
  return isVisibleShortcutElement(element);
}

function getEditableShortcutTarget(target: HTMLElement) {
  if (
    target.matches(
      'input, textarea, select, button, a, [role="button"], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  ) {
    return target;
  }

  return target.closest<HTMLElement>(
    'input, textarea, select, button, a, [role="button"], .ant-select, .ant-picker, .ant-input, .ant-input-number, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
  );
}

function getGlobalShortcutInputTarget(target: HTMLElement) {
  if (
    target.matches(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  ) {
    return target;
  }

  return target.closest<HTMLElement>(
    'input, textarea, select, .ant-select, .ant-picker, .ant-input, .ant-input-number, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
  );
}

export function hasOpenDialogOverlay() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const selectors = [
    '.ant-modal-wrap',
    '.ant-drawer',
    '[role="dialog"]',
    '[aria-modal="true"]',
  ];

  return selectors.some((selector) => {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    return [...nodes].some((node) => {
      if (node.classList.contains('ant-modal-wrap')) {
        return isVisibleShortcutOverlayElement(node);
      }

      const wrap = node.closest('.ant-modal-wrap');
      if (
        wrap instanceof HTMLElement &&
        isVisibleShortcutOverlayElement(wrap)
      ) {
        return true;
      }

      return isVisibleShortcutOverlayElement(node);
    });
  });
}

export function isEditableEnterTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (!isVisibleShortcutElement(target)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableTarget = getEditableShortcutTarget(target);
  return Boolean(editableTarget && isVisibleShortcutElement(editableTarget));
}

function isGlobalShortcutInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (!isVisibleShortcutElement(target)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const inputTarget = getGlobalShortcutInputTarget(target);
  return Boolean(inputTarget && isVisibleShortcutElement(inputTarget));
}

export function isMultilineEnterTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.matches('textarea') ||
    !!target.closest('textarea, .ant-input-textarea')
  );
}

export function shouldIgnoreGlobalShortcut(event: KeyboardEvent) {
  return (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isGlobalShortcutInputTarget(event.target) ||
    hasOpenDialogOverlay()
  );
}

export function blurInputOnEnter(event: KeyboardEvent) {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isMultilineEnterTarget(event.target)
  ) {
    return;
  }
  event.preventDefault();
  const target = event.target as HTMLInputElement;
  if (target instanceof HTMLElement) {
    target.blur();
  }
}

export const blurOnEnter = blurInputOnEnter;

type SearchFormSubmitter = () => unknown;

const SEARCH_FORM_INPUT_TYPES = new Set([
  '',
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function blurInputIfStillActive(target: HTMLInputElement) {
  if (typeof document === 'undefined' || document.activeElement === target) {
    target.blur();
  }
}

function isSearchFormEnterInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }
  if (
    !SEARCH_FORM_INPUT_TYPES.has(target.type) ||
    target.closest('textarea, .ant-input-textarea, .ant-picker, .ant-select')
  ) {
    return false;
  }
  return true;
}

export function submitSearchFormOnEnterAndBlur(
  event: KeyboardEvent,
  submitForm: SearchFormSubmitter,
) {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isMultilineEnterTarget(event.target) ||
    !isSearchFormEnterInputTarget(event.target)
  ) {
    return false;
  }

  const target = event.target as HTMLInputElement;
  event.preventDefault();
  event.stopPropagation();

  try {
    const result = submitForm();
    if (isPromiseLike(result)) {
      void Promise.resolve(result)
        .finally(() => blurInputIfStillActive(target))
        .catch(() => undefined);
    } else {
      blurInputIfStillActive(target);
    }
  } catch (error) {
    blurInputIfStillActive(target);
    throw error;
  }

  return true;
}

export type EnterFocusResult = false | 'last-input' | true;

const FOCUSABLE_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'number',
]);

function getActiveInput(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) {
    return target;
  }
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLInputElement ? activeElement : null;
}

function isHiddenElement(element: HTMLElement) {
  if (
    element.hidden ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.getClientRects().length === 0
  ) {
    return true;
  }
  const style = window.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden';
}

function isFocusableInput(input: HTMLInputElement) {
  if (
    !FOCUSABLE_INPUT_TYPES.has(input.type) ||
    input.disabled ||
    input.readOnly ||
    input.getAttribute('aria-disabled') === 'true' ||
    input.getAttribute('aria-hidden') === 'true' ||
    input.tabIndex < 0
  ) {
    return false;
  }
  if (
    input.closest(
      'textarea, .ant-input-textarea, .ant-select, .ant-picker, [hidden], [aria-hidden="true"]',
    )
  ) {
    return false;
  }
  if (isHiddenElement(input)) {
    return false;
  }
  return true;
}

function getFocusScope(input: HTMLInputElement) {
  return (
    input.closest('form') ||
    input.closest('.ant-form, .vben-form') ||
    input.closest('.ant-modal, .ant-drawer, [role="dialog"]') ||
    document.body
  );
}

export function focusNextInputOnEnter(event: KeyboardEvent): EnterFocusResult {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isMultilineEnterTarget(event.target)
  ) {
    return false;
  }
  const currentInput = getActiveInput(event.target);
  if (!currentInput || !isFocusableInput(currentInput)) {
    return false;
  }
  event.preventDefault();
  currentInput.blur();

  const scope = getFocusScope(currentInput);
  const inputs = [...scope.querySelectorAll<HTMLInputElement>('input')].filter(
    isFocusableInput,
  );
  const currentIndex = inputs.indexOf(currentInput);
  const nextInput = currentIndex >= 0 ? inputs[currentIndex + 1] : undefined;
  if (!nextInput) {
    return 'last-input';
  }
  nextInput.focus();
  try {
    nextInput.select();
  } catch {
    // Some input types can receive focus but do not support text selection.
  }
  return true;
}

type EditableFormControl = {
  focusTarget: HTMLElement;
  root: HTMLElement;
};

type EnterFocusOptions = {
  onLastControlEnter?: (event: KeyboardEvent) => void;
};

const EDITABLE_FORM_CONTROL_SELECTOR = [
  'input',
  'select',
  '.ant-input-number',
  '.ant-picker',
  '.ant-select',
].join(',');

const OPEN_FORM_CONTROL_POPUP_SELECTOR = [
  '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
  '.ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)',
].join(',');

function containsNode(scope: ParentNode, node: Node) {
  if (scope instanceof Document) {
    return scope.documentElement.contains(node);
  }
  return scope instanceof HTMLElement && scope.contains(node);
}

function isReadonlyInputType(input: HTMLInputElement) {
  return input.type === 'hidden' || input.type === 'file';
}

function hasDisabledControlState(element: HTMLElement) {
  return (
    element.getAttribute('aria-disabled') === 'true' ||
    element.classList.contains('ant-select-disabled') ||
    element.classList.contains('ant-picker-disabled') ||
    element.classList.contains('ant-input-number-disabled')
  );
}

function isSkippedFormControl(element: HTMLElement) {
  return Boolean(
    element.closest(
      'textarea, .ant-input-textarea, .vxe-table, .vxe-grid, [data-erp-enter-focus-skip="true"]',
    ),
  );
}

function normalizeEditableFormControlRoot(element: HTMLElement) {
  return (
    element.closest<HTMLElement>(
      '.ant-select, .ant-picker, .ant-input-number',
    ) || element.closest<HTMLElement>('input, select')
  );
}

function getEditableFormControlFocusTarget(root: HTMLElement) {
  if (root.matches('.ant-select')) {
    return (
      root.querySelector<HTMLElement>('.ant-select-selection-search-input') ||
      root.querySelector<HTMLElement>('.ant-select-selector') ||
      root
    );
  }
  if (root.matches('.ant-picker, .ant-input-number')) {
    return root.querySelector<HTMLElement>('input') || root;
  }
  return root;
}

function isEditableFormControlRoot(root: HTMLElement) {
  if (isSkippedFormControl(root) || isHiddenElement(root)) {
    return false;
  }
  if (hasDisabledControlState(root)) {
    return false;
  }
  if (root instanceof HTMLInputElement) {
    return (
      !isReadonlyInputType(root) &&
      !root.disabled &&
      !root.readOnly &&
      root.getAttribute('aria-disabled') !== 'true' &&
      root.tabIndex >= 0
    );
  }
  if (root instanceof HTMLSelectElement) {
    return !root.disabled && root.getAttribute('aria-disabled') !== 'true';
  }
  const input = root.querySelector<HTMLInputElement>('input');
  if (input) {
    return (
      !isReadonlyInputType(input) &&
      !input.disabled &&
      input.getAttribute('aria-disabled') !== 'true'
    );
  }
  return root.tabIndex >= 0 || root.matches('.ant-select, .ant-picker');
}

function getEditableFormControls(scope: ParentNode): EditableFormControl[] {
  const roots = new Set<HTMLElement>();
  const controls: EditableFormControl[] = [];
  const candidates = [
    ...scope.querySelectorAll<HTMLElement>(EDITABLE_FORM_CONTROL_SELECTOR),
  ];

  for (const candidate of candidates) {
    const root = normalizeEditableFormControlRoot(candidate);
    if (!root || roots.has(root) || !isEditableFormControlRoot(root)) {
      continue;
    }
    roots.add(root);
    controls.push({
      focusTarget: getEditableFormControlFocusTarget(root),
      root,
    });
  }

  return controls;
}

function getEditableFormControlFromTarget(
  target: EventTarget | null,
  scope: ParentNode,
) {
  const targetElement =
    target instanceof HTMLElement ? target : document.activeElement;
  if (!(targetElement instanceof HTMLElement)) {
    return;
  }
  const root = normalizeEditableFormControlRoot(targetElement);
  if (!root || !containsNode(scope, root) || !isEditableFormControlRoot(root)) {
    return;
  }
  return root;
}

function focusEditableFormControl(control: EditableFormControl) {
  control.focusTarget.focus({ preventScroll: true });
  if (control.focusTarget instanceof HTMLInputElement) {
    try {
      control.focusTarget.select();
    } catch {
      // Some input types can receive focus but do not support text selection.
    }
  }
}

function isFocusableEditableInput(input: HTMLInputElement) {
  return (
    !isReadonlyInputType(input) &&
    !input.disabled &&
    !input.readOnly &&
    input.getAttribute('aria-disabled') !== 'true' &&
    input.tabIndex >= 0 &&
    !isHiddenElement(input)
  );
}

export function focusFirstEditableInput(
  scope: ParentNode | null | undefined,
  selector = 'input',
) {
  const input = scope
    ? [...scope.querySelectorAll<HTMLInputElement>(selector)].find(
        isFocusableEditableInput,
      )
    : undefined;
  if (!input) {
    return false;
  }
  input.focus({ preventScroll: true });
  try {
    input.select();
  } catch {
    // Some input types can receive focus but do not support text selection.
  }
  return true;
}

export function queueAfterEditableControlRender(callback: () => void) {
  if (
    typeof window === 'undefined' ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    callback();
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}

export function hasOpenFormControlPopup() {
  if (typeof document === 'undefined') {
    return false;
  }
  return [
    ...document.querySelectorAll<HTMLElement>(OPEN_FORM_CONTROL_POPUP_SELECTOR),
  ].some((element) => isVisibleShortcutElement(element));
}

export function focusFirstEditableFormControl(scope: ParentNode) {
  const [firstControl] = getEditableFormControls(scope);
  if (!firstControl) {
    return false;
  }
  focusEditableFormControl(firstControl);
  return true;
}

export function focusNextEditableFormControlOnEnter(
  event: KeyboardEvent,
  scope: ParentNode,
  options: EnterFocusOptions = {},
): EnterFocusResult {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isMultilineEnterTarget(event.target) ||
    hasOpenFormControlPopup()
  ) {
    return false;
  }

  const currentRoot = getEditableFormControlFromTarget(event.target, scope);
  if (!currentRoot) {
    return false;
  }

  const controls = getEditableFormControls(scope);
  const currentIndex = controls.findIndex(
    (control) => control.root === currentRoot,
  );
  if (currentIndex < 0) {
    return false;
  }

  event.preventDefault();
  controls[currentIndex]?.focusTarget.blur();

  const nextControl = controls[currentIndex + 1];
  if (!nextControl) {
    options.onLastControlEnter?.(event);
    return 'last-input';
  }

  focusEditableFormControl(nextControl);
  return true;
}

export function isFormInputTarget(target: EventTarget | null) {
  return isEditableEnterTarget(target);
}

export function shouldConfirmOnEnter(event: KeyboardEvent, enabled: boolean) {
  return (
    enabled &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.key === 'Enter' &&
    !isEditableEnterTarget(event.target)
  );
}
