import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

setActivePinia(createPinia());
const {
  formatDeptTreeSelectValues,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} = await import('./data');

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const deptTreeSource = readFileSync(
  join(currentDir, 'modules/dept-tree.vue'),
  'utf8',
);
const userDetailModalSource = readFileSync(
  join(currentDir, 'modules/user-detail-modal.vue'),
  'utf8',
);
const userFormSource = readFileSync(
  join(currentDir, 'modules/form.vue'),
  'utf8',
);
const userDataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const batchEditSource = readFileSync(
  join(currentDir, 'modules/batch-edit-form.vue'),
  'utf8',
);

describe('system user list UI contract', () => {
  it('uses the user identity as the leading business column', () => {
    const columns = useGridColumns() as any[];
    const businessColumns = columns.filter(
      (column) => column.type !== 'checkbox',
    );

    expect(businessColumns[0]).toMatchObject({
      field: 'nickname',
      slots: { default: 'userIdentity' },
      title: '用户',
    });
    expect(
      columns.find((column) => column.field === 'roleNames'),
    ).toMatchObject({
      slots: { default: 'userRoles' },
    });
    expect(columns.some((column) => column.field === 'dataScope')).toBe(false);
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(columns[0]).toMatchObject({
      autoFixed: false,
      type: 'checkbox',
      width: 36,
    });
    expect(columns.at(-1)).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 176,
    });
  });

  it('renders user names without the generated initial avatar', () => {
    expect(indexSource).toContain('<template #userIdentity="{ row }">');
    expect(indexSource).toContain('class="user-identity__name"');
    expect(indexSource).not.toContain('<Avatar');
    expect(indexSource).not.toContain('getUserInitial');
    expect(indexSource).not.toContain('user-identity__avatar');
  });

  it('keeps field permissions effective for the redesigned columns', () => {
    const columns = useGridColumns(undefined, [
      'nickname',
      'roleIds',
      'status',
    ]) as any[];

    expect(columns.some((column) => column.field === 'nickname')).toBe(false);
    expect(columns.some((column) => column.field === 'roleNames')).toBe(false);
    expect(columns.some((column) => column.field === 'status')).toBe(false);
  });

  it('keeps role overflow understandable without exposing user data scope', () => {
    expect(indexSource).toContain('getUserRoleNames(row).slice(0, 2)');
    expect(indexSource).toContain("getUserRoleNames(row).join('、')");
    expect(indexSource).toContain('user-role-more');
    expect(indexSource).not.toContain('#dataScope');
  });

  it('keeps department filtering, clearing, and export in the same scope', () => {
    expect(indexSource).toContain('deptId: searchDeptId.value');
    expect(indexSource).toContain('@click="handleDeptClear"');
    expect(indexSource).toContain(':selected-key="searchDeptId"');
    expect(deptTreeSource).toContain(
      ':selected-keys="props.selectedKey ? [props.selectedKey] : []"',
    );
    expect(deptTreeSource).toContain(
      'selectedKeys.length > 0 ? info.node.dataRef : undefined',
    );
  });

  it('adopts the compact sales-cart list interaction contract', () => {
    const searchSchemas = useGridFormSchema() as any[];
    const selectSchemas = searchSchemas.filter((schema) =>
      ['ApiSelect', 'Select'].includes(schema.component),
    );

    expect(selectSchemas).not.toHaveLength(0);
    selectSchemas.forEach((schema) => {
      expect(schema.componentProps.popupClassName).toBe(
        'user-management-search-select-dropdown',
      );
    });
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("target.closest('.ant-picker, .ant-select')");
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('allowBtn: false');
    expect(indexSource).toContain('createVxeHeaderSort(userSortFieldMap)');
    expect(indexSource).toContain('...buildSortParams(sorts, sort)');
    expect(indexSource).toContain('void restoreSortState(gridApi)');
    expect(indexSource).toContain('sortChange: handleSortChange');
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
  });

  it('does not color user rows by account status', () => {
    expect(indexSource).not.toContain('rowClassName');
    expect(indexSource).not.toContain('user-row--enabled');
    expect(indexSource).not.toContain('user-row--disabled');
    expect(indexSource).not.toContain('status-legend');
    expect(indexSource).not.toContain('正常账号');
    expect(indexSource).not.toContain('停用账号');
  });

  it('shows batch operations only after rows are selected', () => {
    expect(indexSource).toContain('v-if="checkedIds.length"');
    expect(indexSource).not.toContain('disabled: isEmpty(checkedIds)');
    expect(indexSource).toContain('querySuccess: () => {');
    expect(indexSource).toContain('users: checkedUsers.value');
    expect(indexSource).toContain('checkedUsers.value = []');
    expect(batchEditSource).toContain('selectedUsers');
    expect(batchEditSource).toContain('updateTenantVisitScope');
  });

  it('opens readonly user detail from regular row cells', () => {
    expect(indexSource).toContain('cellClick: handleCellClick');
    expect(indexSource).toContain(
      'function handleDetail(row: SystemUserApi.User)',
    );
    expect(indexSource).toContain("type: 'detail'");
    expect(indexSource).toContain("type: 'edit'");
    expect(indexSource).toContain("column?.field === 'status'");
    expect(userDetailModalSource).toContain(
      "type DetailModalType = 'detail' | 'edit'",
    );
    expect(userDetailModalSource).toContain('const isDetail = computed');
    expect(userDetailModalSource).toContain(':show-confirm-button="canSubmit"');
    expect(userDetailModalSource).toContain(
      "hasAccessByCodes(['system:user:update'])",
    );
    expect(userDetailModalSource).toContain('v-if="canEditFromDetail"');
    expect(userDetailModalSource).toContain(':disabled="isDetail"');
  });

  it('uses the modal confirmation as the single save action for every tab', () => {
    expect(userDetailModalSource).not.toContain('保存基本信息');
    expect(userDetailModalSource).not.toContain('保存个人价格限制');
    expect(userDetailModalSource).not.toContain('保存角色设置');
    expect(userDetailModalSource).toContain(
      'const basicInfoSaved = await handleSaveBasicInfo()',
    );
    expect(userDetailModalSource).toContain('await handleSavePriceFields()');
    expect(userDetailModalSource).toContain(
      'await handleSaveRolePermissions()',
    );
    expect(userDetailModalSource).not.toContain('switch (activeTab.value)');
    expect(userDetailModalSource).toContain(
      'isEqual(submitData, initialBasicInfo.value)',
    );
    expect(userDetailModalSource).toContain(
      'isEqual(normalizedFieldCodes, initialCheckedFieldCodes.value)',
    );
    expect(userDetailModalSource).toContain(
      'isEqual(normalizedRoleIds, initialRoleIds.value)',
    );
  });

  it('hydrates strict department tree values with labels', () => {
    expect(
      formatDeptTreeSelectValues(
        [2, 3],
        [
          {
            id: 1,
            name: '总部',
            children: [{ id: 2, name: '销售部' }],
          },
        ],
      ),
    ).toEqual([
      { label: '销售部', value: 2 },
      { label: '3', value: 3 },
    ]);

    const formSchemas = useFormSchema() as any[];
    expect(
      formSchemas.find((schema) => schema.fieldName === 'deptIds')
        ?.componentProps.labelInValue,
    ).toBe(true);
    expect(userDetailModalSource).toContain(
      'deptIds: formatDeptTreeSelectValues(deptIds, departments)',
    );
    expect(userFormSource).toContain('getDeptList()');
    expect(userFormSource).toContain('formatDeptTreeSelectValues(');
  });

  it('hides user-level data-scope selection in user management', () => {
    const formSchemas = useFormSchema() as any[];
    const searchSchemas = useGridFormSchema() as any[];

    expect(formSchemas.some((schema) => schema.fieldName === 'dataScope')).toBe(
      false,
    );
    expect(
      formSchemas.some((schema) => schema.fieldName === 'dataScopeDeptIds'),
    ).toBe(false);
    expect(
      searchSchemas.some((schema) => schema.fieldName === 'dataScope'),
    ).toBe(false);
    expect(
      (useGridColumns() || []).some(
        (column: any) => column.field === 'dataScope',
      ),
    ).toBe(false);
    expect(userDataSource).not.toContain("fieldName: 'dataScope'");
    expect(userDataSource).not.toContain("field: 'dataScope'");
    expect(userFormSource).toContain('createUser(submitData)');
    expect(userFormSource).toContain(
      'delete (submitData as Record<string, any>).dataScope',
    );
    expect(userFormSource).toContain(
      'delete (submitData as Record<string, any>).dataScopeDeptIds',
    );
  });

  it('preserves every original user-management button permission', () => {
    [
      'system:user:create',
      'system:user:import',
      'system:user:export',
      'system:user:update',
      'system:user:delete',
      'system:user:update-password',
    ].forEach((permission) => {
      expect(indexSource).toContain(permission);
    });
  });
});
