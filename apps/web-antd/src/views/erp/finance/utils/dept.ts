import { handleTree } from '@vben/utils';

import { getAccountDeptSimpleList } from '#/api/erp/finance/account';
import { getPayableAccountDeptSimpleList } from '#/api/erp/finance/payable/account';
import { getPayableExpenseDeptSimpleList } from '#/api/erp/finance/payable/expense';
import {
  getPayableOtherDeptSimpleList,
  getPayableOtherSupplierDeptSimpleList,
} from '#/api/erp/finance/payable/other';
import { getPayableReportDeptSimpleList } from '#/api/erp/finance/payable/report';
import { getFinancePaymentDeptSimpleList } from '#/api/erp/finance/payment';
import {
  getFinanceReceiptCustomerDeptSimpleList,
  getFinanceReceiptDeptSimpleList,
} from '#/api/erp/finance/receipt';
import { getReceivableAccountDeptSimpleList } from '#/api/erp/finance/receivable/account';
import { getOtherIncomeDeptSimpleList } from '#/api/erp/finance/receivable/other-income';
import {
  getOtherReceivableCustomerDeptSimpleList,
  getOtherReceivableDeptSimpleList,
} from '#/api/erp/finance/receivable/other-receivable';
import { getReceivableReportDeptSimpleList } from '#/api/erp/finance/receivable/report';
import { getFinanceTransferDeptSimpleList } from '#/api/erp/finance/transfer';

type DeptOption = {
  id?: null | number | string;
  name?: string;
};

export type FinanceDeptNode = {
  children?: FinanceDeptNode[];
  id?: number;
  name?: string;
};

export async function getAccountSearchDeptTree() {
  return getSearchDeptTree(getAccountDeptSimpleList);
}

export async function getPayableAccountSearchDeptTree() {
  return getSearchDeptTree(getPayableAccountDeptSimpleList);
}

export async function getReceivableAccountSearchDeptTree() {
  return getSearchDeptTree(getReceivableAccountDeptSimpleList);
}

export async function getPayableReportSearchDeptTree() {
  return getSearchDeptTree(getPayableReportDeptSimpleList);
}

export async function getReceivableReportSearchDeptTree() {
  return getSearchDeptTree(getReceivableReportDeptSimpleList);
}

export async function getFinancePaymentSearchDeptTree() {
  return getSearchDeptTree(getFinancePaymentDeptSimpleList);
}

export async function getFinanceReceiptSearchDeptTree() {
  return getSearchDeptTree(getFinanceReceiptDeptSimpleList);
}

export async function getFinanceReceiptCustomerDeptTree(params?: {
  customerId?: number | string;
}) {
  const customerId = normalizeDeptId(params?.customerId);
  if (customerId === undefined) {
    return [];
  }
  return handleTree(
    await getFinanceReceiptCustomerDeptSimpleList(customerId),
  ) as FinanceDeptNode[];
}

export async function getOtherReceivableCustomerDeptTree(params?: {
  customerId?: number | string;
}) {
  const customerId = normalizeDeptId(params?.customerId);
  if (customerId === undefined) {
    return [];
  }
  return handleTree(
    await getOtherReceivableCustomerDeptSimpleList(customerId),
  ) as FinanceDeptNode[];
}

export async function getPayableOtherSupplierDeptTree(params?: {
  supplierId?: number | string;
}) {
  const supplierId = normalizeDeptId(params?.supplierId);
  if (supplierId === undefined) {
    return [];
  }
  return handleTree(
    await getPayableOtherSupplierDeptSimpleList(supplierId),
  ) as FinanceDeptNode[];
}

export async function getFinanceTransferSearchDeptTree() {
  return getSearchDeptTree(getFinanceTransferDeptSimpleList);
}

export async function getPayableExpenseSearchDeptTree() {
  return getSearchDeptTree(getPayableExpenseDeptSimpleList);
}

export async function getPayableOtherSearchDeptTree() {
  return getSearchDeptTree(getPayableOtherDeptSimpleList);
}

export async function getOtherReceivableSearchDeptTree() {
  return getSearchDeptTree(getOtherReceivableDeptSimpleList);
}

export async function getOtherIncomeSearchDeptTree() {
  return getSearchDeptTree(getOtherIncomeDeptSimpleList);
}

async function getSearchDeptTree(loader: () => Promise<DeptOption[]>) {
  return handleTree(await loader());
}

export function collectFinanceDeptIds(tree: FinanceDeptNode[]) {
  const ids = new Set<number>();
  const visit = (nodes: FinanceDeptNode[]) => {
    for (const node of nodes) {
      if (node.id !== undefined) {
        ids.add(node.id);
      }
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(tree);
  return ids;
}

export function flattenFinanceDeptTree(tree: FinanceDeptNode[]) {
  const result: FinanceDeptNode[] = [];
  const visit = (nodes: FinanceDeptNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) {
        visit(node.children);
      }
    }
  };
  visit(tree);
  return result;
}

function normalizeDeptId(value?: null | number | string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}
