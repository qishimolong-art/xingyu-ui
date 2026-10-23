import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modules = ['order', 'in', 'return', 'priceadjust', 'invoice'] as const;
const focusExtendedModules = ['priceadjust', 'invoice'] as const;

function readModuleSource(module: (typeof modules)[number], file: string) {
  return readFileSync(join(currentDir, module, 'modules', file), 'utf8');
}

describe.each(modules)('purchase %s document form layout', (module) => {
  const formSource = readModuleSource(module, 'form.vue');
  const itemSource = readModuleSource(module, 'item-form.vue');

  it('uses the fullscreen compact four-column document structure', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain('labelWidth: 82');
    expect(formSource).toContain(
      "wrapperClass: 'purchase-document-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain("layout: 'horizontal'");
    expect(formSource).toContain('preparePurchaseDocumentFormSchema(');

    const basicIndex = formSource.indexOf('>基本信息</span>');
    const itemIndex = formSource.indexOf('class="purchase-document-items"');
    const summaryIndex = formSource.indexOf('<PurchaseDocumentSummary');
    const auditIndex = formSource.indexOf('>审核信息</span>');
    expect(basicIndex).toBeGreaterThan(-1);
    expect(itemIndex).toBeGreaterThan(basicIndex);
    expect(summaryIndex).toBeGreaterThan(itemIndex);
    expect(auditIndex).toBeGreaterThan(summaryIndex);
    expect(formSource.slice(itemIndex, summaryIndex)).not.toContain(
      '</section>',
    );
    expect(formSource).not.toContain('>单据汇总</span>');
  });

  it('has explicit loading, error, success, and stale-request exits', () => {
    expect(formSource).toContain('const detailLoading = ref(false)');
    expect(formSource).toContain("const detailLoadError = ref('')");
    expect(formSource).toContain('let detailLoadSequence = 0');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('v-if="detailLoading"');
    expect(formSource).toContain('v-else-if="detailLoadError"');
    expect(formSource).toContain('purchase-document-form__content');
  });

  it('applies editable state to every non-detail mode', () => {
    expect(formSource).toContain("'purchase-document-form--editable'");
    expect(formSource).toMatch(/formType !== 'detail'|!isDetailMode/);
  });

  it('uses stable three-state local item sorting and compact item controls', () => {
    expect(itemSource).toContain('preparePurchaseDocumentItemColumns(');
    expect(itemSource).toContain('sortPurchaseDocumentItems(');
    expect(itemSource).toContain('rows');
    expect(itemSource).toContain('fit: true');
    expect(itemSource).toContain('reloadColumn');
    expect(itemSource).toContain("orders: ['asc', 'desc', null]");
    expect(itemSource).toContain('sortChange: handleItemSortChange');
    expect(itemSource).toContain('vxe-cell--sort');
    expect(itemSource).not.toContain('<template #bottom>');
  });
});

describe.each(focusExtendedModules)(
  'purchase %s document enter focus contract',
  (module) => {
    const formSource = readModuleSource(module, 'form.vue');

    it('uses the shared editable form focus helpers instead of schema-level input enter binding', () => {
      expect(formSource).toContain('focusFirstEditableFormControl');
      expect(formSource).toContain('focusNextEditableFormControlOnEnter');
      expect(formSource).toContain('queueAfterEditableControlRender');
      expect(formSource).not.toContain('attachPurchaseInputEnterFocus');
    });

    it('focuses the first editable basic-form control after editable loads only', () => {
      expect(formSource).toContain('const basicFormRef = ref<HTMLElement>()');
      expect(formSource).toContain('function canFocusBasicForm()');
      expect(formSource).toContain('return canConfirmForm.value');
      expect(formSource).toContain('focusFirstEditableFormControl(scope)');
      expect(formSource).toContain(
        'void queueFocusFirstBasicFormControl(sequence)',
      );
    });

    it('moves focus on basic-form Enter and submits through the existing confirm path at the end', () => {
      expect(formSource).toContain('@keydown.capture="handleBasicFormEnter"');
      expect(formSource).toContain(
        'focusNextEditableFormControlOnEnter(event, scope, {',
      );
      expect(formSource).toContain(
        'onLastControlEnter: handleLastInputEnterConfirm',
      );
      expect(formSource).toContain('void modalApi.onConfirm()');
    });
  },
);
