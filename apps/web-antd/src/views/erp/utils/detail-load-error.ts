export const ERP_DETAIL_PERMISSION_ERROR_TEXT = '没有该数据权限';

const PERMISSION_ERROR_TEXTS = [
  '没有该数据权限',
  '没有该操作权限',
  '没有权限',
  '无权限',
];

function getErrorPayloads(error: unknown) {
  if (!error || typeof error !== 'object') {
    return [error];
  }
  const record = error as any;
  return [
    error,
    record.data,
    record.response,
    record.response?.data,
    record.cause,
  ].filter(Boolean);
}

function getPayloadText(payload: unknown) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (payload instanceof Error) return payload.message;
  if (typeof payload !== 'object') return '';
  const record = payload as any;
  return [record.msg, record.message, record.error]
    .filter((text) => typeof text === 'string')
    .join(' ');
}

export function isErpPermissionError(error: unknown) {
  return getErrorPayloads(error).some((payload) => {
    const code = (payload as any)?.code ?? (payload as any)?.status;
    if (String(code) === '403') {
      return true;
    }
    const text = getPayloadText(payload);
    return PERMISSION_ERROR_TEXTS.some((keyword) => text.includes(keyword));
  });
}

export function getErpDetailLoadError(error: unknown, fallback: string) {
  return isErpPermissionError(error)
    ? ERP_DETAIL_PERMISSION_ERROR_TEXT
    : fallback;
}
