import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

describe('current cost affected Vue compilation', () => {
  for (const relative of [
    './current-cost-confirmation.vue',
    './current-cost-review.vue',
    './form.vue',
    '../index.vue',
    '../../../report/trade-v2/index.vue',
  ]) {
    it(`compiles ${relative}`, () => {
      const filename = fileURLToPath(new URL(relative, import.meta.url));
      const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), {
        filename,
      });
      expect(errors).toEqual([]);
      const script = compileScript(descriptor, { id: filename });
      const template = compileTemplate({
        id: filename,
        filename,
        source: descriptor.template!.content,
        compilerOptions: { bindingMetadata: script.bindings },
      });
      expect(template.errors).toEqual([]);
    });
  }
});
