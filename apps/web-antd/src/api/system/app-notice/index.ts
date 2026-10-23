import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace SystemAppNoticeApi {
  /** 小程序公告信息 */
  export interface AppNotice {
    id?: number;
    title: string;
    content: string;
    status: number;
    sort?: number;
    startTime?: number | string;
    endTime?: number | string;
    createTime?: Date | number | string;
  }
}

/** 查询小程序公告列表 */
export function getAppNoticePage(params: PageParam) {
  return requestClient.get<PageResult<SystemAppNoticeApi.AppNotice>>(
    '/system/app-notice/page',
    { params },
  );
}

/** 查询小程序公告详情 */
export function getAppNotice(id: number) {
  return requestClient.get<SystemAppNoticeApi.AppNotice>(
    `/system/app-notice/get?id=${id}`,
  );
}

/** 新增小程序公告 */
export function createAppNotice(data: SystemAppNoticeApi.AppNotice) {
  return requestClient.post('/system/app-notice/create', data);
}

/** 修改小程序公告 */
export function updateAppNotice(data: SystemAppNoticeApi.AppNotice) {
  return requestClient.put('/system/app-notice/update', data);
}

/** 删除小程序公告 */
export function deleteAppNotice(id: number) {
  return requestClient.delete(`/system/app-notice/delete?id=${id}`);
}
