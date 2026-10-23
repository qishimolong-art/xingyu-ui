import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);

describe('legacy finance payment negative amount support', () => {
  it('uses lazy supplier select without the old full-list api', () => {
    const supplierField = useFormSchema('create').find(
      (field) => field.fieldName === 'supplierId',
    );

    expect(supplierField?.component).toBe('SupplierLazySelect');
    expect((supplierField?.componentProps as any)?.api).toBeUndefined();
    expect((supplierField?.componentProps as any)?.pageSize).toBe(10);
  });

  it('allows signed non-zero main amounts while keeping discount non-negative', () => {
    const formSchema = useFormSchema('create');
    const totalRule = formSchema.find(
      (field) => field.fieldName === 'totalPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    const paymentRule = formSchema.find(
      (field) => field.fieldName === 'paymentPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };
    const discountRule = formSchema.find(
      (field) => field.fieldName === 'discountPrice',
    )?.rules as { safeParse: (value: unknown) => { success: boolean } };

    expect(totalRule.safeParse(-20).success).toBe(true);
    expect(totalRule.safeParse(0).success).toBe(false);
    expect(paymentRule.safeParse(-20).success).toBe(true);
    expect(paymentRule.safeParse(0).success).toBe(false);
    expect(discountRule.safeParse(0).success).toBe(true);
    expect(discountRule.safeParse(-0.01).success).toBe(false);
  });

  it('validates item payment amount by signed remaining amount', () => {
    expect(itemFormSource).toContain(
      'Math.sign(paymentPrice) !== Math.sign(remainingPrice)',
    );
    expect(itemFormSource).toContain(
      'Math.abs(paymentPrice) > Math.abs(remainingPrice)',
    );
    expect(itemFormSource).toContain('核销金额必须在未核销金额范围内');
    expect(itemFormSource).not.toContain('本次付款必须大于0');
  });
});
