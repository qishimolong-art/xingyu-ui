<script lang="ts" setup>
import type { MallCouponTemplateApi } from '#/api/mall/promotion/coupon/couponTemplate';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import {
  CouponTemplateTakeTypeEnum,
  PromotionProductScopeEnum,
} from '@vben/constants';
import { convertToInteger, formatToFraction } from '@vben/utils';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createCouponTemplate,
  getCouponTemplate,
  updateCouponTemplate,
} from '#/api/mall/promotion/coupon/couponTemplate';
import { $t } from '#/locales';
import { ProductCategorySelect } from '#/views/mall/product/category/components';
import { SpuShowcase } from '#/views/mall/product/spu/components';

import { useFormSchema } from '../data';

import '../../../styles/compact-grid.css';

const emit = defineEmits(['success']);
const formData = ref<
  Partial<MallCouponTemplateApi.CouponTemplate> & {
    productCategoryIds?: number | number[];
    productSpuIds?: number[];
  }
>({});
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['优惠券模板'])
    : $t('ui.actionTitle.create', ['优惠券模板']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 120,
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    // 同步商品/分类选择到表单，确保验证时能获取到值
    if (formData.value.productSpuIds) {
      await formApi.setFieldValue(
        'productSpuIds',
        formData.value.productSpuIds,
      );
    }
    if (formData.value.productCategoryIds) {
      await formApi.setFieldValue(
        'productCategoryIds',
        formData.value.productCategoryIds,
      );
    }
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    try {
      // 提交表单
      const formValues = (await formApi.getValues()) as any;
      const data = await processSubmitData(formValues);
      await (formData.value?.id
        ? updateCouponTemplate(data)
        : createCouponTemplate(data));
      // 关闭并提示
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      await resetForm();
      return;
    }
    await resetForm();
    // 加载数据
    const data = modalApi.getData<MallCouponTemplateApi.CouponTemplate>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      const couponTemplate = await getCouponTemplate(data.id);
      const processedData = await processLoadData(couponTemplate);
      formData.value = {
        ...couponTemplate,
        productCategoryIds: processedData.productCategoryIds,
        productSpuIds: processedData.productSpuIds,
      };
      // 设置到表单
      await formApi.setValues(processedData);
    } finally {
      modalApi.unlock();
    }
  },
});

/** 重置表单 */
async function resetForm() {
  formData.value = {};
  await formApi.resetForm();
}

/** 处理提交数据 */
async function processSubmitData(
  formValues: any,
): Promise<MallCouponTemplateApi.CouponTemplate> {
  return {
    ...formValues,
    productScopeValues: getProductScopeValues(formValues),
    // 金额转换：元转分
    discountPrice: convertToInteger(formValues.discountPrice),
    discountPercent:
      formValues.discountPercent === undefined
        ? undefined
        : formValues.discountPercent * 10,
    discountLimitPrice: convertToInteger(formValues.discountLimitPrice),
    usePrice: convertToInteger(formValues.usePrice),
    // 处理有效期时间
    validStartTime:
      formValues.validTimes && formValues.validTimes.length === 2
        ? formValues.validTimes[0]
        : undefined,
    validEndTime:
      formValues.validTimes && formValues.validTimes.length === 2
        ? formValues.validTimes[1]
        : undefined,
    // 处理发放数量和限领数量
    totalCount:
      formValues.takeType === CouponTemplateTakeTypeEnum.USER.type
        ? formValues.totalCount
        : -1,
    takeLimitCount:
      formValues.takeType === CouponTemplateTakeTypeEnum.USER.type
        ? formValues.takeLimitCount
        : -1,
  };
}

/** 根据商品券类型组装提交给后端的商品范围 */
function getProductScopeValues(formValues: any): number[] | undefined {
  if (formValues.productScope === PromotionProductScopeEnum.SPU.scope) {
    return normalizeIds(formValues.productSpuIds);
  }
  if (formValues.productScope === PromotionProductScopeEnum.CATEGORY.scope) {
    return normalizeIds(formValues.productCategoryIds);
  }
  return undefined;
}

function normalizeIds(value?: number | number[]): number[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null);
  }
  return value ? [value] : [];
}

function getCategoryIdForLoad(data: MallCouponTemplateApi.CouponTemplate) {
  const productScopeValues = data.productScopeValues || [];
  if (
    data.productScope === PromotionProductScopeEnum.CATEGORY.scope &&
    productScopeValues.length > 0
  ) {
    return productScopeValues[0];
  }
  return undefined;
}

/** 处理加载的数据 */
async function processLoadData(
  data: MallCouponTemplateApi.CouponTemplate,
): Promise<any> {
  const productScopeValues = data.productScopeValues || [];
  return {
    ...data,
    productSpuIds:
      data.productScope === PromotionProductScopeEnum.SPU.scope
        ? productScopeValues
        : [],
    productCategoryIds: getCategoryIdForLoad(data),
    // 金额转换：分转元
    discountPrice: formatToFraction(data.discountPrice),
    discountPercent:
      data.discountPercent === undefined
        ? undefined
        : data.discountPercent / 10,
    discountLimitPrice: formatToFraction(data.discountLimitPrice),
    usePrice: formatToFraction(data.usePrice),
    // 处理有效期时间
    validTimes:
      data.validStartTime && data.validEndTime
        ? [data.validStartTime, data.validEndTime]
        : [],
  };
}
</script>

<template>
  <Modal :title="getTitle" class="!w-[720px] max-w-[96vw]">
    <Form class="mx-4 mall-promotion-edit-form">
      <!-- 自定义插槽：商品选择 -->
      <template #productSpuIds>
        <SpuShowcase v-model="formData.productSpuIds" />
      </template>
      <!-- 自定义插槽：分类选择 -->
      <template #productCategoryIds>
        <ProductCategorySelect v-model="formData.productCategoryIds" />
      </template>
    </Form>
  </Modal>
</template>
