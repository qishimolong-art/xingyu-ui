import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { convertServerMenuToRouteRecordStringComponent } from '../../../../packages/utils/src/helpers/generate-menus';
import {
  cloneAccessMenuTree,
  restoreBusinessReportPaths,
} from './business-reports';

describe('经营报表迁移后的授权路由', () => {
  it('恢复数据库保存的旧地址，并保留组件 query、隐藏属性和路由名称', () => {
    const menus = [
      {
        id: 1,
        parentId: 0,
        path: '/erp',
        name: 'ERP 系统',
        visible: true,
        children: [
          {
            id: 2,
            parentId: 1,
            path: 'business-report',
            name: '经营报表',
            componentName: 'ErpBusinessReports',
            visible: true,
            children: [
              {
                id: 3,
                parentId: 2,
                path: 'purchase',
                name: '采购及供应商经营',
                visible: true,
                children: [
                  {
                    id: 4,
                    parentId: 3,
                    path: '/erp/custom-purchase/report',
                    name: '采购报表',
                    componentName: 'ErpPurchaseReport',
                    visible: false,
                    keepAlive: true,
                    component: 'erp/purchase/report/index?mode=detail',
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as unknown as Parameters<
      typeof convertServerMenuToRouteRecordStringComponent
    >[0];
    const originalMenus = structuredClone(menus);
    const converted = convertServerMenuToRouteRecordStringComponent(
      cloneAccessMenuTree(menus),
    );
    const result = restoreBusinessReportPaths(converted);
    const report = result[0]?.children?.[0]?.children?.[0]?.children?.[0];
    if (!report) throw new Error('report route should exist');
    expect(report.path).toBe('/erp/custom-purchase/report');
    expect(report.name).toBe('ErpPurchaseReport');
    expect(report.component).toBe('erp/purchase/report/index');
    expect(report.meta).toMatchObject({
      hideInMenu: true,
      keepAlive: true,
      query: { mode: 'detail' },
    });
    expect(
      converted[0]?.children?.[0]?.children?.[0]?.children?.[0]?.path,
    ).toBe('/erp/business-report/purchase//erp/custom-purchase/report');
    expect(restoreBusinessReportPaths(result)).toEqual(result);
    const rebuilt = restoreBusinessReportPaths(
      convertServerMenuToRouteRecordStringComponent(cloneAccessMenuTree(menus)),
    );
    expect(rebuilt).toEqual(result);
    expect(menus).toEqual(originalMenus);
  });

  it('仅采购菜单保持仅采购；仅父菜单不会生成任何报表页面', () => {
    const routes = [
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'purchase',
            path: '/erp/business-report/purchase',
            children: [
              {
                name: 'ErpPurchaseReport',
                path: '/erp/business-report/purchase//erp/purchase/report',
              },
            ],
          },
        ],
      },
    ];
    expect(
      restoreBusinessReportPaths(routes)[0]?.children?.[0]?.children,
    ).toEqual([{ name: 'ErpPurchaseReport', path: '/erp/purchase/report' }]);
    const parentOnly = [
      { name: 'ErpBusinessReports', path: '/erp/business-report' },
    ];
    expect(restoreBusinessReportPaths(parentOnly)).toEqual(parentOnly);
    expect(restoreBusinessReportPaths([])).toEqual([]);
  });

  it('经营报表分类没有授权子页面时使用模块页面兜底，避免分类地址空白', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_sale',
            path: '/erp/business-report/sale',
            component: '',
          },
          {
            name: 'ErpBusinessReports_purchase',
            path: '/erp/business-report/purchase',
          },
        ],
      },
    ]);
    expect(routes[0]?.children?.[0]).toMatchObject({
      path: '/erp/business-report/sale',
      component: 'erp/sale/report/index',
    });
    expect(routes[0]?.children?.[1]).toMatchObject({
      path: '/erp/business-report/purchase',
      component: 'erp/purchase/report/index',
    });

    const transferRoutes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_transfer',
            path: '/erp/business-report/transfer',
          },
        ],
      },
    ]);
    expect(transferRoutes[0]?.children?.[0]).toMatchObject({
      path: '/erp/business-report/transfer',
      component: 'erp/report/transfer/index',
    });
  });

  it('同组件的模块外路由、禁用及隐藏状态都不改变', () => {
    const routes = [
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpPurchaseReport',
            path: '/erp/business-report/purchase//erp/purchase/report',
            component: 'erp/purchase/report/index',
            meta: { hideInMenu: true },
            status: 1,
          },
        ],
      },
      {
        name: 'OtherModule',
        path: '/other//custom',
        component: 'erp/purchase/report/index',
        meta: { hideInMenu: false },
        status: 0,
      },
    ];
    const result = restoreBusinessReportPaths(routes);
    expect(result[1]).toEqual(routes[1]);
    expect(result[0]?.children?.[0]).toMatchObject({
      status: 1,
      meta: { hideInMenu: true },
    });
  });

  it('异常协议相对或多次拼接地址不被改成外站地址', () => {
    const routes = [
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          { path: '/erp/business-report/sale///other.example/report' },
          { path: '/erp/business-report/sale//erp//sale/report' },
        ],
      },
    ];
    expect(restoreBusinessReportPaths(routes)).toEqual(routes);
  });

  it('经营报表目录打开时自动进入第一个子报表，避免目录空白页', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_sale',
            path: '/erp/business-report/sale',
            component,
            children: [
              {
                name: 'ErpSaleReport',
                component,
                path: '/erp/business-report/sale//erp/sale/report',
              },
            ],
          },
          {
            name: 'ErpBusinessReports_purchase',
            path: '/erp/business-report/purchase',
            component,
            children: [
              {
                name: 'ErpPurchaseReport',
                component,
                path: '/erp/business-report/purchase//erp/purchase/report',
              },
            ],
          },
        ],
      },
    ]);
    expect((routes[0] as any)?.redirect).toBe('/erp/sale/report');
    expect((routes[0]?.children?.[0] as any)?.redirect).toBe(
      '/erp/sale/report',
    );
    expect((routes[0]?.children?.[1] as any)?.redirect).toBe(
      '/erp/purchase/report',
    );

    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(
      router.resolve('/erp/business-report/sale').redirectedFrom,
    ).toBeUndefined();
    expect(routes[0]?.children?.[0]?.children?.[0]?.path).toBe(
      '/erp/sale/report',
    );
  });

  it('Vue Router 的旧收藏链接和 query 下钻仍定位同一报表', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'PurchaseCategory',
            path: '/erp/business-report/purchase',
            component,
            children: [
              {
                name: 'ErpPurchaseReport',
                component,
                path: '/erp/business-report/purchase//erp/purchase/report',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    const target = router.resolve(
      '/erp/purchase/report?productId=12&warehouseId=8',
    );
    expect(target.name).toBe('ErpPurchaseReport');
    expect(target.query).toEqual({ productId: '12', warehouseId: '8' });
    expect(target.matched.map((record) => record.name)).toEqual([
      'ErpBusinessReports',
      'PurchaseCategory',
      'ErpPurchaseReport',
    ]);
    expect(
      router.resolve({ name: 'ErpPurchaseReport', query: { productId: 12 } })
        .fullPath,
    ).toBe('/erp/purchase/report?productId=12');
  });

  it('销售采购往来报表菜单恢复为原访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_otherSettlement',
            path: '/erp/business-report/other-settlement',
            component,
            children: [
              {
                name: 'ErpReceivableReport',
                component,
                path: '/erp/business-report/other-settlement//erp/finance/receivable/report',
              },
              {
                name: 'ErpPayableReport',
                component,
                path: '/erp/business-report/other-settlement//erp/finance/payable/report',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/finance/receivable/report').name).toBe(
      'ErpReceivableReport',
    );
    expect(router.resolve('/erp/finance/payable/report').name).toBe(
      'ErpPayableReport',
    );
    expect(
      router.resolve('/erp/finance/receivable/report?customerId=12').query,
    ).toEqual({ customerId: '12' });
  });
  it('系统分析报表菜单恢复为原访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_profit',
            path: '/erp/business-report/profit',
            component,
            children: [
              {
                name: 'ErpSystemReport',
                component,
                path: '/erp/business-report/profit//erp/system-report',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/system-report').name).toBe('ErpSystemReport');
    expect(router.resolve({ name: 'ErpSystemReport' }).fullPath).toBe(
      '/erp/system-report',
    );
  });
  it('经营报表总览入口菜单恢复为经营报表访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpReportOverview',
            component,
            path: '/erp/business-report//erp/report/overview',
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/report/overview').name).toBe(
      'ErpReportOverview',
    );
  });
  it('07/08/10 汇总入口菜单恢复为经营报表访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_accountFund',
            path: '/erp/business-report/account-fund',
            component,
            children: [
              {
                name: 'ErpReportAccountFund',
                component,
                path: '/erp/business-report/account-fund//erp/report/account-fund',
              },
            ],
          },
          {
            name: 'ErpBusinessReports_expenseIncome',
            path: '/erp/business-report/expense-income',
            component,
            children: [
              {
                name: 'ErpReportExpenseIncome',
                component,
                path: '/erp/business-report/expense-income//erp/report/expense-income',
              },
            ],
          },
          {
            name: 'ErpBusinessReports_financialStatement',
            path: '/erp/business-report/financial-statement',
            component,
            children: [
              {
                name: 'ErpReportFinancialStatement',
                component,
                path: '/erp/business-report/financial-statement//erp/report/financial-statement',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/report/account-fund').name).toBe(
      'ErpReportAccountFund',
    );
    expect(router.resolve('/erp/report/expense-income').name).toBe(
      'ErpReportExpenseIncome',
    );
    expect(router.resolve('/erp/report/financial-statement').name).toBe(
      'ErpReportFinancialStatement',
    );
  });
  it('固定资产及折旧独立页面可直接解析到固定资产经营报表组件', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_fixedAsset',
            path: '/erp/business-report/fixed-asset',
            component,
            children: [
              {
                name: 'ErpBusinessReportFixedAssetCard',
                component,
                path: '/erp/business-report/fixed-asset/asset-card',
              },
              {
                name: 'ErpBusinessReportFixedAssetDepreciationDetail',
                component,
                path: '/erp/business-report/fixed-asset/depreciation-detail',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(
      router.resolve('/erp/business-report/fixed-asset/asset-card').name,
    ).toBe('ErpBusinessReportFixedAssetCard');
    expect(
      router.resolve('/erp/business-report/fixed-asset/depreciation-detail')
        .name,
    ).toBe('ErpBusinessReportFixedAssetDepreciationDetail');
  });
  it('固定资产和异常审计新增骨架菜单恢复为经营报表访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_fixedAsset',
            path: '/erp/business-report/fixed-asset',
            component,
            children: [
              {
                name: 'ErpReportFixedAsset',
                component,
                path: '/erp/business-report/fixed-asset//erp/report/fixed-asset',
              },
            ],
          },
          {
            name: 'ErpBusinessReports_auditTracePerformance',
            path: '/erp/business-report/audit-trace-performance',
            component,
            children: [
              {
                name: 'ErpReportAuditTracePerformance',
                component,
                path: '/erp/business-report/audit-trace-performance//erp/report/audit-trace-performance',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/report/fixed-asset').name).toBe(
      'ErpReportFixedAsset',
    );
    expect(router.resolve('/erp/report/audit-trace-performance').name).toBe(
      'ErpReportAuditTracePerformance',
    );
  });
  it('销售采购往来及对账独立页面入口使用新经营报表组件', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_counterparty',
            path: '/erp/business-report/counterparty',
            children: [
              {
                name: 'ErpBusinessReportCounterpartyCustomerReceivable',
                path: '/erp/business-report/counterparty/customer-receivable',
                component: 'erp/report/counterparty/index',
              },
              {
                name: 'ErpBusinessReportCounterpartySupplierPayable',
                path: '/erp/business-report/counterparty/supplier-payable',
                component: 'erp/report/counterparty/index',
              },
            ],
          },
        ],
      },
    ]);
    const group = routes[0]?.children?.[0] as
      | undefined
      | { children?: Array<{ component?: unknown }>; redirect?: unknown };
    expect(group?.redirect).toBe(
      '/erp/business-report/counterparty/customer-receivable',
    );
    expect(group?.children?.[0]?.component).toBe(
      'erp/report/counterparty/index',
    );
    expect(group?.children?.[1]?.component).toBe(
      'erp/report/counterparty/index',
    );
  });

  it('账户资金及总部归集独立页面入口使用新经营报表组件', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_accountFund',
            path: '/erp/business-report/account-fund',
            children: [
              {
                name: 'ErpBusinessReportAccountFundLedger',
                path: '/erp/business-report/account-fund/account-ledger',
                component: 'erp/report/account-fund/index',
              },
              {
                name: 'ErpBusinessReportAccountFundBalance',
                path: '/erp/business-report/account-fund/account-balance',
                component: 'erp/report/account-fund/index',
              },
            ],
          },
        ],
      },
    ]);
    const group = routes[0]?.children?.[0] as
      | undefined
      | { children?: Array<{ component?: unknown }>; redirect?: unknown };
    expect(group?.redirect).toBe(
      '/erp/business-report/account-fund/account-ledger',
    );
    expect(group?.children?.[0]?.component).toBe(
      'erp/report/account-fund/index',
    );
    expect(group?.children?.[1]?.component).toBe(
      'erp/report/account-fund/index',
    );
  });

  it('费用分摊及经营收支独立页面入口使用新经营报表组件', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_expenseIncome',
            path: '/erp/business-report/expense-income',
            children: [
              {
                name: 'ErpBusinessReportExpenseIncomeExpenseDetail',
                path: '/erp/business-report/expense-income/expense-detail',
                component: 'erp/report/expense-income/index',
              },
              {
                name: 'ErpBusinessReportExpenseIncomeDepartmentExpense',
                path: '/erp/business-report/expense-income/department-expense',
                component: 'erp/report/expense-income/index',
              },
            ],
          },
        ],
      },
    ]);
    const group = routes[0]?.children?.[0] as
      | undefined
      | { children?: Array<{ component?: unknown }>; redirect?: unknown };
    expect(group?.redirect).toBe(
      '/erp/business-report/expense-income/expense-detail',
    );
    expect(group?.children?.[0]?.component).toBe(
      'erp/report/expense-income/index',
    );
    expect(group?.children?.[1]?.component).toBe(
      'erp/report/expense-income/index',
    );
  });

  it('部门利润及驾驶舱独立页面入口使用新经营报表组件', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_profit',
            path: '/erp/business-report/profit',
            children: [
              {
                name: 'ErpBusinessReportProfitDepartment',
                path: '/erp/business-report/profit/department-profit',
                component: 'erp/report/profit-dashboard/index',
              },
              {
                name: 'ErpBusinessReportProfitCompany',
                path: '/erp/business-report/profit/company-profit',
                component: 'erp/report/profit-dashboard/index',
              },
            ],
          },
        ],
      },
    ]);
    const group = routes[0]?.children?.[0] as
      | undefined
      | { children?: Array<{ component?: unknown }>; redirect?: unknown };
    expect(group?.redirect).toBe(
      '/erp/business-report/profit/department-profit',
    );
    expect(group?.children?.[0]?.component).toBe(
      'erp/report/profit-dashboard/index',
    );
    expect(group?.children?.[1]?.component).toBe(
      'erp/report/profit-dashboard/index',
    );
  });
  it('其他应收及其他应付独立页面入口使用新经营报表组件', () => {
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        children: [
          {
            name: 'ErpBusinessReports_otherSettlement',
            path: '/erp/business-report/other-settlement',
            children: [
              {
                name: 'ErpBusinessReportOtherSettlementReceivable',
                path: '/erp/business-report/other-settlement/other-receivable',
                component: 'erp/report/other-settlement/index',
              },
              {
                name: 'ErpBusinessReportOtherSettlementPayable',
                path: '/erp/business-report/other-settlement/other-payable',
                component: 'erp/report/other-settlement/index',
              },
            ],
          },
        ],
      },
    ]);
    const group = routes[0]?.children?.[0] as
      | undefined
      | { children?: Array<{ component?: unknown }>; redirect?: unknown };
    expect(group?.redirect).toBe(
      '/erp/business-report/other-settlement/other-receivable',
    );
    expect(group?.children?.[0]?.component).toBe(
      'erp/report/other-settlement/index',
    );
    expect(group?.children?.[1]?.component).toBe(
      'erp/report/other-settlement/index',
    );
  });
  it('完整经营报表树下的各业务模块菜单都恢复到原访问地址', () => {
    const component = { template: '<router-view />' };
    const entries = [
      ['overview', 'ErpReportOverview', '/erp/report/overview'],
      ['sale', 'ErpSaleReport', '/erp/sale/report'],
      ['purchase', 'ErpPurchaseReport', '/erp/purchase/report'],
      ['stock-trace', 'ErpStockReport', '/erp/stock/report'],
      ['stock-trace', 'ErpStockRecord', '/erp/stock/record'],
      ['transfer', 'ErpStockTransferLedger', '/erp/stock/transfer-ledger'],
      ['counterparty', 'ErpReceivableReport', '/erp/finance/receivable/report'],
      ['counterparty', 'ErpPayableReport', '/erp/finance/payable/report'],
      ['profit', 'ErpSystemReport', '/erp/system-report'],
      ['account-fund', 'ErpReportAccountFund', '/erp/report/account-fund'],
      [
        'expense-income',
        'ErpReportExpenseIncome',
        '/erp/report/expense-income',
      ],
      [
        'financial-statement',
        'ErpReportFinancialStatement',
        '/erp/report/financial-statement',
      ],
      ['fixed-asset', 'ErpReportFixedAsset', '/erp/report/fixed-asset'],
      [
        'audit-trace-performance',
        'ErpReportAuditTracePerformance',
        '/erp/report/audit-trace-performance',
      ],
      [
        'financial-report',
        'ErpBusinessReportFinancialReportTemplate',
        '/erp/report/financial/report-template',
      ],
      [
        'financial-report',
        'ErpBusinessReportFinancialBalanceSheet',
        '/erp/report/financial/balance-sheet',
      ],
      [
        'financial-report',
        'ErpBusinessReportFinancialIncomeStatement',
        '/erp/report/financial/income-statement',
      ],
      [
        'financial-report',
        'ErpBusinessReportFinancialCashFlow',
        '/erp/report/financial/cash-flow',
      ],
    ] as const;
    const groupMap = new Map<
      string,
      { children: any[]; name: string; path: string }
    >();
    for (const [group, name, path] of entries) {
      if (!groupMap.has(group)) {
        groupMap.set(group, {
          name: `ErpBusinessReports_${group}`,
          path: `/erp/business-report/${group}`,
          children: [],
        });
      }
      const groupNode = groupMap.get(group);
      expect(groupNode).toBeDefined();
      groupNode?.children.push({
        name,
        component,
        path: `/erp/business-report/${group}/${path}`,
      });
    }
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [...groupMap.values()].map((group) => ({
          ...group,
          component,
        })),
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    for (const [, name, path] of entries) {
      expect(router.resolve(path).name).toBe(name);
    }
  });
  it('财务报表 wrapper 菜单恢复为经营报表访问地址', () => {
    const component = { template: '<router-view />' };
    const routes = restoreBusinessReportPaths([
      {
        name: 'ErpBusinessReports',
        path: '/erp/business-report',
        component,
        children: [
          {
            name: 'ErpBusinessReports_financialReport',
            path: '/erp/business-report/financial-report',
            component,
            children: [
              {
                name: 'ErpBusinessReportFinancialReportTemplate',
                component,
                path: '/erp/business-report/financial-report//erp/report/financial/report-template',
              },
              {
                name: 'ErpBusinessReportFinancialBalanceSheet',
                component,
                path: '/erp/business-report/financial-report//erp/report/financial/balance-sheet',
              },
              {
                name: 'ErpBusinessReportFinancialIncomeStatement',
                component,
                path: '/erp/business-report/financial-report//erp/report/financial/income-statement',
              },
              {
                name: 'ErpBusinessReportFinancialCashFlow',
                component,
                path: '/erp/business-report/financial-report//erp/report/financial/cash-flow',
              },
            ],
          },
        ],
      },
    ]);
    const router = createRouter({ history: createMemoryHistory(), routes });
    expect(router.resolve('/erp/report/financial/report-template').name).toBe(
      'ErpBusinessReportFinancialReportTemplate',
    );
    expect(router.resolve('/erp/report/financial/balance-sheet').name).toBe(
      'ErpBusinessReportFinancialBalanceSheet',
    );
    expect(router.resolve('/erp/report/financial/income-statement').name).toBe(
      'ErpBusinessReportFinancialIncomeStatement',
    );
    expect(router.resolve('/erp/report/financial/cash-flow').name).toBe(
      'ErpBusinessReportFinancialCashFlow',
    );
  });
});
