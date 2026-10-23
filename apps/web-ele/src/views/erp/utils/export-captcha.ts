import { ElMessageBox } from 'element-plus';

const EXPORT_CAPTCHA_CODE = '123456';

interface ConfirmErpExportCaptchaOptions {
  title?: string;
  message?: string;
}

/**
 * Unified ERP archive export captcha.
 * The code is temporarily fixed before SMS verification is available.
 */
export async function confirmErpExportCaptcha(
  options: ConfirmErpExportCaptchaOptions = {},
) {
  try {
    await ElMessageBox.prompt(
      options.message ?? '请输入导出验证码，当前验证码为 123456',
      options.title ?? '导出验证码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^\d{6}$/,
        inputPlaceholder: '请输入 6 位验证码',
        inputErrorMessage: '请输入 6 位验证码',
        inputValidator: (value) => {
          if (value !== EXPORT_CAPTCHA_CODE) {
            return '验证码错误';
          }
          return true;
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}
