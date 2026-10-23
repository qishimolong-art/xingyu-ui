import type { AssistantEvent } from './stream';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore, useUserStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { readAssistantStream } from './stream';

export interface Conversation {
  id: string;
  title: string;
}
export interface History {
  id: string;
  question: string;
  status: string;
  canRerun: boolean;
}
export interface SelectedEntity {
  entityType: string;
  field: string;
  id: number;
  name?: string;
}
export interface PhoneticCorrection {
  category?: string;
  confidence: number;
  corrected: string;
  matchType:
    | 'ALIAS'
    | 'HOMOPHONE'
    | 'NEAR_PHONETIC'
    | 'NEAR_SOUND'
    | 'PHONETIC';
  original: string;
  source: 'CONTROLLED_LEXICON' | 'ENTITY_MASTER_DATA';
}
export interface AssistantResponseMetadata {
  detail?: {
    available: boolean;
    kind: 'ERP_ASSISTANT_DETAIL';
    label: string;
    messageId?: string;
    reason?: string;
  };
  message: string;
  schemaVersion: number;
  severity: 'error' | 'info' | 'success' | 'warning';
  source?: {
    available: boolean;
    count: number;
  };
  status: string;
  table?: {
    columnCount: number;
    detailRows: number;
    summaryRows: number;
    visible: boolean;
  };
  type: 'CLARIFICATION' | 'DONE' | 'ERROR' | 'RESULT';
}
export interface ProductPriceStockResult {
  missingPriceFields?: Array<{ key: string; title: string }>;
  priceDisplayText?: string;
  prices: Array<{
    key: string;
    title: string;
    unit: string;
    value: number;
  }>;
  productId: number;
  productName: string;
  unit?: string;
  warehouseStocks: Array<{
    amount: number;
    warehouseId: number;
    warehouseName: string;
  }>;
}
export interface AccountDepartmentResult {
  amount: number;
  deptId?: null | number;
  deptName: string;
  partyId: number;
  partyName: string;
  unit: string;
}
export interface Result {
  messageId: string;
  summary: Array<Record<string, any>>;
  rows: Array<Record<string, any>>;
  response?: AssistantResponseMetadata;
  basis?: string[];
  answerText?: string;
  columns?: Array<{ dataIndex?: string; key: string; title: string }>;
  emptyText?: string;
  priceFields?: Array<{ key: string; title: string }>;
  missingPriceFields?: Array<{ key: string; title: string }>;
  priceNotice?: string;
  priceStatus?: 'AVAILABLE' | 'NOT_MAINTAINED' | 'NO_PERMISSION' | 'PARTIAL';
  productMatchLimit?: number;
  productMatchTruncated?: boolean;
  productResults?: ProductPriceStockResult[];
  accountPartyLimit?: number;
  accountPartyTruncated?: boolean;
  accountResults?: AccountDepartmentResult[];
  presentation?: {
    headline?: string;
    mode: 'DETAIL' | 'DISTRIBUTION' | 'RANKING' | 'SUMMARY' | 'TREND';
    showChart: boolean;
    showSummary: boolean;
    showTable: boolean;
  };
  queryType?:
    | 'BUSINESS_TOOL'
    | 'KNOWLEDGE'
    | 'MIXED'
    | 'TEXT_TO_SQL'
    | 'VERIFIED_METRIC';
  title?: string;
  toolName?: string;
  dataToolName?: string;
  dataStatus?: string;
  knowledgeStatus?: string;
  verificationNotice?: string;
  verificationStatus?: 'NO_EVIDENCE' | 'REVIEWED' | 'UNVERIFIED';
  freshness?: 'LATEST_REVIEWED';
  freshnessNotice?: string;
  warnings?: string[];
  correctionNotice?: string;
  corrections?: PhoneticCorrection[];
  normalizedQuestion?: string;
  components?: Array<{
    message?: string;
    status: string;
    toolName?: string;
    type: 'DATA' | 'KNOWLEDGE';
  }>;
  traceId?: string;
  unit?: string;
  queriedAt: number | string;
  start?: number | string;
  end?: number | string;
  status: string;
  stockNotice?: string;
  summaryLabel?: string;
  scope: string;
  plan?: {
    group: string;
    limit?: number;
    metric: string;
    period: string;
    presentationMode?:
      | 'DETAIL'
      | 'DISTRIBUTION'
      | 'RANKING'
      | 'SUMMARY'
      | 'TREND';
    priceField?: string;
    priceQueryMode?: 'ALL' | 'NONE' | 'SPECIFIC';
    rankOrder?: 'ASC' | 'DESC';
    stockMode: string;
  };
  knowledge?: {
    description: string;
    excludedDraftNotes?: number;
    reviewedChunks?: number;
    reviewedNotes?: number;
    source: string;
    title: string;
    unverifiedItems?: number;
    version: string;
  };
  sources?: Array<{
    citation?: string;
    contentHash?: string;
    id: string;
    path: string;
    reason?: string;
    section: string;
    title: string;
    updated?: string;
    verificationStatus?: 'REVIEWED' | 'UNVERIFIED';
  }>;
}
const root = '/erp/assistant';
export const identity = () => {
  const store = useAccessStore();
  const user = useUserStore().userInfo;
  // Credential rotation is not an account switch; keep successful results on refresh.
  return JSON.stringify([
    Boolean(store.accessToken),
    user?.id ?? user?.userId ?? null,
    store.tenantId,
    store.visitTenantId,
  ]);
};
export const listConversations = (page = 1, pageSize = 20) =>
  requestClient.get<Conversation[]>(`${root}/conversations`, {
    params: { page, pageSize },
  });
