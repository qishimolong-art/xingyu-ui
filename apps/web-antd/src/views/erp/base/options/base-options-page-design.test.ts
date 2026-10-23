import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommonStatusEnum } from '@vben/constants';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useFormSchema, useGridColumns, useGridFormSchema } from '../data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const gridSource = readFileSync(
  join(currentDir, '..', 'components', 'BaseDataGrid.vue'),
  'utf8',
);
const formSource = readFileSync(
  join(currentDir, '..', 'modules', 'form.vue'),
  'utf8',
);

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('base options page design contract', () => {
  it('keeps only the operation column fixed and preserves field visibility', () => {
    const columns = useGridColumns() as any[];
    const fixedColumns = columns
      .filter((column) => column.fixed)
      .map((column) => ({ fixed: column.fixed, title: column.title }));

    expect(fixedColumns).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      (useGridColumns(['code']) as any[]).some(
        (column) => column.field === 'code',
      ),
    ).toBe(false);
  });

  it('uses remote sorting and tooltip overflow for dense business data', () => {
    const columns = useGridColumns() as any[];

    for (const field of [
      'id',
      'name',
      'code',
      'sort',
      'status',
      'createTime',
    ]) {
      expect(
        columns.find((column) => column.field === field)?.sortable,
        field,
      ).toBe(true);
    }
    expect(
      columns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
    for (const field of ['id', 'name', 'code', 'remark']) {
      expect(
        columns.find((column) => column.field === field)?.showOverflow,
        field,
      ).toBe('tooltip');
    }
    expect(gridSource).toContain('buildSortParams(sorts, sort)');
  });

  it('uses compact search overlays and safe create defaults', () => {
    expect(
      useGridFormSchema().find((schema) => schema.fieldName === 'status')
        ?.componentProps,
    ).toMatchObject({
      popupClassName: 'base-data-search-select-dropdown',
    });

    const formSchema = useFormSchema();
    expect(
      formSchema.find((schema) => schema.fieldName === 'sort'),
    ).toMatchObject({ defaultValue: 0 });
    expect(
      formSchema.find((schema) => schema.fieldName === 'status'),
    ).toMatchObject({ defaultValue: CommonStatusEnum.ENABLE });
    expect(
      formSchema.find((schema) => schema.fieldName === 'remark'),
    ).toMatchObject({ formItemClass: 'col-span-1 sm:col-span-2' });
  });

  it('matches the compact list and disabled-status highlight contract', () => {
    expect(gridSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(gridSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(gridSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(gridSource).toContain("showOverflow: 'tooltip'");
    expect(gridSource).toContain("'erp-disabled-row-highlight'");
    expect(gridSource).toContain('浅黄色背景和红色文字表示该选项已停用');
    expect(gridSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(gridSource).toContain('color: #1677ff');
    expect(gridSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(gridSource).toContain('display: none');
    expect(gridSource).toContain('font-size: 12px');
  });

  it('keeps create, update, and delete permissions on their original actions', () => {
    expect(gridSource).toContain('erp:base-data:create');
    expect(gridSource).toContain('erp:base-data:update');
    expect(gridSource).toContain('erp:base-data:delete');
    expect(gridSource).toContain("useFieldPermission('erp_base_data')");
  });

  it('uses a compact responsive form and compact category navigation', () => {
    expect(formSource).toContain('compact: true');
    expect(formSource).toContain(
      "wrapperClass: 'base-data-form-grid grid-cols-1 sm:grid-cols-2'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('.ant-input[readonly]');
    expect(formSource).toContain('font-size: 12px');
    expect(pageSource).toContain('base-options-nav__title">选项分类');
    expect(pageSource).toContain('height: 32px');
    expect(pageSource).toContain('@media (max-width: 767px)');
  });
});
