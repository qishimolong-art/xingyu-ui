import type { VbenFormSchema } from '#/adapter/form';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { getRuntimeFieldConfigList } from '#/api/erp/config/field';
import {
  applyFieldPermission,
  isFieldHidden,
} from '#/composables/useFieldPermission';

export type FieldAliasMap = Record<string, string[]>;

export interface FieldVisibilityOptions {
  fieldAliases?: FieldAliasMap;
  /** Optional successful snapshot; existing callers retain their fetch/fallback behavior. */
  config?: ErpFieldConfigApi.FieldConfig[];
}

export interface EffectiveFieldVisibilityContext extends FieldVisibilityOptions {
  fieldConfigFieldKeys?: Set<string> | string[];
  fieldConfigHiddenFields?: Set<string> | string[];
  moduleKey?: string;
  roleHiddenFields?: Set<string> | string[];
}

/**
 * 字段配置缓存：TTL 改为 0（每次打开表单都重新请求后端）。
 * - 确保管理页保存后，下次打开表单立即生效
 * - 管理页保存/重置后仍会主动 clearFieldConfigCache(moduleKey) 清缓存
 */
const TTL_MS = 0;
const cache = new Map<
  string,
  { p: Promise<ErpFieldConfigApi.FieldConfig[]>; t: number }
>();

/** 清除字段配置缓存，不传参则清除全部 */
export function clearFieldConfigCache(moduleKey?: string) {
  if (moduleKey) {
    cache.delete(moduleKey);
  } else {
    cache.clear();
  }
}

async function loadConfig(moduleKey: string) {
  const now = Date.now();
  const hit = cache.get(moduleKey);
  if (hit && TTL_MS > 0 && now - hit.t < TTL_MS) {
    return hit.p;
  }
  const p = getRuntimeFieldConfigList(moduleKey).catch((error) => {
    // 请求失败时清掉本次缓存，避免卡死
    const current = cache.get(moduleKey);
    if (current && current.p === p) {
      cache.delete(moduleKey);
    }
    throw error;
  });
  cache.set(moduleKey, { t: now, p });
  return p;
}

export async function getRuntimeFieldConfig(moduleKey: string) {
  return loadConfig(moduleKey);
}

function normalizeAliasMap(fieldAliases?: FieldAliasMap) {
  const map = new Map<string, string[]>();
  Object.entries(fieldAliases ?? {}).forEach(([fieldKey, aliases]) => {
    const candidates = [
      fieldKey,
      ...aliases,
      ...aliases.map((alias) => `col_${alias}`),
      `col_${fieldKey}`,
    ].filter(Boolean);
    const uniqueCandidates = [...new Set(candidates)];
    uniqueCandidates.forEach((candidate) => {
      map.set(candidate, uniqueCandidates);
    });
  });
  return map;
}

function getFieldCandidates(fieldKey?: string, fieldAliases?: FieldAliasMap) {
  if (!fieldKey) {
    return [];
  }
  return normalizeAliasMap(fieldAliases).get(fieldKey) ?? [fieldKey];
}

function getConfigCandidates(
  fieldName: string,
  configMap: Map<string, ErpFieldConfigApi.FieldConfig>,
  fieldAliases?: FieldAliasMap,
) {
  return getFieldCandidates(fieldName, fieldAliases)
    .map((candidate) => configMap.get(candidate))
    .filter(Boolean) as ErpFieldConfigApi.FieldConfig[];
}

function getPreferredConfig(
  fieldName: string,
  configMap: Map<string, ErpFieldConfigApi.FieldConfig>,
  fieldAliases?: FieldAliasMap,
) {
  return (
    configMap.get(fieldName) ??
    getConfigCandidates(fieldName, configMap, fieldAliases)[0]
  );
}

export function isFieldConfigHidden(
  hiddenFields: Set<string> | string[],
  fieldKey?: string,
  options: FieldVisibilityOptions = {},
) {
  if (!fieldKey) {
    return false;
  }
  const fields =
    hiddenFields instanceof Set ? hiddenFields : new Set(hiddenFields);
  return getFieldCandidates(fieldKey, options.fieldAliases).some(
    (candidate) => fields.has(candidate) || fields.has(`col_${candidate}`),
  );
}

export async function getFieldConfigHiddenFields(
  moduleKey: string,
  options: FieldVisibilityOptions = {},
) {
  try {
    const config = await loadConfig(moduleKey);
    const hiddenFields = new Set<string>();
    config
      .filter((item) => item.visible === false)
      .forEach((item) => {
        getFieldCandidates(item.fieldName, options.fieldAliases).forEach(
          (candidate) => hiddenFields.add(candidate),
        );
      });
    return [...hiddenFields];
  } catch {
    return [];
  }
}

export async function getFieldConfigFieldKeys(
  moduleKey: string,
  options: FieldVisibilityOptions = {},
) {
  try {
    const config = await loadConfig(moduleKey);
    const fieldKeys = new Set<string>();
    config.forEach((item) => {
      getFieldCandidates(item.fieldName, options.fieldAliases).forEach(
        (candidate) => fieldKeys.add(candidate),
      );
    });
    return [...fieldKeys];
  } catch {
    return [];
  }
}

