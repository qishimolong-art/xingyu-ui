import { nextTick, onActivated, ref } from 'vue';

type PageResultLike<T> = {
  list?: T[];
  total?: number | string;
};

type ActivationRefreshExtraParams = Record<string, any>;
type ActivationRefreshPageParams = {
  pageNo: number;
  pageSize: number;
} & ActivationRefreshExtraParams;

interface UseVxeActivationRefreshOptions<T> {
  gridApi: any;
  getParams: () =>
    | ActivationRefreshExtraParams
    | Promise<ActivationRefreshExtraParams>;
  queryPage: (
    params: ActivationRefreshPageParams,
  ) => PageResultLike<T> | Promise<PageResultLike<T>>;
  onSuccess?: (rows: T[], result: PageResultLike<T>) => Promise<void> | void;
  onAfterRefresh?: () => void;
  onFirstActivated?: () => void;
  errorMessage: string;
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

export function useVxeActivationRefresh<T>({
  errorMessage,
  getParams,
  gridApi,
  onAfterRefresh,
  onFirstActivated,
  onSuccess,
  queryPage,
}: UseVxeActivationRefreshOptions<T>) {
  const activationRefreshMaskVisible = ref(false);
  let activatedOnce = false;
  let activationRefreshVersion = 0;

  async function refreshActivatedPage() {
    const refreshVersion = ++activationRefreshVersion;
    activationRefreshMaskVisible.value = true;

    try {
      await nextTick();
      await waitForFrame();
      await waitForFrame();

      if (refreshVersion !== activationRefreshVersion) {
        return;
      }

      const proxyInfo = gridApi.grid?.getProxyInfo?.();
      const pager = proxyInfo?.pager;
      const pageSize = Number(pager?.pageSize || 20);
      const currentPage = Number(pager?.currentPage || 1);
      const params = await getParams();
      let result = await queryPage({
        pageNo: currentPage,
        pageSize,
        ...params,
      });
      const total = Number(result.total || 0);
      const pageCount = Math.max(Math.ceil(total / pageSize), 1);
      const finalPage = Math.min(currentPage, pageCount);

      if (finalPage !== currentPage) {
        result = await queryPage({
          pageNo: finalPage,
          pageSize,
          ...params,
        });
      }

      if (refreshVersion !== activationRefreshVersion) {
        return;
      }

      const rows = result.list ?? [];
      if (pager) {
        pager.currentPage = finalPage;
        pager.pageSize = pageSize;
        pager.total = Number(result.total || 0);
      }
      await gridApi.grid?.loadData?.(rows);
      await onSuccess?.(rows, result);
    } catch (error) {
      console.error(errorMessage, error);
    } finally {
      if (refreshVersion === activationRefreshVersion) {
        activationRefreshMaskVisible.value = false;
        onAfterRefresh?.();
      }
    }
  }

  onActivated(() => {
    if (!activatedOnce) {
      activatedOnce = true;
      onFirstActivated?.();
      return;
    }
    void refreshActivatedPage();
  });

  return {
    activationRefreshMaskVisible,
    refreshActivatedPage,
  };
}
