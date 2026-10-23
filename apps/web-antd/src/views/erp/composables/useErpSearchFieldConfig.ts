import type { VbenFormSchema } from '#/adapter/form';

import {
  type ErpSearchFieldConfigApi,
  getRuntimeSearchFieldConfigList,
} from '#/api/erp/config/search';

const TTL_MS = 0;
const cache = new Map<
  string,
  { p: Promise<ErpSearchFieldConfigApi.SearchFieldConfig[]>; t: number }
>();

export function clearErpSearchFieldConfigCache(moduleKey?: string) {
  if (moduleKey) {
    cache.delete(moduleKey);
    return;
  }
  cache.clear();
}

async function loadSearchFieldConfig(moduleKey: string) {
  const now = Date.now();
  const hit = cache.get(moduleKey);
  if (hit && TTL_MS > 0 && now - hit.t < TTL_MS) {
    return hit.p;
  }

  const p = getRuntimeSearchFieldConfigList(moduleKey).catch((error) => {
    const current = cache.get(moduleKey);
    if (current?.p === p) {
      cache.delete(moduleKey);
    }
    throw error;
  });
  cache.set(moduleKey, { p, t: now });
  return p;
}

function getSchemaFieldName(item: VbenFormSchema) {
  return item.fieldName || (item as any).field;
}

export async function useErpSearchFieldConfig(
  moduleKey: string,
  baseSchema: VbenFormSchema[],
): Promise<VbenFormSchema[]> {
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
