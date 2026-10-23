import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { effectScope, nextTick, ref, watch } from 'vue';

// eslint-disable-next-line n/no-extraneous-import -- workspace TypeScript compiler used to execute extracted setup statements
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import { getTransferAmountError } from './misc-transfer-amount';

// Execute actual declarations and watcher in source order to catch setup-time
// reads before initialization, which source-string assertions cannot detect.
function createWatcher(kind: 'payment' | 'receipt') {
  const source =
    readFileSync(
      `apps/web-antd/src/views/erp/finance/settlement/${kind}/modules/form.vue`,
      'utf8',
    )
      .split('<script lang="ts" setup>')[1]
      ?.split('</script>')[0] ?? '';
  const ast = ts.createSourceFile(
    'form.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const selected: string[] = [];
  for (const statement of ast.statements) {
    const text = statement.getText(ast);
    if (
      /^const (formData|transferLimit|transferLimitError)\b/.test(text) ||
      /^watch\(\s*\(\) => \[formData\.value\.(paymentPrice|receiptPrice)/.test(
        text,
      )
    ) {
      selected.push(text);
    } else if (text.startsWith('const [Form, formApi] = useVbenForm(')) {
      selected.push('const formApi = { form: { setFieldError } };');
    }
  }
  expect(selected).toHaveLength(5);
  const js = ts.transpileModule(
    `${selected.join('\n')}\nreturn { formData, transferLimit };`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    },
  ).outputText;
  const setFieldError = vi.fn();
  const formType = ref('create');
  const scope = effectScope();
  try {
    const state = scope.run(() =>
      runInNewContext(`(function () { ${js} })()`, {
        ref,
        watch,
        formType,
        createDefaultFormData: () => ({}),
        setFieldError,
        getTransferAmountError,
      }),
    );
    return { ...state, formType, setFieldError, stop: () => scope.stop() };
  } catch (error) {
    scope.stop();
    throw error;
  }
}

describe.each(['receipt', 'payment'] as const)(
  '%s transfer watcher runtime',
  (kind) => {
    const amountField = `${kind}Price`;
    const sourceField =
      kind === 'receipt' ? 'sourceReceivableMiscId' : 'sourcePayableMiscId';

    it('initializes and revalidates when amount or limit changes', async () => {
      const state = createWatcher(kind);
      try {
        state.formData.value = { [sourceField]: 1, [amountField]: 701 };
        state.transferLimit.value = 700;
        await nextTick();
        expect(state.setFieldError).toHaveBeenLastCalledWith(
          amountField,
          expect.stringContaining('700.00'),
        );
        state.formData.value[amountField] = 700;
        await nextTick();
        expect(state.setFieldError).toHaveBeenLastCalledWith(
          amountField,
          undefined,
        );
        state.transferLimit.value = 600;
        await nextTick();
        expect(state.setFieldError).toHaveBeenLastCalledWith(
          amountField,
          expect.stringContaining('600.00'),
        );
      } finally {
        state.stop();
      }
    });

    it('skips ordinary documents, detail mode and masked limits', async () => {
      const state = createWatcher(kind);
      try {
        state.formData.value = { [amountField]: 701 };
        state.transferLimit.value = 700;
        await nextTick();
        state.formType.value = 'detail';
        state.formData.value = { [sourceField]: 1, [amountField]: 702 };
        await nextTick();
        state.formType.value = 'create';
        state.transferLimit.value = null;
        await nextTick();
        expect(state.setFieldError).not.toHaveBeenCalled();
      } finally {
        state.stop();
      }
    });
  },
);
