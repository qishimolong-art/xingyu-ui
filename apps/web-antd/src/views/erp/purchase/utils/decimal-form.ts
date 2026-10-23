import type { VbenFormSchema } from '#/adapter/form';

import { withDocumentDecimalSchemas } from '../../utils/document-decimal-form';
import { formatPurchaseAmount, formatPurchaseDecimal, parsePurchaseDecimal } from './decimal';

export function withPurchaseDecimalSchemas<T extends VbenFormSchema>(schemas: T[]): T[] {
  return withDocumentDecimalSchemas(schemas, parsePurchaseDecimal, formatPurchaseAmount, formatPurchaseDecimal);
}
