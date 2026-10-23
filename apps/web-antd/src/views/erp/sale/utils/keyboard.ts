export {
  blurOnEnter,
  focusNextInputOnEnter,
  isEditableEnterTarget,
  shouldConfirmOnEnter,
} from '#/views/erp/utils/keyboard';

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

function withEnterBlurComponentProps(
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

export function withEnterBlurInputSchemas<T extends VbenFormSchema>(
  schemas: T[],
): T[] {
  return schemas.map((schema) => {
    if (schema.component !== 'Input' && schema.component !== 'InputNumber') {
      return schema;
    }
    return {
      ...schema,
      componentProps: withEnterBlurComponentProps(schema.componentProps),
    };
  });
}
