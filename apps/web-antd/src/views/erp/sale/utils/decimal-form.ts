import type { VbenFormSchema } from '#/adapter/form';

import { withDocumentDecimalSchemas } from '../../utils/document-decimal-form';
import { formatSaleAmount, formatSaleDecimal, parseSaleDecimal } from './decimal';

export function withSaleDecimalSchemas<T extends VbenFormSchema>(schemas: T[]): T[] {
  return withDocumentDecimalSchemas(schemas, parseSaleDecimal, formatSaleAmount, formatSaleDecimal);
}
