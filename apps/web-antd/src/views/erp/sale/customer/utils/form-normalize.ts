import type { ErpCustomerApi } from '#/api/erp/sale/customer';

export interface CustomerDeptLabelValue {
  label: string;
  value: number;
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

export function normalizeCustomerDeptFields(
  data: Omit<ErpCustomerApi.Customer, 'deptIds'> & { deptIds?: unknown },
) {
  const deptIds = normalizeDeptIds(data.deptIds);
  const deptId = Number(data.deptId ?? deptIds[0]);
  const normalizedDeptId = Number.isFinite(deptId) ? deptId : undefined;
  if (!data.allowMultiDept) {
    return {
      ...data,
      deptId: normalizedDeptId,
      deptIds: [],
    };
  }
  const normalizedDeptIds = Array.from(
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

export function splitCustomerDeptNames(names?: string) {
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

export function buildCustomerDeptEditValues(
  data: Pick<ErpCustomerApi.Customer, 'deptIds' | 'deptNames'>,
  resolveDeptName: (id: number) => string | undefined = () => undefined,
) {
  const deptIds = normalizeDeptIds(data.deptIds);
  const deptNames = splitCustomerDeptNames(data.deptNames);

  return {
    deptIds: deptIds.map<CustomerDeptLabelValue>((id, index) => ({
      label: deptNames[index] || resolveDeptName(id) || String(id),
      value: id,
    })),
  };
}
