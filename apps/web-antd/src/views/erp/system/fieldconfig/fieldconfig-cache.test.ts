import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const customFieldSource = readFileSync(
  join(currentDir, 'custom-field.vue'),
  'utf8',
);
const fieldConfigSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const moduleItemsSource = readFileSync(
  join(currentDir, '../../../system/role/modules/module-items.ts'),
  'utf8',
);

describe('field config cache invalidation', () => {
  it('clears product field config and permission caches after custom field creation', () => {
    expect(customFieldSource).toContain(
      'clearFieldConfigCache(PRODUCT_MODULE_KEY)',
    );
    expect(customFieldSource).toContain(
      'clearFieldPermissionCache(PRODUCT_MODULE_KEY)',
    );
  });

  it('clears field config and permission caches after field config save', () => {
    expect(fieldConfigSource).toContain(
      'clearFieldConfigCache(currentKey.value)',
    );
    expect(fieldConfigSource).toContain(
      'clearFieldPermissionCache(currentKey.value)',
    );
  });
});

describe('field config page field permissions', () => {
  it('applies role field permissions while protecting management columns', () => {
    expect(fieldConfigSource).toContain(
      "const FIELD_CONFIG_PERMISSION_MODULE = 'erp_system_field_config'",
    );
    expect(fieldConfigSource).toContain('useFieldPermission(');
    expect(fieldConfigSource).toContain(
      'const PROTECTED_COLUMN_KEYS = new Set',
    );
    ['fieldName', 'fieldLabel', 'visible', 'action', 'index'].forEach((key) =>
      expect(fieldConfigSource).toContain(`'${key}'`),
    );
    expect(fieldConfigSource).toContain(
      'const effectiveTableColumns = computed',
    );
    expect(fieldConfigSource).toContain('PROTECTED_COLUMN_KEYS.has(columnKey)');
    expect(fieldConfigSource).toContain(
      '!isFieldHidden(hiddenFields.value, columnKey)',
    );
    expect(fieldConfigSource).toContain(':columns="effectiveTableColumns"');
  });
});

describe('product custom field permissions', () => {
  it('separates create and update permissions on the custom field page', () => {
    expect(customFieldSource).toContain(
      "const FIELD_CONFIG_CREATE_PERMISSION = 'erp:field-config:create-custom-field'",
    );
    expect(customFieldSource).toContain(
      "const FIELD_CONFIG_UPDATE_PERMISSION = 'erp:field-config:update'",
    );
    expect(customFieldSource).toContain(
      'v-access:code="[FIELD_CONFIG_CREATE_PERMISSION]"',
    );
    expect(customFieldSource).toContain(
      'v-access:code="[FIELD_CONFIG_UPDATE_PERMISSION]"',
    );
    expect(customFieldSource).toContain('if (canUpdateFieldConfig.value) {');
    expect(customFieldSource).toContain("key: 'action'");
  });

  it('keeps product custom field role rule mapped to query, update, and create permissions', () => {
    expect(moduleItemsSource).toContain('erp_product_custom_field: {');
    expect(moduleItemsSource).toContain(
      "components: ['erp/system/fieldconfig/custom-field']",
    );
    expect(moduleItemsSource).toContain("'erp:field-config:query'");
    expect(moduleItemsSource).toContain("'erp:field-config:update'");
    expect(moduleItemsSource).toContain(
      "'erp:field-config:create-custom-field'",
    );
  });

  it('keeps delete on the batch update contract with retained items', () => {
    expect(customFieldSource).toContain(
      'const items = buildBatchUpdateItems(nextFields)',
    );
    expect(customFieldSource).toContain('deletedCustomFields: [fieldName]');
    expect(customFieldSource).toContain('Modal.confirm({');
    expect(customFieldSource).toContain("okType: 'danger'");
    expect(customFieldSource).toContain('await loadExistingFields()');
    expect(customFieldSource).toContain('clampCurrentPage()');
  });

  it('allows every field label to be edited on the batch update contract', () => {
    expect(customFieldSource).toContain('async function handleEditSubmit()');
    expect(customFieldSource).toContain('if (!target) {');
    expect(customFieldSource).toContain("message.warning('字段不存在')");
    expect(customFieldSource).toContain(
      'field.fieldName === fieldName ? { ...field, fieldLabel } : field',
    );
    expect(customFieldSource).toContain('await batchUpdateFieldConfig({');
    expect(customFieldSource).toContain('items,');
  });

  it('keeps edit available for system fields and delete limited to custom fields', () => {
    expect(customFieldSource).toContain('<div class="table-actions">');
    expect(customFieldSource).toContain('v-if="isCustomField(record)"');
    expect(customFieldSource).not.toContain(
      "message.warning('只能修改自定义字段名称')",
    );
  });

  it('guards edit and delete handlers behind update permission and in-flight state', () => {
    expect(customFieldSource).toContain(
      'if (!canUpdateFieldConfig.value) return;',
    );
    expect(customFieldSource).toContain(
      "message.warning('暂无修改字段名称权限')",
    );
    expect(customFieldSource).toContain(
      'if (!canUpdateFieldConfig.value || deletingFieldName.value) return;',
    );
    expect(customFieldSource).toContain(
      "message.warning('只能删除自定义字段')",
    );
    expect(customFieldSource).toContain(
      ':disabled="Boolean(deletingFieldName) || editSubmitting"',
    );
  });
});
