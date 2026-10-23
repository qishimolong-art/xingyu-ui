import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommonStatusEnum } from '@vben/constants';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const permissionFormSource = readFileSync(
  join(currentDir, 'modules', 'assign-permission-form.vue'),
  'utf8',
);
const permissionApiSources = {
  antd: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      'api',
      'system',
      'permission',
      'index.ts',
    ),
    'utf8',
  ),
  ele: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-ele',
      'src',
      'api',
      'system',
      'permission',
      'index.ts',
    ),
    'utf8',
  ),
  naive: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-naive',
      'src',
      'api',
      'system',
      'permission',
      'index.ts',
    ),
    'utf8',
  ),
  tdesign: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-tdesign',
      'src',
      'api',
      'system',
      'permission',
      'index.ts',
    ),
    'utf8',
  ),
};
const roleApiSources = {
  antd: readFileSync(
    join(currentDir, '..', '..', '..', 'api', 'system', 'role', 'index.ts'),
    'utf8',
  ),
  ele: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-ele',
      'src',
      'api',
      'system',
      'role',
      'index.ts',
    ),
    'utf8',
  ),
  naive: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-naive',
      'src',
      'api',
      'system',
      'role',
      'index.ts',
    ),
    'utf8',
  ),
  tdesign: readFileSync(
    join(
      currentDir,
      '..',
      '..',
      '..',
      '..',
      '..',
      'web-tdesign',
      'src',
      'api',
      'system',
      'role',
      'index.ts',
    ),
    'utf8',
  ),
};
const eleRoleDataSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    '..',
    'web-ele',
    'src',
    'views',
    'system',
    'role',
    'data.ts',
  ),
  'utf8',
);
const eleRoleFormSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    '..',
    'web-ele',
    'src',
    'views',
    'system',
    'role',
    'modules',
    'form.vue',
  ),
  'utf8',
);
beforeEach(() => {
  setActivePinia(createPinia());
});

