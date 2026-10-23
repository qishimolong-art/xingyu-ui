<script lang="ts" setup>
import type { MallRewardActivityApi } from '#/api/mall/promotion/reward/rewardActivity';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import {
  PromotionConditionTypeEnum,
  PromotionProductScopeEnum,
} from '@vben/constants';
import { cloneDeep, convertToInteger, formatToFraction } from '@vben/utils';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createRewardActivity,
  getReward,
  updateRewardActivity,
} from '#/api/mall/promotion/reward/rewardActivity';
import { $t } from '#/locales';
import { ProductCategorySelect } from '#/views/mall/product/category/components';
import { SpuShowcase } from '#/views/mall/product/spu/components';

import { useFormSchema } from '../data';
import RewardRule from './reward-rule.vue';

import '../../styles/compact-grid.css';

const emit = defineEmits(['success']);

const defaultFormData = (): Partial<MallRewardActivityApi.RewardActivity> => ({
  conditionType: PromotionConditionTypeEnum.PRICE.type,
  productScope: PromotionProductScopeEnum.ALL.scope,
  rules: [],
});

const formData =
  ref<Partial<MallRewardActivityApi.RewardActivity>>(defaultFormData());
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['满减送'])
    : $t('ui.actionTitle.create', ['满减送']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    // 在验证前同步 formData 中的值到表单中
    await formApi.setFieldValue('rules', formData.value.rules || []);
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
    // 提交表单
    try {
      const values =
        (await formApi.getValues()) as MallRewardActivityApi.RewardActivity;
      // 使用 formData.value 作为基础，确保 rules 来自 formData
      const data = {
        ...formData.value,
        ...values,
        productScopeValues: getProductScopeValues(values),
        rules: formData.value.rules || [],
      } as MallRewardActivityApi.RewardActivity;
      if (data.startAndEndTime && Array.isArray(data.startAndEndTime)) {
        data.startTime = data.startAndEndTime[0];
        data.endTime = data.startAndEndTime[1];
        delete data.startAndEndTime;
      }
      // 深拷贝 rules 避免修改原始数据
      const rules = cloneDeep(
        data.rules,
      ) as unknown as MallRewardActivityApi.RewardRule[];
      rules.forEach((item: any) => {
        item.discountPrice = convertToInteger(item.discountPrice || 0);
        if (data.conditionType === PromotionConditionTypeEnum.PRICE.type) {
          item.limit = convertToInteger(item.limit || 0);
        }
      });
      data.rules = rules;
      await (data.id
        ? updateRewardActivity(data as MallRewardActivityApi.RewardActivity)
        : createRewardActivity(data as MallRewardActivityApi.RewardActivity));
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
    const data = modalApi.getData<MallRewardActivityApi.RewardActivity>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      const result = await getReward(data.id);
      const processedData = processLoadData(result);
      processedData.rules?.forEach((item: any) => {
        item.discountPrice = formatToFraction(item.discountPrice || 0);
        if (
          processedData.conditionType === PromotionConditionTypeEnum.PRICE.type
        ) {
          item.limit = formatToFraction(item.limit || 0);
        }
      });
      formData.value = processedData;
      // 设置到 values
      await formApi.setValues(processedData);
    } finally {
      modalApi.unlock();
    }
  },
});

/** 重置表单 */
async function resetForm() {
  formData.value = defaultFormData();
  await formApi.resetForm();
}

/** 根据活动范围组装提交给后端的商品范围 */
function getProductScopeValues(
  formValues: MallRewardActivityApi.RewardActivity,
): number[] | undefined {
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

/** 处理加载的数据 */
function processLoadData(
  data: MallRewardActivityApi.RewardActivity,
): MallRewardActivityApi.RewardActivity {
  const productScopeValues = data.productScopeValues || [];
  return {
    ...data,
    productSpuIds:
      data.productScope === PromotionProductScopeEnum.SPU.scope
        ? productScopeValues
        : [],
    productCategoryIds:
      data.productScope === PromotionProductScopeEnum.CATEGORY.scope
        ? productScopeValues
        : [],
    startAndEndTime: [
      data.startTime ? String(data.startTime) : undefined,
      data.endTime ? String(data.endTime) : undefined,
    ] as any[],
  };
}
</script>

<template>
  <Modal :title="getTitle" class="!w-[1080px] max-w-[96vw]">
    <Form class="mx-6 mall-promotion-edit-form">
      <!-- 自定义插槽：优惠规则 -->
      <template #rules>
        <RewardRule v-model="formData" />
      </template>
      <!-- 自定义插槽：商品选择 -->
      <template #productSpuIds>
        <SpuShowcase v-model="formData.productSpuIds" />
      </template>
      <!-- 自定义插槽：分类选择 -->
      <template #productCategoryIds>
        <ProductCategorySelect v-model="formData.productCategoryIds" multiple />
      </template>
    </Form>
  </Modal>
</template>
