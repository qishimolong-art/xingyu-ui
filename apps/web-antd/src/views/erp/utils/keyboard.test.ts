import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasOpenFormControlPopup,
  hasOpenDialogOverlay,
  focusFirstEditableInput,
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  focusNextInputOnEnter,
  queueAfterEditableControlRender,
  isCreateShortcutKey,
  isQueryShortcutKey,
  shouldIgnoreGlobalShortcut,
  submitSearchFormOnEnterAndBlur,
} from './keyboard';

function buildKeyboardEvent({
  fnKey = false,
  isComposing,
  keyCode,
  target,
  which,
  ...init
}: KeyboardEventInit & {
  fnKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  target?: EventTarget;
  which?: number;
} = {}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });

  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { value: keyCode });
  }
  if (which !== undefined) {
    Object.defineProperty(event, 'which', { value: which });
  }
  if (fnKey) {
    Object.defineProperty(event, 'getModifierState', {
      value: (key: string) => key === 'Fn',
    });
  }
  if (isComposing !== undefined) {
    Object.defineProperty(event, 'isComposing', { value: isComposing });
  }
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }

  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ERP keyboard shortcut rules', () => {
  it('matches all supported create shortcut key forms', () => {
    expect(isCreateShortcutKey(buildKeyboardEvent({ key: 'Insert' }))).toBe(
      true,
    );
    expect(isCreateShortcutKey(buildKeyboardEvent({ key: 'Help' }))).toBe(true);
    expect(
      isCreateShortcutKey(
        buildKeyboardEvent({ key: 'Unidentified', keyCode: 45 }),
      ),
    ).toBe(true);
    expect(
      isCreateShortcutKey(
        buildKeyboardEvent({ key: 'Unidentified', which: 45 }),
      ),
    ).toBe(true);
    expect(
      isCreateShortcutKey(buildKeyboardEvent({ fnKey: true, key: 'Enter' })),
    ).toBe(true);
  });

  it('does not treat regular Enter or i as create shortcuts', () => {
    expect(isCreateShortcutKey(buildKeyboardEvent({ key: 'Enter' }))).toBe(
      false,
    );
    expect(isCreateShortcutKey(buildKeyboardEvent({ key: 'i' }))).toBe(false);
  });

  it('uses Ctrl + Enter as the query shortcut', () => {
    expect(
      isQueryShortcutKey(buildKeyboardEvent({ ctrlKey: true, key: 'Enter' })),
    ).toBe(true);
    expect(isQueryShortcutKey(buildKeyboardEvent({ key: 'Enter' }))).toBe(
      false,
    );
    expect(
      isQueryShortcutKey(
        buildKeyboardEvent({ ctrlKey: true, key: 'Enter', shiftKey: true }),
      ),
    ).toBe(false);
  });

  it('ignores global shortcuts from editable and Ant Design control targets', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const contenteditable = document.createElement('div');
    const antSelect = document.createElement('div');
    const antSelectInner = document.createElement('span');
    const antPicker = document.createElement('div');
    const antPickerInner = document.createElement('span');
    const antInput = document.createElement('div');
    const antInputInner = document.createElement('span');
    const antInputNumber = document.createElement('div');
    const antInputNumberInner = document.createElement('button');

    contenteditable.contentEditable = 'true';
    antSelect.className = 'ant-select';
    antPicker.className = 'ant-picker';
    antInput.className = 'ant-input';
    antInputNumber.className = 'ant-input-number';
    antSelect.append(antSelectInner);
    antPicker.append(antPickerInner);
    antInput.append(antInputInner);
    antInputNumber.append(antInputNumberInner);
    document.body.append(
      input,
      textarea,
      select,
      contenteditable,
      antSelect,
      antPicker,
      antInput,
      antInputNumber,
    );

    for (const target of [
      input,
      textarea,
      select,
      contenteditable,
      antSelectInner,
      antPickerInner,
      antInputInner,
      antInputNumberInner,
    ]) {
      expect(
        shouldIgnoreGlobalShortcut(
          buildKeyboardEvent({ key: 'Insert', target }),
        ),
      ).toBe(true);
    }
  });

  it('does not ignore global shortcuts from visible navigation and action targets', () => {
    const button = document.createElement('button');
    const link = document.createElement('a');
    const roleButton = document.createElement('div');

    roleButton.setAttribute('role', 'button');
    document.body.append(button, link, roleButton);

    for (const target of [button, link, roleButton]) {
      expect(
        shouldIgnoreGlobalShortcut(
          buildKeyboardEvent({ key: 'Insert', target }),
        ),
      ).toBe(false);
    }
  });

  it('does not ignore global shortcuts from stale hidden or detached editable targets', () => {
    const detachedInput = document.createElement('input');
    const hiddenInput = document.createElement('input');
    const hiddenWrapper = document.createElement('div');
    const wrappedInput = document.createElement('input');
    const hiddenAntSelect = document.createElement('div');
    const hiddenAntSelectInner = document.createElement('span');

    hiddenInput.style.display = 'none';
    hiddenWrapper.hidden = true;
    hiddenWrapper.append(wrappedInput);
    hiddenAntSelect.className = 'ant-select ant-select-dropdown-hidden';
    hiddenAntSelect.append(hiddenAntSelectInner);
    document.body.append(hiddenInput, hiddenWrapper, hiddenAntSelect);

    for (const target of [
      detachedInput,
      hiddenInput,
      wrappedInput,
      hiddenAntSelectInner,
    ]) {
      expect(
        shouldIgnoreGlobalShortcut(
          buildKeyboardEvent({ key: 'Insert', target }),
        ),
      ).toBe(false);
    }
  });

  it('detects open dialog overlays and ignores global shortcuts under them', () => {
    expect(hasOpenDialogOverlay()).toBe(false);

    const modal = document.createElement('div');
    modal.className = 'ant-modal-wrap';
    document.body.append(modal);

    expect(hasOpenDialogOverlay()).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(buildKeyboardEvent({ key: 'Insert' })),
    ).toBe(true);
  });

  it('does not detect hidden dialog overlays as open', () => {
    const displayHiddenModal = document.createElement('div');
    const ariaHiddenDialog = document.createElement('div');
    const classHiddenDrawer = document.createElement('div');

    displayHiddenModal.className = 'ant-modal-wrap';
    displayHiddenModal.style.display = 'none';
    ariaHiddenDialog.setAttribute('role', 'dialog');
    ariaHiddenDialog.setAttribute('aria-hidden', 'true');
    classHiddenDrawer.className = 'ant-drawer ant-drawer-hidden';
    document.body.append(
      displayHiddenModal,
      ariaHiddenDialog,
      classHiddenDrawer,
    );

    expect(hasOpenDialogOverlay()).toBe(false);
    expect(
      shouldIgnoreGlobalShortcut(buildKeyboardEvent({ key: 'Insert' })),
    ).toBe(false);
  });

  it('ignores prevented, repeated, composing, and modifier-conflicted events', () => {
    const prevented = buildKeyboardEvent({ key: 'Insert' });
    prevented.preventDefault();

    expect(shouldIgnoreGlobalShortcut(prevented)).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(
        buildKeyboardEvent({ key: 'Insert', repeat: true }),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(
        buildKeyboardEvent({ isComposing: true, key: 'Insert' }),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(
        buildKeyboardEvent({ ctrlKey: true, key: 'Insert' }),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(
        buildKeyboardEvent({ altKey: true, key: 'Insert' }),
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGlobalShortcut(
        buildKeyboardEvent({ key: 'Insert', metaKey: true }),
      ),
    ).toBe(true);
  });

  it('reports whether Enter moved focus to another input', () => {
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    document.body.append(firstInput, secondInput);
    firstInput.focus();

    const firstEnter = buildKeyboardEvent({
      key: 'Enter',
      target: firstInput,
    });

    expect(focusNextInputOnEnter(firstEnter)).toBe(true);
    expect(firstEnter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(secondInput);

    const lastEnter = buildKeyboardEvent({
      key: 'Enter',
      target: secondInput,
    });

    expect(focusNextInputOnEnter(lastEnter)).toBe('last-input');
    expect(lastEnter.defaultPrevented).toBe(true);
  });

  it('submits and blurs the active search input after Enter search completes', async () => {
    const input = document.createElement('input');
    const submitForm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          window.setTimeout(resolve);
        }),
    );
    document.body.append(input);
    input.focus();

    const enter = buildKeyboardEvent({
      key: 'Enter',
      target: input,
    });

    expect(submitSearchFormOnEnterAndBlur(enter, submitForm)).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(submitForm).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);

    await new Promise((resolve) => window.setTimeout(resolve));
    await Promise.resolve();

    expect(document.activeElement).not.toBe(input);
  });

  it('does not blur a new focus target when Enter search finishes later', async () => {
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    let resolveSubmit!: () => void;
    const submitForm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    document.body.append(firstInput, secondInput);
    firstInput.focus();

    submitSearchFormOnEnterAndBlur(
      buildKeyboardEvent({ key: 'Enter', target: firstInput }),
      submitForm,
    );
    secondInput.focus();
    resolveSubmit();
    await Promise.resolve();

    expect(document.activeElement).toBe(secondInput);
  });

  it('blurs the search input even when Enter search rejects', async () => {
    const input = document.createElement('input');
    let rejectSubmit!: (error: Error) => void;
    const submitForm = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmit = reject;
        }),
    );
    document.body.append(input);
    input.focus();

    submitSearchFormOnEnterAndBlur(
      buildKeyboardEvent({ key: 'Enter', target: input }),
      submitForm,
    );
    rejectSubmit(new Error('search failed'));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).not.toBe(input);
  });

  it('ignores non-plain search Enter targets', () => {
    const input = document.createElement('input');
    const picker = document.createElement('div');
    const pickerInput = document.createElement('input');
    const submitForm = vi.fn();

    picker.className = 'ant-picker';
    picker.append(pickerInput);
    document.body.append(input, picker);

    expect(
      submitSearchFormOnEnterAndBlur(
        buildKeyboardEvent({
          isComposing: true,
          key: 'Enter',
          target: input,
        }),
        submitForm,
      ),
    ).toBe(false);
    expect(
      submitSearchFormOnEnterAndBlur(
        buildKeyboardEvent({ key: 'Enter', repeat: true, target: input }),
        submitForm,
      ),
    ).toBe(false);
    expect(
      submitSearchFormOnEnterAndBlur(
        buildKeyboardEvent({ key: 'Enter', target: pickerInput }),
        submitForm,
      ),
    ).toBe(false);
    expect(
      submitSearchFormOnEnterAndBlur(
        buildKeyboardEvent({ ctrlKey: true, key: 'Enter', target: input }),
        submitForm,
      ),
    ).toBe(false);
    expect(submitForm).not.toHaveBeenCalled();
  });

  it('focuses the first editable form control in a scope', () => {
    const scope = document.createElement('div');
    const disabledInput = document.createElement('input');
    const antSelect = document.createElement('div');
    const selectInput = document.createElement('input');

    disabledInput.disabled = true;
    antSelect.className = 'ant-select';
    selectInput.className = 'ant-select-selection-search-input';
    antSelect.append(selectInput);
    scope.append(disabledInput, antSelect);
    document.body.append(scope);

    expect(focusFirstEditableFormControl(scope)).toBe(true);
    expect(document.activeElement).toBe(selectInput);
  });

  it('focuses the first editable input in a scoped detail table selector', () => {
    const scope = document.createElement('div');
    const disabledInput = document.createElement('input');
    const readonlyInput = document.createElement('input');
    const hiddenInput = document.createElement('input');
    const firstCountInput = document.createElement('input');
    const secondCountInput = document.createElement('input');

    disabledInput.disabled = true;
    readonlyInput.readOnly = true;
    hiddenInput.type = 'hidden';
    firstCountInput.setAttribute('data-count-input', 'true');
    firstCountInput.value = '3';
    secondCountInput.setAttribute('data-count-input', 'true');
    scope.append(
      disabledInput,
      readonlyInput,
      hiddenInput,
      firstCountInput,
      secondCountInput,
    );
    document.body.append(scope);

    expect(focusFirstEditableInput(scope, '[data-count-input="true"]')).toBe(
      true,
    );
    expect(document.activeElement).toBe(firstCountInput);
    expect(firstCountInput.selectionStart).toBe(0);
    expect(firstCountInput.selectionEnd).toBe(1);
  });

  it('queues editable control focus after two render frames', () => {
    const callbacks: FrameRequestCallback[] = [];
    const focusCallback = vi.fn();

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    queueAfterEditableControlRender(focusCallback);

    expect(focusCallback).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    callbacks.shift()?.(0);

    expect(focusCallback).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);

    callbacks.shift()?.(16);

    expect(focusCallback).toHaveBeenCalledTimes(1);
  });

  it('moves Enter focus to the next editable form control while skipping unavailable controls', () => {
    const scope = document.createElement('div');
    const firstInput = document.createElement('input');
    const disabledInput = document.createElement('input');
    const readonlyInput = document.createElement('input');
    const hiddenInput = document.createElement('input');
    const numberControl = document.createElement('div');
    const numberInput = document.createElement('input');

    disabledInput.disabled = true;
    readonlyInput.readOnly = true;
    hiddenInput.style.display = 'none';
    numberControl.className = 'ant-input-number';
    numberControl.append(numberInput);
    scope.append(
      firstInput,
      disabledInput,
      readonlyInput,
      hiddenInput,
      numberControl,
    );
    document.body.append(scope);
    firstInput.focus();

    const enter = buildKeyboardEvent({
      key: 'Enter',
      target: firstInput,
    });

    expect(focusNextEditableFormControlOnEnter(enter, scope)).toBe(true);
    expect(enter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(numberInput);
  });

  it('recognizes Ant Design select and date picker controls in Enter focus order', () => {
    const scope = document.createElement('div');
    const antSelect = document.createElement('div');
    const selectInput = document.createElement('input');
    const picker = document.createElement('div');
    const pickerInput = document.createElement('input');

    antSelect.className = 'ant-select';
    selectInput.className = 'ant-select-selection-search-input';
    picker.className = 'ant-picker';
    antSelect.append(selectInput);
    picker.append(pickerInput);
    scope.append(antSelect, picker);
    document.body.append(scope);
    selectInput.focus();

    const enter = buildKeyboardEvent({
      key: 'Enter',
      target: selectInput,
    });

    expect(focusNextEditableFormControlOnEnter(enter, scope)).toBe(true);
    expect(document.activeElement).toBe(pickerInput);
  });

  it('does not intercept Enter while a select or date popup is open', () => {
    const scope = document.createElement('div');
    const firstInput = document.createElement('input');
    const secondInput = document.createElement('input');
    const dropdown = document.createElement('div');

    dropdown.className = 'ant-select-dropdown';
    scope.append(firstInput, secondInput);
    document.body.append(scope, dropdown);
    firstInput.focus();

    expect(hasOpenFormControlPopup()).toBe(true);

    const enter = buildKeyboardEvent({
      key: 'Enter',
      target: firstInput,
    });

    expect(focusNextEditableFormControlOnEnter(enter, scope)).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(firstInput);
  });

  it('ignores multiline, composing, repeated, and modifier Enter for form focus traversal', () => {
    const scope = document.createElement('div');
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.append(scope);
    scope.append(input, textarea);
    input.focus();

    expect(
      focusNextEditableFormControlOnEnter(
        buildKeyboardEvent({ isComposing: true, key: 'Enter', target: input }),
        scope,
      ),
    ).toBe(false);
    expect(
      focusNextEditableFormControlOnEnter(
        buildKeyboardEvent({ key: 'Enter', repeat: true, target: input }),
        scope,
      ),
    ).toBe(false);
    expect(
      focusNextEditableFormControlOnEnter(
        buildKeyboardEvent({ ctrlKey: true, key: 'Enter', target: input }),
        scope,
      ),
    ).toBe(false);
    expect(
      focusNextEditableFormControlOnEnter(
        buildKeyboardEvent({ key: 'Enter', target: textarea }),
        scope,
      ),
    ).toBe(false);
  });
});
