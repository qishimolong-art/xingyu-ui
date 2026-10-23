export const SYSTEM_ERROR_MESSAGE = '系统异常，请联系管理员处理';

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object';
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return undefined;
}

export function getRequestErrorData(error: any) {
  const responseData = error?.response?.data;
  if (isObject(responseData)) {
    return responseData;
  }

  const errorData = error?.data;
  if (isObject(errorData)) {
    return errorData;
  }

  return isObject(error) ? error : {};
}

export function getRequestErrorCode(error: any) {
  const responseData = getRequestErrorData(error);
  return (
    toNumber(responseData?.code) ??
    toNumber(error?.data?.code) ??
    toNumber(error?.code) ??
    toNumber(error?.response?.status)
  );
}

export function isRequestUnauthorizedError(error: any) {
  return getRequestErrorCode(error) === 401;
}

export function shouldUseSystemErrorMessage(error: any) {
  const code = getRequestErrorCode(error);
  return typeof code === 'number' && code > 0 && code < 1000 && code !== 401;
}

export function maskRequestSystemErrorMessage(error: any) {
  if (!shouldUseSystemErrorMessage(error)) {
    return;
  }

  const responseData = getRequestErrorData(error);
  responseData.msg = SYSTEM_ERROR_MESSAGE;
  if ('message' in responseData) {
    responseData.message = SYSTEM_ERROR_MESSAGE;
  }
  if ('error' in responseData) {
    responseData.error = SYSTEM_ERROR_MESSAGE;
  }
}

export function getRequestErrorMessage(defaultMessage: string, error: any) {
  if (shouldUseSystemErrorMessage(error)) {
    return SYSTEM_ERROR_MESSAGE;
  }

  const responseData = getRequestErrorData(error);
  return (
    responseData?.error ??
    responseData?.message ??
    responseData?.msg ??
    defaultMessage
  );
}
