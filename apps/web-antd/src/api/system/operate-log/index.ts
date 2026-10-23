import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace SystemOperateLogApi {
  /** 操作日志信息 */
  export interface OperateLog {
    id: number;
    traceId: string;
    userType: number;
    userId: number;
    userName: string;
    type: string;
    subType: string;
    bizId: number;
    action: string;
    extra: string;
    requestMethod: string;
    requestUrl: string;
    userIp: string;
    userAgent: string;
    creator: string;
    creatorName: string;
    createTime: string;
  }

  export interface OperateLogPageParams extends PageParam {
    action?: string;
    createTime?: string[];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    subType?: string;
    type?: string;
    userId?: number;
  }

  export interface OperateLogModuleOption {
    label: string;
    value: string;
  }
}

/** 查询操作日志列表 */
export function getOperateLogPage(
  params: SystemOperateLogApi.OperateLogPageParams,
) {
  return requestClient.get<PageResult<SystemOperateLogApi.OperateLog>>(
    '/system/operate-log/page',
    { params },
  );
}

/** 查询操作日志模块选项 */
export function getOperateLogModuleOptions() {
  return requestClient.get<SystemOperateLogApi.OperateLogModuleOption[]>(
    '/system/operate-log/module-options',
  );
}

/** 导出操作日志 */
export function exportOperateLog(params: any) {
  return requestClient.download('/system/operate-log/export-excel', { params });
}
