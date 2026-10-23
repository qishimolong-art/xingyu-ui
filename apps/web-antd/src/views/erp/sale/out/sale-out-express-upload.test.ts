import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveSaleOutExpressFileUrl } from './utils/express-file';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/out/index.ts'),
  'utf8',
);
const modalSource = readFileSync(
  join(currentDir, 'modules/express-upload-modal.vue'),
  'utf8',
);

describe('sale out express upload contract', () => {
  it('uses the dedicated multipart sales-order endpoint', () => {
    expect(apiSource).toContain('export function uploadSaleOutExpressFile(');
    expect(apiSource).toContain("'/erp/sale-out/upload-express-file'");
    expect(apiSource).toContain('{ file, id }');
    expect(apiSource).toContain('requestClient.upload<string>');
  });

  it('defers upload until confirm and refreshes after success', () => {
    expect(modalSource).toContain(':before-upload="beforeUpload"');
    expect(modalSource).toContain('return false');
    expect(modalSource).toContain('await uploadSaleOutExpressFile(');
    expect(modalSource).toContain("emit('success')");
    expect(modalSource).not.toContain('updateSaleOutExpressFile(');
    expect(modalSource).not.toContain('<ImageUpload');
  });

  it('keeps client-side type and size validation aligned with the backend', () => {
    expect(modalSource).toContain("['jpeg', 'jpg', 'png']");
    expect(modalSource).toContain('5 * 1024 * 1024');
    expect(modalSource).toContain('点击“确认”后上传并绑定销售单');
  });

  it('normalizes express file links without leaking the hash router path', () => {
    expect(modalSource).toContain(
      'currentExpressFileUrl.value = resolveSaleOutExpressFileUrl(',
    );
    expect(
      resolveSaleOutExpressFileUrl(
        '/admin-api/infra/file/-1/get/erp/sale-out/express/1/test.png#/analytics',
        '/admin-api',
      ),
    ).toBe('/admin-api/infra/file/-1/get/erp/sale-out/express/1/test.png');
    expect(
      resolveSaleOutExpressFileUrl(
        'http://erp.scxyltd.com/admin-api/infra/file/-1/get/erp/sale-out/express/1/test.png#/analytics',
        'http://erp.scxyltd.com:48080/admin-api',
      ),
    ).toBe(
      'http://erp.scxyltd.com:48080/admin-api/infra/file/-1/get/erp/sale-out/express/1/test.png',
    );
  });
});
