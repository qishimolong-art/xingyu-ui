import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { describe, expect, it } from 'vitest';
describe('销售取消领货受影响页面编译', () => {
  for (const relative of [
    './index.vue',
    './modules/detail-modal.vue',
    '../warehouse/modules/form.vue',
    '../warehouse/modules/batch-edit-form.vue',
    '../../sale/out/index.vue',
    '../../sale/out/modules/form.vue',
  ]) {
    it(`compiles ${relative}`, () => {
      const filename = fileURLToPath(new URL(relative, import.meta.url));
      const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), {
        filename,
      });
      expect(errors).toEqual([]);
      const script = compileScript(descriptor, { id: filename });
      expect(
        compileTemplate({
          id: filename,
          filename,
          source: descriptor.template!.content,
          compilerOptions: { bindingMetadata: script.bindings },
        }).errors,
      ).toEqual([]);
    });
  }
});
