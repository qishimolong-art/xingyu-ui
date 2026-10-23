import type { SystemMenuApi } from '#/api/system/menu';

import { describe, expect, it } from 'vitest';

import { resolveMenuPermissionModule } from './module-items';

import {
  addManagedMenuAncestorIds,
  buildMenuTree,
  buildPermissionFormScope,
  filterAssignableMenus,
  filterPermissionTree,
  flattenMenuTree,
  getManagedMenuIds,
  getMenuCheckedState,
  getPermissionAncestorIds,
  getVisibleFormIds,
  mergeManagedMenuIds,
} from './permission-tree';

function menu(
  id: number,
  name: string,
  parentId: number,
  options: Partial<SystemMenuApi.Menu> = {},
): SystemMenuApi.Menu {
  return {
    alwaysShow: true,
    component: '',
    createTime: new Date(),
    icon: '',
    id,
    keepAlive: true,
    name,
    parentId,
    path: '',
    permission: '',
    sort: id,
    status: 0,
    type: 1,
    visible: true,
    ...options,
  };
}

const menus = [
  menu(1, '系统管理', 0, { path: '/system' }),
  menu(10, '用户管理', 1, {
    component: 'system/user/index',
    path: 'user',
    type: 2,
  }),
  menu(11, '用户查询', 10, { permission: 'system:user:list', type: 3 }),
  menu(900676, '配置租户访问范围', 10, {
    permission: 'system:tenant:visit-scope',
    type: 3,
  }),
  menu(12, '角色管理', 1, {
    component: 'system/role/index',
    path: 'role',
    type: 2,
  }),
  menu(13, '部门管理', 1, {
    component: 'system/dept/index',
    path: 'dept',
    type: 2,
  }),
  menu(14, '菜单管理', 1, {
    component: 'system/menu/index',
    path: 'menu',
    type: 2,
  }),
  menu(15, '审计日志', 1, { path: 'log' }),
  menu(16, '操作日志', 15, { path: 'operate-log', type: 2 }),
  menu(17, '登录日志', 15, { path: 'login-log', type: 2 }),
  menu(1224, '租户管理', 1, { path: 'tenant' }),
  menu(1138, '租户列表', 1224, {
    component: 'system/tenant/index',
    path: 'list',
    type: 2,
  }),
  menu(1139, '租户查询', 1138, {
    permission: 'system:tenant:query',
    type: 3,
  }),
  menu(1140, '租户创建', 1138, {
    permission: 'system:tenant:create',
    type: 3,
  }),
  menu(1141, '租户更新', 1138, {
    permission: 'system:tenant:update',
    type: 3,
  }),
  menu(1142, '租户删除', 1138, {
    permission: 'system:tenant:delete',
    type: 3,
  }),
  menu(1143, '租户导出', 1138, {
    permission: 'system:tenant:export',
    type: 3,
  }),
  menu(5010, '租户切换', 1138, {
    permission: 'system:tenant:visit',
    type: 3,
  }),
  menu(1225, '租户套餐', 1224, {
    component: 'system/tenantPackage/index',
    path: 'package',
    type: 2,
  }),
  menu(1226, '租户套餐查询', 1225, {
    permission: 'system:tenant-package:query',
    type: 3,
  }),
  menu(100, 'ERP 系统', 0, { path: '/erp', sort: 1 }),
  menu(110, '库存管理', 100, { path: 'stock' }),
  menu(111, '产品库存', 110, {
    component: 'erp/stock/stock/index',
    path: 'stock',
    type: 2,
  }),
  menu(112, '库存查询', 111, { permission: 'erp:stock:query', type: 3 }),
  menu(113, '库存详情', 111, {
    path: 'detail',
    type: 2,
    visible: false,
  }),
  menu(200, '商城系统', 0, { path: '/mall', sort: 2 }),
  menu(210, '商品中心', 200, { path: 'product' }),
  menu(211, '商品列表', 210, {
    component: 'mall/product/spu/index',
    path: 'spu',
    type: 2,
  }),
  menu(212, '商品查询', 211, {
    permission: 'mall:product:spu:query',
    type: 3,
  }),
  menu(213, '商品详情', 211, {
    path: 'detail',
    type: 2,
    visible: false,
  }),
  menu(220, '订单中心', 200, { path: 'trade' }),
  menu(221, '订单列表', 220, {
    component: 'mall/trade/order/index',
    path: 'order',
    type: 2,
  }),
];

