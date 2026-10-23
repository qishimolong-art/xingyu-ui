import { handleTree } from '@vben/utils';

import { getSaleReportDeptSimpleList } from '#/api/erp/report/sale';
import { getSimpleDeptList } from '#/api/system/dept';

type DeptNode = {
  children?: DeptNode[];
  id?: number;
  name?: string;
};

let deptTreeCache: DeptNode[] | undefined;
let deptTreePromise: Promise<DeptNode[]> | undefined;

export async function getSaleDeptTree() {
  if (deptTreeCache) {
    return deptTreeCache;
  }
  deptTreePromise ??= getSimpleDeptList().then((data) => {
    deptTreeCache = handleTree(data) as DeptNode[];
    return deptTreeCache;
  });
  return deptTreePromise;
}

export async function getSaleReportSearchDeptTree() {
  return handleTree(await getSaleReportDeptSimpleList()) as DeptNode[];
}
