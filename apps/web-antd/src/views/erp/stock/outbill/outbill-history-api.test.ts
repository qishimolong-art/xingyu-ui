import { beforeEach, describe, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  download: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
import {
  exportStockOutBill,
  getStockOutBillItemPage,
  getStockOutBillPage,
  pickStockOutBill,
} from '#/api/erp/stock/outbill';
import {
  batchUpdateWarehouse,
  createWarehouse,
  exportWarehouse,
  getWarehousePage,
  updateWarehouse,
} from '#/api/erp/stock/warehouse';

import {
  stockOutBillHistoryStatus,
  stockOutBillHistorySummary,
} from './outbill-history';
beforeEach(() => {
  vi.clearAllMocks();
});
describe('销售直接扣库的旧写接口隔离', () => {
  it('cached old pick caller receives a business error without PUT', async () => {
    await expect(
      pickStockOutBill({ id: 1, items: [{ itemId: 2, pickCount: 3 }] }),
    ).rejects.toThrow('销售领货已取消');
    expect(client.put).not.toHaveBeenCalled();
  });
  it('warehouse create/update/batch omit old flag without mutating the supplied historical record', () => {
    const source = {
      id: 1,
      name: '老仓库',
      stockBillEnabled: true,
      saleEnabled: true,
      sort: 4,
    };
    createWarehouse(source);
    updateWarehouse(source);
    batchUpdateWarehouse({
      ids: [1, 2],
      stockBillEnabled: false,
      remark: '调整备注',
    });
    expect(source.stockBillEnabled).toBe(true);
    expect(client.post).toHaveBeenCalledWith('/erp/warehouse/create', {
      id: 1,
      name: '老仓库',
      saleEnabled: true,
      sort: 4,
    });
    expect(client.put).toHaveBeenCalledWith('/erp/warehouse/update', {
      id: 1,
      name: '老仓库',
      saleEnabled: true,
      sort: 4,
    });
    expect(client.put).toHaveBeenCalledWith('/erp/warehouse/batch-update', {
      ids: [1, 2],
      remark: '调整备注',
    });
  });
  it('history filters, pages and export still forward original values', () => {
    const filters = { pageNo: 2, pageSize: 20, stockBillEnabled: true };
    getWarehousePage(filters);
    exportWarehouse(filters);
    getStockOutBillPage({ pageNo: 3, pageSize: 10 });
    getStockOutBillItemPage({
      billId: 1,
      mask: true,
      pageNo: 2,
      pageSize: 20,
      orderField: 'productName',
      orderDirection: 'desc',
    });
    exportStockOutBill({ status: 10, fields: 'no,pickedCount' });
    expect(client.get).toHaveBeenCalledWith('/erp/warehouse/page', {
      params: filters,
    });
    expect(client.download).toHaveBeenCalledWith(
      '/erp/warehouse/export-excel',
      { params: filters },
    );
    expect(client.get).toHaveBeenCalledWith('/erp/stock-out-bill/item-page', {
      params: {
        decimalMode: 'string',
        billId: 1,
        mask: true,
        pageNo: 2,
        pageSize: 20,
        orderField: 'productName',
        orderDirection: 'desc',
      },
    });
    expect(client.download).toHaveBeenCalledWith(
      '/erp/stock-out-bill/export-excel',
      { params: { status: 10, fields: 'no,pickedCount' } },
    );
  });
  it('pending and partially picked historical records never become complete', () => {
    expect(stockOutBillHistoryStatus(10)).toBe('历史待领（待核对）');
    expect(stockOutBillHistoryStatus(20)).toBe('历史部分领货（待核对）');
    expect(stockOutBillHistoryStatus(30)).toBe('历史已完成');
    expect(stockOutBillHistoryStatus(undefined)).toBe('历史状态未记录');
    expect(stockOutBillHistorySummary([30, undefined])).toBe('历史状态未记录');
    expect(stockOutBillHistorySummary([30, 10])).toBe('历史部分领货（待核对）');
    expect(stockOutBillHistorySummary([])).toBe('无历史出仓记录');
  });
});
