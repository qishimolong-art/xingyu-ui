import type { ErpSalePickDeliveryApi } from '#/api/erp/sale/pick-delivery';

import { ref } from 'vue';

// 只去掉小数末尾的零，不对异常历史小数取整或丢失大整数精度。
export function formatPickDeliveryQuantity(value: unknown): string {
  return String(value ?? '0').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

// 将六位数量转为百万分之一单位，以 BigInt 精确比较上限。
export function quantityUnits(value: unknown): bigint | undefined {
  const text = formatPickDeliveryQuantity(value ?? '').trim();
  if (!/^\d{1,18}(?:\.\d{1,6})?$/.test(text)) return undefined;
  const [integer, decimal = ""] = text.split(".");
  return BigInt(integer!) * 1_000_000n + BigInt(decimal.padEnd(6, "0"));
}

export function usePickDeliveryQuantities(kind: 'delivery' | 'pick') {
  const selectedItemIds = ref<number[]>([]);
  const quantities = ref<Record<number, string>>({});
  const selectedRecords = new Map<number, ErpSalePickDeliveryApi.ItemResp>();
  let prepared:
    | undefined
    | {
        request: {
          files: ErpSalePickDeliveryApi.SubmitFile[];
          items: ErpSalePickDeliveryApi.SubmitItem[];
          remark?: string;
          requestId: string;
        };
        signature: string;
      };

  function remaining(item: ErpSalePickDeliveryApi.ItemResp) {
    return formatPickDeliveryQuantity(
      (kind === 'pick'
        ? item.remainingPickCount
        : (item.availableDeliveryCount ?? item.remainingDeliveryCount)) ?? '0',
    );
  }

  function setSelection(
    keys: number[],
    visible: ErpSalePickDeliveryApi.ItemResp[],
    canSelect: (item: ErpSalePickDeliveryApi.ItemResp) => boolean,
  ) {
    const visibleMap = new Map(visible.map((item) => [item.id, item]));
    const next = keys.filter((id) => {
      const row = visibleMap.get(id) ?? selectedRecords.get(id);
      return row && canSelect(row);
    });
    for (const id of selectedItemIds.value) {
      if (!next.includes(id)) {
        quantities.value = Object.fromEntries(
          Object.entries(quantities.value).filter(
            ([key]) => Number(key) !== id,
          ),
        );
        selectedRecords.delete(id);
      }
    }
    for (const id of next) {
      const row = visibleMap.get(id) ?? selectedRecords.get(id);
      if (!row) continue;
      if (!selectedItemIds.value.includes(id))
        quantities.value[id] = remaining(row);
      selectedRecords.set(id, row);
    }
    selectedItemIds.value = next;
  }

  function getItems(): ErpSalePickDeliveryApi.SubmitItem[] {
    return selectedItemIds.value
      .map((itemId) => {
        const record = selectedRecords.get(itemId);
        const value = quantityUnits(quantities.value[itemId]);
        const max = quantityUnits(record && remaining(record));
        if (
          value === undefined ||
          !/^\d{1,18}(?:\.\d{1,6})?$/.test((quantities.value[itemId] ?? '').trim()) ||
          max === undefined ||
          value <= 0n ||
          value > max
        ) {
          throw new Error(
            `${record?.productName || record?.productCode || '配件'}：本次数量须为大于0且不超过${kind === 'delivery' ? '当前可送数量' : '剩余数量'}的数量（最多6位小数）`,
          );
        }
        return { itemId, quantity: (quantities.value[itemId] ?? '').trim() };
      })
      .toSorted((a, b) => a.itemId - b.itemId);
  }

  async function prepareSubmission(
    remark: string,
    fileKeys: string[],
    upload: () => Promise<ErpSalePickDeliveryApi.SubmitFile[]>,
  ) {
    const items = getItems();
    const signature = JSON.stringify([items, remark, fileKeys]);
    if (prepared?.signature === signature) return prepared.request;
    const files = await upload();
    // 同一批次失败后复用已上传凭证与请求ID，避免超时重试重复记账。
    const request = {
      requestId: Array.from(
        globalThis.crypto.getRandomValues(new Uint8Array(16)),
        (value) => value.toString(16).padStart(2, '0'),
      ).join(''),
      items,
      files,
      remark: remark || undefined,
    };
    prepared = { signature, request };
    return request;
  }

  function reset() {
    selectedItemIds.value = [];
    quantities.value = {};
    selectedRecords.clear();
    prepared = undefined;
  }

  return {
    selectedItemIds,
    quantities,
    remaining,
    setSelection,
    getItems,
    prepareSubmission,
    reset,
  };
}