export function isFieldConfigKnown(
  fieldKey: string | undefined,
  context: Pick<
    EffectiveFieldVisibilityContext,
    'fieldAliases' | 'fieldConfigFieldKeys'
  >,
) {
  if (!fieldKey) {
    return false;
  }
  const fields =
    context.fieldConfigFieldKeys instanceof Set
      ? context.fieldConfigFieldKeys
      : new Set(context.fieldConfigFieldKeys);
  return getFieldCandidates(fieldKey, context.fieldAliases).some(
    (candidate) => fields.has(candidate) || fields.has(`col_${candidate}`),
  );
}

export function isEffectiveFieldHidden(
  fieldKey: string | undefined,
  context: EffectiveFieldVisibilityContext,
) {
  if (!fieldKey) {
    return false;
  }
  if (
    isFieldConfigHidden(
      context.fieldConfigHiddenFields ?? [],
      fieldKey,
      context,
    )
  ) {
    return true;
  }
  return getFieldCandidates(fieldKey, context.fieldAliases).some((candidate) =>
    isFieldHidden(context.roleHiddenFields ?? [], candidate),
  );
}

function removeRequiredRule(rules: unknown) {
  if (rules === 'mobileRequired') {
    return 'mobile';
  }
  if (rules === 'required' || rules === 'selectRequired') {
    return undefined;
  }
  if (Array.isArray(rules)) {
    const nextRules = rules
      .map((rule) => {
        if (rule === 'mobileRequired') {
          return 'mobile';
        }
        return rule;
      })
      .filter((rule) => {
        if (typeof rule === 'string') {
          return rule !== 'required' && rule !== 'selectRequired';
        }
        return !(
          rule &&
          typeof rule === 'object' &&
          (rule as { required?: boolean }).required === true
        );
      });
    return nextRules.length > 0 ? nextRules : undefined;
  }
  if (
    rules &&
    typeof rules === 'object' &&
    (rules as { required?: boolean }).required === true
  ) {
    const originalRules = rules as Record<string, unknown>;
    const { required: _required, ...restRules } = originalRules;
    return Object.keys(restRules).length > 0 ? restRules : undefined;
  }
  return rules;
}

/**
 * 把字段配置应用到 schema 上：
 * - visible===false：字段不渲染、不校验
 * - fieldLabel.trim() 非空：覆盖 schema.label
 * - required===true：设置必填规则
 * - required===false：只移除必填校验，保留格式和自定义业务校验
 *
 * 后端接口不可用时降级为原 schema，保证页面仍可正常使用。
 */
export async function applyFieldConfig(
  schema: VbenFormSchema[],
  moduleKey: string,
  options: FieldVisibilityOptions = {},
): Promise<VbenFormSchema[]> {
  let config: ErpFieldConfigApi.FieldConfig[];
  try {
    config = options.config ?? (await loadConfig(moduleKey));
  } catch {
    return schema;
  }
  const configMap = new Map(config.map((c) => [c.fieldName, c]));
  const result: VbenFormSchema[] = [];
  let segment: Array<{
    config: ErpFieldConfigApi.FieldConfig;
    index: number;
    item: VbenFormSchema;
  }> = [];

  function flushSegment() {
    if (segment.length === 0) {
      return;
    }
    segment.sort((a, b) => {
      const sortA = a.config.sort ?? Number.MAX_SAFE_INTEGER;
      const sortB = b.config.sort ?? Number.MAX_SAFE_INTEGER;
      return sortA === sortB ? a.index - b.index : sortA - sortB;
    });
    result.push(...segment.map((entry) => entry.item));
    segment = [];
  }

  schema.forEach((item, index) => {
    if (!item.fieldName) {
      flushSegment();
      result.push(item);
      return;
    }
    const candidates = getConfigCandidates(
      item.fieldName,
      configMap,
      options.fieldAliases,
    );
    const cfg = getPreferredConfig(
      item.fieldName,
      configMap,
      options.fieldAliases,
    );
    if (!cfg) {
      flushSegment();
      result.push(item);
      return;
    }
    if (candidates.some((candidate) => candidate.visible === false)) {
      return;
    }
    const newItem = { ...item };
    const fieldLabel = cfg.fieldLabel?.trim();
    if (fieldLabel) {
      newItem.label = fieldLabel;
    }
    if (cfg.required === true) {
      newItem.rules = 'required';
    } else if (cfg.required === false) {
      const nextRules = removeRequiredRule(newItem.rules);
      if (nextRules === undefined) {
        delete newItem.rules;
      } else {
        newItem.rules = nextRules as typeof newItem.rules;
      }
    }
    segment.push({ config: cfg, index, item: newItem });
  });
  flushSegment();
  return result;
}

export async function applyEffectiveFieldVisibility(
  schema: VbenFormSchema[],
  context: EffectiveFieldVisibilityContext & { moduleKey: string },
) {
  const configuredSchema = await applyFieldConfig(schema, context.moduleKey, {
    fieldAliases: context.fieldAliases,
    config: context.config,
  });
  const fieldConfigHiddenFields =
    context.fieldConfigHiddenFields ??
    (await getFieldConfigHiddenFields(context.moduleKey, {
      fieldAliases: context.fieldAliases,
    }));
  return applyFieldPermission(
    configuredSchema,
    configuredSchema
      .filter((item) =>
        isEffectiveFieldHidden(item.fieldName, {
          ...context,
          fieldConfigHiddenFields,
        }),
      )
      .map((item) => item.fieldName)
      .filter(Boolean) as string[],
  );
}
