import { message } from 'ant-design-vue';
import { requestClient } from '#/api/request';
import { validateFinanceStorage } from './finance-decimal';
const decimalField = /(?:Price|Amount|Balance)$|^(amount|balance|exchangeRate|writeOffAmount)$/;
export function validateFinancePayload(data: any, path = '') {
  if (!data || typeof data !== 'object') return;
  for (const [field, value] of Object.entries(data)) {
    if (Array.isArray(value)) value.forEach((row, index) => validateFinancePayload(row, `第 ${index+1} 行`));
    else if (value && typeof value === 'object') validateFinancePayload(value, path);
    else if (decimalField.test(field) && value !== '****') validateFinanceStorage(value as any, `${path}${field}`, 6, field==='exchangeRate' ? 12 : 18);
  }
}
function validate(data: any) { try { validateFinancePayload(data); } catch(error) { message.warning((error as Error).message); throw error; } }
export const financeDecimalRequestClient = {
  get<T = any>(url: string, config: any = {}) { return requestClient.get<T>(url, { ...config, params: { ...config.params, decimalMode: 'string' } }); },
  post<T = any>(url: string, data?: any, config?: any) { validate(data); return requestClient.post<T>(url, data, config); },
  put<T = any>(url: string, data?: any, config?: any) { validate(data); return requestClient.put<T>(url, data, config); },
  delete<T = any>(url: string, config?: any) { return requestClient.delete<T>(url, config); },
  download(url: string, config?: any) { return requestClient.download(url, config); },
  upload<T = any>(url: string, data: any, config?: any) { return requestClient.upload<T>(url, data, config); },
};
