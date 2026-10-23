import type { SystemAreaApi } from '#/api/system/area';

import { resolveBusinessLicenseArea } from '#/views/erp/sale/customer/utils/business-license-ocr';

function hasTextValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function hasAreaValue(value: unknown) {
  return Array.isArray(value)
    ? value.some((item) => hasTextValue(item))
    : hasTextValue(value);
}

function findAreaNamePath(
  nodes: SystemAreaApi.Area[],
  targetId: number,
  path: string[] = [],
): string[] | undefined {
  for (const node of nodes) {
    const currentPath = [...path, node.name];
    if (node.id === targetId) {
      return currentPath;
    }
    if (node.children?.length) {
      const childPath = findAreaNamePath(node.children, targetId, currentPath);
      if (childPath) {
        return childPath;
      }
    }
  }
  return undefined;
}

export async function buildSupplierBusinessLicenseAddressFill(
  address: string | undefined,
  current: { address?: string; areaIds?: string[] },
  loadAreaTree: () => Promise<SystemAreaApi.Area[]>,
) {
  const values: { address?: string; areaIds?: string[] } = {};
  let skippedCount = 0;
  let unmatchedAddress = false;
  const licenseAddress = address?.trim();
  if (licenseAddress) {
    if (hasTextValue(current.address)) skippedCount += 1;
    else values.address = licenseAddress;
    if (hasAreaValue(current.areaIds)) skippedCount += 1;
    else {
      try {
        const tree = await loadAreaTree();
        const area = resolveBusinessLicenseArea(licenseAddress, tree);
        const path = area ? findAreaNamePath(tree, area.areaId) : undefined;
        if (path?.length && path.every((item) => hasTextValue(item)))
          values.areaIds = path;
        else unmatchedAddress = true;
      } catch {
        unmatchedAddress = true;
      }
    }
  }
  return { values, skippedCount, unmatchedAddress };
}
