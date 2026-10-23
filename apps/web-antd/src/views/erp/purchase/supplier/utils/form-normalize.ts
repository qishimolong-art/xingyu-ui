import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import {
  formatOptionalNumberInput,
  parseOptionalNumber,
  toOptionalNumberValue,
} from '../data';

function normalizeSupplierNumberFields(data: ErpSupplierApi.Supplier) {
  const normalized = { ...data };
  const taxPercent = parseOptionalNumber(normalized.taxPercent);

  normalized.taxPercent = toOptionalNumberValue(
    formatOptionalNumberInput(taxPercent),
  );

  return normalized;
}

function normalizeDeptIds(value: unknown): number[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item: any) => Number(item?.value ?? item))
    .filter((id): id is number => Number.isFinite(id));
}

function normalizeSupplierDeptFields(data: ErpSupplierApi.Supplier) {
  const deptIds = normalizeDeptIds(data.deptIds);
  const deptId = Number(
    (data.deptId as any)?.value ?? data.deptId ?? deptIds[0],
  );
  const normalizedDeptId = Number.isFinite(deptId) ? deptId : undefined;
  if (!data.allowMultiDept) {
    return {
      ...data,
      deptId: normalizedDeptId,
      deptIds: [],
    };
  }
  const normalizedDeptIds: number[] = Array.from(
    new Set(
      [normalizedDeptId, ...deptIds].filter((id): id is number =>
        Number.isFinite(id),
      ),
    ),
  );
  return {
    ...data,
    deptId: normalizedDeptId ?? normalizedDeptIds[0],
    deptIds: normalizedDeptIds,
  };
}

function normalizeSupplierManualCode(
  data: ErpSupplierApi.Supplier & Record<string, any>,
) {
  const normalized = { ...data };
  if (typeof normalized.code === 'string') {
    const code = normalized.code.trim();
    normalized.code = code || undefined;
  }
  if (typeof normalized.pinyinCode === 'string') {
    const pinyinCode = normalized.pinyinCode.trim();
    normalized.pinyinCode = pinyinCode || undefined;
  }
  if (typeof normalized.wubiCode === 'string') {
    const wubiCode = normalized.wubiCode.trim();
    normalized.wubiCode = wubiCode || undefined;
  }
  delete normalized.manualInputCode;
  return normalized as ErpSupplierApi.Supplier;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
}

function buildSupplierAreaIds(
  data: Partial<
    Pick<ErpSupplierApi.Supplier, 'city' | 'district' | 'province'>
  >,
) {
  return [data.province, data.city, data.district]
    .map(normalizeText)
    .filter((item): item is string => Boolean(item));
}

function normalizeSupplierAreaFields(
  data: ErpSupplierApi.Supplier & Record<string, any>,
) {
  const normalized = { ...data };
  const areaIds = Array.isArray(normalized.areaIds)
    ? normalized.areaIds
        .map(normalizeText)
        .filter((item): item is string => Boolean(item))
    : [];
  if (areaIds.length > 0) {
    normalized.province = areaIds[0];
    normalized.city = areaIds[1];
    normalized.district = areaIds[2];
  } else if ('areaIds' in normalized) {
    normalized.province = undefined;
    normalized.city = undefined;
    normalized.district = undefined;
  }
  delete normalized.areaIds;
  return normalized as ErpSupplierApi.Supplier;
}

export function buildSupplierAreaEditValues(
  data: Partial<ErpSupplierApi.Supplier>,
) {
  return {
    areaIds: buildSupplierAreaIds(data),
  };
}

export function formatSupplierArea(data?: ErpSupplierApi.Supplier) {
  const areaText = buildSupplierAreaIds(data || {}).join(' / ');
  return areaText || undefined;
}

export function normalizeSupplierFormData(data: ErpSupplierApi.Supplier) {
  return normalizeSupplierAreaFields(
    normalizeSupplierManualCode(
      normalizeSupplierDeptFields(normalizeSupplierNumberFields(data)),
    ),
  );
}

export function buildSupplierDeptEditValues(
  data: Pick<
    ErpSupplierApi.Supplier,
    'deptId' | 'deptIds' | 'deptName' | 'deptNames'
  >,
  resolveDeptName: (id: number) => string | undefined = () => undefined,
) {
  const deptId = normalizeDeptIds(data.deptId)[0];
  const deptIds = normalizeDeptIds(data.deptIds);
  const deptNames = splitSupplierDeptNames(data.deptNames);
  const buildValue = (id: number, name?: string) => ({
    label:
      name?.trim() ||
      (id === deptId ? data.deptName?.trim() : undefined) ||
      resolveDeptName(id) ||
      String(id),
    value: id,
  });

  return {
    deptId:
      deptId === undefined ? undefined : buildValue(deptId, data.deptName),
    deptIds: deptIds.map((id, index) => buildValue(id, deptNames[index])),
  };
}

/** Resolve an audit user name while keeping the API-provided name authoritative. */
export function resolveSupplierAuditUserName(
  userRef: null | number | string | undefined,
  userName: null | string | undefined,
  userNameMap: ReadonlyMap<number, string>,
) {
  const explicitName = userName?.trim();
  if (explicitName) {
    return explicitName;
  }
  if (userRef === undefined || userRef === null || userRef === '') {
    return undefined;
  }

  const normalizedRef = String(userRef).trim();
  if (!normalizedRef) {
    return undefined;
  }
  const userId = Number(normalizedRef);
  if (Number.isFinite(userId)) {
    return userNameMap.get(userId);
  }
  return normalizedRef;
}

export function splitSupplierDeptNames(names?: string) {
  if (!names) {
    return [];
  }
  const normalizedNames = ['\u3001', '\uff0c', '/', ';', '\uff1b'].reduce(
    (value, separator) => value.split(separator).join(','),
    names,
  );
  return normalizedNames
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}
