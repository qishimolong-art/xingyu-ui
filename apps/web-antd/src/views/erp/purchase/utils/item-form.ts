import {
  blurInputOnEnter,
  focusNextInputOnEnter,
  isFormInputTarget,
} from '#/views/erp/utils/keyboard';
import {
  buildErpItemDuplicateKey,
  isBatchNoEnabled,
} from '#/views/erp/utils/item';

export {
  blurInputOnEnter,
  focusNextInputOnEnter,
  isBatchNoEnabled,
  isFormInputTarget,
};

export function buildPurchaseItemDuplicateKey(item: {
  gift?: boolean;
  productId?: null | number | string;
  warehouseId?: null | number | string;
}) {
  return buildErpItemDuplicateKey(item);
}
