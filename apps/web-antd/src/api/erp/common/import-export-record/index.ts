import type { PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpImportExportRecordApi {
  export interface RecordItem {
    id: number;
    operationType: 'IMPORT' | 'EXPORT';
    moduleKey: string;
    moduleName: string;
    templateKey?: string;
    fileName?: string;
    fileType?: string;
    status: 'PROCESSING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE';
    totalCount?: number;
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    queryParams?: string;
    exportFields?: string;
    errorMessage?: string;
    durationMs?: number;
    operatorId?: number;
    operatorName?: string;
    startTime?: string;
    endTime?: string;
    createTime?: string;
  }

  export interface DetailItem {
    id: number;
    recordId: number;
    rowNo?: number;
    groupKey?: string;
    detailType?: 'CONTEXT' | 'FAILURE';
    bizKey?: string;
    bizName?: string;
    failureReason?: string;
    rawData?: string;
    createTime?: string;
  }
}

export function getImportExportRecordPage(params: Record<string, any>) {
  return requestClient.get<PageResult<ErpImportExportRecordApi.RecordItem>>(
    '/erp/import-export-record/page',
    { params },
  );
}

export function getImportExportRecord(id: number) {
  return requestClient.get<ErpImportExportRecordApi.RecordItem>(
    '/erp/import-export-record/get',
    { params: { id } },
  );
}

export function getImportExportRecordDetailPage(params: Record<string, any>) {
  return requestClient.get<PageResult<ErpImportExportRecordApi.DetailItem>>(
    '/erp/import-export-record/detail-page',
    { params },
  );
}

export function downloadImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/import-export-record/failure-details/download',
    { params: { recordId } },
  );
}
