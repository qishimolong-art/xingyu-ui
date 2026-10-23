import type { VbenFormSchema } from '#/adapter/form';

/**
 * Give a detail-only link field its own fixed slot name without replacing the
 * original create/edit control. Field permission is expected to run first so
 * the permission key remains the original business field name.
 */
export function replaceDetailFieldWithLinkSlot(
  schema: VbenFormSchema[],
  formType: string,
  fieldName: string,
  detailFieldName: string,
): VbenFormSchema[] {
  if (formType !== 'detail') {
    return schema;
  }
  return schema.map((item) => {
    if (item.fieldName !== fieldName) {
      return item;
    }
    const { rules: _rules, ...rest } = item;
    return {
      ...rest,
      component: 'Input',
      fieldName: detailFieldName,
    };
  });
}
