import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);

describe('department list compact UI contract', () => {
  it('keeps click-header sorting while hiding its direction arrows', () => {
    expect(indexSource).toContain("orders: ['asc', 'desc', null]");
    expect(indexSource).toContain('remote: true');
    expect(indexSource).toContain('.vxe-header--column.is--sortable');
    expect(indexSource).toContain('.vxe-cell--title');
    expect(indexSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(indexSource).toContain('display: none');
  });

  it('matches search and toolbar controls to the compact 12px scale', () => {
    expect(indexSource).toContain('class="department-management-grid"');
    expect(indexSource).toContain('.vxe-grid--form-wrapper');
    expect(indexSource).toContain('.ant-input-affix-wrapper');
    expect(indexSource).toContain('.vxe-toolbar .table-actions .ant-btn');
    expect(indexSource).toContain(
      '.vxe-body--column .table-actions .ant-btn-link',
    );
    expect(indexSource).toContain('.vxe-toolbar .vxe-button');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('height: 28px');
  });

  it('opens readonly department detail from regular row cells', () => {
    expect(indexSource).toContain('cellClick: handleCellClick');
    expect(indexSource).toContain(
      'function handleDetail(row: SystemDeptApi.Dept)',
    );
    expect(indexSource).toContain("type: 'detail'");
    expect(indexSource).toContain("column?.slots?.default === 'dragHandle'");
    expect(indexSource).toContain('.vxe-tree--btn-wrapper');
    expect(indexSource).toContain('@append="handleAppend"');
    expect(indexSource).toContain('@edit="handleEdit"');
    expect(formSource).toContain(
      "type FormType = 'create' | 'detail' | 'edit'",
    );
    expect(formSource).toContain('const isDetail = computed');
    expect(formSource).toContain(':show-confirm-button="canSubmit"');
    expect(formSource).toContain("hasAccessByCodes(['system:dept:update'])");
    expect(formSource).toContain("hasAccessByCodes(['system:dept:create'])");
    expect(formSource).toContain('department-edit-form--readonly');
  });

  it('uses the same 12px typography in the teleported status dropdown', () => {
    expect(dataSource).toContain(
      "popupClassName: 'department-search-select-dropdown'",
    );
    expect(indexSource).toContain(
      '.department-search-select-dropdown .ant-select-item',
    );
  });
});
