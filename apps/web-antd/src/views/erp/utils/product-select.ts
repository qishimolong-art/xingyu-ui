const PRODUCT_OPTION_SEARCH_FIELDS = [
  'label',
  'name',
  'code',
  'pinyinCode',
  'wubiCode',
  'barCode',
  'productName',
  'productCode',
  'productPinyinCode',
  'productWubiCode',
  'productBarCode',
  'vehicleModel',
  'vehicleModelText',
  'factoryCode',
  'standard',
  'brand',
  'oeNumber',
  'drawingNo',
  'featureCode',
  'originPlace',
  'shelf',
];

export function filterErpProductOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return PRODUCT_OPTION_SEARCH_FIELDS.some((field) =>
    String(option?.[field] ?? '')
      .toLowerCase()
      .includes(keyword),
  );
}
