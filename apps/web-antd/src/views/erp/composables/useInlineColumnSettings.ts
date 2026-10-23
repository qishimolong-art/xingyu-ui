import { computed, shallowReactive, shallowRef, watch } from 'vue';

export interface InlineColumn {
  field: string;
  title: string;
  width: number;
  kind?: 'amount' | 'image' | 'price' | 'text';
}
export interface InlineColumnPreference {
  field: string;
  width: number;
  visible: boolean;
  fixed: '' | 'left' | 'right';
}

const configurations = shallowReactive(
  new Map<string, InlineColumnPreference[]>(),
);

export function defaultColumns(
  columns: InlineColumn[],
): InlineColumnPreference[] {
  return columns.map(({ field, width }) => ({
    field,
    width,
    visible: true,
    fixed: '',
  }));
}

export function normalizeColumns(value: unknown, columns: InlineColumn[]) {
  const defaults = defaultColumns(columns);
  if (!Array.isArray(value)) return defaults;
  const available = new Map(defaults.map((column) => [column.field, column]));
  const result: InlineColumnPreference[] = [];
  for (const item of value) {
    const fallback = available.get(item?.field);
    if (!fallback) continue;
    available.delete(item.field);
    result.push({
      field: fallback.field,
      width:
        Number.isInteger(item.width) && item.width >= 60 && item.width <= 600
          ? item.width
          : fallback.width,
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      fixed: item.fixed === 'left' || item.fixed === 'right' ? item.fixed : '',
    });
  }
  result.push(...available.values());
  if (!result.some((column) => column.visible)) return defaults;
  if (result.filter((column) => column.fixed).length > 4) {
    return result.map((column) => ({ ...column, fixed: '' as const }));
  }
  return result;
}

export function validateColumns(
  columns: InlineColumnPreference[],
  panelWidth: number,
) {
  if (!columns.some((column) => column.visible))
    return '请至少保留一列库存信息';
  if (
    columns.some(
      (column) =>
        !Number.isInteger(column.width) ||
        column.width < 60 ||
        column.width > 600,
    )
  )
    return '列宽须为 60～600 的整数';
  if (columns.filter((column) => column.fixed).length > 4)
    return '业务冻结列合计最多 4 列';
  const fixedWidth = columns.reduce(
    (sum, column) => sum + (column.visible && column.fixed ? column.width : 0),
    42,
  );
  if (fixedWidth > panelWidth - 120)
    return '冻结列过宽，请减少冻结列或缩小列宽，至少为中间区域保留 120 像素';
  return '';
}

export function columnStorageKey(
  tenant: unknown,
  user: unknown,
  scope: string,
) {
  if (user === undefined || user === null || user === '') return '';
  return `xingyu-erp:inline-stock-columns:v1:${encodeURIComponent(String(tenant ?? 'default'))}:${encodeURIComponent(String(user))}:${encodeURIComponent(scope)}`;
}

/** Only display preferences are shared. Business rows and permission state stay local. */
export function useInlineColumnSettings(
  key: () => string,
  definitions: InlineColumn[],
) {
  const transient = shallowRef(defaultColumns(definitions));
  watch(
    key,
    (storageKey) => {
      transient.value = defaultColumns(definitions);
      if (!storageKey || configurations.has(storageKey)) return;
      let saved: unknown;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      } catch {
        /* Storage may be unavailable or contain an old invalid value. */
      }
      configurations.set(storageKey, normalizeColumns(saved, definitions));
    },
    { immediate: true },
  );
  const applied = computed(() => configurations.get(key()) ?? transient.value);
  function save(value: InlineColumnPreference[]) {
    const next = value.map((column) => ({ ...column }));
    const storageKey = key();
    if (!storageKey) {
      transient.value = next;
      return false;
    }
    configurations.set(storageKey, next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }
  return { applied, save };
}
