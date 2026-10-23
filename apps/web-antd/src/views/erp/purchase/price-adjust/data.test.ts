import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  filterPriceTypeOptions,
  getPriceTypeFieldKey,
  getVisibleCustomPriceFields,
  sourcePriceTypeOptions,
  targetPriceTypeOptions,
  toCustomPriceColumnField,
  useGridColumns,
  useGridFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));

function customField(
  overrides: Partial<ErpFieldConfigApi.FieldConfig> = {},
): ErpFieldConfigApi.FieldConfig {
  return {
    fieldName: 'vipPrice',
    fieldLabel: '会员价',
    fieldGroup: 'price_info',
    fieldSource: 'CUSTOM',
    fieldType: 'DECIMAL',
    moduleKey: 'erp_product',
    required: false,
    visible: true,
    listVisible: false,
    readonly: false,
    ...overrides,
  };
}

describe('配件价格调整动态价格列', () => {
  it('展示价格分组自定义字段且不受配件列表列显示开关限制', () => {
    const fields = getVisibleCustomPriceFields([
      customField(),
      customField({
        fieldName: 'memo',
        fieldGroup: 'extend_info',
      }),
    ]);
    const columns = useGridColumns(fields);
    const column = columns?.find(
      (item: any) => item.field === toCustomPriceColumnField('vipPrice'),
    ) as any;

    expect(fields.map((item) => item.fieldName)).toEqual(['vipPrice']);
    expect(column?.title).toBe('会员价');
    expect(column?.editRender?.attrs).toEqual({ type: 'number' });
  });

  it('展示并允许编辑采购价格和销售价格', () => {
    const columns = useGridColumns();
    const purchaseColumn = columns?.find(
      (item: any) => item.field === 'purchasePrice',
    ) as any;
    const saleColumn = columns?.find(
      (item: any) => item.field === 'salePrice',
    ) as any;

    expect(purchaseColumn?.title).toBe('采购价格');
    expect(purchaseColumn?.editRender?.attrs).toEqual({ type: 'number' });
    expect(saleColumn?.title).toBe('销售价格');
    expect(saleColumn?.editRender?.attrs).toEqual({ type: 'number' });
  });

  it('只读或无权限的自定义价格字段不可编辑，且无权限时显示星号', () => {
    const readonlyColumn = useGridColumns([
      customField({ readonly: true }),
    ])?.find(
      (item: any) => item.field === toCustomPriceColumnField('vipPrice'),
    ) as any;
    const hiddenColumns = useGridColumns(
      [customField()],
      ['col_vipPrice', 'retailPrice', 'purchasePrice'],
    );
    const hiddenCustomColumn = hiddenColumns?.find(
      (item: any) => item.field === toCustomPriceColumnField('vipPrice'),
    ) as any;
    const hiddenRetailPriceColumn = hiddenColumns?.find(
      (item: any) => item.field === 'retailPrice',
    ) as any;
    const hiddenPurchasePriceColumn = hiddenColumns?.find(
      (item: any) => item.field === 'purchasePrice',
    ) as any;

    expect(readonlyColumn?.editRender).toBeUndefined();
    expect(hiddenCustomColumn?.editRender).toBeUndefined();
    expect(hiddenCustomColumn?.formatter()).toBe('****');
    expect(hiddenRetailPriceColumn?.editRender).toBeUndefined();
    expect(
      hiddenRetailPriceColumn?.formatter({ row: { retailPrice: 12 } }),
    ).toBe('****');
    expect(hiddenPurchasePriceColumn?.editRender).toBeUndefined();
    expect(
      hiddenPurchasePriceColumn?.formatter({ row: { purchasePrice: 99 } }),
    ).toBe('****');
  });

  it('配件价格调整列表叠加产品价格查看权限遮罩', () => {
    const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
    const apiSource = readFileSync(
      join(currentDir, '../../../../api/erp/parts/price-adjust/index.ts'),
      'utf8',
    );

    expect(pageSource).toContain("useFieldPermission('erp_product')");
    expect(pageSource).toContain('hiddenFieldsLoaded');
    expect(pageSource).toContain('reloadColumn');
    expect(apiSource).toContain('/erp/product/price-adjust-page');
  });

  it('配件价格调整列表提供统一关键词搜索', () => {
    const keywordSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'keyword',
    ) as any;

    expect(keywordSchema?.component).toBe('Input');
    expect(keywordSchema?.componentProps?.placeholder).toContain(
      '多个字段关键词可用 /、+、逗号分隔',
    );
    expect(
      keywordSchema?.componentProps?.['data-erp-keyword-search-input'],
    ).toBe('true');
  });

  it('filters unauthorized batch-adjust price options', () => {
    const hiddenFields = ['referencePrice', 'col_purchasePrice'];

    expect(
      filterPriceTypeOptions(targetPriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'REFERENCE_PRICE',
      ),
    ).toBe(false);
    expect(
      filterPriceTypeOptions(sourcePriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'PURCHASE_PRICE',
      ),
    ).toBe(false);
    expect(
      filterPriceTypeOptions(sourcePriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'RETAIL_PRICE',
      ),
    ).toBe(true);
  });

  it('keeps batch-adjust price options tied to real product price fields', () => {
    const unsupportedTypes = ['BATCH_PRICE', 'BRANCH_PRICE', 'SPECIAL_PRICE'];
    const allOptions = [...targetPriceTypeOptions, ...sourcePriceTypeOptions];

    expect(allOptions.map((option) => option.value)).not.toEqual(
      expect.arrayContaining(unsupportedTypes),
    );
    expect(
      allOptions.every((option) => Boolean(getPriceTypeFieldKey(option.value))),
    ).toBe(true);
  });

  it('submits only backend-writable price fields and loads permissions before execute', () => {
    const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
    const modalSource = readFileSync(
      join(currentDir, 'AdjustModal.vue'),
      'utf8',
    );

    expect(pageSource).toContain('PRICE_UPDATE_FIELDS.forEach');
    expect(pageSource).toContain('!isFieldHidden(hiddenFields.value, field)');
    expect(modalSource).toContain('visibleSourcePriceTypeOptions');
    expect(modalSource).toContain('await loadHiddenFields()');
  });
});
