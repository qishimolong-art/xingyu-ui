import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';
import type { ErpVoucherApi } from '../voucher';
export interface Auxiliary {
  type: string;
  id?: number;
  name?: string;
}
export interface Mapping {
  scenario: string;
  role: string;
  categoryId?: number;
  subjectId?: number;
}
export interface RuleConfig {
  version: number;
  taxpayer: string;
  enabledScenarios: string[];
  mappings: Mapping[];
  accounts: { accountId?: number; subjectId?: number }[];
  projects: {
    id?: number;
    name: string;
    enabled: boolean;
    deptIds: number[];
  }[];
}
export interface Template {
  code: string;
  name: string;
  bizType: number;
  taxable: boolean;
  roles: string[];
  treatment: string;
  basis: string;
}
export interface AccountingContext {
  bizType: number;
  bizId: number;
  version: number;
  sourceVersion: string;
  scenario?: string;
  revenueConfirmed?: boolean;
  discountNature?: string;
  priceBasis?: string;
  invoiceStatus?: string;
  deductionStatus?: string;
  taxAmount?: number | string | null | string;
  feeConfirmed?: boolean;
  feeNature?: string;
  feePartyType?: number;
  feePartyId?: number;
  feeAlreadyPosted?: boolean;
  postedBizType?: number;
  postedBizId?: number;
  note?: string;
  auxiliaries: Auxiliary[];
  allocationWeights: Record<string, number>;
}
export interface GenerationRequest {
  bizType: number;
  bizId: number;
  voucherDate?: string;
  attributionYear?: number;
  attributionMonth?: number;
  previewToken?: string;
}
export interface Preview {
  bizType: number;
  bizId: number;
  bizNo: string;
  status: string;
  issues: string[];
  sourceVersion: string;
  previewToken?: string;
  voucherDate?: string;
  voucherId?: number;
  sourceAmount?: number | string | null;
  stockAmount?: number | string | null;
  configVersion?: number;
  contextVersion?: number;
  scenario?: string;
  items: ErpVoucherApi.VoucherItem[];
  evidence: Record<string, unknown>;
}
export interface Choice {
  id: number;
  remark?: string;
  name?: string;
  subjectCode?: string;
  subjectName?: string;
  parentId?: number;
  accountType?: number;
}
export interface Choices {
  subjects: Choice[];
  categories: Choice[];
  accounts: Choice[];
  departments: Auxiliary[];
}
export const getRuleConfig = () =>
  requestClient.get<RuleConfig>('/erp/voucher-rule/get');
export const saveRuleConfig = (data: RuleConfig) =>
  requestClient.put('/erp/voucher-rule/save', data);
export const getRuleTemplates = () =>
  requestClient.get<Template[]>('/erp/voucher-rule/templates');
export const getRuleChoices = () =>
  requestClient.get<Choices>('/erp/voucher-rule/choices');
export const getAuxiliaryOptions = (type: string) =>
  requestClient.get<Auxiliary[]>('/erp/voucher-rule/auxiliary-options', {
    params: { type },
  });
export const getAccountingContext = (bizType: number, bizId: number) =>
  requestClient.get<AccountingContext>(
    '/erp/voucher-attribution/accounting-context',
    { params: { bizType, bizId } },
  );
export const saveAccountingContext = (data: AccountingContext) =>
  requestClient.put('/erp/voucher-attribution/accounting-context', data);
export const previewVouchers = (items: GenerationRequest[]) =>
  requestClient.post<Preview[]>('/erp/voucher-attribution/preview', { items });
export const generatePreview = (items: GenerationRequest[]) =>
  requestClient.post<number[]>('/erp/voucher-attribution/generate-preview', {
    items,
  });
export const ROLE_LABELS: Record<string, string> = {
  INVENTORY: '库存商品',
  AP: '应付账款',
  PROVISIONAL_AP: '暂估应付',
  INPUT_TAX: '进项税额',
  OUTPUT_TAX: '应交增值税/销项税额',
  SELLING_EXPENSE: '采购相关销售费用',
  AR: '应收账款',
  REVENUE: '主营业务收入',
  COST: '主营业务成本',
  FINANCE_EXPENSE: '财务费用',
  ADVANCE_RECEIPT: '预收账款',
  PREPAID: '预付账款',
  OTHER_AR: '其他应收款',
  OTHER_AP: '其他应付款',
  EXPENSE: '经营费用',
  PENDING: '待处理财产损溢',
};
export const STATUS_LABELS: Record<string, string> = {
  READY: '可生成',
  GENERATED: '已生成',
  UNCONFIGURED: '未配置',
  INCOMPLETE: '待补充',
  MANUAL: '需人工处理',
  LINKED: '关联来源记账',
};
export const AUX_LABELS: Record<string, string> = {
  supplier: '供应商',
  customer: '客户',
  dept: '部门',
  person: '个人',
  project: '项目',
};

export const setRuleEnabled = (data: {
  scenario: string;
  enabled: boolean;
  version: number;
}) => requestClient.put('/erp/voucher-rule/enabled', data);
