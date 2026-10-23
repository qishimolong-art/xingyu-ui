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
const apiSource = readFileSync(
  join(currentDir, '..', '..', '..', 'api', 'system', 'login-log', 'index.ts'),
  'utf8',
);

describe('system login log page UI contract', () => {
  it('keeps all business columns sortable and fixes only the operation column', () => {
    const columns = useGridColumns() as any[];
    const businessColumns = columns.slice(0, -1);

    expect(columns.map((column) => column.title)).toEqual([
      '日志编号',
      '登录类型',
      '用户名称',
      '登录地址',
      '浏览器',
      '登录结果',
      '登录日期',
      '操作',
    ]);
    businessColumns.forEach((column) => {
      expect(column.sortable, column.field).toBe(true);
      expect(column.showOverflow, column.field).toBe('tooltip');
    });
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
  });

  it('provides a compact login-result filter and input Enter search', () => {
    const formSchemas = useGridFormSchema() as any[];
    const statusSchema = formSchemas.find(
      (schema) => schema.fieldName === 'status',
    );

    expect(statusSchema.component).toBe('Select');
    expect(statusSchema.componentProps.options).toEqual([
      { label: '成功', value: true },
      { label: '失败', value: false },
    ]);
    expect(statusSchema.componentProps.popupClassName).toBe(
      'login-log-search-select-dropdown',
    );
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('event.isComposing');
    expect(indexSource).toContain("target.closest('.ant-picker, .ant-select')");
    expect(indexSource).toContain('font-size: 12px');
  });

  it('uses safe three-state remote sorting for query and export', () => {
    expect(indexSource).toContain("orders: ['asc', 'desc', null]");
    expect(indexSource).toContain('allowBtn: false');
    expect(indexSource).toContain('activeSortParams.value');
    expect(indexSource).toContain('...activeSortParams.value');
    expect(indexSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(apiSource).toContain(
      'interface LoginLogPageParams extends PageParam',
    );
  });

  it('highlights failed rows while leaving successful rows neutral', () => {
    expect(indexSource).toContain("'login-log-row--failed'");
    expect(indexSource).toContain('row.result === LOGIN_SUCCESS_RESULT');
    expect(indexSource).toContain('hsl(var(--destructive) / 9%)');
    expect(indexSource).toContain(
      '浅红色背景表示登录失败，白色背景表示登录成功',
    );
  });

  it('preserves login-log query and export permissions', () => {
    expect(indexSource).toContain('system:login-log:query');
    expect(indexSource).toContain('system:login-log:export');
  });

  it('opens login detail from regular row cells', () => {
    expect(indexSource).toContain('cellClick: handleCellClick');
    expect(indexSource).toContain(
      'function handleDetail(row: SystemLoginLogApi.LoginLog)',
    );
    expect(indexSource).toContain("column?.slots?.default === 'actions'");
    expect(indexSource).toContain('detailModalApi.setData(row).open()');
  });

  it('renders a compact responsive detail and hides empty trace IDs', () => {
    const detailSchema = useDetailSchema() as any[];
    const trace = detailSchema.find((item) => item.field === 'traceId');
    const userAgent = detailSchema.find((item) => item.field === 'userAgent');

    expect(trace.show({ traceId: 'trace-1' })).toBe(true);
    expect(trace.show({ traceId: '' })).toBe(false);
    expect(userAgent.span).toBe(2);
    expect(detailSource).toContain('column: { lg: 2');
    expect(detailSource).toContain('未获取到登录日志详情，请关闭后重试。');
    expect(detailSource).toContain('font-size: 12px');
  });
});
