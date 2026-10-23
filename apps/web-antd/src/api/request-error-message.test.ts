import { describe, expect, it } from 'vitest';

import {
  getRequestErrorCode,
  getRequestErrorMessage,
  isRequestUnauthorizedError,
  maskRequestSystemErrorMessage,
  shouldUseSystemErrorMessage,
  SYSTEM_ERROR_MESSAGE,
} from './request-error-message';

describe('request-error-message', () => {
  it('uses the unified message for global system error codes', () => {
    const error = {
      response: {
        data: {
          code: 400,
          msg: '请求的租户标识未传递，请进行排查',
        },
      },
    };

    expect(getRequestErrorCode(error)).toBe(400);
    expect(shouldUseSystemErrorMessage(error)).toBe(true);
    expect(getRequestErrorMessage('请求错误', error)).toBe(
      SYSTEM_ERROR_MESSAGE,
    );
  });

  it('keeps business error messages for codes greater than 999', () => {
    const error = {
      response: {
        data: {
          code: 1_002_000_000,
          msg: '登录失败，账号密码不正确',
        },
      },
    };

    expect(shouldUseSystemErrorMessage(error)).toBe(false);
    expect(getRequestErrorMessage('请求错误', error)).toBe(
      '登录失败，账号密码不正确',
    );
  });

  it('does not show an extra message for 401 errors', () => {
    const error = {
      data: {
        code: 401,
        msg: '账号未登录',
      },
    };

    expect(isRequestUnauthorizedError(error)).toBe(true);
    expect(shouldUseSystemErrorMessage(error)).toBe(false);
  });

  it('falls back to HTTP status when the response body has no business code', () => {
    const error = {
      response: {
        data: {},
        status: 500,
      },
    };

    expect(getRequestErrorCode(error)).toBe(500);
    expect(getRequestErrorMessage('内部服务器错误，请稍后再试。', error)).toBe(
      SYSTEM_ERROR_MESSAGE,
    );
  });

  it('keeps network and timeout messages unchanged', () => {
    expect(
      getRequestErrorMessage('网络异常，请检查您的网络连接后重试。', {}),
    ).toBe('网络异常，请检查您的网络连接后重试。');
    expect(getRequestErrorMessage('请求超时，请稍后再试。', {})).toBe(
      '请求超时，请稍后再试。',
    );
  });

  it('masks global error payloads before they reach local catch handlers', () => {
    const responseData = {
      code: 500,
      error: 'NullPointerException',
      message: 'TenantContextHolder 不存在租户编号',
      msg: '系统异常',
    };
    const error = {
      response: {
        data: responseData,
      },
    };

    maskRequestSystemErrorMessage(error);

    expect(responseData).toEqual({
      code: 500,
      error: SYSTEM_ERROR_MESSAGE,
      message: SYSTEM_ERROR_MESSAGE,
      msg: SYSTEM_ERROR_MESSAGE,
    });
  });
});
