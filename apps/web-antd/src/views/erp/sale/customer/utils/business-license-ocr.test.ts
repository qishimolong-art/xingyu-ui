import { describe, expect, it, vi } from 'vitest';

import {
  buildBusinessLicenseAddressFill,
  getBusinessLicenseAddress,
  getBusinessLicenseCustomerName,
  getBusinessLicenseNameMismatch,
  resolveBusinessLicenseArea,
} from './business-license-ocr';

const areaTree = [
  {
    id: 1,
    name: '浙江省',
    code: '330000',
    children: [
      {
        id: 11,
        name: '杭州市',
        code: '330100',
        children: [
          { id: 111, name: '滨江区', code: '330108' },
          { id: 112, name: '西湖区', code: '330106' },
        ],
      },
    ],
  },
  {
    id: 2,
    name: '北京市',
    code: '110000',
    children: [
      {
        id: 21,
        name: '市辖区',
        code: '110100',
        children: [{ id: 211, name: '朝阳区', code: '110105' }],
      },
    ],
  },
];

describe('business license OCR customer fill helpers', () => {
  it('reads customer name and address from normalized OCR response fields', () => {
    const result = {
      invoiceCompany: ' 杭州星宇科技有限公司 ',
      invoiceAddress: ' 浙江省杭州市滨江区长河街道 ',
    };

    expect(getBusinessLicenseCustomerName(result)).toBe('杭州星宇科技有限公司');
    expect(getBusinessLicenseAddress(result)).toBe(
      '浙江省杭州市滨江区长河街道',
    );
  });

  it('matches a recognized full address to the deepest province-city-county node', () => {
    expect(
      resolveBusinessLicenseArea('浙江省杭州市滨江区长河街道', areaTree),
    ).toEqual({
      areaId: 111,
      areaText: '浙江省杭州市滨江区',
    });
  });

  it('keeps municipality address text concise when the tree has a generic city level', () => {
    expect(resolveBusinessLicenseArea('北京市朝阳区建国路', areaTree)).toEqual({
      areaId: 211,
      areaText: '北京市朝阳区',
    });
  });
});

describe('business license full residence fill', () => {
  const address = '浙江省杭州市滨江区长河街道测试路18号201室';

  it('fills both empty fields and retains the street and house number', async () => {
    const result = await buildBusinessLicenseAddressFill(
      ` ${address} `,
      {},
      async () => areaTree,
    );
    expect(result.values).toEqual({
      addressAreaId: 111,
      detailAddress: address,
    });
    expect(result.area?.areaText).toBe('浙江省杭州市滨江区');
    expect(result.unmatchedAddress).toBe(false);
    expect(result.skippedCount).toBe(0);
  });

  it('fills residence independently of an existing area without loading the tree', async () => {
    const load = vi.fn();
    const result = await buildBusinessLicenseAddressFill(
      address,
      { addressAreaId: 112 },
      load,
    );
    expect(result.values).toEqual({ detailAddress: address });
    expect(result.skippedCount).toBe(1);
    expect(load).not.toHaveBeenCalled();
  });

  it('matches the area while preserving a manually entered residence', async () => {
    const result = await buildBusinessLicenseAddressFill(
      address,
      { detailAddress: '人工填写地址' },
      async () => areaTree,
    );
    expect(result.values).toEqual({ addressAreaId: 111 });
    expect(result.skippedCount).toBe(1);
  });

  it('does not overwrite either field on repeated recognition', async () => {
    const first = await buildBusinessLicenseAddressFill(
      address,
      {},
      async () => areaTree,
    );
    const load = vi.fn();
    const repeated = await buildBusinessLicenseAddressFill(
      '北京市朝阳区测试路2号',
      first.values,
      load,
    );
    expect(repeated.values).toEqual({});
    expect(repeated.skippedCount).toBe(2);
    expect(load).not.toHaveBeenCalled();
  });

  it('fills whitespace-only fields', async () => {
    const result = await buildBusinessLicenseAddressFill(
      address,
      { addressAreaId: ' ', detailAddress: ' ' },
      async () => areaTree,
    );
    expect(result.values).toEqual({
      addressAreaId: 111,
      detailAddress: address,
    });
  });

  it('retains full residence when no area matches', async () => {
    const result = await buildBusinessLicenseAddressFill(
      '测试镇测试路18号',
      {},
      async () => areaTree,
    );
    expect(result.values).toEqual({ detailAddress: '测试镇测试路18号' });
    expect(result.unmatchedAddress).toBe(true);
  });

  it('retains full residence when loading areas fails', async () => {
    const result = await buildBusinessLicenseAddressFill(
      address,
      {},
      async () => {
        throw new Error('area service unavailable');
      },
    );
    expect(result.values).toEqual({ detailAddress: address });
    expect(result.unmatchedAddress).toBe(true);
  });

  it.each([undefined, '', '  '])(
    'leaves fields unchanged for empty residence %s',
    async (emptyAddress) => {
      const load = vi.fn();
      const result = await buildBusinessLicenseAddressFill(
        emptyAddress,
        { detailAddress: '原地址' },
        load,
      );
      expect(result.values).toEqual({});
      expect(result.unmatchedAddress).toBe(false);
      expect(load).not.toHaveBeenCalled();
    },
  );
});

describe('business license customer name warning', () => {
  it.each([
    [undefined, '执照公司'],
    ['', '执照公司'],
    ['  ', '执照公司'],
    ['客户公司', undefined],
    ['客户公司', ''],
    ['客户公司', '  '],
    ['客户公司', '客户公司'],
    [' 客户公司 ', ' 客户公司  '],
  ])(
    'does not warn for empty or matching names (%s, %s)',
    (current, recognized) => {
      expect(
        getBusinessLicenseNameMismatch(current, { invoiceCompany: recognized }),
      ).toBeUndefined();
    },
  );

  it('shows both names and confirmation consequences without changing the result', () => {
    const result = { invoiceCompany: ' 执照公司 ' };
    const warning = getBusinessLicenseNameMismatch(' 原客户公司 ', result);
    expect(warning?.description).toContain('当前客户名称：原客户公司');
    expect(warning?.description).toContain('营业执照名称：执照公司');
    expect(warning?.description).toContain('是否继续使用本次识别结果');
    expect(warning?.description).toContain('取消则不回填、不保存');
    expect(result.invoiceCompany).toBe(' 执照公司 ');
  });

  it('keeps internal whitespace and punctuation differences significant', () => {
    expect(
      getBusinessLicenseNameMismatch('公司（杭州）', {
        invoiceCompany: '公司(杭州)',
      }),
    ).toBeDefined();
    expect(
      getBusinessLicenseNameMismatch('A B公司', { invoiceCompany: 'AB公司' }),
    ).toBeDefined();
  });

  it('uses the existing name fallback when normalized fields are absent', () => {
    expect(
      getBusinessLicenseNameMismatch('客户公司', { data: { name: '执照公司' } })
        ?.description,
    ).toContain('营业执照名称：执照公司');
  });
});
