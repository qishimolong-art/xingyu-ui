import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpRecycleBinApi {
  export type SourceType = 'customer' | 'product' | 'supplier' | 'warehouse';

  export interface RecycleBinItem {
    sourceType: SourceType;
    sourceId: number;
    code?: string;
    name?: string;
    disabledBy?: number;
    disabledByName?: string;
    disabledTime?: Date | number | string;
    rowKey?: string;
  }

  export interface BatchReq {
    items: Array<{
      sourceId: number;
      sourceType: SourceType;
    }>;
  }
}

export function getRecycleBinPage(params: PageParam) {
  return requestClient.get<PageResult<ErpRecycleBinApi.RecycleBinItem>>(
    '/erp/recycle-bin/page',
    { params },
  );
}

export function restoreRecycleBin(data: ErpRecycleBinApi.BatchReq) {
  return requestClient.put('/erp/recycle-bin/restore', data);
}

export function clearRecycleBin(data: ErpRecycleBinApi.BatchReq) {
  return requestClient.delete('/erp/recycle-bin/clear', { data });
}
