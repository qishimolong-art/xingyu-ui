import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useBasicFormSchema, useGridColumns, useGridFormSchema } from './data';
import {
  buildSupplierAreaEditValues,
  buildSupplierDeptEditValues,
  formatSupplierArea,
  normalizeSupplierFormData,
  resolveSupplierAuditUserName,
} from './utils/form-normalize';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail.vue'),
  'utf8',
);
const enterpriseMatchModalSource = readFileSync(
  join(currentDir, 'modules/enterprise-match-modal.vue'),
  'utf8',
);
const importFormSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);
const supplierApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/supplier/index.ts'),
  'utf8',
);

describe('supplier page design contract', () => {
  it('keeps the requested supplier business columns in their exact order', () => {
    const columns = useGridColumns() || [];
    const businessColumns = columns.filter(
      (column) => column.type !== 'checkbox' && column.title !== '操作',
    );

    expect(businessColumns.map((column) => column.title)).toEqual([
      '联系人',
      '供应商门户',
      '编码',
      '名称',
      '企业匹配',
      '状态',
      '微信客服',
      '区域',
      '地址',
      '备注',
      '创建人',
      '创建时间',
      '联系方式',
      '采购员',
      '关联账套',
      '白条授信',
    ]);
    expect(businessColumns.every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)?.fixed).toBe('right');

    const contactHiddenColumns = useGridColumns(['contact']) || [];
    expect(
      contactHiddenColumns.some((column) => column.title === '联系人'),
    ).toBe(false);
  });

  it('renders every interactive and future-backed list field explicitly', () => {
    expect(indexSource).toContain('<template #supplierPortalAction>');
    expect(indexSource).toContain('<template #enterpriseMatch="{ row }">');
    expect(indexSource).toContain('<template #wechatService>');
    expect(indexSource).toContain('<template #accountSetName="{ row }">');
    expect(indexSource).toContain('<template #creditLimit="{ row }">');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
  });

  it('uses row based supplier enterprise match status and OCR entry', () => {
    expect(supplierApiSource).toContain('businessInfoSynced?: boolean');
    expect(indexSource).toContain('function getEnterpriseMatchText');
    expect(indexSource).toContain(
      "row.businessInfoSynced ? '已同步' : '未同步'",
    );
    expect(indexSource).toContain('function handleEnterpriseMatch');
    expect(indexSource).toContain("activeTab: 'business'");
    expect(indexSource).toContain(
      'enterpriseMatchModalApi.setData(row).open()',
    );
    expect(indexSource).toContain('{{ getEnterpriseMatchText(row) }}');
    expect(indexSource).not.toContain("handlePendingFeature('企业匹配')");

    expect(enterpriseMatchModalSource).toContain(
      'recognizeSupplierBusinessLicense',
    );
    expect(enterpriseMatchModalSource).toContain(
      'buildSupplierBusinessInfoFromOcr',
    );
    expect(enterpriseMatchModalSource).toContain('createSupplierBusinessInfo');
    expect(enterpriseMatchModalSource).toContain('createSupplierImage');
    expect(enterpriseMatchModalSource).toContain("emit('success')");
  });

  it('shows supplier import create update failure result details', () => {
    expect(supplierApiSource).toContain('interface SupplierImportResult');
    expect(supplierApiSource).toContain(
      'requestClient.post<ErpSupplierApi.SupplierImportResult>',
    );
    expect(importFormSource).toContain('const importResult = ref');
    expect(importFormSource).toContain('buildImportResultMessage');
    expect(importFormSource).toContain('新增');
    expect(importFormSource).toContain('更新');
    expect(importFormSource).toContain('failureDetails');
    expect(importFormSource).toContain('所属部门名称');
    expect(importFormSource).toContain('适用部门名称');
    expect(importFormSource).toContain('多个适用部门请用“、”分隔');
    expect(importFormSource).toContain('总公司 / 采购部');
    expect(importFormSource).toContain(
      "{{ importResult ? '关闭' : '开始导入' }}",
    );
  });

  it('uses a standalone tab-free create layout and a four-column form grid', () => {
    expect(
      useBasicFormSchema().some((field) => field.fieldName === 'areaIds'),
    ).toBe(true);
    expect(
      useBasicFormSchema().some((field) => field.fieldName === 'region'),
    ).toBe(false);
    expect(formSource).toContain(
      'modalApi.setState({ fullscreen: true, confirmDisabled: true })',
    );
    expect(formSource).toContain(
      "wrapperClass: 'supplier-form-grid grid-cols-4'",
    );
    expect(formSource).toContain(
      'class="supplier-form-view supplier-create-layout erp-form-focus-highlight"',
    );
    expect(formSource).toContain(
      'class="supplier-create-card__title">供应商资料',
    );
    expect(formSource).not.toContain('<Tabs');
    expect(formSource).not.toContain('activeTab');
    expect(formSource).not.toContain('isEditMode');
    expect(formSource).not.toContain('updateSupplier');
  });

  it('uses effective field visibility with region and areaIds alias compatibility', () => {
    expect(formSource).toContain('applyEffectiveFieldVisibility');
    expect(formSource).toContain('loadSupplierFieldVisibility');
    expect(formSource).toContain('config: fieldConfigSnapshot.value');
    expect(formSource).toContain("areaIds: ['region']");
    expect(formSource).toContain('fieldConfigHiddenFields.value');

    expect(detailSource).toContain('applyEffectiveFieldVisibility');
    expect(detailSource).toContain('loadSupplierFieldVisibility');
    expect(detailSource).toContain('config: fieldConfigSnapshot.value');
    expect(detailSource).toContain('isFieldConfigKnown');
    expect(detailSource).toContain('isEffectiveFieldHidden');
    expect(detailSource).toContain("areaIds: ['region']");
    expect(detailSource).toContain('fieldConfigFieldKeys.value');
    expect(detailSource).toContain('fieldConfigHiddenFields.value');
    expect(detailSource).toContain('snapshot.configFieldKeys.length > 0');
    expect(detailSource).toContain('await loadFieldVisibility()');
  });

  it('hides supplier detail main fields outside field config while preserving audit fallback', () => {
    expect(detailSource).toContain(
      'fieldConfigFieldKeys.value = snapshot.configFieldKeys',
    );
    expect(detailSource).toContain('!fieldConfigLoaded.value');
    expect(detailSource).toContain('!isFieldConfigKnown(fieldKey, {');
    expect(detailSource).toContain(
      'fieldConfigFieldKeys: fieldConfigFieldKeys.value',
    );
    expect(detailSource).toContain(
      'function showOptionalField(fieldKey: string)',
    );
    expect(detailSource).toContain("showOptionalField('creator')");
    expect(detailSource).toContain("showOptionalField('creatorName')");
    expect(detailSource).toContain("showOptionalField('updater')");
    expect(detailSource).toContain("showOptionalField('updaterName')");
    expect(detailSource).toContain('fieldConfigFieldKeys.value = []');
    expect(detailSource).toContain('fieldConfigLoaded.value = false');
  });

  it('keeps edit and detail in one shared tab layout', () => {
    expect(indexSource).toContain(
      "detailModalApi.setData({ ...row, mode: 'edit' }).open()",
    );
    expect(indexSource).toContain('formModalApi.setData(null).open()');
    expect(detailSource).toContain(
      'modalApi.setState({ fullscreen: true, confirmDisabled: true })',
    );
    expect(detailSource).toContain(':show-confirm-button="isEditMode"');
    expect(detailSource).toContain(
      '<div v-if="isEditMode" class="supplier-detail-layout">',
    );
    expect(detailSource).toContain(
      '<div v-else class="supplier-detail-layout">',
    );
    expect(detailSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
    expect(detailSource).toContain(
      'class="supplier-detail-section__title">开票信息',
    );
    expect(detailSource).toContain(
      'class="supplier-detail-section__title">财务信息',
    );
    [
      '基础信息',
      '联系人',
      '合同',
      '拓展配置',
      '动态字段',
      '企业信息',
      '供应商账户',
      '票据登记',
      '任务量',
      '工商信息',
      '分配部门',
    ].forEach((tab) => expect(detailSource).toContain(`tab="${tab}"`));
  });

  it('keeps search labels and list/detail action typography compact', () => {
    const settleMethod = useGridFormSchema().find(
      (field) => field.fieldName === 'settleMethod',
    );
    expect(settleMethod?.label).toBe('结算方式');
    expect(indexSource).toContain('class="supplier-operation-actions"');
    expect(indexSource).toContain('font-size: 12px !important');
    expect(indexSource).toContain('gap: 2px');
    expect(indexSource).toContain('margin-inline-start: 2px !important');
    expect(detailSource).toContain(
      '.supplier-detail-tabs :deep(.ant-table-cell)',
    );
    expect(detailSource).toContain(
      '.supplier-detail-tabs :deep(.ant-btn-link)',
    );
  });

  it('preserves cached refresh without stealing search focus', () => {
    const schemas = useGridFormSchema();
    expect(
      schemas.find((field) => field.fieldName === 'code')?.componentProps,
    ).toMatchObject({ 'data-erp-archive-code-search-input': 'true' });
    expect(
      schemas.find((field) => field.fieldName === 'name')?.componentProps,
    ).toMatchObject({ 'data-erp-archive-name-search-input': 'true' });

    expect(indexSource).not.toContain('onMounted');
    expect(indexSource).not.toContain('queueFocusArchiveSearchInput');
    expect(indexSource).toContain(
      'const supplierGridShellRef = ref<HTMLElement>();',
    );
    expect(indexSource).toContain('ref="supplierGridShellRef"');
    expect(indexSource).not.toContain(
      'queueFocusArchiveSearchInput(supplierGridShellRef)',
    );
    expect(indexSource).toContain(
      'async function refreshActivatedSupplierPage',
    );
    expect(indexSource).toContain('void refreshActivatedSupplierPage()');
    expect(indexSource).not.toContain('useVxeActivationRefresh');
  });

  it('hydrates department labels and keeps multi-department selection compact', () => {
    const schema = useBasicFormSchema([], { deptLabelInValue: true });
    const deptProps = schema.find((item) => item.fieldName === 'deptId')
      ?.componentProps as Record<string, any>;
    const deptIdsProps = schema.find((item) => item.fieldName === 'deptIds')
      ?.componentProps as Record<string, any>;

    expect(deptProps.labelInValue).toBe(true);
    expect(deptIdsProps.class).toContain('supplier-dept-multiple-select');
    expect(typeof deptProps.api).toBe('function');
    expect(deptProps.pageSize).toBe(20);
    expect(
      schema.find((item) => item.fieldName === 'deptIds')?.component,
    ).not.toBe('ApiTreeSelect');
    expect(detailSource).not.toContain('setTimeout(resolve, 100)');
    expect(detailSource).toContain(
      "basicFormApi.setFieldValue('deptId', deptValues.deptId)",
    );
    expect(detailSource).toContain('flex-wrap: nowrap');
    expect(detailSource).toContain('text-overflow: ellipsis');

    expect(
      buildSupplierDeptEditValues(
        {
          deptId: 12,
          deptIds: [12, 13],
          deptName: '采购一部',
          deptNames: '采购一部、采购二部',
        },
        (id) => `部门${id}`,
      ),
    ).toEqual({
      deptId: { label: '采购一部', value: 12 },
      deptIds: [
        { label: '采购一部', value: 12 },
        { label: '采购二部', value: 13 },
      ],
    });
  });

  it('hydrates audit user names while preserving API-provided names', () => {
    const userNames = new Map([
      [12, '张三'],
      [13, '李四'],
    ]);

    expect(resolveSupplierAuditUserName('12', undefined, userNames)).toBe(
      '张三',
    );
    expect(resolveSupplierAuditUserName(13, '接口返回', userNames)).toBe(
      '接口返回',
    );
    expect(resolveSupplierAuditUserName('legacy-user', '', userNames)).toBe(
      'legacy-user',
    );
    expect(detailSource).not.toContain('getSimpleUserList');
    expect(detailSource).not.toContain('loadAuditUserOptions');
    expect(detailSource).toContain("showOptionalField('creatorName')");
    expect(detailSource).toContain(
      `:department-keys="['createDeptName', 'createDeptId']"`,
    );
    expect(detailSource).toContain('department-label="创建部门"');
  });

  it('groups extension settings into a compact supplier configuration board', () => {
    expect(detailSource).toContain('class="supplier-extend-layout"');
    ['合作与结算', '退货与入库', '自动补货'].forEach((section) =>
      expect(detailSource).toContain(
        `class="supplier-extend-section__title">${section}`,
      ),
    );
    [
      'purchaseReturnAddress',
      'generateInBill',
      'generateLabelTask',
      'autoReplenishmentCycle',
      'autoReplenishmentTime',
      'stockUpperDays',
      'stockStandardDays',
      'stockLowerDays',
    ].forEach((field) =>
      expect(detailSource).toContain(`extendInfo?.${field}`),
    );
    expect(detailSource).toContain('.supplier-extend-grid');
    expect(detailSource).toContain('.supplier-extend-state.is-active');
    expect(detailSource).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
  });

  it('preserves supplier create and edit payload normalization', () => {
    expect(
      normalizeSupplierFormData({
        areaIds: ['浙江省', '杭州市', '西湖区'],
        allowMultiDept: true,
        code: ' SUP-001 ',
        deptId: { label: '采购一部', value: 12 },
        deptIds: [
          { label: '采购一部', value: 12 },
          { label: '采购二部', value: 13 },
          { label: '采购二部', value: 13 },
        ],
        manualInputCode: true,
        taxPercent: '13.5' as any,
      } as any),
    ).toMatchObject({
      code: 'SUP-001',
      deptId: 12,
      deptIds: [12, 13],
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      taxPercent: 13.5,
    });
    expect(
      normalizeSupplierFormData({
        areaIds: [],
        province: '浙江省',
        city: '杭州市',
        district: '西湖区',
      } as any),
    ).toMatchObject({
      province: undefined,
      city: undefined,
      district: undefined,
    });
    expect(
      buildSupplierAreaEditValues({
        province: '浙江省',
        city: '杭州市',
        district: '西湖区',
      }),
    ).toEqual({ areaIds: ['浙江省', '杭州市', '西湖区'] });
    expect(
      formatSupplierArea({
        province: '浙江省',
        city: '杭州市',
        district: '西湖区',
      } as any),
    ).toBe('浙江省 / 杭州市 / 西湖区');
  });

  it('preserves existing permission gates for supplier operations', () => {
    [
      'erp:supplier:create',
      'erp:supplier:import',
      'erp:supplier:export',
      'erp:supplier:update',
      'erp:supplier:merge',
    ].forEach((permission) => expect(indexSource).toContain(permission));
  });
});
