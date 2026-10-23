import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ERP_DETAIL_PERMISSION_ERROR_TEXT,
  getErpDetailLoadError,
  isErpPermissionError,
} from './detail-load-error';

const currentDir = dirname(fileURLToPath(import.meta.url));
const sourceDocumentForms = [
  '../purchase/in/modules/form.vue',
  '../purchase/return/modules/form.vue',
  '../purchase/priceadjust/modules/form.vue',
  '../sale/out/modules/form.vue',
  '../sale/return/modules/form.vue',
  '../sale/priceadjust/modules/form.vue',
  '../stock/in/modules/form.vue',
  '../stock/out/modules/form.vue',
  '../stock/move/modules/form.vue',
  '../stock/warehouse-move/modules/form.vue',
  '../stock/check/modules/form.vue',
] as const;
const financeDetailForms = [
  {
    fallback: '收款单详情加载失败，请关闭后重试',
    path: '../finance/settlement/receipt/modules/form.vue',
  },
  {
    fallback: '付款单加载失败，请关闭后重试',
    path: '../finance/settlement/payment/modules/form.vue',
  },
  {
    fallback: '其他应收详情加载失败，请关闭后重试',
    path: '../finance/receivable/other-receivable/modules/form.vue',
  },
  {
    fallback: '其他应付详情加载失败，请关闭后重试',
    path: '../finance/payable/other/modules/form.vue',
  },
] as const;
const financeAccountDetailDrawers = [
  {
    fallback: '收款单详情加载失败，请稍后重试',
    path: '../finance/receivable/account/modules/detail-drawer.vue',
  },
  {
    fallback: '付款单详情加载失败，请稍后重试',
    path: '../finance/payable/account/modules/detail-drawer.vue',
  },
] as const;

describe('ERP detail load error', () => {
  it('detects permission errors from common response shapes', () => {
    expect(isErpPermissionError({ response: { data: { code: 403 } } })).toBe(
      true,
    );
    expect(isErpPermissionError({ data: { code: '403' } })).toBe(true);
    expect(
      isErpPermissionError({ response: { data: { msg: '没有该操作权限' } } }),
    ).toBe(true);
    expect(
      isErpPermissionError({ response: { data: { msg: '没有该数据权限' } } }),
    ).toBe(true);
    expect(isErpPermissionError(new Error('当前用户无权限查看'))).toBe(true);
  });

  it('uses a stable permission message and preserves non-permission fallbacks', () => {
    expect(ERP_DETAIL_PERMISSION_ERROR_TEXT).toBe('没有该数据权限');
    expect(
      getErpDetailLoadError(
        { response: { data: { message: '没有该操作权限' } } },
        '详情加载失败，请关闭后重试',
      ),
    ).toBe(ERP_DETAIL_PERMISSION_ERROR_TEXT);
    expect(getErpDetailLoadError(new Error('网络异常'), '加载失败')).toBe(
      '加载失败',
    );
  });

  it('is used by stock detail source document forms', () => {
    sourceDocumentForms.forEach((relativePath) => {
      const source = readFileSync(join(currentDir, relativePath), 'utf8');

      expect(source).toContain(
        "import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error'",
      );
      expect(source).toContain('getErpDetailLoadError(');
    });
  });

  it('is used by finance account and report source document forms', () => {
    financeDetailForms.forEach(({ fallback, path }) => {
      const source = readFileSync(join(currentDir, path), 'utf8');

      expect(source).toContain(
        "import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error'",
      );
      expect(source).toContain('getErpDetailLoadError(');
      expect(source).toContain(fallback);
    });
  });

  it('is used by finance account writeoff direct detail loads', () => {
    financeAccountDetailDrawers.forEach(({ fallback, path }) => {
      const source = readFileSync(join(currentDir, path), 'utf8');

      expect(source).toContain(
        "import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error'",
      );
      expect(source).toContain('getErpDetailLoadError(');
      expect(source).toContain(fallback);
    });
  });
});
