import type { SystemMenuApi } from '#/api/system/menu';

export interface ModuleItem {
  groupKey: string;
  groupLabel: string;
  key: string;
  label: string;
}

export interface MenuPermissionRule {
  components?: string[];
  permissions?: string[];
  prefixes?: string[];
}

export const MODULE_ITEMS: ModuleItem[] = [
  // 系统管理
  {
    groupKey: 'system',
    groupLabel: '系统管理',
    key: 'system_users',
    label: '人员管理',
  },
  {
    groupKey: 'system',
    groupLabel: '系统管理',
    key: 'system_dept',
    label: '部门管理',
  },
  {
    groupKey: 'system',
    groupLabel: '系统管理',
    key: 'system_role',
    label: '角色管理',
  },
  {
    groupKey: 'system',
    groupLabel: '系统管理',
    key: 'system_operate_log',
    label: '操作日志',
  },
  {
    groupKey: 'system',
    groupLabel: '系统管理',
    key: 'system_login_log',
    label: '登录日志',
  },
  // 基础数据
  {
    groupKey: 'base',
    groupLabel: '基础数据',
    key: 'erp_base_data',
    label: '基础选项',
  },
  {
    groupKey: 'base',
    groupLabel: '基础数据',
    key: 'erp_supplier',
    label: '供应商档案',
  },
  {
    groupKey: 'base',
    groupLabel: '基础数据',
    key: 'erp_customer',
    label: '客户档案',
  },
  {
    groupKey: 'parts_basic',
    groupLabel: '配件基本信息',
    key: 'erp_product',
    label: '配件信息',
  },
  {
    groupKey: 'parts_basic',
    groupLabel: '配件基本信息',
    key: 'erp_product_category',
    label: '配件分类',
  },
  {
    groupKey: 'parts_basic',
    groupLabel: '配件基本信息',
    key: 'erp_product_brand',
    label: '配件品牌',
  },
  {
    groupKey: 'parts_basic',
    groupLabel: '配件基本信息',
    key: 'erp_product_unit',
    label: '配件单位',
  },
  {
    groupKey: 'base',
    groupLabel: '基础数据',
    key: 'erp_price_system',
    label: '价格体系',
  },
  // 采购管理
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_order',
    label: '采购订单',
  },
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_in',
    label: '采购入库',
  },
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_return',
    label: '采购退货',
  },
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_invoice',
    label: '采购票据',
  },
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_price_adjust',
    label: '采购调价',
  },
  {
    groupKey: 'purchase',
    groupLabel: '采购管理',
    key: 'erp_purchase_report',
    label: '采购报表',
  },
  // 销售管理
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_quote',
    label: '销售报价',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_order',
    label: '销售订单',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_cart',
    label: '销售手推车',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_out',
    label: '销售单',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_return',
    label: '销售退货',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_price_adjust',
    label: '销售调价',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_config',
    label: '销售配置',
  },
  {
    groupKey: 'sale',
    groupLabel: '销售管理',
    key: 'erp_sale_report',
    label: '销售报表',
  },
  // 库存管理
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_in',
    label: '库存入库',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_out',
    label: '库存出库',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_move',
    label: '库存调拨（历史只读）',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_transfer_out',
    label: '调拨出库单',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_transfer_in',
    label: '调拨入库单',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_warehouse_move',
    label: '仓库移货单',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_check',
    label: '库存盘点',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock',
    label: '产品库存',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_record',
    label: '库存进出流水明细账',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_out_bill',
    label: '出仓单',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_stock_in_bill',
    label: '入仓单',
  },
  {
    groupKey: 'stock',
    groupLabel: '库存管理',
    key: 'erp_warehouse',
    label: '仓库管理',
  },
  // 资金管理
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_account',
    label: '账户信息',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payment',
    label: '付款单',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receipt',
    label: '收款单',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_transfer',
    label: '转账单',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receivable_account',
    label: '应收账款',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receivable_report',
    label: '应收报表',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payable_account',
    label: '应付账款',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payable_report',
    label: '应付报表',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payable_expense',
    label: '费用支付',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payable_other',
    label: '应付调账',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receivable_other_income',
    label: '其他收入',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receivable_other',
    label: '应收调账',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_receivable_misc',
    label: '其他应收',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_payable_misc',
    label: '其他应付',
  },
  {
    groupKey: 'finance',
    groupLabel: '资金管理',
    key: 'erp_finance_settlement_offset',
    label: '应收冲应付',
  },
  // 财务核算
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_subject',
    label: '会计科目',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_book_open',
    label: '系统开账',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_voucher',
    label: '凭证列表',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_voucher_attribution',
    label: '凭证生成',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_voucher_word',
    label: '凭证字',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_balance_sheet',
    label: '资产负债表',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_income_statement',
    label: '利润表',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_cash_flow',
    label: '现金流量表',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_other_receivable',
    label: '其他应收单',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_pre_receipt',
    label: '预收款单',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_pre_payment',
    label: '预付款单',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_pre_receivable',
    label: '预收账款单',
  },
  {
    groupKey: 'accounting',
    groupLabel: '财务核算',
    key: 'erp_accounting_other_payable',
    label: '其他应付单',
  },
  // ERP 系统配置
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_system_report',
    label: '系统报表',
  },
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_recycle_bin',
    label: '回收站',
  },
  {
    groupKey: 'parts_basic',
    groupLabel: '配件基本信息',
    key: 'erp_parts_price_adjust',
    label: '配件价格调整',
  },
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_system_field_config',
    label: '字段配置',
  },
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_product_custom_field',
    label: '新增自定义字段',
  },
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_system_search_field_config',
    label: '搜索字段配置',
  },
  {
    groupKey: 'erp_system',
    groupLabel: 'ERP系统配置',
    key: 'erp_form_data_permission',
    label: '表单数据权限配置',
  },
];

