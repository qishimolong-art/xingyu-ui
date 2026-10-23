import type { SystemMenuApi } from '#/api/system/menu';

export type MenuTreeNode = SystemMenuApi.Menu & {
  children?: MenuTreeNode[];
};

export interface PermissionFormScope {
  /** 左侧实际展示的目录、页面树（不包含按钮和隐藏路由） */
  displayTree: MenuTreeNode[];
  /** 本界面允许管理的完整菜单树（包含按钮和隐藏路由） */
  scopeTree: MenuTreeNode[];
}

export interface PermissionFormScopeOptions {
  /** 是否展示仅供系统租户分配的租户列表页面及管理按钮 */
  includeTenantList?: boolean;
}

const ERP_ROOT_PATH = '/erp';
const MALL_ROOT_PATH = '/mall';
const SYSTEM_ROOT_PATH = '/system';
const TENANT_VISIT_PERMISSION = 'system:tenant:visit';

const SYSTEM_FORM_COMPONENTS = new Set([
  'system/dept/index',
  'system/role/index',
  'system/user/index',
]);

const SYSTEM_FORM_PATHS = new Set(['dept', 'log', 'role', 'user']);

function normalizePath(path?: string) {
  if (!path) {
    return '';
  }
  const normalized = path.trim().replaceAll('\\', '/');
  if (normalized === '/') {
    return normalized;
  }
  return normalized.replace(/\/$/, '');
}

function sortMenuNodes(nodes: MenuTreeNode[]) {
  nodes.sort((left, right) => {
    if (left.sort === undefined || right.sort === undefined) {
      // simple-list 已在后端按 sort 排好，但没有返回 sort 字段。
      return 0;
    }
    return left.sort - right.sort || left.id - right.id;
  });
  nodes.forEach((node) => {
    if (node.children?.length) {
      sortMenuNodes(node.children);
    }
  });
  return nodes;
}

/**
 * 由精简菜单接口的平铺数据构建稳定菜单树。
 * 孤立节点仍作为根节点保留，避免异常主数据被静默丢失。
 */