describe('system role management UI contract', () => {
  it('keeps every business header sortable and only fixes the operation column', () => {
    const columns = useGridColumns() as any[];

    for (const field of [
      'id',
      'name',
      'type',
      'remark',
      'status',
      'createTime',
    ]) {
      expect(
        columns.find((column) => column.field === field)?.sortable,
        field,
      ).toBe(true);
    }
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      columns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
  });

  it('uses tooltip overflow and compact search overlays', () => {
    const columns = useGridColumns() as any[];
    for (const field of ['id', 'name', 'remark', 'createTime']) {
      expect(
        columns.find((column) => column.field === field)?.showOverflow,
        field,
      ).toBe('tooltip');
    }
    expect(
      useGridFormSchema().find((schema) => schema.fieldName === 'status')
        ?.componentProps,
    ).toMatchObject({
      popupClassName: 'role-management-search-select-dropdown',
    });
  });

  it('matches the compact list and stopped-role presentation', () => {
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain("'role-row--disabled'");
    expect(indexSource).toContain('浅橙色背景和红色文字表示该角色已停用');
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('color: #1677ff');
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(indexSource).toContain('display: none');
    expect(indexSource).toContain('font-size: 12px');
  });

  it('keeps unavailable and destructive actions aligned with business rules', () => {
    expect(indexSource).not.toContain("label: '导入'");
    expect(indexSource).toContain('ifShow: canBatchOperate');
    expect(indexSource).toContain(
      'ifShow: () => row.type !== SystemRoleTypeEnum.SYSTEM',
    );
    expect(indexSource).toContain('内置角色仅保留权限配置，不允许修改或删除');
  });

  it('opens readonly role detail from regular row cells', () => {
    expect(indexSource).toContain('cellClick: handleCellClick');
    expect(indexSource).toContain(
      'function handleDetail(row: SystemRoleApi.Role)',
    );
    expect(indexSource).toContain("mode: 'detail'");
    expect(indexSource).toContain("mode: 'edit'");
    expect(indexSource).toContain(
      '@assign-permission="handleAssignPermission"',
    );
    expect(formSource).toContain(
      "type FormType = 'create' | 'detail' | 'edit'",
    );
    expect(formSource).toContain('const isDetail = computed');
    expect(formSource).toContain(':show-confirm-button="canSubmit"');
    expect(formSource).toContain('const canEditFromDetail = computed');
    expect(formSource).toContain(
      'const canAssignPermissionFromDetail = computed',
    );
    expect(formSource).toContain("hasAccessByCodes(['system:role:update'])");
    expect(formSource).toContain(
      'hasAccessByCodes(ASSIGN_PERMISSION_AUTH_CODES)',
    );
  });

  it('preserves the complete role and permission action chain', () => {
    [
      'system:role:create',
      'system:role:export',
      'system:role:update',
      'system:role:delete',
      'system:permission:assign-role-menu',
      'system:permission:assign-role-field-permission',
      'system:permission:assign-role-data-scope',
    ].forEach((permission) => {
      expect(indexSource).toContain(permission);
    });
  });

  it('restores role form data-scope controls inside the permission modal', () => {
    expect(permissionFormSource).toContain('数据权限');
    expect(permissionFormSource).toContain(
      "hasAccessByCodes(['system:permission:assign-role-data-scope'])",
    );
    expect(permissionFormSource).toContain(
      'const canQueryRoleMenus = computed',
    );
    expect(permissionFormSource).toContain('canAssignDataScope.value');
    expect(permissionFormSource).toContain('canQueryRoleMenus.value');
    expect(permissionFormSource).toContain('getRoleFormDataScopes');
    expect(permissionFormSource).toContain('assignRoleFormDataScope');
    expect(permissionFormSource).toContain('getFormDataPermissionConfig');
    expect(permissionFormSource).toContain('activeFinalDataScopeDescription');
    expect(permissionFormSource).toContain('基础数据范围：');
    expect(permissionFormSource).toContain('额外表单规则：');
    expect(permissionFormSource).toContain('最终效果：');
    expect(permissionFormSource).toContain('RadioGroup');
    expect(permissionFormSource).toContain('role-data-scope-radio');
    expect(permissionFormSource).toContain('normalizeDataScope');
    expect(permissionFormSource).toContain(
      '() => canAssignDataScope.value && !!activeFormKey.value',
    );
    expect(permissionFormSource).toContain(
      ':checkable="canAssignMenuPermission"',
    );
    expect(permissionFormSource).not.toContain(
      ':disabled="!canAssignMenuPermission"',
    );
    expect(permissionFormSource).not.toContain(
      '请先勾选左侧表单后再配置数据权限',
    );
    expect(permissionFormSource).not.toContain('继承角色默认');
  });

  it('adds the tenant list to the platform tenant permission tree', () => {
    expect(permissionFormSource).toContain('页面树');
    expect(permissionFormSource).toContain(
      'ERP、商城及指定系统管理页面，平台租户可配置租户列表',
    );
    expect(permissionFormSource).toContain(
      'accessStore.tenantId === SYSTEM_TENANT_ID',
    );
    expect(permissionFormSource).toContain(
      'accessStore.visitTenantId === null',
    );
    expect(permissionFormSource).toContain(
      'includeTenantList: canManageTenantListPermissions.value',
    );
    expect(permissionFormSource).not.toContain('includeTenantVisit');
    expect(permissionFormSource).not.toContain('平台能力');
    expect(permissionFormSource).toContain('全选可见页面');
    expect(permissionFormSource).toContain('搜索页面或目录');
    expect(permissionFormSource).toContain('当前页面功能按钮');
    expect(permissionFormSource).toContain('当前页面未配置字段权限映射');
    expect(permissionFormSource).toContain('当前页面未配置数据权限映射');
    expect(permissionFormSource).toContain('未找到页面');
  });

  it('keeps stale global role data-scope clients out of the role APIs', () => {
    for (const [appName, source] of Object.entries(permissionApiSources)) {
      expect(source, appName).toContain('/system/permission/assign-role-menu');
      expect(source, appName).toContain('/system/permission/assign-user-role');
      expect(source, appName).not.toContain('AssignRoleDataScopeReqVO');
      expect(source, appName).not.toContain('assignRoleDataScope');
      expect(source, appName).not.toContain(
        '/system/permission/assign-role-data-scope',
      );
    }

    for (const [appName, source] of Object.entries(roleApiSources)) {
      expect(source, appName).not.toContain('dataScope: number');
      expect(source, appName).not.toContain('dataScopeDeptIds');
    }

    expect(eleRoleDataSource).not.toContain("fieldName: 'dataScope'");
    expect(eleRoleFormSource).not.toContain('SystemDataScopeEnum');
    expect(eleRoleFormSource).not.toContain("setFieldValue('dataScope'");
  });

  it('uses a compact responsive form with a safe status default', () => {
    const formSchema = useFormSchema();
    expect(
      formSchema.find((schema) => schema.fieldName === 'status'),
    ).toMatchObject({ defaultValue: CommonStatusEnum.ENABLE });
    expect(
      formSchema.find((schema) => schema.fieldName === 'remark'),
    ).toMatchObject({ formItemClass: 'col-span-1 sm:col-span-2' });
    expect(formSource).toContain('compact: true');
    expect(formSource).toContain(
      "wrapperClass: 'role-form-grid grid-cols-1 sm:grid-cols-2'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('.ant-input[readonly]');
    expect(formSource).toContain('font-size: 12px');
  });
});
