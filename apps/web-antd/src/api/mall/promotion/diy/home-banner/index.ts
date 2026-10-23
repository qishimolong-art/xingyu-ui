import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace MallDiyHomeBannerApi {
  /** 首页轮播图 */
  export interface HomeBanner {
    id?: number; // 编号
    title?: string; // 标题
    picUrl: string; // 图片地址
    url?: string; // 跳转地址
    sort?: number; // 排序
    status: number; // 状态
    memo?: string; // 备注
  }
}

/** 查询首页轮播图列表 */
export function getDiyHomeBannerPage(params: PageParam) {
  return requestClient.get<PageResult<MallDiyHomeBannerApi.HomeBanner>>(
    '/promotion/diy-home-banner/page',
    { params },
  );
}

/** 查询首页轮播图详情 */
export function getDiyHomeBanner(id: number) {
  return requestClient.get<MallDiyHomeBannerApi.HomeBanner>(
    `/promotion/diy-home-banner/get?id=${id}`,
  );
}

/** 新增首页轮播图 */
export function createDiyHomeBanner(data: MallDiyHomeBannerApi.HomeBanner) {
  return requestClient.post('/promotion/diy-home-banner/create', data);
}

/** 修改首页轮播图 */
export function updateDiyHomeBanner(data: MallDiyHomeBannerApi.HomeBanner) {
  return requestClient.put('/promotion/diy-home-banner/update', data);
}

/** 删除首页轮播图 */
export function deleteDiyHomeBanner(id: number) {
  return requestClient.delete(`/promotion/diy-home-banner/delete?id=${id}`);
}
