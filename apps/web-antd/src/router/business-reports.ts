interface BusinessReportRoute {
  children?: BusinessReportRoute[];
  component?: unknown;
  name?: unknown;
  path: string;
  redirect?: unknown;
}

const BUSINESS_REPORT_CATEGORY_COMPONENTS: Record<string, string> = {
  '/erp/business-report/account-fund': 'erp/report/account-fund/index',
  '/erp/business-report/counterparty': 'erp/report/counterparty/index',
  '/erp/business-report/audit-trace-performance':
    'erp/report/audit-trace-performance/index',
  '/erp/business-report/expense-income': 'erp/report/expense-income/index',
  '/erp/business-report/financial-statement':
    'erp/report/financial-statement/index',
  '/erp/business-report/fixed-asset': 'erp/report/fixed-asset/index',
  '/erp/business-report/inventory': 'erp/stock/report/index',
  '/erp/business-report/other-settlement': 'erp/report/other-settlement/index',
  '/erp/business-report/profit': 'erp/report/profit-dashboard/index',
  '/erp/business-report/purchase': 'erp/purchase/report/index',
  '/erp/business-report/sale': 'erp/sale/report/index',
  '/erp/business-report/transfer': 'erp/report/transfer/index',
};

/** 公共菜单转换器会修改 path/component；每次转换使用独立树，避免污染登录缓存。 */
export function cloneAccessMenuTree<T extends BusinessReportRoute>(
  menus: T[],
): T[] {
  return menus.map((menu) => {
    const result = { ...menu };
    if (menu.children) {
      result.children = cloneAccessMenuTree(menu.children);
    }
    return result;
  });
}

/**
 * 经营报表迁移在叶子 path 保存迁移前的完整 URL。
 * 公共转换器会拼接父级，形成 .../分类//原地址；只在本模块恢复原地址。
 * 不创建路由、不根据组件推测地址，不改变菜单授权、隐藏状态或 query 元数据。
 */
export function restoreBusinessReportPaths<T extends BusinessReportRoute>(
  routes: T[],
): T[] {
  function isValidLocalPath(path: string): boolean {
    return path.startsWith('/') && !path.includes('//');
  }

  function findFirstLeafPath(route: BusinessReportRoute): string | undefined {
    if (!route.children?.length) {
      return isValidLocalPath(route.path) ? route.path : undefined;
    }
    for (const child of route.children) {
      const path = findFirstLeafPath(child);
      if (path) return path;
    }
  }

  function restore<R extends BusinessReportRoute>(
    route: R,
    insideReports: boolean,
  ): R {
    const isReports = insideReports || route.name === 'ErpBusinessReports';
    const result = { ...route };
    const separator = route.path.indexOf('//');
    if (isReports && separator !== -1) {
      const originalPath = route.path.slice(separator + 1);
      // 仅接受同站绝对路径，拒绝协议相对路径及重复拼接的异常值。
      if (isValidLocalPath(originalPath)) {
        result.path = originalPath;
      }
    }
    if (route.children) {
      result.children = route.children.map((child) =>
        restore(child, isReports),
      );
      const firstLeafPath = findFirstLeafPath(result);
      if (isReports && firstLeafPath && firstLeafPath !== result.path) {
        result.redirect = firstLeafPath;
      }
    }
    if (
      isReports &&
      (!result.children || result.children.length === 0) &&
      !result.component
    ) {
      const fallbackComponent =
        BUSINESS_REPORT_CATEGORY_COMPONENTS[result.path];
      if (fallbackComponent) {
        result.component = fallbackComponent;
      }
    }
    return result;
  }

  return routes.map((route) => restore(route, false));
}
