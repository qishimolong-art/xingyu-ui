import { requestClient } from '#/api/request';

export namespace ErpBusinessReportStatusApi {
  export interface ModuleStatus {
    code: string;
    dependencyPermissions?: string[];
    dependencySql?: string[];
    dependencySwitches?: string[];
    displayCapabilities?: string[];
    name: string;
    pendingItems?: string[];
    riskNotes?: string[];
    status: string;
  }

  export interface Status {
    globalNotes?: string[];
    modules?: ModuleStatus[];
    reportName?: string;
    version?: string;
  }
}

export function getBusinessReportStatus() {
  return requestClient.get<ErpBusinessReportStatusApi.Status>(
    '/erp/business-report/status',
  );
}
