import { getRuntimeFieldConfigList } from '#/api/erp/config/field';
import { getCurrentUserHiddenFields } from '#/api/system/permission/field';
export function loadCustomerRoleFields(module = 'erp_customer') {
  return getCurrentUserHiddenFields(module, undefined, true);
}
export async function loadCustomerFieldVisibility(
  configModule = 'customer',
  module = 'erp_customer',
) {
  const [config, hiddenFields] = await Promise.all([
    getRuntimeFieldConfigList(configModule),
    loadCustomerRoleFields(module),
  ]);
  return {
    config,
    hiddenFields,
    configHiddenFields: config
      .filter((field) => field.visible === false)
      .map((field) => field.fieldName),
  };
}
