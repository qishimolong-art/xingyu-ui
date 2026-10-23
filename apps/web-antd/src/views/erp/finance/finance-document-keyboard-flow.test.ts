import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const documentForms = [
  ['settlement receipt', ['settlement', 'receipt', 'modules', 'form.vue']],
  ['settlement payment', ['settlement', 'payment', 'modules', 'form.vue']],
  ['bank transfer', ['cash-bank', 'transfer', 'modules', 'form.vue']],
  ['payable expense', ['payable', 'expense', 'modules', 'form.vue']],
  [
    'receivable other income',
    ['receivable', 'other-income', 'modules', 'form.vue'],
  ],
  [
    'receivable other receivable',
    ['receivable', 'other-receivable', 'modules', 'form.vue'],
  ],
  ['payable other', ['payable', 'other', 'modules', 'form.vue']],
  ['receivable misc', ['receivable', 'misc', 'modules', 'form.vue']],
  ['payable misc', ['payable', 'misc', 'modules', 'form.vue']],
] as const;

const formsWithEditableItems = [
  ['settlement receipt', ['settlement', 'receipt', 'modules', 'form.vue']],
  ['settlement payment', ['settlement', 'payment', 'modules', 'form.vue']],
  ['payable expense', ['payable', 'expense', 'modules', 'form.vue']],
  [
    'receivable other income',
    ['receivable', 'other-income', 'modules', 'form.vue'],
  ],
] as const;

const editableItemComponents = [
  [
    'settlement receipt item',
    ['settlement', 'receipt', 'modules', 'item-form.vue'],
    undefined,
  ],
  [
    'settlement payment item',
    ['settlement', 'payment', 'modules', 'item-form.vue'],
    undefined,
  ],
  [
    'settlement receipt sale select',
    ['settlement', 'receipt', 'modules', 'sale-select.vue'],
    'data-finance-receipt-price-input="true"',
  ],
  [
    'settlement payment purchase select',
    ['settlement', 'payment', 'modules', 'purchase-select.vue'],
    'data-finance-payment-price-input="true"',
  ],
  [
    'payable expense item',
    ['payable', 'expense', 'modules', 'item-form.vue'],
    'data-payable-expense-amount-input="true"',
  ],
  [
    'receivable other income item',
    ['receivable', 'other-income', 'modules', 'item-form.vue'],
    'data-other-income-amount-input="true"',
  ],
] as const;

function readFinanceFile(pathSegments: readonly string[]) {
  return readFileSync(join(currentDir, ...pathSegments), 'utf8');
}

describe('finance document keyboard flow', () => {
  it.each(documentForms)(
    'uses container-level Enter focus flow on %s',
    (_name, path) => {
      const source = readFinanceFile(path);

      expect(source).not.toContain('attachFinanceInputEnterFocus');
      expect(source).not.toContain('handleFinanceInputEnterFocus');
      expect(source).toContain('basicFormRef');
      expect(source).toContain('handleFinanceEditableFormEnter');
      expect(source).toContain('queueFocusFirstFinanceEditableFormControl');
      expect(source).toContain('function canFocusBasicForm()');
      expect(source).toContain('function handleBasicFormEnter');
      expect(source).toContain('function handleLastInputEnterConfirm');
      expect(source).toContain('void modalApi.onConfirm()');
      expect(source).toContain('@keydown.enter.capture="handleBasicFormEnter"');
      expect(source).toContain('queueFocusFirstBasicFormControl');
    },
  );

  it.each(formsWithEditableItems)(
    'routes editable item last Enter to the original confirm path on %s',
    (_name, path) => {
      const source = readFinanceFile(path);

      expect(source).toContain('@request-submit="handleLastInputEnterConfirm"');
    },
  );

  it.each(editableItemComponents)(
    'emits request-submit from editable item inputs on %s',
    (_name, path, focusSelector) => {
      const source = readFinanceFile(path);

      expect(source).toContain("'request-submit'");
      expect(source).toContain('function handleItemInputPressEnter');
      expect(source).toContain('focusNextInputOnEnter(event)');
      expect(source).toContain("emit('request-submit', event)");
      expect(source).not.toContain('@press-enter="focusNextInputOnEnter"');
      if (focusSelector) {
        expect(source).toContain('focusFirstEditableInput');
        expect(source).toContain('queueAfterEditableControlRender');
        expect(source).toContain('isCurrent: true');
        expect(source).toContain(focusSelector);
      }
    },
  );

  it('includes account maintenance in the complete editable-control contract', () => {
    const accountForm = readFinanceFile([
      'cash-bank',
      'account',
      'modules',
      'form.vue',
    ]);

    expect(accountForm).toContain('handleFinanceEditableFormEnter');
    expect(accountForm).toContain('queueFocusFirstFinanceEditableFormControl');
    expect(accountForm).toContain('() => void modalApi.onConfirm()');
    expect(accountForm).not.toContain('attachFinanceInputEnterFocus');
  });
});
