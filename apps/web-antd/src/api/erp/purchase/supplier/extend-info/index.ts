import { requestClient } from '#/api/request';

export namespace ErpSupplierExtendInfoApi {
  export interface SupplierExtendInfo {
    id?: number;
    supplierId: number;
    chainGroupId?: number;
    bankName2?: string;
    bankAccount2?: string;
    extEmail?: string;
    idCardNo?: string;
    alternateCode?: string;
    baseAmount?: number;
    legalPerson?: string;
    legalPersonPhone?: string;
    boss?: string;
    bossPhone?: string;
    priceMarkupRate?: number;
    keySupplier?: boolean;
    allianceReplenishment?: boolean;
    purchaseReturnContact?: string;
    purchaseReturnAddress?: string;
    purchaseReturnPhone?: string;
    settleDay?: number;
    generateInBill?: boolean;
    inboundMethod?: string;
    generateLabelTask?: boolean;
    allianceOrderMatchRule?: string;
    allianceBillExtractRule?: string;
    settleAccountId?: number;
    scrapReturnCycleDays?: number;
    scrapReturnNextDate?: string;
    scrapReturnThresholdAmount?: number;
    autoReplenishmentEnabled?: boolean;
    autoReplenishmentFormula?: string;
    autoReplenishmentCycle?: string;
    autoReplenishmentTime?: string;
    nextOrderDate?: string;
    stockUpperDays?: number;
    stockStandardDays?: number;
    stockLowerDays?: number;
    dailySaleCycle?: string;
    dailySaleRecentDays?: number;
    limitAdjustRecentMonths?: number;
    limitAdjustMonthlySales?: number;
    createTime?: string;
  }
}

export function getSupplierExtendInfo(supplierId: number) {
  return requestClient.get<ErpSupplierExtendInfoApi.SupplierExtendInfo>('/erp/supplier-extend-info/get-by-supplier-id', { params: { supplierId } });
}

export function saveSupplierExtendInfo(data: ErpSupplierExtendInfoApi.SupplierExtendInfo) {
  return requestClient.post('/erp/supplier-extend-info/save', data);
}