export const createConversation = (signal?: AbortSignal) =>
  requestClient.post<string>(`${root}/conversation`, undefined, { signal });
export const deleteConversation = (id: string) =>
  requestClient.delete(`${root}/conversation`, { params: { id } });
export const history = (conversationId: string, page = 1) =>
  requestClient.get<History[]>(`${root}/messages`, {
    params: { conversationId, page },
    timeout: 60_000,
  });
export const details = (messageId: string, page = 1) =>
  requestClient.get<{
    columns?: Array<{ dataIndex?: string; key: string; title: string }>;
    list: Array<Record<string, any>>;
    total: number;
  }>(`${root}/details`, {
    params: { messageId, page, pageSize: 20 },
    timeout: 60_000,
  });

export interface Readiness {
  datasets?: string[];
  entitySearch?: {
    enabled: boolean;
    maxCandidates: number;
    types: string[];
  };
  hybridAuditReady?: boolean;
  newOrchestration?: boolean;
  orchestrationMode?: 'GRAY' | 'LEGACY' | 'NEW';
  semanticVersion?: string;
  semanticKnowledgeVersion?: string;
  companyKnowledgeAvailable?: boolean;
  companyKnowledgeVersion?: string;
  companyKnowledgeReason?: string;
  companyKnowledgeStats?: {
    excludedDraftNotes: number;
    isolatedInstructionItems: number;
    reviewedChunks: number;
    reviewedNotes: number;
    unverifiedItems: number;
    version: string;
  };
  mixedQuestionAvailable?: boolean;
  semanticIntents?: string[];
  unverifiedCapabilities?: string[];
  registeredCapabilities?: string[];
  v2?: {
    fallbackCapabilities: string[];
    fallbackOnError: boolean;
    grayCapabilities: string[];
    grayEntries: string[];
    grayTenantCount: number;
    grayUserCount: number;
    mode: 'V1' | 'V2' | 'V2_GRAY' | 'V2_SHADOW';
    registeredCapabilityCount: number;
  };
  status: string;
  text: string;
  textToSql?: boolean;
  tools?: string[];
  metrics: Array<{
    available: boolean;
    id: string;
    reason: string;
    reasonText?: string;
    title: string;
  }>;
}
export const readiness = (refresh = false) =>
  requestClient.get<Readiness>(`${root}/readiness`, {
    params: refresh ? { refresh: true } : undefined,
    timeout: 10_000,
  });
export const cancelRequest = (id: string) =>
  requestClient.post<boolean>(
    `${root}/requests/${encodeURIComponent(id)}/cancel`,
  );
export interface AssistantAudit {
  create_time: number | string;
  elapsed_ms: number;
  query_trace?: string;
  route_type: string;
  row_count?: number;
  sql_fingerprint?: string;
  status: string;
  tokens: number;
  tool_name?: string;
}
export const audit = (messageId: string) =>
  requestClient.get<AssistantAudit>(
    `${root}/messages/${encodeURIComponent(messageId)}/audit`,
  );
export const rerun = (
  messageId: string,
  signal: AbortSignal,
  receive: (event: AssistantEvent) => void,
) => ask('', '', signal, receive, undefined, messageId);

export async function ask(
  conversationId: string,
  question: string,
  signal: AbortSignal,
  receive: (event: AssistantEvent) => void,
  choice?: { field: string; id: number },
  rerunId?: string,
  context?: {
    currentPage?: string;
    entry: 'WEB_DRAWER' | 'WEB_PAGE';
  },
) {
  const store = useAccessStore();
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${store.accessToken}`,
  };
  if (store.tenantId !== null && store.tenantId !== undefined)
    headers['tenant-id'] = String(store.tenantId);
  if (store.visitTenantId !== null && store.visitTenantId !== undefined)
    headers['visit-tenant-id'] = String(store.visitTenantId);
  const response = await fetch(
    `${apiURL}${root}${rerunId ? `/messages/${encodeURIComponent(rerunId)}/rerun` : '/send'}`,
    {
      method: 'POST',
      headers,
      body: rerunId
        ? undefined
        : JSON.stringify({
            conversationId,
            question,
            choiceField: choice?.field,
            choiceId: choice?.id,
            entry: context?.entry,
            currentPage: context?.currentPage,
          }),
      signal,
    },
  );
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('text/event-stream')
  ) {
    let text = '查询未能开始，请检查登录状态或稍后重试';
    try {
      const data = await response.json();
      text = data.msg || text;
    } catch {
      /* Keep bounded user-facing error. */
    }
    throw new Error(text);
  }
  if (!response.body) throw new Error('服务器未返回查询流');
  await readAssistantStream(response.body, receive);
}
