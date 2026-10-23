import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const formFiles = [
  '../../finance/cash-bank/transfer/modules/form.vue',
  '../../finance/payable/expense/modules/form.vue',
  '../../finance/payable/misc/modules/form.vue',
  '../../finance/payable/other/modules/form.vue',
  '../../finance/receivable/misc/modules/form.vue',
  '../../finance/receivable/other-receivable/modules/form.vue',
  '../../finance/receivable/other-income/modules/form.vue',
  '../../finance/settlement/payment/modules/form.vue',
  '../../finance/settlement/receipt/modules/form.vue',
  '../../purchase/in/modules/form.vue',
  '../../purchase/invoice/modules/form.vue',
  '../../purchase/order/modules/form.vue',
  '../../purchase/priceadjust/modules/form.vue',
  '../../purchase/return/modules/form.vue',
  '../../sale/cart/modules/form.vue',
  '../../sale/priceadjust/modules/form.vue',
  '../../sale/quote/modules/form.vue',
  '../../sale/return/modules/form.vue',
  '../../stock/transfer-out/modules/form.vue',
] as const;
const componentDirectory = resolve(
  process.cwd(),
  'apps/web-antd/src/views/erp/report/components',
);

describe('报表单据详情严格只读', () => {
  it.each(formFiles)('%s 在报表上下文隐藏业务动作区', (relativePath) => {
    const source = readFileSync(
      resolve(componentDirectory, relativePath),
      'utf8',
    );

    expect(source).toContain('const reportViewOnly = useReportViewOnly();');
    expect(source).toContain(
      '<template v-if="!reportViewOnly" #center-footer>',
    );
    expect(source).toContain(
      '<template v-if="!reportViewOnly" #prepend-footer>',
    );
  });

  it('销售出库关联详情在报表上下文隐藏业务动作区', () => {
    const source = readFileSync(
      resolve(componentDirectory, '../../sale/out/modules/form.vue'),
      'utf8',
    );

    expect(source).toContain('const reportViewOnly = useReportViewOnly();');
    expect(source).toContain(
      '<template v-if="!reportViewOnly" #prepend-footer>',
    );
  });

  it('旧销售订单在报表上下文隐藏业务动作区', () => {
    const source = readFileSync(
      resolve(componentDirectory, '../../sale/order/modules/form.vue'),
      'utf8',
    );

    expect(source).toContain('const reportViewOnly = useReportViewOnly();');
    expect(source).toContain(
      '<template v-if="!reportViewOnly" #prepend-footer>',
    );
    expect(source).toContain('!reportViewOnly &&');
  });

  it.each([
    '../../finance/settlement/payment/modules/form.vue',
    '../../finance/settlement/receipt/modules/form.vue',
  ])('%s 在报表上下文关闭行内反核销', (relativePath) => {
    const source = readFileSync(
      resolve(componentDirectory, relativePath),
      'utf8',
    );

    expect(source).toContain(
      ':allow-reverse="!reportViewOnly && formData?.status === 20"',
    );
  });

  it('共用详情启动器在鉴权后传递只读标记', () => {
    const source = readFileSync(
      resolve(componentDirectory, 'report-document-detail-modal.vue'),
      'utf8',
    );

    expect(source).toContain("message.warning('无该单据查看权限')");
    expect(source).toContain('reportViewOnly: true');
    expect(source).toContain('provideReportViewOnly();');

    const contextSource = readFileSync(
      resolve(componentDirectory, 'report-view-only.ts'),
      'utf8',
    );
    expect(contextSource).toContain('inject(REPORT_VIEW_ONLY_KEY, false)');
  });
});
