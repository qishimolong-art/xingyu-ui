import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpAssemblyRecipeApi {
  export const STATUS_DISABLED = 0;
  export const STATUS_ENABLED = 1;
  export const PURPOSE_ASSEMBLY = 1;

  export interface RecipeItem {
    id?: number;
    recipeId?: number;
    productId: number;
    quantityPerSet: number;
    sort?: number;
    remark?: string;
    productCode?: string;
    productName?: string;
    productFactoryCode?: string;
    productStandard?: string;
    productUnitName?: string;
    productDrawingNo?: string;
    productOriginPlace?: string;
    productBrand?: string;
    productVehicleModel?: string;
    productFeatureCode?: string;
    productRetailPrice?: number;
    batchNoEnabled?: boolean;
  }

  export interface Recipe {
    id?: number;
    no?: string;
    productId: number;
    purpose?: number;
    moduleCode?: string;
    moduleName?: string;
    laborCostPerSet: number;
    deptId?: number;
    version?: number;
    status?: number;
    remark?: string;
    creator?: string;
    creatorName?: string;
    createTime?: number | string;
    updater?: string;
    updaterName?: string;
    updateTime?: number | string;
    itemCount?: number;
    productCode?: string;
    productName?: string;
    productDrawingNo?: string;
    productFeatureCode?: string;
    productOriginPlace?: string;
    productVehicleModel?: string;
    productReferencePrice?: number;
    productFactoryCode?: string;
    productStandard?: string;
    productUnitName?: string;
    batchNoEnabled?: boolean;
    items?: RecipeItem[];
  }

  export interface RecipePageReq extends PageParam {
    keyword?: string;
    purpose?: number;
    status?: number;
  }

  export interface RecipeItemPageReq extends PageParam {
    recipeId: number;
  }
}

export function getAssemblyRecipePage(
  params: ErpAssemblyRecipeApi.RecipePageReq,
) {
  return requestClient.get<PageResult<ErpAssemblyRecipeApi.Recipe>>(
    '/erp/assembly-recipe/page',
    { params },
  );
}

export async function getEnabledAssemblyRecipeOptionPage(
  params: ErpAssemblyRecipeApi.RecipePageReq,
) {
  const page = await getAssemblyRecipePage({ ...params, status: 1 });
  return {
    ...page,
    list: (page.list || []).map((item) => ({
      ...item,
      optionLabel:
        `${item.moduleCode || item.productCode || ''} ${item.moduleName || item.productName || ''}`.trim(),
    })),
  };
}

export function getAssemblyRecipe(id: number, includeItems = true) {
  return requestClient.get<ErpAssemblyRecipeApi.Recipe>(
    '/erp/assembly-recipe/get',
    {
      params: { id, includeItems },
    },
  );
}

export function getAssemblyRecipeItemPage(
  params: ErpAssemblyRecipeApi.RecipeItemPageReq,
) {
  return requestClient.get<PageResult<ErpAssemblyRecipeApi.RecipeItem>>(
    '/erp/assembly-recipe/item-page',
    { params },
  );
}

export function createAssemblyRecipe(data: ErpAssemblyRecipeApi.Recipe) {
  return requestClient.post<number>('/erp/assembly-recipe/create', data);
}

export function updateAssemblyRecipe(data: ErpAssemblyRecipeApi.Recipe) {
  return requestClient.put('/erp/assembly-recipe/update', data);
}

export function updateAssemblyRecipeStatus(id: number, status: number) {
  return requestClient.put('/erp/assembly-recipe/update-status', {
    id,
    status,
  });
}

export function deleteAssemblyRecipe(id: number) {
  return requestClient.delete('/erp/assembly-recipe/delete', {
    params: { id },
  });
}
