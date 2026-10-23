import type { VbenFormSchema } from '#/adapter/form';

import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

type PressEnterHandler = (event: KeyboardEvent) => void;
type ComponentProps = Record<string, any>;
type EnterFocusOptions = {
  onLastInputEnter?: (event: KeyboardEvent) => void;
};

const INPUT_COMPONENTS = new Set(['Input']);

function isEnabledInputField(schema: VbenFormSchema) {
  if (!INPUT_COMPONENTS.has(String(schema.component))) {
    return false;
  }
  if (typeof schema.componentProps === 'function') {
    return true;
  }
  const componentProps = schema.componentProps as ComponentProps | undefined;
  return componentProps?.disabled !== true;
}

function withEnterFocusHandler(
  props: ComponentProps = {},
  options: EnterFocusOptions = {},
) {
  const componentProps = { ...props };
  const originalOnPressEnter = componentProps.onPressEnter as
    | PressEnterHandler
    | undefined;
  componentProps.onPressEnter = (event: KeyboardEvent) => {
    originalOnPressEnter?.(event);
    const enterFocusResult = focusNextInputOnEnter(event);
    if (enterFocusResult === 'last-input') {
      options.onLastInputEnter?.(event);
    }
  };
  return componentProps;
}

function withEnterFocusComponentProps(
  componentProps: VbenFormSchema['componentProps'],
  options: EnterFocusOptions = {},
) {
  if (typeof componentProps === 'function') {
    const getComponentProps = componentProps as (
      ...args: any[]
    ) => ComponentProps;
    return (...args: any[]) =>
      withEnterFocusHandler(getComponentProps(...args) || {}, options);
  }
  return withEnterFocusHandler(
    (componentProps as ComponentProps) || {},
    options,
  );
}

export function attachPurchaseInputEnterFocus<T extends VbenFormSchema[]>(
  schema: T,
  options: EnterFocusOptions = {},
): T {
  for (const item of schema) {
    if (!isEnabledInputField(item)) {
      continue;
    }
    item.componentProps = withEnterFocusComponentProps(
      item.componentProps,
      options,
    );
  }
  return schema;
}
