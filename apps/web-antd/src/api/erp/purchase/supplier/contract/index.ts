import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierContractApi {
  export interface SupplierContract {
    id?: number;
    supplierId: number;
    contractNo: string;
    contractDate: string;
    contractType?: string;
    settleMethod?: string;
    startTime?: string;
    transportMethod?: string;
    endTime?: string;
    mainContract?: boolean;
    rebateEnabled?: boolean;
    freightSettleMethod?: number;
    baseAmount?: number;
    taskAmount?: number;
    summary?: string;
    attachmentUrl?: string;
    status?: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierContractList(supplierId: number) {
  return requestClient.get<ErpSupplierContractApi.SupplierContract[]>(
    '/erp/supplier-contract/list',
    { params: { supplierId } },
  );
}

export function getSupplierContract(id: number) {
  return requestClient.get<ErpSupplierContractApi.SupplierContract>(
    `/erp/supplier-contract/get?id=${id}`,
  );
}

export function createSupplierContract(
  data: ErpSupplierContractApi.SupplierContract,
) {
  return requestClient.post('/erp/supplier-contract/create', data);
}

export function updateSupplierContract(
  data: ErpSupplierContractApi.SupplierContract,
) {
  return requestClient.put('/erp/supplier-contract/update', data);
}

export function deleteSupplierContract(id: number) {
  return requestClient.delete(`/erp/supplier-contract/delete?id=${id}`);
}

export function getSupplierContractPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierContractApi.SupplierContract>>(
    '/erp/supplier-contract/page',
    { params },
  );
}
