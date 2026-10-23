import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

export function getPurchaseInvoiceSourceRefKey(
  sourceRef: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef,
) {
  return `${sourceRef.sourceType}:${sourceRef.sourceDocId}`;
}

export function normalizePurchaseInvoiceSourceRefs(
  sourceRefs: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[] = [],
) {
  const refs = new Map<
    string,
    ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef
  >();
  for (const ref of sourceRefs) {
    const sourceType = Number(ref.sourceType);
    const sourceDocId = Number(ref.sourceDocId);
    if (
      !Number.isFinite(sourceType) ||
      !Number.isFinite(sourceDocId) ||
      sourceDocId <= 0
    ) {
      continue;
    }
    const normalizedRef = { sourceDocId, sourceType };
    refs.set(getPurchaseInvoiceSourceRefKey(normalizedRef), normalizedRef);
  }
  return Array.from(refs.values());
}

export function filterSelectedPurchaseInvoiceSourceRefs(
  sourceRefs: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[] = [],
  selectedKeys: Array<number | string> = [],
) {
  const selectedKeySet = new Set(selectedKeys.map(String));
  return normalizePurchaseInvoiceSourceRefs(sourceRefs).filter((sourceRef) =>
    selectedKeySet.has(getPurchaseInvoiceSourceRefKey(sourceRef)),
  );
}
