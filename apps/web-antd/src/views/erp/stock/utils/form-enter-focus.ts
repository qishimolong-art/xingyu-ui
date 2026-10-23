import type { VbenFormSchema } from '#/adapter/form';

import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

type ComponentProps = Record<string, any>;

function withEnterFocusHandler(props: ComponentProps) {
  const originalOnPressEnter = props.onPressEnter;
  return {
    ...props,
    onPressEnter: (event: KeyboardEvent) => {
      if (typeof originalOnPressEnter === 'function') {
        originalOnPressEnter(event);
      }
      focusNextInputOnEnter(event);
    },
  };
}

function withEnterFocusComponentProps(
  componentProps: VbenFormSchema['componentProps'],
) {
  if (typeof componentProps === 'function') {
    const getComponentProps = componentProps as (
      ...args: any[]
    ) => ComponentProps;
    return (...args: any[]) =>
      withEnterFocusHandler(getComponentProps(...args) || {});
  }
  return withEnterFocusHandler((componentProps as ComponentProps) || {});
}

export function attachStockInputEnterFocus<T extends VbenFormSchema[]>(
  schemas: T,
): T {
  for (const schema of schemas) {
    if (schema.component !== 'Input' && schema.component !== 'InputNumber') {
      continue;
    }
    schema.componentProps = withEnterFocusComponentProps(schema.componentProps);
  }
  return schemas;
}
