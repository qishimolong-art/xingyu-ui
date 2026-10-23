import { h } from 'vue';

import { message, Modal } from 'ant-design-vue';

import { requestClient } from '#/api/request';

import { stockRoundingRows } from './stock-decimal';

async function confirmRounding(
  data: any,
  prompt = true,
  hiddenFields: string[] = [],
) {
  if (!Array.isArray(data?.items)) return;
  let changes;
  try {
    changes = stockRoundingRows(data.items, hiddenFields);
  } catch (error) {
    if (prompt) message.warning((error as Error).message);
    throw error;
  }
  if (changes.length === 0 || !prompt) return;
  await new Promise<void>((resolve, reject) =>
    Modal.confirm({
      title: '计算结果将按保存精度四舍五入',
      content: h(
        'div',
        {
          style: {
            whiteSpace: 'pre-wrap',
            maxHeight: '320px',
            overflowY: 'auto',
          },
        },
        changes
          .map((change) => `${change.label}：${change.raw} → ${change.saved}`)
          .join('\n'),
      ),
      onOk: () => resolve(),
      onCancel: () => reject(new Error('已取消保存，输入内容保留')),
    }),
  );
}

/** Stock entry points opt in; the global client and other modules stay unchanged. */
export const stockDecimalRequestClient = {
  get<T = any>(url: string, config: any = {}) {
    return requestClient.get<T>(url, {
      ...config,
      params: { ...config.params, decimalMode: 'string' },
    });
  },
  async post<T = any>(url: string, data?: any, config: any = {}) {
    const { decimalHiddenFields, ...httpConfig } = config;
    if (
      /\/(?:create|create-and-submit|update|create-draft|update-draft|update-and-submit)$/.test(
        url,
      )
    )
      await confirmRounding(data, !url.endsWith('-draft'), decimalHiddenFields);
    return requestClient.post<T>(url, data, {
      ...httpConfig,
      params: { ...httpConfig.params, decimalMode: 'string' },
    });
  },
  async put<T = any>(url: string, data?: any, config: any = {}) {
    const { decimalHiddenFields, ...httpConfig } = config;
    if (
      /\/(?:create|create-and-submit|update|create-draft|update-draft|update-and-submit)$/.test(
        url,
      )
    )
      await confirmRounding(data, !url.endsWith('-draft'), decimalHiddenFields);
    return requestClient.put<T>(url, data, {
      ...httpConfig,
      params: { ...httpConfig.params, decimalMode: 'string' },
    });
  },
  delete<T = any>(url: string, config: any = {}) {
    return requestClient.delete<T>(url, config);
  },
  upload<T = any>(url: string, data: any, config: any = {}) {
    return requestClient.upload<T>(url, data, config);
  },
  download(url: string, config: any = {}) {
    return requestClient.download(url, config);
  },
};
