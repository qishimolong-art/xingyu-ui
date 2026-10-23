import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'ErpSalePickWeComWorkbench',
    path: '/wecom/sale-pick',
    component: () => import('#/views/erp/sale/pick/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      noBasicLayout: true,
      title: '销售拣货单',
    },
  },
  {
    name: 'ErpSaleDeliveryWeComWorkbench',
    path: '/wecom/sale-delivery',
    component: () => import('#/views/erp/sale/delivery/index.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      noBasicLayout: true,
      title: '销售送货单',
    },
  },
];

export default routes;
