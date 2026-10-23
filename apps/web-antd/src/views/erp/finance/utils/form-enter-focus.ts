import type { VbenFormSchema } from '#/adapter/form';

import type { Ref } from 'vue';

import { nextTick } from 'vue';

import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  focusNextInputOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

type PressEnterHandler = (event: KeyboardEvent) => void;

const INPUT_COMPONENTS = new Set(['Input', 'InputNumber']);

function isEnabledInputField(schema: VbenFormSchema) {
  if (!INPUT_COMPONENTS.has(String(schema.component))) {
    return false;
  }
  const componentProps = schema.componentProps as
    | Record<string, any>
    | undefined;
  return (
    componentProps?.disabled !== true &&
    componentProps?.readonly !== true &&
    componentProps?.readOnly !== true
  );
}

export function attachFinanceInputEnterFocus<T extends VbenFormSchema[]>(
  schema: T,
): T {
  for (const item of schema) {
    if (!isEnabledInputField(item)) {
      continue;
    }
    const componentProps = {
      ...(item.componentProps as Record<string, any> | undefined),
    };
    const originalOnPressEnter = componentProps.onPressEnter as
      | PressEnterHandler
      | undefined;
    componentProps.onPressEnter = (event: KeyboardEvent) => {
      originalOnPressEnter?.(event);
      focusNextInputOnEnter(event);
    };
    item.componentProps = componentProps;
  }
  return schema;
}

export function handleFinanceInputEnterFocus(event: KeyboardEvent) {
  focusNextInputOnEnter(event);
}

type FocusScopeRef = Ref<HTMLElement | null | undefined>;

export function focusFirstFinanceEditableFormControl(
  scopeRef: FocusScopeRef,
  canFocus: () => boolean,
) {
  const scope = scopeRef.value;
  if (!scope || !canFocus()) {
    return false;
  }
  return focusFirstEditableFormControl(scope);
}

export function queueFocusFirstFinanceEditableFormControl(
  scopeRef: FocusScopeRef,
  canFocus: () => boolean,
  isCurrent: () => boolean = () => true,
) {
  void nextTick(() => {
    queueAfterEditableControlRender(() => {
      if (!isCurrent()) {
        return;
      }
      focusFirstFinanceEditableFormControl(scopeRef, canFocus);
    });
  });
}

export function handleFinanceEditableFormEnter(
  event: KeyboardEvent,
  scopeRef: FocusScopeRef,
  canFocus: () => boolean,
  onLastControlEnter: (event: KeyboardEvent) => void,
) {
  const scope = scopeRef.value;
  if (!scope || !canFocus()) {
    return false;
  }
  return focusNextEditableFormControlOnEnter(event, scope, {
    onLastControlEnter,
  });
}
