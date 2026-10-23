import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

setActivePinia(createPinia());
const { useDetailSchema, useGridColumns, useGridFormSchema } =
  await import('./data');

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules', 'detail.vue'),
  'utf8',
);

describe('system operate log page UI contract', () => {
  it('keeps the business columns in order and only fixes the operation column', () => {
    const columns = useGridColumns() as any[];

    expect(columns.map((column) => column.title)).toEqual([
      '日志编号',
      '操作人',
      '操作模块',
      '操作名',
      '操作内容',
      '操作时间',
      '操作 IP',
      '操作',
    ]);
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
  });

  it('uses compact searchable controls and tooltip overflow', () => {
    const formSchemas = useGridFormSchema() as any[];
    const selectSchemas = formSchemas.filter((schema) =>
      ['ApiSelect', 'Select'].includes(schema.component),
    );
    const columns = useGridColumns() as any[];

    expect(selectSchemas).toHaveLength(2);
    selectSchemas.forEach((schema) => {
      expect(schema.componentProps.popupClassName).toBe(
        'operate-log-search-select-dropdown',
      );
    });
    columns.slice(0, -1).forEach((column) => {
      expect(column.showOverflow).toBe('tooltip');
    });
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("target.closest('.ant-picker, .ant-select')");
    expect(indexSource).toContain('font-size: 12px');
  });

  it('keeps safe three-state remote sorting and propagates it to export', () => {
    const columns = useGridColumns() as any[];

    for (const field of ['id', 'type', 'subType', 'createTime', 'userIp']) {
      expect(
        columns.find((column) => column.field === field)?.sortable,
        field,
      ).toBe(true);
    }
    expect(indexSource).toContain("orders: ['asc', 'desc', null]");
    expect(indexSource).toContain('allowBtn: false');
    expect(indexSource).toContain('activeSortParams.value');
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
  });

  it('preserves operation-log query and export permissions', () => {
    expect(indexSource).toContain('system:operate-log:query');
    expect(indexSource).toContain('system:operate-log:export');
  });

  it('opens operation detail from regular row cells', () => {
    expect(indexSource).toContain('cellClick: handleCellClick');
    expect(indexSource).toContain(
      'function handleDetail(row: SystemOperateLogApi.OperateLog)',
    );
    expect(indexSource).toContain("column?.slots?.default === 'actions'");
    expect(indexSource).toContain('detailModalApi.setData(row).open()');
  });

  it('shows optional detail values only when they exist', () => {
    const detailSchema = useDetailSchema() as any[];
    const trace = detailSchema.find((item) => item.field === 'traceId');
    const extra = detailSchema.find((item) => item.field === 'extra');

    expect(trace.show({ traceId: 'trace-1' })).toBe(true);
    expect(trace.show({ traceId: '' })).toBe(false);
    expect(extra.show({ extra: '{"id":1}' })).toBe(true);
    expect(extra.show({ extra: '' })).toBe(false);
    expect(detailSource).toContain('column: { lg: 2');
    expect(detailSource).toContain('未获取到操作日志详情，请关闭后重试。');
    expect(detailSource).toContain('font-size: 12px');
  });
});
