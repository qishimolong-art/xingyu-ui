type FormField = {
  fieldName?: string;
};

/**
 * 运费类型和费用是同一组业务信息，即使运行时字段配置改变了排序，
 * 也要让费用紧跟在运费类型后面。
 */
export function keepFreightFeeAdjacent<T extends FormField>(schema: T[]): T[] {
  const freightTypeIndex = schema.findIndex(
    (item) => item.fieldName === 'freightType',
  );
  const feeAmountIndex = schema.findIndex(
    (item) => item.fieldName === 'feeAmount',
  );

  if (
    freightTypeIndex === -1 ||
    feeAmountIndex === -1 ||
    feeAmountIndex === freightTypeIndex + 1
  ) {
    return schema;
  }

  const nextSchema = [...schema];
  const feeAmountField = nextSchema.splice(feeAmountIndex, 1)[0];
  if (!feeAmountField) {
    return schema;
  }
  const nextFreightTypeIndex = nextSchema.findIndex(
    (item) => item.fieldName === 'freightType',
  );
  nextSchema.splice(nextFreightTypeIndex + 1, 0, feeAmountField);
  return nextSchema;
}
