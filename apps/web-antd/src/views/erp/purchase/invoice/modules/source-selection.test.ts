import { describe, expect, it } from 'vitest';

import {
  filterSelectedPurchaseInvoiceSourceRefs,
  getPurchaseInvoiceSourceRefKey,
  normalizePurchaseInvoiceSourceRefs,
} from './source-selection';

describe('purchase invoice persisted source selection', () => {
  it('deduplicates mixed persisted source references', () => {
    expect(
      normalizePurchaseInvoiceSourceRefs([
        { sourceDocId: 101, sourceType: 10 },
        { sourceDocId: 101, sourceType: 10 },
        { sourceDocId: 202, sourceType: 20 },
        { sourceDocId: 303, sourceType: 30 },
      ]),
    ).toEqual([
      { sourceDocId: 101, sourceType: 10 },
      { sourceDocId: 202, sourceType: 20 },
      { sourceDocId: 303, sourceType: 30 },
    ]);
  });

  it('ignores invalid source references', () => {
    expect(
      normalizePurchaseInvoiceSourceRefs([
        { sourceDocId: 0, sourceType: 10 },
        { sourceDocId: Number.NaN, sourceType: 20 },
        { sourceDocId: 88, sourceType: 10 },
      ]),
    ).toEqual([{ sourceDocId: 88, sourceType: 10 }]);
  });

  it('keeps only persisted references whose composite keys remain selected', () => {
    const refs = [
      { sourceDocId: 101, sourceType: 10 },
      { sourceDocId: 202, sourceType: 20 },
      { sourceDocId: 303, sourceType: 30 },
    ];

    expect(getPurchaseInvoiceSourceRefKey(refs[0]!)).toBe('10:101');
    expect(
      filterSelectedPurchaseInvoiceSourceRefs(refs, ['10:101', '30:303']),
    ).toEqual([refs[0], refs[2]]);
  });
});
