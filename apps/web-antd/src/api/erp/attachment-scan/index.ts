import type { AxiosProgressEvent } from '#/api/infra/file';

import { requestClient } from '#/api/request';

export namespace ErpAttachmentScanApi {
  export interface CreateReq {
    bizType?: string;
    bizId?: number;
    bizNo?: string;
    title?: string;
    maxFileCount?: number;
  }

  export interface CreateResp {
    sessionId: number;
    ticket: string;
    qrUrl: string;
    expireTime: string;
    status: number;
  }

  export interface SessionResp {
    sessionId: number;
    title?: string;
    bizType?: string;
    bizNo?: string;
    expireTime: string;
    status: number;
    uploadedCount: number;
    maxFileCount: number;
  }

  export interface FileResp {
    fileId: number;
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize: number;
    uploadTime: string;
  }

  export interface UploadResp extends FileResp {
    uploadedCount: number;
    status: number;
  }

  export interface StatusResp extends SessionResp {
    files: FileResp[];
  }
}

export function createAttachmentScan(data: ErpAttachmentScanApi.CreateReq) {
  return requestClient.post<ErpAttachmentScanApi.CreateResp>(
    '/erp/attachment-scan/create',
    data,
    {
      headers: {
        'X-Erp-Router-Mode':
          import.meta.env.VITE_ROUTER_HISTORY === 'hash' ? 'hash' : 'history',
      },
    },
  );
}

export function getAttachmentScanSession(ticket: string) {
  return requestClient.get<ErpAttachmentScanApi.SessionResp>(
    '/erp/attachment-scan/session',
    { params: { ticket } },
  );
}

export function uploadAttachmentScanFile(
  ticket: string,
  file: File,
  onUploadProgress?: AxiosProgressEvent,
) {
  return requestClient.upload<ErpAttachmentScanApi.UploadResp>(
    '/erp/attachment-scan/upload',
    { file, ticket },
    { onUploadProgress },
  );
}

export function getAttachmentScanStatus(sessionId: number) {
  return requestClient.get<ErpAttachmentScanApi.StatusResp>(
    '/erp/attachment-scan/status',
    { params: { sessionId } },
  );
}

export function cancelAttachmentScan(sessionId: number) {
  return requestClient.post(
    `/erp/attachment-scan/cancel?sessionId=${sessionId}`,
  );
}
