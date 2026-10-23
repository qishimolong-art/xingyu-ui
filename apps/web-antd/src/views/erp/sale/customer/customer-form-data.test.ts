import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as baseOptionsApi from '#/api/erp/base';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useBasicFormSchema,
  useFinanceFormSchema,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
  useInvoiceFormSchema,
  useSaleFormSchema,
  useSystemFormSchema,
} from './data';
import {
  buildCustomerDeptEditValues,
  normalizeCustomerDeptFields,
} from './utils/form-normalize';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail.vue'),
  'utf8',
);
const enterpriseMatchModalSource = readFileSync(
  join(currentDir, 'modules/enterprise-match-modal.vue'),
  'utf8',
);
const customerApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/customer/index.ts'),
  'utf8',
);

const visibleFieldNames = (schema: ReturnType<typeof useFormSchema>) =>
  schema
    .map((item) => String(item.fieldName))
    .filter((fieldName) => fieldName !== 'id');

describe('customer archive form design contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps historical stock-cost labels disabled only for existing records', async () => {
    const mock = vi
      .spyOn(baseOptionsApi, 'getBaseDataSimpleList')
      .mockResolvedValue([{ id: 1, name: '零售价', code: 'retail_price' }]);
    try {
      const existing = useSaleFormSchema({
        selectedOptions: { priceLevel: [{ value: 6 }] },
      }).find((field) => field.fieldName === 'priceLevel')
        ?.componentProps as any;
      expect(await existing.api()).toContainEqual({
        label: '库存成本价（历史）',
        value: 6,
        disabled: true,
      });
      const fresh = useSaleFormSchema().find(
        (field) => field.fieldName === 'priceLevel',
      )?.componentProps as any;
      expect(
        (await fresh.api()).some((option: any) => option.value === 6),
      ).toBe(false);
    } finally {
      mock.mockRestore();
    }
  });

  it('uses one Enter owner across five sections, including dynamic input props', () => {
    const schema = [
      useBasicFormSchema(),
      useFinanceFormSchema(),
      useInvoiceFormSchema(),
      useSaleFormSchema(),
      useSystemFormSchema(),
    ].flat();
    for (const field of schema.filter((field) => field.component === 'Input')) {
      const props =
        typeof field.componentProps === 'function'
          ? field.componentProps({}, {} as any)
          : field.componentProps;
      expect(props).not.toHaveProperty('onPressEnter');
      expect(props).not.toHaveProperty('onKeydown');
    }
  });

  it('keeps every editable customer field in exactly one page section', () => {
    const sections = [
      useBasicFormSchema(),
      useFinanceFormSchema(),
      useInvoiceFormSchema(),
      useSaleFormSchema(),
      useSystemFormSchema(),
    ];
    const sectionFields = sections.flatMap(visibleFieldNames);
    const allFields = visibleFieldNames(useFormSchema());

    expect(sectionFields.toSorted()).toEqual(allFields.toSorted());
    expect(new Set(sectionFields).size).toBe(sectionFields.length);
  });

  it('places department controls with business and logistics fields', () => {
    const fields = visibleFieldNames(useSaleFormSchema());

    expect(fields).toEqual([
      'saleUserId',
      'developerUserId',
      'deptId',
      'priceLevel',
      'priceLocked',
      'logistics',
      'transportMethod',
      'routeId',
      'freightExplainId',
      'allowMultiDept',
      'deptIds',
    ]);
  });

  it('hides standalone phone fields from the customer archive main form', () => {
    const allFields = visibleFieldNames(useFormSchema());
    const basicFields = visibleFieldNames(useBasicFormSchema());

    expect(allFields).not.toContain('telephone');
    expect(allFields).not.toContain('financeTelephone');
    expect(basicFields).not.toContain('telephone');
    expect(basicFields).not.toContain('financeTelephone');
  });

  it('uses effective field visibility for customer create and edit schemas', () => {
    expect(formSource).toContain('applyEffectiveFieldVisibility');
    expect(formSource).toContain('loadCustomerFieldVisibility');
    expect(formSource).toContain("const FIELD_CONFIG_MODULE = 'customer'");
    expect(formSource).toContain(
      "const FIELD_PERMISSION_MODULE = 'erp_customer'",
    );
    expect(formSource).toContain('fieldConfigHiddenFields.value');
    expect(formSource).toContain('await loadFieldVisibility()');
  });

  it('uses field config and role field permission together on customer detail', () => {
    expect(detailSource).toContain('loadCustomerFieldVisibility');
    expect(detailSource).toContain('snapshot.configHiddenFields');
    expect(detailSource).toContain('isFieldConfigKnown');
    expect(detailSource).toContain('isEffectiveFieldHidden');
    expect(detailSource).toContain("const FIELD_CONFIG_MODULE = 'customer'");
    expect(detailSource).toContain(
      "const FIELD_PERMISSION_MODULE = 'erp_customer'",
    );
    expect(detailSource).toContain('fieldConfigFieldKeys.value');
    expect(detailSource).toContain('fieldConfigHiddenFields.value');
    expect(detailSource).toContain('fieldConfigLoaded.value');
    expect(detailSource).toContain('roleHiddenFields: hiddenFields.value');
    expect(detailSource).toContain('CUSTOMER_ARCHIVE_HIDDEN_FIELDS');
    expect(detailSource).toContain('!fieldConfigLoaded.value ||');
    expect(detailSource).toContain(
      'Promise.all([loadConfigOptions(), loadFieldVisibility()])',
    );
  });

  it('keeps customer detail-only finance statistics hidden from main field config', () => {
    expect(detailSource).toContain("'receivableBalance'");
    expect(detailSource).toContain("'earliestUnpaidDate'");
    expect(detailSource).toContain("'debtDays'");
    expect(detailSource).toContain("'creditBlocked'");
    expect(detailSource).toContain('v-if="!isHidden(\'receivableBalance\')"');
    expect(detailSource).toContain('v-if="!isHidden(\'earliestUnpaidDate\')"');
    expect(detailSource).toContain('v-if="!isHidden(\'debtDays\')"');
    expect(detailSource).toContain('v-if="!isHidden(\'creditBlocked\')"');
  });

  it('connects customer enterprise match list status to business info sync state', () => {
    expect(customerApiSource).toContain('businessInfoSynced?: boolean');
    expect(indexSource).toContain('EnterpriseMatchModal');
    expect(indexSource).toContain('EnterpriseMatchModalInstance');
    expect(indexSource).toContain('handleEnterpriseMatch(row)');
    expect(indexSource).toContain('row.businessInfoSynced');
    expect(indexSource).toContain(
      "row.businessInfoSynced === true ? '已同步' : '未同步'",
    );
    expect(indexSource).toContain("activeTab: 'business'");
    expect(indexSource).toContain('@success="handleRefresh"');
    expect(indexSource).not.toContain('企业匹配功能待接入');
  });

  it('shows customer detail enterprise match from business info sync state', () => {
    expect(detailSource).toContain('function enterpriseMatchText');
    expect(detailSource).toContain(
      "item?.businessInfoSynced === true ? '已同步' : '未同步'",
    );
    expect(detailSource).toContain('{{ enterpriseMatchText(customer) }}');
  });

  it('keeps list search unfocused on entry and after cached refresh', () => {
    const schemas = useGridFormSchema();
    expect(
      schemas.find((field) => field.fieldName === 'code')?.componentProps,
    ).toMatchObject({ 'data-erp-archive-code-search-input': 'true' });
    expect(
      schemas.find((field) => field.fieldName === 'name')?.componentProps,
    ).toMatchObject({ 'data-erp-archive-name-search-input': 'true' });

    expect(indexSource).not.toContain('queueFocusArchiveSearchInput');
    expect(indexSource).toContain('refreshActivatedCustomerPage');
    expect(indexSource).toContain('ref="customerGridShellRef"');
  });

  it('saves customer enterprise match OCR artifacts through existing subtables', () => {
    expect(enterpriseMatchModalSource).toContain(
      'recognizeCustomerBusinessLicense',
    );
    expect(enterpriseMatchModalSource).toContain(
      'buildCustomerBusinessInfoFromOcr',
    );
    expect(enterpriseMatchModalSource).toContain('createCustomerBusinessInfo');
    expect(enterpriseMatchModalSource).toContain('createCustomerImage');
    expect(enterpriseMatchModalSource).toContain("emit('success')");
    expect(enterpriseMatchModalSource).not.toContain('updateCustomer(');
  });

  it('reuses the shared customer business license OCR business-info mapping in create form', () => {
    expect(formSource).toContain('buildCustomerBusinessInfoFromOcr');
    expect(formSource).toContain('CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY');
    expect(formSource).toContain(
      'resolveCustomerBusinessLicenseUploadedFileUrl',
    );
  });

  it('hydrates every applicable department label and keeps the field compact', () => {
    const deptIdsProps = useSaleFormSchema().find(
      (item) => item.fieldName === 'deptIds',
    )?.componentProps as Record<string, any>;

    expect(deptIdsProps.class).toContain('w-full');
    expect(
      useSaleFormSchema().find((field) => field.fieldName === 'deptIds')
        ?.component,
    ).not.toBe('ApiTreeSelect');

    expect(
      buildCustomerDeptEditValues(
        {
          deptIds: [12, 13, 14],
          deptNames: '销售一部、销售二部、直营网点',
        },
        (id) => `部门${id}`,
      ),
    ).toEqual({
      deptIds: [
        { label: '销售一部', value: 12 },
        { label: '销售二部', value: 13 },
        { label: '直营网点', value: 14 },
      ],
    });

    expect(
      normalizeCustomerDeptFields({
        name: '多部门客户',
        allowMultiDept: true,
        deptId: 12,
        deptIds: [
          { label: '销售一部', value: 12 },
          { label: '销售二部', value: 13 },
          { label: '销售二部', value: 13 },
        ],
      }),
    ).toMatchObject({
      deptId: 12,
      deptIds: [12, 13],
    });
  });

  it('places status and remark in the final system section', () => {
    const fields = visibleFieldNames(useSystemFormSchema());

    expect(fields).toEqual([
      'wubiCode',
      'pinyinCode',
      'memberCode',
      'platformCode',
      'status',
      'remark',
    ]);
  });

  it('uses the compact dropdown typography hook for every form select', () => {
    const selectSchemas = useFormSchema().filter((schema) =>
      String(schema.component).includes('Select'),
    );

    expect(selectSchemas.length).toBeGreaterThan(0);
    expect(
      selectSchemas.every(
        (schema) =>
          (schema.componentProps as any)?.popupClassName ===
          'customer-form-select-dropdown',
      ),
    ).toBe(true);
  });

  it('uses the sales-cart density hook for every list-search select', () => {
    const selectSchemas = useGridFormSchema().filter((schema) =>
      String(schema.component).includes('Select'),
    );

    expect(selectSchemas.length).toBeGreaterThan(0);
    expect(
      selectSchemas.every((schema) =>
        (schema.componentProps as any)?.popupClassName.includes(
          'customer-search-select-dropdown',
        ),
      ),
    ).toBe(true);
  });

  it('aligns customer price level options with product price fields', () => {
    expect(indexSource).toContain('buildPriceLevelNameMap');
    expect(detailSource).toContain('fillPriceLevelNameMap');
    expect(formSource).toContain('handleBaseDataCreated');
    expect(
      useSaleFormSchema().find((item) => item.fieldName === 'priceLevel'),
    ).toBeTruthy();
    expect(useGridFormSchema()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldName: 'priceLevel',
        }),
      ]),
    );
  });

  it('keeps only the operation column fixed on the right', () => {
    const fixedColumns = (useGridColumns() || []).filter(
      (column: any) => column.fixed,
    );

    expect(fixedColumns).toHaveLength(1);
    expect(fixedColumns[0]).toMatchObject({
      fixed: 'right',
      title: '操作',
    });
  });
});
