import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');

describe('department form sales-cart UI contract', () => {
  it('uses the fullscreen four-column basic-information layout for create and edit', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'department-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain("formItemClass: 'col-span-1'");
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain('compact: true');
    expect(formSource).toContain(
      'class="department-form-section__title">基本信息',
    );
  });

  it('shares compact editable-state styling and explicit dropdown typography', () => {
    expect(formSource).toContain(
      'class="department-edit-form department-edit-form--editable"',
    );
    expect(formSource).toContain('min-height: 32px');
    expect(formSource).toContain('font-size: 12px');
    expect(formSource).toContain('.department-form-select-dropdown');
    expect(dataSource.match(/department-form-select-dropdown/g)).toHaveLength(
      2,
    );
  });

  it('preserves edit loading, field permissions, and create-update submission paths', () => {
    expect(formSource).toContain('hiddenFields.value');
    expect(formSource).toContain('removeHiddenValues');
    expect(formSource).toContain('formData.value = await getDept(data.id)');
    expect(formSource).toContain(
      'formData.value?.id ? updateDept(data) : createDept(data)',
    );
    expect(formSource).toContain('modalApi.unlock()');
  });
});
