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
const batchFormSource = readFileSync(
  join(currentDir, 'modules', 'batch-edit-form.vue'),
  'utf8',
);
const importFormSource = readFileSync(
  join(currentDir, 'modules', 'import-form.vue'),
  'utf8',
);

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('product unit page design contract', () => {
  it('keeps leading columns scrollable and applies field visibility to list columns', () => {
    const columns = useGridColumns() as any[];
    const fixedColumns = columns
      .filter((column) => column.fixed)
      .map((column) => ({ fixed: column.fixed, title: column.title }));

    expect(fixedColumns).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(
      columns.find((column) => column.type === 'checkbox')?.fixed,
    ).toBeUndefined();
    expect(
      (useGridColumns(['name']) as any[]).some(
        (column) => column.field === 'name',
      ),
    ).toBe(false);
  });

  it('wires every business header to remote sorting and tooltip overflow', () => {
    const columns = useGridColumns() as any[];

    for (const field of ['id', 'name', 'status', 'createTime']) {
      const column = columns.find((item) => item.field === field);
      expect(column?.sortable, field).toBe(true);
    }
    expect(
      columns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
    expect(
      columns.find((column) => column.field === 'name')?.showOverflow,
    ).toBe('tooltip');
    expect(indexSource).toContain('...buildSortParams()');
  });

  it('uses compact search overlays and a safe enabled default', () => {
    expect(
      useGridFormSchema().find((schema) => schema.fieldName === 'status')
        ?.componentProps,
    ).toMatchObject({
      popupClassName: 'product-unit-search-select-dropdown',
    });
    expect(
      useFormSchema().find((schema) => schema.fieldName === 'status'),
    ).toMatchObject({
      defaultValue: CommonStatusEnum.ENABLE,
    });
  });

  it('matches the compact list interaction and status-highlight contract', () => {
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('ifShow: () => checkedIds.length > 0');
    expect(indexSource).toContain("'erp-disabled-row-highlight'");
    expect(indexSource).toContain('浅黄色背景和红色文字表示该单位已停用');
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('color: #1677ff');
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(indexSource).toContain('display: none');
    expect(indexSource).toContain('font-size: 12px');
  });

  it('uses compact responsive forms and protects field-permission behavior', () => {
    expect(formSource).toContain('compact: true');
    expect(formSource).toContain(
      "wrapperClass: 'product-unit-form-grid grid-cols-1 sm:grid-cols-2'",
    );
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('基本信息');
    expect(formSource).toContain('font-size: 12px');
    expect(batchFormSource).toContain("if (isHidden('status'))");
    expect(batchFormSource).toContain('当前角色无权批量修改单位状态');
    expect(batchFormSource).toContain('RadioButton');
    expect(importFormSource).toContain('title="导入配件单位"');
    expect(importFormSource).toContain('height: 28px');
  });
});
