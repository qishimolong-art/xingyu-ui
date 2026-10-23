import { onBeforeUnmount, ref } from 'vue';

import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

export function useCustomerFormKeyboard(
  editable: () => boolean,
  ready: () => boolean,
) {
  const formScope = ref<HTMLElement>();
  let opened = false;
  let done = false;
  let sequence = 0;
  function queueFocus() {
    const current = sequence;
    queueAfterEditableControlRender(() => {
      if (
        current !== sequence ||
        !opened ||
        done ||
        !editable() ||
        !ready() ||
        !formScope.value
      )
        return;
      done = focusFirstEditableFormControl(formScope.value);
    });
  }
  function beginOpen() {
    sequence += 1;
    done = false;
    opened = false;
  }
  function endOpen() {
    sequence += 1;
    opened = false;
  }
  function onOpened() {
    opened = true;
    queueFocus();
  }
  function handleFormEnter(event: KeyboardEvent) {
    const scope = formScope.value;
    const target = event.target;
    if (
      !scope ||
      !editable() ||
      !ready() ||
      !(target instanceof HTMLElement) ||
      target.closest('[role="dialog"]') !== scope.closest('[role="dialog"]')
    )
      return;
    if (
      focusNextEditableFormControlOnEnter(event, scope, {
        onLastControlEnter: () => target.focus({ preventScroll: true }),
      })
    )
      event.stopPropagation();
  }
  onBeforeUnmount(endOpen);
  return {
    beginOpen,
    endOpen,
    formScope,
    handleFormEnter,
    onOpened,
    queueFocus,
  };
}
