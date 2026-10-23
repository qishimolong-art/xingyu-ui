const BUSINESS_PARTNER_SEARCH_FIELDS = [
  'label',
  'name',
  'title',
  'shortName',
  'code',
  'contact',
  'mobile',
  'telephone',
  'pinyinCode',
  'wubiCode',
  'memberCode',
  'platformCode',
  'creditBlockedReason',
  'value',
];

function collectSourceText(source: any) {
  if (!source) {
    return '';
  }
  return BUSINESS_PARTNER_SEARCH_FIELDS.map((field) => source?.[field])
    .filter((item) => item !== undefined && item !== null)
    .join(' ');
}

export function collectErpBusinessPartnerOptionText(option: any) {
  const sources = [
    option,
    option?.raw,
    option?.origin,
    option?.data,
    option?.option,
  ];
  return sources.map(collectSourceText).filter(Boolean).join(' ').toLowerCase();
}

export function filterErpBusinessPartnerOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  return collectErpBusinessPartnerOptionText(option).includes(keyword);
}
