export interface TenantVisitTransitionOptions {
  closeOtherTabs: () => Promise<void> | void;
  currentVisitTenantId: null | number;
  loginTenantId: null | number;
  refreshTab: () => Promise<void> | void;
  setVisitTenantId: (tenantId: null | number) => void;
  targetTenantId: number;
}

export function hasVisitableTenant(
  tenants: Array<{ id?: number }>,
  loginTenantId: null | number,
) {
  return tenants.some((tenant) => tenant.id !== loginTenantId);
}

export function resolveActiveTenantId(
  loginTenantId: null | number,
  visitTenantId: null | number,
) {
  return visitTenantId ?? loginTenantId;
}

export function isVisitingTenant(
  loginTenantId: null | number,
  visitTenantId: null | number,
) {
  return (
    visitTenantId !== null &&
    visitTenantId !== undefined &&
    visitTenantId !== loginTenantId
  );
}

export function resolveNextVisitTenantId(
  loginTenantId: null | number,
  targetTenantId: number,
) {
  return targetTenantId === loginTenantId ? null : targetTenantId;
}

export async function applyTenantVisitTransition({
  closeOtherTabs,
  currentVisitTenantId,
  loginTenantId,
  refreshTab,
  setVisitTenantId,
  targetTenantId,
}: TenantVisitTransitionOptions) {
  const nextVisitTenantId = resolveNextVisitTenantId(
    loginTenantId,
    targetTenantId,
  );
  setVisitTenantId(nextVisitTenantId);
  try {
    await closeOtherTabs();
    await refreshTab();
    return nextVisitTenantId;
  } catch (error) {
    setVisitTenantId(currentVisitTenantId);
    throw error;
  }
}