const MENU_PERMISSION_RULES: Record<string, MenuPermissionRule> = {
  system_users: { prefixes: ['system:user:'] },
  system_dept: { prefixes: ['system:dept:'] },
  system_role: { prefixes: ['system:role:'] },
  system_operate_log: { prefixes: ['system:operate-log:'] },
  system_login_log: { prefixes: ['system:login-log:'] },
  erp_finance_receivable_account: {
    prefixes: ['erp:receivable-account:'],
  },
  erp_finance_receivable_report: {
    prefixes: ['erp:receivable-report:'],
  },
  erp_finance_payable_account: { prefixes: ['erp:payable-account:'] },
  erp_finance_payable_report: { prefixes: ['erp:payable-report:'] },
  erp_finance_payable_expense: { prefixes: ['erp:payable-expense:'] },
  erp_finance_payable_other: { prefixes: ['erp:payable-other:'] },
  erp_finance_payable_misc: { prefixes: ['erp:payable-misc:'] },
  erp_finance_receivable_other_income: {
    prefixes: ['erp:receivable-other-income:'],
  },
  erp_finance_receivable_other: { prefixes: ['erp:receivable-other:'] },
  erp_finance_receivable_misc: { prefixes: ['erp:receivable-misc:'] },
  erp_finance_settlement_offset: { prefixes: ['erp:settlement-offset:'] },
  erp_price_system: { prefixes: ['erp:price-system:'] },
  erp_accounting_subject: { prefixes: ['erp:accounting-subject:'] },
  erp_accounting_book_open: { prefixes: ['erp:book-open:'] },
  erp_accounting_voucher: { prefixes: ['erp:voucher:'] },
  erp_accounting_voucher_attribution: {
    prefixes: ['erp:voucher-attribution:'],
  },
  erp_accounting_voucher_word: { prefixes: ['erp:voucher-word:'] },
  erp_accounting_balance_sheet: { prefixes: ['erp:balance-sheet:'] },
  erp_accounting_income_statement: {
    prefixes: ['erp:income-statement:'],
  },
  erp_accounting_cash_flow: { prefixes: ['erp:cash-flow:'] },
  erp_accounting_other_receivable: {
    prefixes: ['erp:other-receivable:'],
  },
  erp_accounting_pre_receipt: { prefixes: ['erp:pre-receipt:'] },
  erp_accounting_pre_payment: { prefixes: ['erp:pre-payment:'] },
  erp_accounting_pre_receivable: {
    prefixes: ['erp:pre-receivable:'],
  },
  erp_accounting_other_payable: { prefixes: ['erp:other-payable:'] },
  erp_stock_out_bill: { prefixes: ['erp:stock-out-bill:'] },
  erp_stock_in_bill: { prefixes: ['erp:stock-in-bill:'] },
  erp_warehouse: {
    prefixes: [
      'erp:warehouse:',
      'erp:warehouse-permission:',
      'erp:warehouse-picker:',
    ],
  },
  erp_recycle_bin: { prefixes: ['erp:recycle-bin:'] },
  erp_product: {
    components: ['erp/product/product/index'],
    prefixes: ['erp:product:'],
  },
  erp_product_brand: {
    components: ['erp/product/brand/index'],
    prefixes: ['erp:product-brand:'],
  },
  erp_parts_price_adjust: {
    components: ['erp/purchase/price-adjust/index'],
    permissions: [
      'erp:product:query',
      'erp:product:update',
      'erp:parts:adjust-price',
    ],
  },
  erp_system_field_config: {
    components: ['erp/system/fieldconfig/index'],
    permissions: ['erp:field-config:query', 'erp:field-config:update'],
  },
  erp_product_custom_field: {
    components: ['erp/system/fieldconfig/custom-field'],
    permissions: [
      'erp:field-config:query',
      'erp:field-config:update',
      'erp:field-config:create-custom-field',
    ],
  },
  erp_system_search_field_config: {
    prefixes: ['erp:search-field-config:'],
  },
  erp_form_data_permission: {
    components: ['erp/system/form-data-permission/index'],
    prefixes: ['system:form-data-permission:'],
  },
};

