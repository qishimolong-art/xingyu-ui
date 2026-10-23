import { requestClient } from '#/api/request';

export namespace ErpAutoWriteOffConfigApi {
  export interface Config {
    disabledDeptIds: number[];
    effectiveDisabledDeptIds: number[];
  }

  export interface UpdateReq {
    disabledDeptIds: number[];
  }
}

export function getAutoWriteOffConfig() {
  return requestClient.get<ErpAutoWriteOffConfigApi.Config>(
    '/erp/auto-write-off-config/get',
  );
}

export function updateAutoWriteOffConfig(
  data: ErpAutoWriteOffConfigApi.UpdateReq,
) {
  return requestClient.put('/erp/auto-write-off-config/update', data, {
    headers: { 'Content-Type': 'application/json' },
  });
}
