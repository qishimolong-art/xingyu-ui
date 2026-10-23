import { describe, expect, it, vi } from 'vitest';

import { getBusinessLicenseNameMismatch } from '#/views/erp/sale/customer/utils/business-license-ocr';

import { buildSupplierBusinessLicenseAddressFill } from './business-license-ocr';

const address = '浙江省杭州市滨江区长河街道测试路18号201室';
const areaIds = ['浙江省', '杭州市', '滨江区'];
const tree = [
  {
    id: 33,
    name: '浙江省',
    children: [
      { id: 3301, name: '杭州市', children: [{ id: 330_108, name: '滨江区' }] },
    ],
  },
];

describe('supplier full residence fill', () => {
  it('fills complete address and name-based region path', async () => {
    const result = await buildSupplierBusinessLicenseAddressFill(
      address,
      {},
      async () => tree,
    );
    expect(result.values).toEqual({ address, areaIds });
    expect(result.unmatchedAddress).toBe(false);
  });
  it('fills address without requesting regions when an area is already selected', async () => {
    const load = vi.fn();
    const result = await buildSupplierBusinessLicenseAddressFill(
      address,
      { areaIds },
      load,
    );
    expect(result.values).toEqual({ address });
    expect(load).not.toHaveBeenCalled();
  });
  it('keeps existing address and independently fills region', async () => {
    const result = await buildSupplierBusinessLicenseAddressFill(
      address,
      { address: '人工地址' },
      async () => tree,
    );
    expect(result.values).toEqual({ areaIds });
  });
  it.each(['unmatched', 'exception', 'missing-name'])(
    'retains full residence on %s',
    async (scenario) => {
      const load = async () => {
        if (scenario === 'exception') throw new Error('area unavailable');
        return scenario === 'missing-name'
          ? [{ id: 0, name: '', children: tree }]
          : [];
      };
      expect(
        await buildSupplierBusinessLicenseAddressFill(address, {}, load),
      ).toMatchObject({ values: { address }, unmatchedAddress: true });
    },
  );
  it('does not clear fields or load areas when residence is empty', async () => {
    const load = vi.fn();
    const result = await buildSupplierBusinessLicenseAddressFill(
      '  ',
      { address, areaIds },
      load,
    );
    expect(result.values).toEqual({});
    expect(load).not.toHaveBeenCalled();
  });
  it('does not overwrite fields on repeated recognition', async () => {
    const load = vi.fn();
    expect(
      await buildSupplierBusinessLicenseAddressFill(
        address,
        { address, areaIds },
        load,
      ),
    ).toMatchObject({ values: {}, skippedCount: 2 });
    expect(load).not.toHaveBeenCalled();
  });
});

describe('supplier name confirmation messages', () => {
  it('shows supplier-specific text while preserving customer default', () => {
    const result = { invoiceCompany: '营业执照公司' };
    expect(
      getBusinessLicenseNameMismatch('原名称', result, '供应商'),
    ).toMatchObject({
      description: expect.stringContaining('当前供应商名称：原名称'),
    });
    expect(getBusinessLicenseNameMismatch('原名称', result)).toMatchObject({
      description: expect.stringContaining('当前客户名称：原名称'),
    });
  });
  it.each([
    ['', '公司'],
    ['公司', ''],
    ['公司', '公司'],
    [' 公司 ', '公司 '],
  ])('does not prompt for %s / %s', (name, license) => {
    expect(
      getBusinessLicenseNameMismatch(
        name,
        { invoiceCompany: license },
        '供应商',
      ),
    ).toBeUndefined();
  });
  it('does not use fuzzy name matching', () => {
    expect(
      getBusinessLicenseNameMismatch(
        '测试 公司',
        { invoiceCompany: '测试公司' },
        '供应商',
      ),
    ).toBeDefined();
  });
});
