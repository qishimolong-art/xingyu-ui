import { getRuntimeFieldConfigList } from '#/api/erp/config/field';
import { getCurrentUserHiddenFields } from '#/api/system/permission/field';

const aliases: Record<string, string[]> = {
  areaIds: ['region'],
  financePhone: ['financeMobile'],
  invoiceCompany: ['invoiceTitle'],
  taxpayerId: ['invoiceTaxNo'],
};
function candidates(field: string) {
  const result = new Set([field]);
  for (const [name, alternatives] of Object.entries(aliases)) {
    if (name === field || alternatives.includes(field))
      for (const value of [name, ...alternatives]) result.add(value);
  }
  return [...result];
}
export function loadSupplierRoleFields() {
  return getCurrentUserHiddenFields('erp_supplier', undefined, true);
}
/** A failed load rejects; it must never mean that every field is editable. */
export async function loadSupplierFieldVisibility() {
  const [config, hiddenFields] = await Promise.all([
    getRuntimeFieldConfigList('supplier'),
    loadSupplierRoleFields(),
  ]);
  return {
    config,
    hiddenFields,
    configFieldKeys: [
      ...new Set(config.flatMap((field) => candidates(field.fieldName))),
    ],
    configHiddenFields: [
      ...new Set(
        config
          .filter((field) => field.visible === false)
          .flatMap((field) => candidates(field.fieldName)),
      ),
    ],
  };
}
