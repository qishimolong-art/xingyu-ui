import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const outboundModalSource = readFileSync(
  join(currentDir, 'modules/convert-cart-modal.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/quote/index.ts'),
  'utf8',
);

describe('sale quote ordering and outbound-to-cart workflow', () => {
  it('shows independent order and outbound status columns plus an outbound action column', () => {
    expect(dataSource).toContain("field: 'outAction'");
    expect(dataSource).toContain("title: '出库'");
    expect(dataSource).toContain("slots: { default: 'outAction' }");
    expect(dataSource).toContain("field: 'orderStatus'");
    expect(dataSource).toContain("title: '下订状态'");
    expect(dataSource).toContain("field: 'outStatus'");
    expect(dataSource).toContain("title: '出库状态'");
    expect(indexSource).toContain(
      "return row.orderStatus === 20 ? '已下订' : '未下订'",
    );
    expect(indexSource).toContain(
      "if (row.outStatus === 40) return '全部转手推车'",
    );
    expect(indexSource).toContain("if (row.outStatus === 50) return '已出库'");
    expect(indexSource).toContain('<template #outAction="{ row }">');
  });

  it('restricts ordering, reverse ordering and outbound actions by state and permission', () => {
    expect(indexSource).toContain("label: '下订'");
    expect(indexSource).toContain('ifShow: () => row.status === 10');
    expect(indexSource).toContain("label: '反下订'");
    expect(indexSource).toContain('ifShow: () => row.status === 20');
    expect(indexSource).toContain("auth: ['erp:sale-quote:approve']");
    expect(indexSource).toContain("label: '出库'");
    expect(indexSource.match(/label: '出库'/g)).toHaveLength(1);
    expect(indexSource).toContain("auth: ['erp:sale-quote:convert-cart']");
    expect(indexSource).toContain(
      'return row.status === 20 || row.status === 30',
    );
    expect(formSource).toContain('const showReverseOrderBtn = computed');
  });

  it('uses the reverse-order API and creates a pending-review cart from partial quantities', () => {
    expect(apiSource).toContain("'/erp/sale-quote/reverse-order'");
    expect(apiSource).toContain("'/erp/sale-quote/convert-cart'");
    expect(outboundModalSource).toContain("title: '本次出库数量'");
    expect(outboundModalSource).toContain('count > row.convertibleCount');
    expect(outboundModalSource).toContain('已生成待审核销售手推车');
    expect(outboundModalSource).toContain('报价订单分批出库');
  });

  it('shows warehouse department and realtime stock without client-side stock blocking', () => {
    expect(outboundModalSource).toContain('includeStock: true');
    expect(outboundModalSource).toContain("title: '仓库'");
    expect(outboundModalSource).toContain("title: '所属部门'");
    expect(outboundModalSource).toContain("title: '库存'");
    expect(outboundModalSource).toContain("title: '可用库存'");
    expect(outboundModalSource).toContain('record.availableCount ?? 0');
    expect(outboundModalSource).not.toContain('count > row.availableCount');
    expect(apiSource).toContain('includeStock?: boolean');
    expect(apiSource).toContain('includeStock: options.includeStock');
  });

  it('places the outbound quantity immediately after quantity and before unit price', () => {
    const quantityColumn = outboundModalSource.indexOf(
      "title: '数量', dataIndex: 'quoteCount'",
    );
    const outboundQuantityColumn = outboundModalSource.indexOf(
      "title: '本次出库数量', dataIndex: 'count'",
    );
    const priceColumn = outboundModalSource.indexOf(
      "title: '单价', dataIndex: 'productPrice'",
    );

    expect(quantityColumn).toBeGreaterThan(-1);
    expect(outboundQuantityColumn).toBeGreaterThan(quantityColumn);
    expect(priceColumn).toBeGreaterThan(outboundQuantityColumn);
  });

  it('uses money and compact-number formatters throughout the outbound modal', () => {
    expect(outboundModalSource).toContain(
      'erpPriceInputFormatter(record.productPrice)',
    );
    expect(outboundModalSource).toContain(
      'erpCountInputFormatter(record.weight)',
    );
    expect(outboundModalSource).toContain(
      'erpCountInputFormatter(record.packageQty)',
    );
    expect(outboundModalSource).toContain(
      'count: erpCountInputFormatter(convertibleCount)',
    );
    expect(outboundModalSource).toContain(
      '@update:value="record.countDirty = true"',
    );
    expect(outboundModalSource).toContain('@blur="handleCountBlur(record)"');
  });
});