export function buildMenuTree(menus: SystemMenuApi.Menu[]): MenuTreeNode[] {
  const nodeMap = new Map<number, MenuTreeNode>();
  menus.forEach((menu) => nodeMap.set(menu.id, { ...menu, children: [] }));

  const roots: MenuTreeNode[] = [];
  nodeMap.forEach((node) => {
    const parent = nodeMap.get(node.parentId);
    if (parent && parent.id !== node.id) {
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return sortMenuNodes(roots);
}

/**
 * 完整菜单列表提供路径、排序和显示状态；精简列表提供当前租户可授权边界。
 */
export function filterAssignableMenus(
  detailedMenus: SystemMenuApi.Menu[],
  assignableMenus: Array<Pick<SystemMenuApi.Menu, 'id'>>,
) {
  const assignableIds = new Set(assignableMenus.map((menu) => menu.id));
  return detailedMenus.filter((menu) => assignableIds.has(menu.id));
}

/** 全量保存角色菜单前，只替换本界面管理范围内的 ID。 */
export function mergeManagedMenuIds(
  currentMenuIds: number[],
  originalMenuIds: number[],
  managedMenuIds: ReadonlySet<number>,
) {
  const selectedManagedIds = currentMenuIds.filter((id) =>
    managedMenuIds.has(id),
  );
  const originalUnmanagedIds = originalMenuIds.filter(
    (id) => !managedMenuIds.has(id),
  );
  return [...new Set([...selectedManagedIds, ...originalUnmanagedIds])];
}

export function flattenMenuTree(
  nodes: MenuTreeNode[],
  result: MenuTreeNode[] = [],
): MenuTreeNode[] {
  nodes.forEach((node) => {
    result.push(node);
    if (node.children?.length) {
      flattenMenuTree(node.children, result);
    }
  });
  return result;
}

function isSelectedSystemFormRoot(node: MenuTreeNode) {
  const path = normalizePath(node.path).replace(/^\//, '');
  return (
    SYSTEM_FORM_COMPONENTS.has(normalizePath(node.component)) ||
    SYSTEM_FORM_PATHS.has(path) ||
    node.name === '审计日志'
  );
}

function cloneWithChildren(
  node: MenuTreeNode,
  children = node.children || [],
): MenuTreeNode {
  return {
    ...node,
    children: children.map((child) => cloneWithChildren(child)),
  };
}

function buildTenantListTree(
  systemRoot: MenuTreeNode,
): MenuTreeNode | undefined {
  const tenantRoot = (systemRoot.children || []).find(
    (node) =>
      normalizePath(node.path).replace(/^\//, '') === 'tenant' ||
      node.name === '租户管理',
  );
  if (!tenantRoot) {
    return undefined;
  }
  const tenantList = (tenantRoot.children || []).find(
    (node) =>
      normalizePath(node.component) === 'system/tenant/index' ||
      node.name === '租户列表',
  );
  if (!tenantList) {
    return undefined;
  }
  const tenantListChildren = (tenantList.children || []).filter(
    (node) => node.permission !== TENANT_VISIT_PERMISSION,
  );
  return {
    ...tenantRoot,
    children: [cloneWithChildren(tenantList, tenantListChildren)],
    // 数据库中的租户管理节点是可包含子页面的菜单，在权限树中按目录交互。
    type: 1,
  };
}

function toDisplayNode(node: MenuTreeNode): MenuTreeNode | undefined {
  if (
    node.type === 3 ||
    (node.status !== undefined && node.status !== 0) ||
    node.visible === false
  ) {
    return undefined;
  }
  const children = (node.children || [])
    .map((child) => toDisplayNode(child))
    .filter((child): child is MenuTreeNode => !!child);

  // 目录本身不是表单，没有可展示的后代时不占用左侧空间。
  if (node.type === 1 && children.length === 0) {
    return undefined;
  }
  return {
    ...node,
    children: children.length ? children : undefined,
  };
}

/**
 * 权限配置页面树的产品边界：
 * 1. ERP 系统根目录下超级管理员可见的全部目录和页面；
 * 2. 商城系统根目录下当前租户可授权的全部目录和页面；
 * 3. 系统管理中的用户、角色、部门、审计日志及其后代。
 * 4. 系统租户可额外管理租户列表页面及其业务按钮，但不包含租户切换权限。
 */
export function buildPermissionFormScope(
  menus: SystemMenuApi.Menu[],
  options: PermissionFormScopeOptions = {},
): PermissionFormScope {
  const fullTree = buildMenuTree(menus);
  const allNodes = flattenMenuTree(fullTree);
  const erpRoot = allNodes.find(
    (node) =>
      normalizePath(node.path) === ERP_ROOT_PATH || node.name === 'ERP 系统',
  );
  const mallRoot = allNodes.find(
    (node) =>
      normalizePath(node.path) === MALL_ROOT_PATH || node.name === '商城系统',
  );
  const systemRoot = allNodes.find(
    (node) =>
      normalizePath(node.path) === SYSTEM_ROOT_PATH || node.name === '系统管理',
  );

  const scopeTree: MenuTreeNode[] = [];
  if (erpRoot) {
    scopeTree.push(cloneWithChildren(erpRoot));
  }
  if (mallRoot) {
    scopeTree.push(cloneWithChildren(mallRoot));
  }
  if (systemRoot) {
    const selectedChildren = (systemRoot.children || [])
      .filter(isSelectedSystemFormRoot)
      .map((node) => cloneWithChildren(node));
    if (options.includeTenantList) {
      const tenantListTree = buildTenantListTree(systemRoot);
      if (tenantListTree) {
        selectedChildren.push(tenantListTree);
      }
    }
    if (selectedChildren.length) {
      scopeTree.push(
        cloneWithChildren(systemRoot, sortMenuNodes(selectedChildren)),
      );
    }
  }

  return {
    displayTree: scopeTree
      .map((node) => toDisplayNode(node))
      .filter((node): node is MenuTreeNode => !!node),
    scopeTree,
  };
}

/** 权限保存范围只包含当前权限配置页面实际管理的真实菜单。 */
export function getManagedMenuIds(nodes: MenuTreeNode[]) {
  return new Set(flattenMenuTree(nodes).map((node) => node.id));
}

/** 优先按权限配置页面的树关系补齐祖先，再回退到完整菜单树。 */
export function getPermissionAncestorIds(
  menuId: number,
  scopeTree: MenuTreeNode[],
  allMenuTree: MenuTreeNode[],
) {
  const scopeNodeMap = new Map(
    flattenMenuTree(scopeTree).map((node) => [node.id, node]),
  );
  const allNodeMap = new Map(
    flattenMenuTree(allMenuTree).map((node) => [node.id, node]),
  );
  const ids: number[] = [];
  let parentId = (scopeNodeMap.get(menuId) || allNodeMap.get(menuId))?.parentId;
  while (parentId && parentId !== 0) {
    const parent = scopeNodeMap.get(parentId) || allNodeMap.get(parentId);
    if (!parent) {
      break;
    }
    ids.push(parent.id);
    parentId = parent.parentId;
  }
  return ids;
}

/**
 * 只为当前界面受管权限补齐祖先；历史未管理权限原样保留，避免保存时扩大授权。
 */
export function addManagedMenuAncestorIds(
  menuIds: number[],
  managedMenuIds: ReadonlySet<number>,
  scopeTree: MenuTreeNode[],
  allMenuTree: MenuTreeNode[],
) {
  const result = new Set(menuIds);
  menuIds.forEach((id) => {
    if (!managedMenuIds.has(id)) {
      return;
    }
    getPermissionAncestorIds(id, scopeTree, allMenuTree).forEach((parentId) =>
      result.add(parentId),
    );
  });
  return [...result];
}

/** 搜索命中时保留完整祖先路径；目录自身命中时保留其全部后代。 */
export function filterPermissionTree(
  nodes: MenuTreeNode[],
  keyword: string,
): MenuTreeNode[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) {
    return nodes;
  }
  return nodes.reduce<MenuTreeNode[]>((result, node) => {
    if (node.name.toLocaleLowerCase().includes(normalizedKeyword)) {
      result.push(node);
      return result;
    }
    const children = filterPermissionTree(node.children || [], keyword);
    if (children.length) {
      result.push({ ...node, children });
    }
    return result;
  }, []);
}

export function getVisibleFormIds(
  nodes: MenuTreeNode[],
  result: number[] = [],
) {
  nodes.forEach((node) => {
    if (node.type === 2) {
      result.push(node.id);
    }
    if (node.children?.length) {
      getVisibleFormIds(node.children, result);
    }
  });
  return result;
}

export function getExpandableMenuIds(
  nodes: MenuTreeNode[],
  result: number[] = [],
) {
  nodes.forEach((node) => {
    if (node.children?.length) {
      result.push(node.id);
      getExpandableMenuIds(node.children, result);
    }
  });
  return result;
}

export function getFirstVisibleForm(
  nodes: MenuTreeNode[],
): MenuTreeNode | undefined {
  for (const node of nodes) {
    if (node.type === 2) {
      return node;
    }
    const child = getFirstVisibleForm(node.children || []);
    if (child) {
      return child;
    }
  }
  return undefined;
}

export function getMenuCheckedState(
  nodes: MenuTreeNode[],
  checkedIds: ReadonlySet<number>,
) {
  const formIds = getVisibleFormIds(nodes);
  const checkedCount = formIds.filter((id) => checkedIds.has(id)).length;
  return {
    checked: formIds.length > 0 && checkedCount === formIds.length,
    indeterminate: checkedCount > 0 && checkedCount < formIds.length,
  };
}
