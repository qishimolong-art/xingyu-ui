import { handleTree } from '@vben/utils';

import {
  getPurchaseInDeptSimpleList,
  getPurchaseInSupplierDeptSimpleList,
} from '#/api/erp/purchase/in';
import { getPurchaseInvoiceDeptSimpleList } from '#/api/erp/purchase/invoice';
import {
  getPurchaseOrderDeptSimpleList,
  getPurchaseOrderSupplierDeptSimpleList,
} from '#/api/erp/purchase/order';
import { getPurchasePriceAdjustDeptSimpleList } from '#/api/erp/purchase/priceadjust';
import { getPurchaseReturnDeptSimpleList } from '#/api/erp/purchase/return';
import { getSupplierDeptSimpleList } from '#/api/erp/purchase/supplier';
import { getPurchaseReportDeptSimpleList } from '#/api/erp/report/purchase';
import { getSimpleDeptList } from '#/api/system/dept';

export type PurchaseDeptNode = {
  children?: PurchaseDeptNode[];
  id?: number;
  name?: string;
};

type DeptNode = PurchaseDeptNode;

type DeptOption = {
  id?: null | number | string;
  name?: string;
};

let deptTreeCache: DeptNode[] | undefined;
let deptTreePromise: Promise<DeptNode[]> | undefined;
let deptNameMapCache: Map<number, string> | undefined;
const supplierDeptTreePromiseCache = new Map<number, Promise<DeptNode[]>>();
const purchaseInSupplierDeptTreePromiseCache = new Map<
  number,
  Promise<DeptNode[]>
>();

export async function getPurchaseDeptTree() {
  if (deptTreeCache) {
    return deptTreeCache;
  }
  deptTreePromise ??= getSimpleDeptList().then((data) => {
    deptTreeCache = handleTree(data) as DeptNode[];
    deptNameMapCache = buildDeptNameMap(deptTreeCache);
    return deptTreeCache;
  });
  return deptTreePromise;
}

export async function getPurchaseOrderSearchDeptTree() {
  return getSearchDeptTree(getPurchaseOrderDeptSimpleList);
}

export async function getPurchaseInSearchDeptTree() {
  return getSearchDeptTree(getPurchaseInDeptSimpleList);
}

export async function getPurchaseReturnSearchDeptTree() {
  return getSearchDeptTree(getPurchaseReturnDeptSimpleList);
}

export async function getPurchaseInvoiceSearchDeptTree() {
  return getSearchDeptTree(getPurchaseInvoiceDeptSimpleList);
}

export async function getPurchasePriceAdjustSearchDeptTree() {
  return getSearchDeptTree(getPurchasePriceAdjustDeptSimpleList);
}

export async function getPurchaseReportSearchDeptTree() {
  return getSearchDeptTree(getPurchaseReportDeptSimpleList);
}

export async function getSupplierSearchDeptTree() {
  return getSearchDeptTree(getSupplierDeptSimpleList);
}

export async function getPurchaseOrderSupplierDeptTree(params?: {
  supplierId?: number | string;
}) {
  const supplierId = normalizeDeptId(params?.supplierId);
  if (supplierId === undefined) {
    return [];
  }
  let promise = supplierDeptTreePromiseCache.get(supplierId);
  if (!promise) {
    promise = getPurchaseOrderSupplierDeptSimpleList(supplierId).then(
      (data) => handleTree(data) as DeptNode[],
    );
    supplierDeptTreePromiseCache.set(supplierId, promise);
  }
  return promise;
}

export async function getPurchaseInSupplierDeptTree(params?: {
  supplierId?: number | string;
}) {
  const supplierId = normalizeDeptId(params?.supplierId);
  if (supplierId === undefined) {
    return [];
  }
  let promise = purchaseInSupplierDeptTreePromiseCache.get(supplierId);
  if (!promise) {
    promise = getPurchaseInSupplierDeptSimpleList(supplierId).then(
      (data) => handleTree(data) as DeptNode[],
    );
    purchaseInSupplierDeptTreePromiseCache.set(supplierId, promise);
  }
  return promise;
}

export function collectPurchaseDeptIds(tree: DeptNode[]) {
  const ids = new Set<number>();
  const visit = (nodes: DeptNode[]) => {
    for (const node of nodes) {
      if (node.id !== undefined) {
        ids.add(node.id);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(tree);
  return ids;
}

export async function ensurePurchaseDeptTreeLoaded() {
  await getPurchaseDeptTree();
}

export async function getPurchaseDeptName(id?: number) {
  if (!id) {
    return '-';
  }
  await ensurePurchaseDeptTreeLoaded();
  return deptNameMapCache?.get(id) || '-';
}

export async function ensurePurchaseDeptOptions(depts: DeptOption[]) {
  const normalizedDepts: Array<{ id: number; name?: string }> = [];
  for (const dept of depts) {
    const id = normalizeDeptId(dept.id);
    if (id === undefined) {
      continue;
    }
    const name = dept.name?.trim();
    normalizedDepts.push(name ? { id, name } : { id });
  }

  if (normalizedDepts.length === 0) {
    return;
  }

  await ensurePurchaseDeptTreeLoaded();

  const tree = deptTreeCache ?? [];
  const nameMap = deptNameMapCache ?? buildDeptNameMap(tree);
  const missingNodes: DeptNode[] = [];

  for (const dept of normalizedDepts) {
    const label = dept.name || nameMap.get(dept.id) || String(dept.id);
    const existingNode = findDeptNode(tree, dept.id);

    if (existingNode) {
      if (!existingNode.name) {
        existingNode.name = label;
      }
    } else {
      missingNodes.push({ id: dept.id, name: label });
    }
    nameMap.set(dept.id, label);
  }

  if (missingNodes.length > 0) {
    tree.push(...missingNodes);
    deptTreeCache = tree;
  }
  deptNameMapCache = nameMap;
}

function buildDeptNameMap(tree: DeptNode[]) {
  const map = new Map<number, string>();
  const visit = (nodes: DeptNode[]) => {
    for (const node of nodes) {
      if (node.id !== undefined && node.name) {
        map.set(node.id, node.name);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(tree);
  return map;
}

async function getSearchDeptTree(loader: () => Promise<DeptOption[]>) {
  return handleTree(await loader()) as DeptNode[];
}

function findDeptNode(tree: DeptNode[], id: number): DeptNode | undefined {
  for (const node of tree) {
    if (node.id === id) {
      return node;
    }
    if (node.children?.length) {
      const found = findDeptNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function normalizeDeptId(id?: null | number | string) {
  if (id === undefined || id === null || id === '') {
    return undefined;
  }
  const value = Number(id);
  return Number.isFinite(value) ? value : undefined;
}
