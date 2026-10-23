import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSupplierSimplePage } from './index';

const requestState = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: requestState,
}));

describe('supplier simple page name search', () => {
  afterEach(() => {
    requestState.get.mockReset();
  });

  it('maps the dropdown keyword to the supplier name', () => {
    getSupplierSimplePage({ keyword: '  甘  ', pageNo: 2, pageSize: 10 });

    expect(requestState.get).toHaveBeenCalledWith('/erp/supplier/simple-page', {
      params: { name: '甘', pageNo: 2, pageSize: 10 },
    });
  });

  it('prefers an explicit supplier name over the dropdown keyword', () => {
    getSupplierSimplePage({
      keyword: '地址关键字',
      name: '  甘肃供应商  ',
      pageNo: 1,
      pageSize: 20,
    });

    expect(requestState.get).toHaveBeenCalledWith('/erp/supplier/simple-page', {
      params: { name: '甘肃供应商', pageNo: 1, pageSize: 20 },
    });
  });

  it('omits an empty supplier name while preserving pagination', () => {
    getSupplierSimplePage({ keyword: '   ', pageNo: 3, pageSize: 10 });

    expect(requestState.get).toHaveBeenCalledWith('/erp/supplier/simple-page', {
      params: { pageNo: 3, pageSize: 10 },
    });
  });
});
