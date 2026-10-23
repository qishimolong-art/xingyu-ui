import type { VbenFormSchema } from '#/adapter/form';

import { onMounted } from 'vue';

import {
  type ErpSearchFieldConfigApi,
  getSearchFieldConfigList,
} from '#/api/erp/config/search';

const cache = new Map<
  string,
  Promise<ErpSearchFieldConfigApi.SearchFieldConfig[]>
>();

export function clearErpSearchFieldConfigCache(moduleKey?: string) {
  if (moduleKey) {
    cache.delete(moduleKey);
    return;
  }
  cache.clear();
}

function getSchemaFieldName(item: VbenFormSchema) {
  return item.fieldName || (item as any).field;
}

function loadSearchFieldConfig(moduleKey: string) {
  const hit = cache.get(moduleKey);
  if (hit) {
    return hit;
  }

  const promise = getSearchFieldConfigList(moduleKey).catch((error) => {
    if (cache.get(moduleKey) === promise) {
      cache.delete(moduleKey);
    }
    throw error;
  });
  cache.set(moduleKey, promise);
  return promise;
}

export async function buildErpSearchFieldSchema(
  moduleKey: string,
  baseSchema: VbenFormSchema[],
) {
  if (!moduleKey) {
    return baseSchema;
  }

  let configs: ErpSearchFieldConfigApi.SearchFieldConfig[] = [];
  try {
    configs = await loadSearchFieldConfig(moduleKey);
  } catch {
    return baseSchema;
  }

  const enabledConfigs = configs
    .filter((item) => item.enabled !== false && item.fieldName)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  if (enabledConfigs.length === 0) {
    return baseSchema;
  }

  const schemaMap = new Map(
    baseSchema
      .map((item) => [getSchemaFieldName(item), item] as const)
      .filter(([fieldName]) => !!fieldName),
  );

  const nextSchema = enabledConfigs
    .map((config) => {
      const schema = schemaMap.get(config.fieldName);
      if (!schema) {
        return undefined;
      }
      return {
        ...schema,
        component: (config.component || schema.component) as any,
        label: config.fieldLabel || schema.label,
      };
    })
    .filter(Boolean) as VbenFormSchema[];

  return nextSchema.length > 0 ? nextSchema : baseSchema;
}

export function useErpSearchFieldConfig(
  moduleKey: string,
  baseSchema: VbenFormSchema[],
  gridApi: {
    formApi?: {
      setState?: (state: { schema: VbenFormSchema[] }) => void;
    };
  },
) {
  onMounted(async () => {
    const schema = await buildErpSearchFieldSchema(moduleKey, baseSchema);
    gridApi.formApi?.setState?.({ schema });
  });
}
