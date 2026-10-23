import type { SystemAreaApi } from '#/api/system/area';

export interface ResolvedBusinessLicenseArea {
  areaId: number;
  areaText: string;
}

type BusinessLicenseOcrLike = {
  data?: Record<string, any>;
  invoiceAddress?: string;
  invoiceCompany?: string;
  raw?: Record<string, any>;
};

type AreaNode = SystemAreaApi.Area;

const GENERIC_AREA_NAMES = new Set(['市辖区', '县', '省直辖县级行政区划']);
const AREA_SUFFIX_PATTERN = /(特别行政区|自治区|自治州|地区|盟|省|市|县|区)$/;

export function getBusinessLicenseCompanyName(result: BusinessLicenseOcrLike) {
  return firstText(
    result.invoiceCompany,
    (result as Record<string, any>).name,
    result.data?.name,
    result.raw?.name,
  );
}

export function getBusinessLicenseCustomerName(result: BusinessLicenseOcrLike) {
  return getBusinessLicenseCompanyName(result);
}

export function getBusinessLicenseAddress(result: BusinessLicenseOcrLike) {
  return firstText(
    result.invoiceAddress,
    (result as Record<string, any>).address,
    result.data?.address,
    result.raw?.address,
  );
}

export function getBusinessLicenseNameMismatch(
  currentName: unknown,
  result: BusinessLicenseOcrLike,
  entityLabel: '供应商' | '客户' = '客户',
) {
  const customerName = firstText(currentName);
  const licenseName = getBusinessLicenseCustomerName(result);
  if (!customerName || !licenseName || customerName === licenseName) {
    return undefined;
  }
  return {
    message: `营业执照名称与当前${entityLabel}名称不一致`,
    description: `当前${entityLabel}名称：${customerName}；营业执照名称：${licenseName}。是否继续使用本次识别结果？确认后保留${entityLabel}原名称，继续后续操作；取消则不回填、不保存本次识别信息及图片。`,
  };
}

/** 地区匹配失败时仍保留完整住所，各地址字段独立补空。 */
export async function buildBusinessLicenseAddressFill(
  address: string | undefined,
  current: { addressAreaId?: number | string; detailAddress?: string },
  loadAreaTree: () => Promise<AreaNode[]>,
) {
  const values: { addressAreaId?: number; detailAddress?: string } = {};
  let skippedCount = 0;
  let unmatchedAddress = false;
  let area: ResolvedBusinessLicenseArea | undefined;
  const licenseAddress = firstText(address);
  if (licenseAddress) {
    if (firstText(current.detailAddress)) {
      skippedCount += 1;
    } else {
      values.detailAddress = licenseAddress;
    }
    if (firstText(String(current.addressAreaId ?? ''))) {
      skippedCount += 1;
    } else {
      try {
        area = resolveBusinessLicenseArea(licenseAddress, await loadAreaTree());
      } catch {
        // 区域加载失败只影响省市县选择，不中断其他 OCR 字段回填。
      }
      if (area) {
        values.addressAreaId = area.areaId;
      } else {
        unmatchedAddress = true;
      }
    }
  }
  return { area, skippedCount, unmatchedAddress, values };
}

export function resolveBusinessLicenseArea(
  address: string | undefined,
  areaTree: AreaNode[],
): ResolvedBusinessLicenseArea | undefined {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress || areaTree.length === 0) {
    return undefined;
  }

  let bestMatch:
    | {
        node: AreaNode;
        path: AreaNode[];
        score: number;
        matchedCount: number;
      }
    | undefined;

  const visit = (nodes: AreaNode[], path: AreaNode[]) => {
    for (const node of nodes) {
      const currentPath = [...path, node];
      const matchStats = getPathMatchStats(normalizedAddress, currentPath);
      if (
        node.id !== undefined &&
        isUsableAreaMatch(matchStats.matchedCount, currentPath.length) &&
        (!bestMatch || matchStats.score > bestMatch.score)
      ) {
        bestMatch = {
          node,
          path: currentPath,
          score: matchStats.score,
          matchedCount: matchStats.matchedCount,
        };
      }
      if (node.children?.length) {
        visit(node.children, currentPath);
      }
    }
  };

  visit(areaTree, []);

  return bestMatch
    ? {
        areaId: bestMatch.node.id!,
        areaText: formatAreaPath(bestMatch.path),
      }
    : undefined;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeAddress(value: string | undefined) {
  return value
    ?.replace(/\s+/g, '')
    .replace(/[()（）,，.。;；:：、-]/g, '')
    .trim();
}

function normalizeAreaName(value: string | undefined) {
  return normalizeAddress(value)?.replace(AREA_SUFFIX_PATTERN, '') || '';
}

function getAreaAliases(name: string) {
  const normalizedName = normalizeAddress(name);
  const shortName = normalizeAreaName(name);
  return Array.from(new Set([normalizedName, shortName])).filter(
    (item): item is string => Boolean(item && item.length >= 2),
  );
}

function getPathMatchStats(address: string, path: AreaNode[]) {
  let matchedCount = 0;
  let matchedLength = 0;

  for (const node of path) {
    const matchedAlias = getAreaAliases(node.name).find((alias) =>
      address.includes(alias),
    );
    if (matchedAlias) {
      matchedCount += 1;
      matchedLength += matchedAlias.length;
    }
  }

  return {
    matchedCount,
    score: matchedCount * 100 + matchedLength * 2 + path.length,
  };
}

function isUsableAreaMatch(matchedCount: number, pathLength: number) {
  if (pathLength <= 1) {
    return matchedCount >= 1;
  }
  return matchedCount >= 2;
}

function formatAreaPath(path: AreaNode[]) {
  const names: string[] = [];
  for (const node of path) {
    if (GENERIC_AREA_NAMES.has(node.name)) {
      continue;
    }
    const previous = names[names.length - 1];
    if (
      previous &&
      normalizeAreaName(previous) === normalizeAreaName(node.name)
    ) {
      continue;
    }
    names.push(node.name);
  }
  return names.join('');
}
