import type { VbenFormSchema } from '#/adapter/form';

import { DeliveryTypeEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { handleTree } from '@vben/utils';

import { getSimpleBrandList } from '#/api/mall/product/brand';
import { getCategoryList } from '#/api/mall/product/category';
import { getSimpleTemplateList } from '#/api/mall/trade/delivery/expressTemplate';

/** 基础设置的表单 */
export function useInfoFormSchema(
  options: { retailPriceDisabled?: boolean } = {},
): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'name',
      label: '商品名称',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入商品名称',
      },
      rules: 'required',
    },
    {
      fieldName: 'categoryId',
      label: '分类名称',
      component: 'ApiTreeSelect',
      componentProps: {
        api: async () => {
          const data = await getCategoryList({});
          return handleTree(data);
        },
        fieldNames: { label: 'name', value: 'id', children: 'children' },
        placeholder: '请选择商品分类',
      },
      rules: 'required',
    },
    {
      fieldName: 'brandId',
      label: '商品品牌',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleBrandList,
        labelField: 'name',
        valueField: 'id',
        allowClear: true,
        placeholder: '请选择商品品牌',
      },
      rules: 'required',
    },
    {
      fieldName: 'keyword',
      label: '商品关键字',
      component: 'Input',
      componentProps: {
        placeholder: '请输入商品关键字',
      },
      rules: 'required',
    },
    {
      fieldName: 'price',
      label: '小程序价格',
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        disabled: options.retailPriceDisabled,
        min: 0,
        placeholder: options.retailPriceDisabled
          ? '仅唯一关联 ERP 配件后可维护'
          : '请输入小程序零售价',
        precision: 2,
        step: 0.01,
      },
      help: '即价格体系中的零售价；编辑已关联商品时会同步 ERP 零售价。',
      rules: 'required',
    },
    {
      fieldName: 'introduction',
      label: '商品简介',
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入商品简介',
        autoSize: { minRows: 2, maxRows: 2 },
        showCount: true,
        maxlength: 128,
        allowClear: true,
      },
      rules: 'required',
    },
    {
      fieldName: 'picUrl',
      label: '商品封面图',
      component: 'ImageUpload',
      componentProps: {
        maxSize: 30,
      },
      rules: 'required',
    },
    {
      fieldName: 'sliderPicUrls',
      label: '商品轮播图',
      component: 'ImageUpload',
      componentProps: {
        maxNumber: 10,
        multiple: true,
        maxSize: 30,
      },
      rules: 'required',
    },
  ];
}

/** 价格库存的表单 */
export function useSkuFormSchema(
  propertyList: any[] = [],
  isDetail: boolean = false,
): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'subCommissionType',
      label: '分销类型',
      component: 'RadioGroup',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: '默认设置',
            value: false,
          },
          {
            label: '单独设置',
            value: true,
          },
        ],
      },
      rules: 'required',
    },
    {
      fieldName: 'specType',
      label: '商品规格',
      component: 'RadioGroup',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: '单规格',
            value: false,
          },
          {
            label: '多规格',
            value: true,
          },
        ],
      },
      rules: 'required',
    },
    // 单规格时显示的 SkuList
    {
      fieldName: 'singleSkuList',
      label: '',
      component: 'Input',
      dependencies: {
        triggerFields: ['specType'],
        // 当 specType 为 false（单规格）时显示
        show: (values) => values.specType === false,
      },
    },
    // 多规格时显示的商品属性（占位，实际通过插槽渲染）
    {
      fieldName: 'productAttributes',
      label: '商品属性',
      component: 'Input',
      dependencies: {
        triggerFields: ['specType'],
        // 当 specType 为 true（多规格）时显示
        show: (values) => values.specType === true,
      },
    },
    // 多规格 - 批量设置
    {
      fieldName: 'batchSkuList',
      label: '批量设置',
      component: 'Input',
      dependencies: {
        triggerFields: ['specType'],
        // 当 specType 为 true（多规格）且 propertyList 有数据时显示，且非详情模式
        show: (values) =>
          values.specType === true && propertyList.length > 0 && !isDetail,
      },
    },
    // 多规格 - 规格列表
    {
      fieldName: 'multiSkuList',
      label: '规格列表',
      component: 'Input',
      dependencies: {
        triggerFields: ['specType'],
        // 当 specType 为 true（多规格）且 propertyList 有数据时显示
        show: (values) => values.specType === true && propertyList.length > 0,
      },
    },
  ];
}

/** 物流设置的表单 */
export function useDeliveryFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'deliveryTypes',
      label: '配送方式',
      component: 'CheckboxGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.TRADE_DELIVERY_TYPE, 'number'),
      },
      rules: 'required',
    },
    {
      fieldName: 'deliveryTemplateId',
      label: '运费模板',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleTemplateList,
        labelField: 'name',
        valueField: 'id',
      },
      dependencies: {
        triggerFields: ['deliveryTypes'],
        show: (values) =>
          !!values.deliveryTypes &&
          values.deliveryTypes.includes(DeliveryTypeEnum.EXPRESS.type),
      },
      rules: 'required',
    },
  ];
}

/** 商品详情的表单 */
export function useDescriptionFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'description',
      label: '商品详情',
      component: 'RichTextarea',
      componentProps: {
        placeholder: '请输入商品详情',
        height: 1000,
      },
      rules: 'required',
    },
  ];
}

/** 配件参数的只读展示表单 */
export function usePartsParamFormSchema(): VbenFormSchema[] {
  const readonlyInputProps = {
    disabled: true,
  };

  return [
    {
      fieldName: 'partCategoryName',
      label: '商品类别',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'code',
      label: '编码',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'partName',
      label: '名称',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'partBrandName',
      label: '品牌',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'standard',
      label: '规格',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'featureCode',
      label: '特征码',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: readonlyInputProps,
    },
  ];
}

/** 其它设置的表单 */
export function useOtherFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    {
      fieldName: 'sort',
      label: '商品排序',
      component: 'InputNumber',
      componentProps: {
        min: 0,
      },
      rules: 'required',
    },
    {
      fieldName: 'giveIntegral',
      label: '赠送积分',
      component: 'InputNumber',
      componentProps: {
        min: 0,
      },
      rules: 'required',
    },
    {
      fieldName: 'virtualSalesCount',
      label: '虚拟销量',
      component: 'InputNumber',
      componentProps: {
        min: 0,
      },
      rules: 'required',
    },
  ];
}
