interface PrintTemplateAuthState {
  accessCodes: readonly string[];
  accessToken: null | string;
  tenantId: null | number;
  visitTenantId: null | number;
}

export interface PrintTemplateAuthPayload {
  accessCodes: string[];
  accessToken: null | string;
  tenantId: null | number;
  visitTenantId: null | number;
}

/**
 * Build a structured-clone-safe payload for the static print-template iframe.
 */
export function buildPrintTemplateAuthPayload(
  state: PrintTemplateAuthState,
): PrintTemplateAuthPayload {
  return {
    accessCodes: [...state.accessCodes],
    accessToken: state.accessToken,
    tenantId: state.tenantId,
    visitTenantId: state.visitTenantId,
  };
}
