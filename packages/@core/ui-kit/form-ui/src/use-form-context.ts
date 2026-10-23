import type { ZodRawShape } from 'zod';

import type { ComputedRef } from 'vue';

import type { ExtendedFormApi, FormActions, VbenFormProps } from './types';

import { computed, unref, useSlots } from 'vue';

import { createContext } from '@vben-core/shadcn-ui';
import { get, isString, set } from '@vben-core/shared/utils';

import { useForm } from 'vee-validate';
import { object, ZodIntersection, ZodNumber, ZodObject, ZodString } from 'zod';
import { getDefaultsForSchema } from 'zod-defaults';

type ExtendFormProps = VbenFormProps & { formApi?: ExtendedFormApi };

export const [injectFormProps, provideFormProps] =
  createContext<[ComputedRef<ExtendFormProps> | ExtendFormProps, FormActions]>(
    'VbenFormProps',
  );

export const [injectComponentRefMap, provideComponentRefMap] =
  createContext<Map<string, unknown>>('ComponentRefMap');

export function useFormInitial(
  props: ComputedRef<VbenFormProps> | VbenFormProps,
) {
  const slots = useSlots();
  const initialValues = generateInitialValues(unref(props).schema || []);

  const form = useForm({
    ...(Object.keys(initialValues)?.length ? { initialValues } : {}),
  });

  const delegatedSlots = computed(() => {
    const resultSlots: string[] = [];

    for (const key of Object.keys(slots)) {
      if (key !== 'default') {
        resultSlots.push(key);
      }
    }
    return resultSlots;
  });

  return {
    delegatedSlots,
    form,
  };
}

export function generateInitialValues(schema: VbenFormProps['schema'] = []) {
  const initialValues: Record<string, any> = {};
  const customDefaultFields = new Set<string>();

  const zodObject: ZodRawShape = {};
  schema.forEach((item) => {
    if (Reflect.has(item, 'defaultValue')) {
      setInitialValue(initialValues, item.fieldName, item.defaultValue);
      customDefaultFields.add(item.fieldName);
      return;
    }
    if (item.rules && !isString(item.rules)) {
      const customDefaultValue = getCustomDefaultValue(item.rules);
      zodObject[item.fieldName] = item.rules;
      if (customDefaultValue !== undefined) {
        setInitialValue(initialValues, item.fieldName, customDefaultValue);
        customDefaultFields.add(item.fieldName);
      }
    }
  });

  const schemaInitialValues = getDefaultsForSchema(object(zodObject));
  const zodDefaults: Record<string, any> = {};
  for (const key in schemaInitialValues) {
    if (customDefaultFields.has(key) || get(initialValues, key) !== undefined) {
      continue;
    }
    setInitialValue(zodDefaults, key, schemaInitialValues[key]);
  }
  return { ...zodDefaults, ...initialValues };
}

function setInitialValue(
  target: Record<string, any>,
  fieldName: string,
  value: any,
) {
  set(target, fieldName, value);
}

function getCustomDefaultValue(rule: any): any {
  const typeName = rule?._def?.typeName;

  if (typeName === 'ZodDefault') {
    return rule._def.defaultValue();
  }
  if (rule instanceof ZodString) {
    return '';
  }
  if (rule instanceof ZodNumber) {
    return null;
  }
  if (rule instanceof ZodObject) {
    const defaultValues: Record<string, any> = {};
    for (const [key, valueSchema] of Object.entries(rule.shape)) {
      defaultValues[key] = getCustomDefaultValue(valueSchema);
    }
    return defaultValues;
  }
  if (rule instanceof ZodIntersection) {
    const leftDefaultValue = getCustomDefaultValue(rule._def.left);
    const rightDefaultValue = getCustomDefaultValue(rule._def.right);

    if (
      typeof leftDefaultValue === 'object' &&
      typeof rightDefaultValue === 'object'
    ) {
      return { ...leftDefaultValue, ...rightDefaultValue };
    }

    return leftDefaultValue ?? rightDefaultValue;
  }
  if (rule?._def && 'innerType' in rule._def) {
    return getCustomDefaultValue(rule._def.innerType);
  }
  if (rule?._def && 'schema' in rule._def) {
    return getCustomDefaultValue(rule._def.schema);
  }
  return undefined;
}
