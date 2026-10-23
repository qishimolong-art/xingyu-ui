import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { getCustomerSaleDeptList } from '#/api/erp/sale/customer';

/**
 * 把客户可选部门的扁平列表构建成树。
 * 与 getSimpleDeptList() 不同，这里的数据来自 getCustomerSaleDeptList(customerId)，
 * 不受当前登录人的部门数据权限过滤，保证跨部门分配的客户也能选到全部部门。
 */
export function buildCustomerDeptTree(
  list: ErpCustomerApi.SaleDept[],
): ErpCustomerApi.SaleDept[] {
  const nodeMap = new Map<number, ErpCustomerApi.SaleDept>();
  list.forEach((dept) => nodeMap.set(dept.id, { ...dept, children: [] }));
  const roots: ErpCustomerApi.SaleDept[] = [];
  nodeMap.forEach((dept) => {
    const parent = dept.parentId ? nodeMap.get(dept.parentId) : undefined;
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(dept);
    } else {
      roots.push(dept);
    }
  });
  nodeMap.forEach((dept) => {
    if (!dept.children?.length) {
      delete dept.children;
    }
  });
  return roots;
}

export function collectCustomerDeptIds(
  list: ErpCustomerApi.SaleDept[],
): number[] {
  const ids: number[] = [];
  const walk = (items: ErpCustomerApi.SaleDept[]) => {
    items.forEach((item) => {
      ids.push(item.id);
      if (item.children?.length) {
        walk(item.children);
      }
    });
  };
  walk(list);
  return ids;
}

export function resolvePreferredCustomerDeptId(
  allowedIds: number[],
  options: { currentDeptId?: number; preferredDeptId?: number } = {},
): number | undefined {
  const { preferredDeptId, currentDeptId } = options;
  if (preferredDeptId && allowedIds.includes(preferredDeptId)) {
    return preferredDeptId;
  }
  if (currentDeptId && allowedIds.includes(currentDeptId)) {
    return currentDeptId;
  }
  return allowedIds[0];
}

/**
 * 按客户加载可选部门树；未选客户时返回空数组。
 */
export async function loadCustomerSaleDeptTree(
  customerId?: number,
): Promise<ErpCustomerApi.SaleDept[]> {
  if (!customerId) {
    return [];
  }
  const list = await getCustomerSaleDeptList(customerId);
  return buildCustomerDeptTree(list || []);
}
