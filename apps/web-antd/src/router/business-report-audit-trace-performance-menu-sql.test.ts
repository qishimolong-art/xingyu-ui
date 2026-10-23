import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../');
const sqlSource = readFileSync(
  join(
    workspaceRoot,
    'code/sql/mysql/erp_business_report_audit_trace_performance_pages_20260924.sql',
  ),
  'utf8',
);

describe('business report audit trace performance pages SQL', () => {
  it('adds independent M12 report pages under business reports', () => {
    expect(sqlSource).toContain('异常审计及绩效');
    expect(sqlSource).toContain('原单与反向业务追踪');
    expect(sqlSource).toContain('业务链路追踪');
    expect(sqlSource).toContain('未闭环业务清单');
    expect(sqlSource).toContain('异常规则与待办');
    expect(sqlSource).toContain('操作日志审计');
    expect(sqlSource).toContain('岗位绩效评分');
    expect(sqlSource).toContain('历史异常审计口径');
    expect(sqlSource).toContain('reverse-trace');
    expect(sqlSource).toContain('business-chain');
    expect(sqlSource).toContain('open-loop');
    expect(sqlSource).toContain('exception-todo');
    expect(sqlSource).toContain('operation-audit');
    expect(sqlSource).toContain('performance-score');
    expect(sqlSource).toContain('erp/report/audit-trace-performance/index');
  });

  it('is repeatable menu SQL without business table, role, tenant, or switch writes', () => {
    expect(sqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sqlSource).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toContain('system_role_menu');
    expect(sqlSource).not.toContain('system_tenant_package');
    expect(sqlSource).not.toMatch(/dual[-_]?cost/i);
    expect(sqlSource).not.toMatch(/erp_stock_record_cursor/i);
  });

  it('points every page to an existing frontend component', () => {
    expect(
      existsSync(
        join(
          workspaceRoot,
          'ui/apps/web-antd/src/views/erp/report/audit-trace-performance/index.vue',
        ),
      ),
    ).toBe(true);
  });
});
