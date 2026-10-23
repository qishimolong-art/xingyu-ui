import type { PageParam } from '@vben/request';

import {
  exportAccountingSubject,
  getAccountingSubjectPage,
} from '#/api/erp/finance/accounting/subject';
import {
  exportVoucher,
  getVoucherPage,
} from '#/api/erp/finance/accounting/voucher';
import { searchSourceBiz } from '#/api/erp/finance/accounting/voucher-attribution';
import { getVoucherWordPage } from '#/api/erp/finance/accounting/voucher-word';
import { exportPurchaseIn, getPurchaseInPage } from '#/api/erp/purchase/in';
import {
  exportPurchaseInvoice,
  getPurchaseInvoicePage,
} from '#/api/erp/purchase/invoice';

/**
 * 发票凭证及财务报表阶段 2 的经营报表包装层。
 * 这里保持经营报表调用名称独立，内部复用已验收的旧业务接口，避免旧业务页面被静默改变。
 */
export function getFinancialPurchaseInvoicePage(
  params: PageParam & Record<string, any>,
) {
  return getPurchaseInvoicePage(params);
}

export function exportFinancialPurchaseInvoice(params: Record<string, any>) {
  return exportPurchaseInvoice(params);
}

export function getFinancialPurchaseInInvoiceStatusPage(
  params: PageParam & Record<string, any>,
) {
  return getPurchaseInPage(params);
}

export function exportFinancialPurchaseInInvoiceStatus(
  params: Record<string, any>,
) {
  return exportPurchaseIn(params);
}

export function getFinancialVoucherPage(
  params: PageParam & Record<string, any>,
) {
  return getVoucherPage(params);
}

export function exportFinancialVoucher(params: Record<string, any>) {
  return exportVoucher(params);
}

export function getFinancialVoucherAttributionSourcePage(
  params: PageParam & Record<string, any>,
) {
  return searchSourceBiz(params);
}

export function getFinancialVoucherWordPage(
  params: PageParam & Record<string, any>,
) {
  return getVoucherWordPage(params);
}

export function getFinancialAccountingSubjectPage(
  params: PageParam & Record<string, any>,
) {
  return getAccountingSubjectPage(params);
}

export function exportFinancialAccountingSubject(params: Record<string, any>) {
  return exportAccountingSubject(params);
}
