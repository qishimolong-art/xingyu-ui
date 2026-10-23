import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCustomerSimplePage, getSaleCustomerSimplePage } from './index';

const requestState = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: requestState,
}));

describe('customer simple page name search', () => {
  afterEach(() => {
    requestState.get.mockReset();
  });

  it.each([
    ['/erp/customer/simple-page', getCustomerSimplePage],
    ['/erp/customer/sale-simple-page', getSaleCustomerSimplePage],
  ])('%s maps the dropdown keyword to the customer name', (url, request) => {
    request({ keyword: '  甘  ', pageNo: 2, pageSize: 10 });

    expect(requestState.get).toHaveBeenCalledWith(url, {
      params: { name: '甘', pageNo: 2, pageSize: 10 },
    });
  });

  it('prefers an explicit customer name over the dropdown keyword', () => {
    getCustomerSimplePage({
      keyword: '地址关键字',
      name: '  甘肃源泰园物资装备有限公司  ',
      pageNo: 1,
      pageSize: 20,
    });

    expect(requestState.get).toHaveBeenCalledWith('/erp/customer/simple-page', {
      params: {
        name: '甘肃源泰园物资装备有限公司',
        pageNo: 1,
        pageSize: 20,
      },
    });
  });

  it('omits an empty customer name while preserving pagination', () => {
    getSaleCustomerSimplePage({ keyword: '   ', pageNo: 3, pageSize: 10 });

    expect(requestState.get).toHaveBeenCalledWith(
      '/erp/customer/sale-simple-page',
      { params: { pageNo: 3, pageSize: 10 } },
    );
  });
});
