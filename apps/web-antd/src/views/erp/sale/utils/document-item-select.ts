export const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

export function isMissingDisplayName(value: unknown, id?: unknown) {
  return (
    !hasValue(value) ||
    value === CURRENT_SELECT_LABEL_PLACEHOLDER ||
    (hasValue(id) && `${value}` === `${id}`)
  );
}

function getOptionKey(item: any) {
  const key = item?.id ?? item?.value;
  return key === undefined || key === null ? undefined : String(key);
}

export function isResolvedSelectOption(item: any) {
  const id = item?.id ?? item?.value;
  return (
    id !== undefined &&
    id !== null &&
    !isMissingDisplayName(item?.name ?? item?.label, id)
  );
}

function isSameSelectOption(oldOption: any, nextOption: any) {
  return (
    String(oldOption?.id ?? oldOption?.value ?? '') ===
      String(nextOption?.id ?? nextOption?.value ?? '') &&
    String(oldOption?.name ?? oldOption?.label ?? '') ===
      String(nextOption?.name ?? nextOption?.label ?? '') &&
    String(oldOption?.deptId ?? '') === String(nextOption?.deptId ?? '') &&
    String(oldOption?.deptName ?? '') === String(nextOption?.deptName ?? '')
  );
}

export function mergeResolvedOptionsById(
  oldOptions: any[],
  nextOptions: any[],
) {
  const map = new Map<string, any>();
  const oldResolvedOptions = (oldOptions || []).filter(isResolvedSelectOption);
  let changed = oldResolvedOptions.length !== (oldOptions || []).length;

  oldResolvedOptions.forEach((item) => {
    const key = getOptionKey(item);
    if (key) {
      map.set(key, item);
    }
  });

  (nextOptions || []).filter(isResolvedSelectOption).forEach((item) => {
    const key = getOptionKey(item);
    if (!key) {
      return;
    }
    const existed = map.get(key);
    if (!existed) {
      map.set(key, item);
      changed = true;
      return;
    }
    if (!isSameSelectOption(existed, item)) {
      map.set(key, { ...existed, ...item });
      changed = true;
    }
  });

  return changed ? Array.from(map.values()) : oldOptions || [];
}

export function findResolvedOptionById(options: any[], id?: number | string) {
  if (!hasValue(id)) {
    return undefined;
  }
  return (options || []).find(
    (item) =>
      String(item?.id ?? item?.value) === String(id) &&
      isResolvedSelectOption(item),
  );
}

export function findDeptName(
  options: any[] = [],
  deptId?: null | number | string,
): string | undefined {
  if (deptId === null || deptId === undefined || deptId === '') {
    return undefined;
  }
  const targetDeptId = String(deptId);
  for (const option of options ?? []) {
    if (String(option?.id ?? option?.value) === targetDeptId) {
      return isMissingDisplayName(option?.name ?? option?.label, deptId)
        ? undefined
        : (option?.name ?? option?.label);
    }
    const childDeptName = findDeptName(option?.children ?? [], deptId);
    if (childDeptName) {
      return childDeptName;
    }
  }
  return undefined;
}
