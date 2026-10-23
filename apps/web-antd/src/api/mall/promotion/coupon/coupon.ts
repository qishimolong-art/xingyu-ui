import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace MallCouponApi {
  /** 优惠券 */
  export interface Coupon {
    id: number; // 优惠券编号
    name: string; // 优惠券名称
    status: number; // 优惠券状态
    type: number; // 优惠券类型
    price: number; // 优惠券金额
    usePrice: number; // 使用门槛
    productScope: number; // 商品范围
    productSpuIds: number[]; // 商品编号数组
    validityType: number; // 有效期类型
    validStartTime: Date; // 固定日期-生效开始时间
    validEndTime: Date; // 固定日期-生效结束时间
    fixedStartTerm: number; // 领取日期-开始天数
    fixedEndTerm: number; // 领取日期-结束天数
    takeLimitCount: number; // 每人限领个数
    usePriceEnabled: boolean; // 是否设置满多少金额可用
    productCategoryIds: number[]; // 商品分类编号数组
  }

  /** 发送优惠券 */
  export interface CouponSendReqVO {
    templateId: number; // 优惠券编号
    userIds: number[]; // 用户编号数组
  }

  export interface AddressTargetItem {
    userId: number;
    nickname?: string;
    mobile?: string;
    matchedAreaNames: string[];
    sendable: boolean;
    skipReason?: string;
  }

  export interface AddressTargetPageReqVO extends PageParam {
    templateId: number;
    areaIds: number[];
  }

  export interface AddressTargetPageRespVO {
    addressMatchedCount: number;
    enabledMatchedCount: number;
    pageResult: PageResult<AddressTargetItem>;
  }

  export interface AddressSendReqVO {
    requestId: string;
    templateId: number;
    areaIds: number[];
    excludedUserIds: number[];
  }

  export interface AddressSendRespVO {
    addressMatchedCount: number;
    disabledSkippedCount: number;
    excludedCount: number;
    limitSkippedCount: number;
    successCount: number;
  }
}

/** 删除优惠劵 */
export function deleteCoupon(id: number) {
  return requestClient.delete(`/promotion/coupon/delete?id=${id}`);
}

/** 获得优惠劵分页 */
export function getCouponPage(params: PageParam) {
  return requestClient.get<PageResult<MallCouponApi.Coupon>>(
    '/promotion/coupon/page',
    { params },
  );
}

/** 发送优惠券 */
export function sendCoupon(data: MallCouponApi.CouponSendReqVO) {
  return requestClient.post('/promotion/coupon/send', data);
}

/** 按收货地区分页预览发券会员 */
export function getAddressCouponTargetPage(
  data: MallCouponApi.AddressTargetPageReqVO,
) {
  return requestClient.post<MallCouponApi.AddressTargetPageRespVO>(
    '/promotion/coupon/address-target/page',
    data,
  );
}

/** 按收货地区发送优惠券 */
export function sendCouponByAddress(data: MallCouponApi.AddressSendReqVO) {
  return requestClient.post<MallCouponApi.AddressSendRespVO>(
    '/promotion/coupon/send-by-address',
    data,
  );
}