describe('role permission form tree', () => {
  it('maps price-system and system forms to their stable field modules', () => {
    expect(
      resolveMenuPermissionModule([
        { component: '', permission: 'erp:price-system:query' },
      ]),
    ).toBe('erp_price_system');
    expect(
      resolveMenuPermissionModule([
        { component: 'system/role/index', permission: '' },
        { component: '', permission: 'system:role:query' },
      ]),
    ).toBe('system_role');
  });

  it('keeps mall pages out of ERP field and data-scope modules', () => {
    expect(
      resolveMenuPermissionModule([
        {
          component: 'mall/product/spu/index',
          permission: 'mall:product:spu:query',
        },
      ]),
    ).toBeUndefined();
  });

  it('maps sale cart data permissions to the runtime ERP form key', () => {
    expect(
      resolveMenuPermissionModule([
        { component: 'erp/sale/cart/index', permission: '' },
        { component: '', permission: 'erp:sale-cart:query' },
        { component: '', permission: 'erp:sale-cart:update' },
      ]),
    ).toBe('erp_sale_cart');
  });

  it('maps misc receivable and payable permissions to their new forms', () => {
    expect(
      resolveMenuPermissionModule([
        { component: 'erp/finance/receivable/misc/index', permission: '' },
        { component: '', permission: 'erp:receivable-misc:query' },
      ]),
    ).toBe('erp_finance_receivable_misc');
    expect(
      resolveMenuPermissionModule([
        { component: 'erp/finance/payable/misc/index', permission: '' },
        { component: '', permission: 'erp:payable-misc:query' },
      ]),
    ).toBe('erp_finance_payable_misc');
  });

  it('keeps product and parts-price-adjust fields mapped to their own pages', () => {
    expect(
      resolveMenuPermissionModule([
        {
          component: 'erp/product/product/index',
          permission: '',
        },
        { component: '', permission: 'erp:product:query' },
        { component: '', permission: 'erp:product:update' },
      ]),
    ).toBe('erp_product');
    expect(
      resolveMenuPermissionModule([
        {
          component: 'erp/purchase/price-adjust/index',
          permission: '',
        },
        { component: '', permission: 'erp:product:query' },
        { component: '', permission: 'erp:product:update' },
        { component: '', permission: 'erp:parts:adjust-price' },
      ]),
    ).toBe('erp_parts_price_adjust');
  });

  it('uses the simple list as the tenant assignable boundary', () => {
    expect(filterAssignableMenus(menus, [{ id: 100 }, { id: 111 }])).toEqual([
      menus.find((item) => item.id === 100),
      menus.find((item) => item.id === 111),
    ]);
  });

  it('exposes the tenant list and management buttons only when requested', () => {
    const hiddenScope = buildPermissionFormScope(menus);
    expect(
      flattenMenuTree(hiddenScope.displayTree).map((node) => node.name),
    ).not.toContain('租户列表');

    const scope = buildPermissionFormScope(menus, {
      includeTenantList: true,
    });
    const systemRoot = scope.displayTree.find(
      (node) => node.name === '系统管理',
    );
    const tenantRoot = systemRoot?.children?.find(
      (node) => node.name === '租户管理',
    );
    expect(tenantRoot).toMatchObject({ id: 1224, type: 1 });
    expect(tenantRoot?.children?.map((node) => node.name)).toEqual([
      '租户列表',
    ]);

    const managedIds = getManagedMenuIds(scope.scopeTree);
    expect([...managedIds]).toEqual(
      expect.arrayContaining([1, 1224, 1138, 1139, 1140, 1141, 1142, 1143]),
    );
    expect(managedIds.has(5010)).toBe(false);
    expect(managedIds.has(1225)).toBe(false);
    expect(managedIds.has(1226)).toBe(false);
    expect(managedIds.has(900676)).toBe(true);
  });

  it('uses the real tenant-management ancestry for tenant list permissions', () => {
    const scope = buildPermissionFormScope(menus, {
      includeTenantList: true,
    });
    const sourceTree = buildMenuTree(menus);
    expect(getPermissionAncestorIds(1139, scope.scopeTree, sourceTree)).toEqual(
      [1138, 1224, 1],
    );

    const fullMenuTree = buildPermissionFormScope(menus).scopeTree;
    expect(getPermissionAncestorIds(111, fullMenuTree, fullMenuTree)).toEqual([
      110, 100,
    ]);
  });

  it('still builds the scoped tree when only simple-list fields are available', () => {
    const simpleMenus = menus.map(
      ({ component, id, name, parentId, permission, type }) =>
        ({
          component,
          id,
          name,
          parentId,
          permission,
          type,
        }) as SystemMenuApi.Menu,
    );
    const { displayTree } = buildPermissionFormScope(simpleMenus);
    const displayedNames = flattenMenuTree(displayTree).map(
      (node) => node.name,
    );
    expect(displayedNames).toContain('ERP 系统');
    expect(displayedNames).toContain('商城系统');
    expect(displayedNames).toContain('用户管理');
    expect(displayedNames).not.toContain('菜单管理');
  });

  it('keeps the mall tree inside the tenant assignable boundary', () => {
    const assignableMenus = filterAssignableMenus(menus, [
      { id: 200 },
      { id: 210 },
      { id: 211 },
    ]);
    const scope = buildPermissionFormScope(assignableMenus);
    const managedNames = flattenMenuTree(scope.scopeTree).map(
      (node) => node.name,
    );

    expect(managedNames).toEqual(['商城系统', '商品中心', '商品列表']);
    expect(managedNames).not.toContain('商品查询');
    expect(managedNames).not.toContain('订单中心');
  });

  it('preserves original permissions outside the managed form-tree scope', () => {
    const scope = buildPermissionFormScope(menus, {
      includeTenantList: true,
    });
    const managedIds = getManagedMenuIds(scope.scopeTree);
    const allMenuTree = buildMenuTree(menus);
    const mergedIds = mergeManagedMenuIds(
      [1, 1224, 1138, 1139],
      [1, 1224, 1138, 1140, 5010, 1225, 1226],
      managedIds,
    );

    expect(mergedIds).toEqual([1, 1224, 1138, 1139, 5010, 1225, 1226]);
    expect(
      addManagedMenuAncestorIds(
        mergedIds,
        managedIds,
        scope.scopeTree,
        allMenuTree,
      ),
    ).toEqual([1, 1224, 1138, 1139, 5010, 1225, 1226]);
    expect(
      addManagedMenuAncestorIds(
        [5010],
        managedIds,
        scope.scopeTree,
        allMenuTree,
      ),
    ).toEqual([5010]);
  });

  it('keeps all ERP and mall pages and only the selected system forms', () => {
    const scope = buildPermissionFormScope(menus);
    const displayedNames = flattenMenuTree(scope.displayTree).map(
      (node) => node.name,
    );
    const managedNames = flattenMenuTree(scope.scopeTree).map(
      (node) => node.name,
    );

    expect(displayedNames).toContain('产品库存');
    expect(displayedNames).toContain('商城系统');
    expect(displayedNames).toContain('商品列表');
    expect(displayedNames).toContain('订单列表');
    expect(displayedNames).toContain('用户管理');
    expect(displayedNames).toContain('操作日志');
    expect(displayedNames).not.toContain('菜单管理');
    expect(displayedNames).not.toContain('库存查询');
    expect(displayedNames).not.toContain('库存详情');
    expect(displayedNames).not.toContain('商品查询');
    expect(displayedNames).not.toContain('商品详情');
    expect(managedNames).toContain('库存查询');
    expect(managedNames).toContain('库存详情');
    expect(managedNames).toContain('商品查询');
    expect(managedNames).toContain('商品详情');
  });

  it('calculates partial mall selection without granting other mall pages', () => {
    const { displayTree } = buildPermissionFormScope(menus);
    const mallTree = displayTree.filter((node) => node.name === '商城系统');

    expect(getMenuCheckedState(mallTree, new Set([211]))).toEqual({
      checked: false,
      indeterminate: true,
    });
    expect(getMenuCheckedState(mallTree, new Set([211, 221]))).toEqual({
      checked: true,
      indeterminate: false,
    });
  });

  it('keeps ancestors when a child form matches search', () => {
    const { displayTree } = buildPermissionFormScope(menus);
    const result = filterPermissionTree(displayTree, '产品库存');
    expect(flattenMenuTree(result).map((node) => node.name)).toEqual([
      'ERP 系统',
      '库存管理',
      '产品库存',
    ]);
  });

  it('calculates page and directory checked states from visible forms', () => {
    const { displayTree } = buildPermissionFormScope(menus);
    const formIds = getVisibleFormIds(displayTree);
    expect(getMenuCheckedState(displayTree, new Set(formIds))).toEqual({
      checked: true,
      indeterminate: false,
    });
    expect(getMenuCheckedState(displayTree, new Set([111]))).toEqual({
      checked: false,
      indeterminate: true,
    });
  });
});
