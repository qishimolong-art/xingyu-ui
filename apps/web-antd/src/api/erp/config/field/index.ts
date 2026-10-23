import { requestClient } from '#/api/request';

export namespace ErpFieldConfigApi {
  /** 字段配置 */
  export interface FieldConfig {
    id?: number;
    moduleKey: string;
    fieldName: string;
    fieldLabel?: string;
    fieldSource?: 'CUSTOM' | 'SYSTEM' | string;
    physicalColumn?: string;
    fieldType?: CustomFieldType | string;
    fieldGroup?: CustomFieldGroup | string;
    componentType?: string;
    maxLength?: number;
    decimalPrecision?: number;
    decimalScale?: number;
    defaultValue?: string;
    listVisible?: boolean;
    searchable?: boolean;
    readonly?: boolean;
    required: boolean;
    visible: boolean;
    sort?: number;
    creator?: string;
    createTime?: Date | string;
  }

  export type CustomFieldType =
    | 'BOOLEAN'
    | 'DATE'
    | 'DATETIME'
    | 'DECIMAL'
    | 'INTEGER'
    | 'TEXT'
    | 'TEXTAREA';

  export type CustomFieldGroup = 'base_info' | 'extend_info' | 'price_info';

  /** 新增自定义字段请求 */
  export interface CreateCustomFieldReq {
    moduleKey: string;
    fieldLabel: string;
    fieldType: CustomFieldType;
    fieldGroup: CustomFieldGroup;
    required?: boolean;
    visible?: boolean;
    listVisible?: boolean;
    searchable?: boolean;
    readonly?: boolean;
    maxLength?: number;
    decimalPrecision?: number;
    decimalScale?: number;
    defaultValue?: string;
    sort?: number;
  }

  /** 批量保存请求 */
  export interface BatchUpdateReq {
    moduleKey: string;
    deletedCustomFields?: string[];
    items: Array<
      Partial<FieldConfig> & {
        fieldName: string;
        fieldLabel?: string;
        required: boolean;
        visible: boolean;
        sort?: number;
      }
    >;
  }

  /** 模块定义 */
  export interface Module {
    key: string;
    name: string;
  }
}

/** 查询某模块的字段配置列表 */
export function getFieldConfigList(moduleKey: string) {
  return requestClient.get<ErpFieldConfigApi.FieldConfig[]>(
    '/erp/field-config/list',
    { params: { moduleKey } },
  );
}

export function getRuntimeFieldConfigList(moduleKey: string) {
  return requestClient.get<ErpFieldConfigApi.FieldConfig[]>(
    '/erp/field-config/runtime-list',
    { params: { moduleKey } },
  );
}

/** 批量保存某模块的全部字段配置（一次性覆盖） */
export function batchUpdateFieldConfig(data: ErpFieldConfigApi.BatchUpdateReq) {
  return requestClient.put('/erp/field-config/batch-update', data);
}

/** 新增自定义字段，当前仅用于配件信息 erp_product */
export function createCustomField(
  data: ErpFieldConfigApi.CreateCustomFieldReq,
) {
  return requestClient.post<ErpFieldConfigApi.FieldConfig>(
    '/erp/field-config/create-custom-field',
    data,
  );
}

/** 清空某模块的自定义字段配置 */
export function resetFieldConfig(moduleKey: string) {
  return requestClient.put('/erp/field-config/reset', null, {
    params: { moduleKey },
  });
}

/** 获取所有可配置模块列表 */
export function getFieldConfigModules() {
  return requestClient.get<ErpFieldConfigApi.Module[]>(
    '/erp/field-config/modules',
  );
}