/**
 * 静态清单仅保留 formKey 与菜单/字段权限之间的技术映射。
 * 角色权限弹窗中的中文名称、分组和层级必须来自真实菜单树。
 */
export function getMenuPermissionRule(module: string): MenuPermissionRule {
  const explicitRule = MENU_PERMISSION_RULES[module];
  if (explicitRule) {
    return explicitRule;
  }
  if (module.startsWith('erp_')) {
    return {
      prefixes: [`erp:${module.slice(4).replaceAll('_', '-')}:`],
    };
  }
  return {};
}

/** 按 component、精确权限码、权限前缀的顺序解析稳定 formKey。 */
export function resolveMenuPermissionModule(
  nodes: Array<Pick<SystemMenuApi.Menu, 'component' | 'permission'>>,
) {
  const componentMatch = MODULE_ITEMS.find((item) => {
    const components = getMenuPermissionRule(item.key).components || [];
    return nodes.some(
      (node) => !!node.component && components.includes(node.component),
    );
  });
  if (componentMatch) {
    return componentMatch.key;
  }

  const permissionMatch = MODULE_ITEMS.find((item) => {
    const permissions = getMenuPermissionRule(item.key).permissions || [];
    return nodes.some(
      (node) => !!node.permission && permissions.includes(node.permission),
    );
  });
  if (permissionMatch) {
    return permissionMatch.key;
  }

  return MODULE_ITEMS.find((item) => {
    const prefixes = getMenuPermissionRule(item.key).prefixes || [];
    return nodes.some(
      (node) =>
        !!node.permission &&
        prefixes.some((prefix) => node.permission.startsWith(prefix)),
    );
  })?.key;
}
