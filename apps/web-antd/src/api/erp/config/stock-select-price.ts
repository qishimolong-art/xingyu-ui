import { requestClient } from '#/api/request';

export namespace ErpStockSelectPriceConfigApi {
  export type BizType = 'purchase' | 'sale' | 'stock';

  export interface Field {
    fieldKey: string;
    fieldLabel: string;
    fieldSource?: 'CUSTOM' | 'SYSTEM';
    purchaseVisible: boolean;
    saleVisible: boolean;
    sort?: number;
  }

  export interface Config {
    configVersion: string;
    fields: Field[];
  }

  export interface UpdateReq {
    configVersion: string;
    items: Array<{
      fieldKey: string;
      purchaseVisible: boolean;
      saleVisible: boolean;
    }>;
  }
}

export function getStockSelectPriceConfig() {
  return requestClient.get<ErpStockSelectPriceConfigApi.Config>(
    '/erp/stock-select-price-config/get',
  );
}

export function updateStockSelectPriceConfig(
  data: ErpStockSelectPriceConfigApi.UpdateReq,
) {
  return requestClient.put('/erp/stock-select-price-config/update', data, {
    // Avoid legacy JSON charset parameters rejected by some deployments.
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getEffectiveStockSelectPriceFields(params: {
  businessDeptId?: number;
  bizType: ErpStockSelectPriceConfigApi.BizType;
}) {
  return requestClient.get<string[]>(
    '/erp/stock-select-price-config/effective-fields',
    { params },
  );
}
