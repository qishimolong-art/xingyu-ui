import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const modalSource = readFileSync(
  join(currentDir, 'modules', 'address-send-modal.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    '..',
    'api',
    'mall',
    'promotion',
    'coupon',
    'coupon.ts',
  ),
  'utf8',
);

describe('coupon address-target send contract', () => {
  it('shows the action only for admin templates under the existing send permission', () => {
    expect(listSource).toContain("label: '按地区发放'");
    expect(listSource).toContain("auth: ['promotion:coupon:send']");
    expect(listSource).toContain(
      'row.takeType === CouponTemplateTakeTypeEnum.ADMIN.type',
    );
    expect(listSource).toContain('isAddressSendDisabled(row)');
  });

  it('keeps exclusions across pages and resets them when areas change', () => {
    expect(modalSource).toContain(
      'excludedUserIds = ref<Set<number>>(new Set())',
    );
    expect(modalSource).toContain('preserveSelectedRowKeys: true');
    expect(modalSource).toContain('async function handleAreaChange()');
    expect(modalSource).toContain('resetPreview();');
    expect(modalSource).toContain('恢复全部选择');
  });

  it('uses server-side recomputation, a stable UUID, and privacy-safe preview fields', () => {
    expect(apiSource).toContain('/promotion/coupon/address-target/page');
    expect(apiSource).toContain('/promotion/coupon/send-by-address');
    expect(modalSource).toContain('requestId: requestId.value');
    expect(modalSource).toContain(
      'excludedUserIds: [...excludedUserIds.value]',
    );
    expect(modalSource).toContain("dataIndex: 'mobile'");
    expect(modalSource).toContain("dataIndex: 'matchedAreaNames'");
    expect(modalSource).not.toContain('detailAddress');
  });
});
