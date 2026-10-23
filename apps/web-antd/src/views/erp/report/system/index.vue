<script lang="ts" setup>
import type { ErpSystemReportApi } from '#/api/erp/report/system';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, Button, DatePicker, Input, message, Modal, Select, TabPane, Tabs } from 'ant-design-vue';

import {
  exportSystemReport,
  getSystemReportOptions,
  getSystemReportPage,
  getSystemReportRank,
  getSystemReportSummary,
  getSystemReportTrend,
} from '#/api/erp/report/system';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

defineOptions({ name: 'ErpSystemReport' });

type Align = 'center' | 'left' | 'right';
type ReportKey = 'purchase' | 'sale' | 'stock';

interface Metric {
  label: string;
  meta: string;
  tone?: 'danger' | 'good' | 'normal' | 'warn';
  value: string;
}

interface Formula {
  label: string;
  text: string;
  tone?: 'danger' | 'good' | 'normal' | 'warn';
}

interface InsightGroup {
  items: Array<{
    meta?: string;
    name: string;
    tone?: 'danger' | 'good' | 'normal' | 'warn';
    value: string;
  }>;
  title: string;
}

interface TrendPoint {
  label: string;
  values: Record<string, number>;
}

interface TrendLine {
  color: string;
  key: string;
  label: string;
  strokeWidth?: number;
}

interface RankMode {
  key: string;
  label: string;
}

interface RankItem {
  count?: string;
  name: string;
  values: Record<string, number | string>;
}

interface TableColumn {
  align?: Align;
  key: string;
  label: string;
  link?: boolean;
  money?: boolean;
  percent?: boolean;
  quantity?: boolean;
  strong?: boolean;
  tag?: boolean;
  width?: number;
}

interface TableDim {
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  title: string;
}

interface ReportConfig {
  badge: string;
  detailTitle: string;
  dims: Record<string, TableDim>;
  filterKeyword: string;
  filters: string[];
  formulas: Formula[];
  insightTitle: string;
  insights: InsightGroup[];
  kpis: Metric[];
  name: string;
  note: string;
  rank: {
    items: RankItem[];
    modes: RankMode[];
    title: string;
  };
  tableDefaultDim: string;
  trend: {
    lines: TrendLine[];
    points: TrendPoint[];
    title: string;
  };
}

interface ReportState {
  colsOpen: boolean;
  dateRange?: [string, string];
  dim: string;
  exportOpen: boolean;
  filterValues: Record<string, any>;
  grain: string;
  hidden: Record<string, boolean>;
  keyword: string;
  page: number;
  period: string;
  rankMode: string;
  sortDir: 'asc' | 'desc';
  sortKey: string;
}

interface RuntimeReportData {
  loaded: boolean;
  options: ErpSystemReportApi.Options;
  pageTotal: number;
  rank: ErpSystemReportApi.Rank[];
  rows: Array<Record<string, any>>;
  summary?: ErpSystemReportApi.Summary;
  trend: ErpSystemReportApi.Trend[];
}

const rowsPerPage = 10;

const purchaseRows = [
  [
    '上海恒驰配件',
    '陈立',
    8420,
    7960,
    460,
    286.4,
    12.8,
    273.6,
    4.5,
    '待催入库',
  ],
  ['南京华成汽配', '周敏', 6980, 6980, 0, 231.9, 5.4, 226.5, 2.3, '正常'],
  [
    '苏州森联供应链',
    '赵鹏',
    5120,
    4210,
    910,
    178.9,
    18.6,
    160.3,
    10.4,
    '退货偏高',
  ],
  ['杭州万向渠道', '陈立', 4380, 3980, 400, 139.6, 6.8, 132.8, 4.9, '待催入库'],
  ['常州东驰贸易', '周敏', 3260, 3090, 170, 96.5, 3.1, 93.4, 3.2, '正常'],
  ['成都路畅供应', '赵鹏', 2880, 2570, 310, 82.2, 7.6, 74.6, 9.2, '关注'],
  ['广州粤通零件', '陈立', 2460, 2380, 80, 72.1, 1.2, 70.9, 1.7, '正常'],
  ['宁波甬鑫汽贸', '周敏', 2280, 1960, 320, 61.4, 4.6, 56.8, 7.5, '关注'],
  ['武汉汉江配件', '赵鹏', 1980, 1820, 160, 54.2, 1.9, 52.3, 3.5, '正常'],
  ['重庆嘉顺汽配', '陈立', 1660, 1500, 160, 45.8, 2.7, 43.1, 5.9, '关注'],
  ['无锡聚源汽贸', '周敏', 1420, 1300, 120, 39.6, 1.3, 38.3, 3.3, '正常'],
  ['天津鑫达供应', '赵鹏', 1180, 1060, 120, 32.8, 2.2, 30.6, 6.7, '关注'],
].map((item) => ({
  supplier: item[0] as string,
  buyer: item[1] as string,
  purchaseQty: item[2] as number,
  inQty: item[3] as number,
  pendingQty: item[4] as number,
  inAmount: item[5] as number,
  returnAmount: item[6] as number,
  netAmount: item[7] as number,
  returnRate: item[8] as number,
  risk: item[9] as string,
}));

const purchaseGoodsRows = [
  [
    'QJY-0001',
    '美孚速霸全合成 FM 5W',
    '5W-30 4L',
    'FM5W30',
    6240,
    5840,
    400,
    151,
    6.8,
    3,
    242,
  ],
  [
    'QJY-0002',
    '美孚速霸每日保护全合成',
    '5W-30 4L',
    'EP5W30',
    3920,
    3500,
    420,
    83,
    2.4,
    2,
    211.7,
  ],
  [
    'LTT-0018',
    '米其林轿车轮胎',
    '225/55R17',
    'MIC-225',
    1180,
    980,
    200,
    69.2,
    2.1,
    4,
    586.4,
  ],
  [
    'CY-0020',
    '壳牌灰壳超凡喜力',
    '0W-40 4L',
    'HELIX',
    1060,
    920,
    140,
    58.4,
    4.8,
    3,
    551,
  ],
  [
    'QJY-0041',
    '嘉实多磁护',
    '5W-40 4L',
    'MAG-5W40',
    680,
    680,
    0,
    54,
    2,
    2,
    794.1,
  ],
  [
    'YH-0071',
    '博世机油滤清器',
    'OF-2214',
    'BOS-2214',
    4260,
    3180,
    1080,
    46,
    2,
    1,
    108,
  ],
  [
    'YH-0088',
    '3M 玻璃水',
    '-25℃ 2L',
    '3M-GW25',
    3320,
    2952,
    368,
    24,
    1,
    1,
    72.3,
  ],
  [
    'LT-0245',
    '朝阳载重轮胎',
    '1200R20',
    'CY-1200',
    96,
    96,
    0,
    14,
    1,
    1,
    1458.3,
  ],
].map((item) => ({
  code: item[0] as string,
  name: item[1] as string,
  spec: item[2] as string,
  drawing: item[3] as string,
  purchaseQty: item[4] as number,
  inQty: item[5] as number,
  pendingQty: item[6] as number,
  purchaseAmount: item[7] as number,
  returnAmount: item[8] as number,
  supplierCount: item[9] as number,
  avgPrice: item[10] as number,
}));

const saleRows = [
  [
    '眉山市彭山区爱车人汽车服',
    '陈朝杰',
    860,
    24.9,
    1.2,
    23.7,
    20.8,
    2.9,
    12.2,
    8.6,
    '正常',
  ],
  [
    '彭山泽均修理厂',
    '李松',
    790,
    24.6,
    0.8,
    23.8,
    20.9,
    2.9,
    12.1,
    10.2,
    '正常',
  ],
  [
    '东坡区鑫悦祥汽车美容养护',
    '詹豪',
    680,
    20.6,
    2,
    18.6,
    16.9,
    1.7,
    9.1,
    18.4,
    '逾期',
  ],
  [
    '四川新鑫和信汽车服务有限',
    '陈朝杰',
    560,
    17.1,
    1.4,
    15.7,
    13.9,
    1.8,
    11.5,
    16.6,
    '逾期',
  ],
  [
    '眉山市车转角汽车服务有限',
    '李松',
    440,
    11.3,
    0.5,
    10.8,
    9.6,
    1.2,
    11.1,
    5.2,
    '正常',
  ],
  [
    '成都蓉耀汽车服务',
    '詹豪',
    410,
    10.6,
    1.1,
    9.5,
    8.9,
    0.6,
    6.3,
    12.7,
    '毛利偏低',
  ],
  ['乐山嘉汇轮胎服务', '陈朝杰', 360, 8.8, 0.2, 8.6, 7.4, 1.2, 14, 4.6, '正常'],
  ['资阳万顺汽车养护', '李松', 330, 7.5, 0.6, 6.9, 6.3, 0.6, 8.7, 7.8, '关注'],
  ['仁寿鑫通汽修', '詹豪', 290, 6.9, 0.4, 6.5, 5.8, 0.7, 10.8, 3.2, '正常'],
  ['夹江路安汽车服务', '陈朝杰', 260, 5.8, 0.3, 5.5, 5, 0.5, 9.1, 2.8, '正常'],
].map((item) => ({
  customer: item[0] as string,
  seller: item[1] as string,
  saleQty: item[2] as number,
  saleAmount: item[3] as number,
  returnAmount: item[4] as number,
  netAmount: item[5] as number,
  costAmount: item[6] as number,
  profitAmount: item[7] as number,
  profitRate: item[8] as number,
  receivable: item[9] as number,
  risk: item[10] as string,
}));

const saleGoodsRows = [
  [
    'QJY-0001',
    '美孚速霸全合成 FM 5W',
    '5W-30 4L',
    1240,
    15.1,
    0.6,
    14.5,
    12.6,
    1.9,
    13.1,
  ],
  [
    'QJY-0002',
    '美孚速霸每日保护全合成',
    '5W-30 4L',
    820,
    8.3,
    0.3,
    8,
    7.2,
    0.8,
    10,
  ],
  [
    'CY-0020',
    '美孚速霸全效保护 C5',
    '0W-30 4L',
    760,
    7.6,
    0.2,
    7.4,
    6.8,
    0.6,
    8.1,
  ],
  [
    'QJY-0041',
    '美孚速霸全合成 FM X3',
    '5W-40 4L',
    580,
    5.8,
    0.2,
    5.6,
    5,
    0.6,
    10.7,
  ],
  [
    'YH-0071',
    '美孚速霸全效保护 C3',
    '5W-30 4L',
    540,
    5.4,
    0.1,
    5.3,
    4.8,
    0.5,
    9.4,
  ],
].map((item) => ({
  code: item[0] as string,
  name: item[1] as string,
  spec: item[2] as string,
  saleQty: item[3] as number,
  saleAmount: item[4] as number,
  returnAmount: item[5] as number,
  netAmount: item[6] as number,
  costAmount: item[7] as number,
  profitAmount: item[8] as number,
  profitRate: item[9] as number,
}));

const stockRows = [
  [
    'QJY-0001',
    '美孚速霸全合成 FM 5W',
    '5W-30 4L',
    '油品',
    1860,
    45.2,
    640,
    520,
    42,
    2200,
    '正常',
  ],
  [
    'QJY-0002',
    '美孚速霸每日保护全合成',
    '5W-30 4L',
    '油品',
    920,
    20.8,
    420,
    380,
    36,
    1200,
    '正常',
  ],
  [
    'LTT-0018',
    '米其林轿车轮胎',
    '225/55R17',
    '轮胎',
    180,
    16.2,
    80,
    96,
    58,
    260,
    '低库存',
  ],
  [
    'CY-0020',
    '壳牌灰壳超凡喜力',
    '0W-40 4L',
    '油品',
    760,
    32.4,
    240,
    180,
    90,
    900,
    '低库存',
  ],
  [
    'YH-0071',
    '博世机油滤清器',
    'OF-2214',
    '易损件',
    0,
    0,
    310,
    426,
    12,
    280,
    '零库存',
  ],
  [
    'YH-0088',
    '3M 玻璃水',
    '-25℃ 2L',
    '养护耗材',
    -18,
    -0.2,
    880,
    920,
    0,
    200,
    '负库存',
  ],
  [
    'LT-0245',
    '朝阳载重轮胎',
    '1200R20',
    '轮胎',
    96,
    14,
    0,
    12,
    186,
    160,
    '低库存',
  ],
  [
    'YH-0102',
    '曼牌空气滤芯',
    'C-2841',
    '易损件',
    124,
    1.2,
    160,
    210,
    24,
    180,
    '低库存',
  ],
].map((item) => ({
  code: item[0] as string,
  name: item[1] as string,
  spec: item[2] as string,
  category: item[3] as string,
  stockQty: item[4] as number,
  stockAmount: item[5] as number,
  inQty: item[6] as number,
  outQty: item[7] as number,
  turnoverDays: item[8] as number,
  safeStock: item[9] as number,
  risk: item[10] as string,
}));

const configs: Record<ReportKey, ReportConfig> = {
  purchase: {
    badge: '采购 · 入库 · 退货',
    detailTitle: '采购报表明细',
    filterKeyword: '编码 / 名称 / 图号',
    filters: ['全部供应商', '全部部门', '全部采购员'],
    insightTitle: '供应商采购洞察',
    name: '采购复盘',
    note: '当前采购看板优先使用系统分析接口；接口数据仍为非正式驾驶舱参考，接口未覆盖或加载失败时保留静态占位（演示），仅用于第一阶段页面联调。',
    tableDefaultDim: '按供应商',
    kpis: [
      {
        label: '采购金额',
        value: '1,286,420.00',
        meta: '较上期 +8.6%',
        tone: 'good',
      },
      {
        label: '入库数量',
        value: '38,926',
        meta: '已入库率 91.4%',
        tone: 'normal',
      },
      {
        label: '未入数量',
        value: '3,648',
        meta: '在途订单 42 单',
        tone: 'warn',
      },
      {
        label: '采购退货',
        value: '72,310.00',
        meta: '退货率 5.6%',
        tone: 'danger',
      },
      {
        label: '采购净额',
        value: '1,214,110.00',
        meta: '沉淀库存 94.4%',
        tone: 'good',
      },
    ],
    formulas: [
      {
        label: '采购净额',
        text: '入库金额 128.6 万 - 退货金额 7.2 万 = 121.4 万',
        tone: 'good',
      },
      { label: '入库率', text: '已入库数量 38,926 / 采购数量 42,574 = 91.4%' },
      {
        label: '未入数量',
        text: '采购数量 42,574 - 已入库数量 38,926 = 3,648',
        tone: 'warn',
      },
      {
        label: '退货率',
        text: '采购退货金额 7.2 万 / 入库金额 128.6 万 = 5.6%',
        tone: 'danger',
      },
      {
        label: '供应商集中',
        text: '前 3 大供应商采购净额占比 54%',
        tone: 'warn',
      },
      {
        label: '价格波动',
        text: '7 个商品平均采购价较上期波动超过 10%',
        tone: 'warn',
      },
      {
        label: '在途风险',
        text: '未入数量超过 500 的商品 2 个，建议催交',
        tone: 'danger',
      },
      {
        label: '部门结构',
        text: '油品采购部占采购净额 52.9%，轮胎采购部占 25.0%',
      },
    ],
    insights: [
      {
        title: '供应商采购排行',
        items: [
          { name: '上海恒驰配件', value: '273.6 万', meta: '占 22.5% · 42 单' },
          { name: '南京华成汽配', value: '226.5 万', meta: '占 18.7% · 36 单' },
          {
            name: '苏州森联供应链',
            value: '160.3 万',
            meta: '占 13.2% · 31 单',
            tone: 'danger',
          },
          { name: '杭州万向渠道', value: '132.8 万', meta: '占 10.9% · 28 单' },
        ],
      },
      {
        title: '高风险对象',
        items: [
          {
            name: '苏州森联供应链',
            value: '退货率 10.4%',
            meta: '高于阈值',
            tone: 'danger',
          },
          {
            name: '博世机油滤清器',
            value: '未入 1,080',
            meta: '待催交',
            tone: 'warn',
          },
          { name: '油品采购部', value: '64.2 万', meta: '采购占比最高' },
        ],
      },
      {
        title: 'TOP 商品',
        items: [
          { name: '美孚速霸全合成 FM 5W', value: '151.0 万' },
          { name: '美孚速霸每日保护全合成', value: '83.0 万' },
          { name: '米其林轿车轮胎', value: '69.2 万' },
        ],
      },
    ],
    rank: {
      title: '供应商采购排行',
      modes: [
        { label: '净额', key: 'netAmount' },
        { label: '采购额', key: 'inAmount' },
        { label: '退货', key: 'returnAmount' },
        { label: '未入', key: 'pendingQty' },
      ],
      items: purchaseRows.map((item) => ({
        count: `${Math.round(Number(item.purchaseQty) / 300)} 单`,
        name: item.supplier,
        values: {
          inAmount: item.inAmount,
          netAmount: item.netAmount,
          pendingQty: item.pendingQty,
          returnAmount: item.returnAmount,
        },
      })),
    },
    trend: {
      title: '采购金额与入库趋势',
      lines: [
        {
          color: '#0b3b6f',
          key: 'purchase',
          label: '采购金额',
          strokeWidth: 3,
        },
        { color: '#e0ac5f', key: 'inbound', label: '入库金额', strokeWidth: 3 },
        { color: '#a8422f', key: 'return', label: '退货金额', strokeWidth: 2 },
        { color: '#2e6b4f', key: 'net', label: '采购净额', strokeWidth: 2 },
      ],
      points: [
        ['09-01', 38, 31, 1.2, 29.8],
        ['09-04', 44, 39, 2.8, 36.2],
        ['09-07', 32, 28, 1.4, 26.6],
        ['09-10', 61, 52, 5.4, 46.6],
        ['09-13', 73, 68, 4.6, 63.4],
        ['09-16', 58, 49, 2.1, 46.9],
        ['09-19', 82, 77, 6.2, 70.8],
        ['09-22', 96, 85, 7.6, 77.4],
        ['09-25', 88, 81, 3.4, 77.6],
        ['09-28', 101, 92, 8.1, 83.9],
      ].map(([label, purchase, inbound, ret, net]) => ({
        label: label as string,
        values: {
          inbound: inbound as number,
          net: net as number,
          purchase: purchase as number,
          return: ret as number,
        },
      })),
    },
    dims: {
      按供应商: {
        title: '按供应商明细',
        rows: purchaseRows,
        columns: [
          { key: 'supplier', label: '供应商', width: 190 },
          { key: 'buyer', label: '采购员' },
          {
            align: 'right',
            key: 'purchaseQty',
            label: '采购数量',
            quantity: true,
          },
          { align: 'right', key: 'inQty', label: '入库数量', quantity: true },
          {
            align: 'right',
            key: 'pendingQty',
            label: '未入数量',
            quantity: true,
          },
          { align: 'right', key: 'inAmount', label: '入库金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '采购净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'returnRate', label: '退货率', percent: true },
          { align: 'center', key: 'risk', label: '风险', tag: true },
        ],
      },
      按商品: {
        title: '按商品明细',
        rows: purchaseGoodsRows,
        columns: [
          { key: 'code', label: '商品编码', width: 120 },
          { key: 'name', label: '商品名称', width: 210 },
          { key: 'spec', label: '规格型号', width: 120 },
          { key: 'drawing', label: '图号', width: 120 },
          {
            align: 'right',
            key: 'purchaseQty',
            label: '采购数量',
            quantity: true,
          },
          { align: 'right', key: 'inQty', label: '入库数量', quantity: true },
          {
            align: 'right',
            key: 'pendingQty',
            label: '未入数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'purchaseAmount',
            label: '采购金额',
            money: true,
            strong: true,
          },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'supplierCount',
            label: '供应商数',
            quantity: true,
          },
          { align: 'right', key: 'avgPrice', label: '平均采购价', money: true },
        ],
      },
      按部门: {
        title: '按部门明细',
        rows: [
          {
            buyerCount: 2,
            dept: '油品采购部',
            docCount: 84,
            inAmount: 68.4,
            netAmount: 64.2,
            purchaseQty: 24_680,
            returnAmount: 4.2,
            supplierCount: 6,
          },
          {
            buyerCount: 1,
            dept: '轮胎采购部',
            docCount: 36,
            inAmount: 31.2,
            netAmount: 30.3,
            purchaseQty: 4620,
            returnAmount: 0.9,
            supplierCount: 4,
          },
          {
            buyerCount: 2,
            dept: '综合采购部',
            docCount: 52,
            inAmount: 29,
            netAmount: 26.9,
            purchaseQty: 13_274,
            returnAmount: 2.1,
            supplierCount: 5,
          },
        ],
        columns: [
          { key: 'dept', label: '部门', width: 160 },
          {
            align: 'right',
            key: 'buyerCount',
            label: '采购员数',
            quantity: true,
          },
          {
            align: 'right',
            key: 'supplierCount',
            label: '供应商数',
            quantity: true,
          },
          {
            align: 'right',
            key: 'purchaseQty',
            label: '采购数量',
            quantity: true,
          },
          { align: 'right', key: 'inAmount', label: '入库金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '采购净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'docCount', label: '单据数', quantity: true },
        ],
      },
      按单据: {
        title: '按单据明细',
        rows: Array.from({ length: 18 }, (_, index) => ({
          buyer: ['陈立', '周敏', '赵鹏'][index % 3]!,
          date: `2026-09-${String(28 - (index % 18)).padStart(2, '0')}`,
          dept: ['油品采购部', '轮胎采购部', '综合采购部'][index % 3]!,
          docNo: `${index % 5 === 0 ? 'CTH' : 'CRK'}-2609${String(100 + index)}`,
          inAmount: index % 5 === 0 ? 0 : 2.8 + index * 0.6,
          lineCount: (index % 7) + 1,
          netAmount: index % 5 === 0 ? -(0.8 + index * 0.3) : 2.8 + index * 0.6,
          qty: 80 + index * 64,
          returnAmount: index % 5 === 0 ? 0.8 + index * 0.3 : 0,
          supplier: purchaseRows[index % purchaseRows.length]!.supplier,
          type: index % 5 === 0 ? '采购退货' : '采购入库',
        })),
        columns: [
          { align: 'center', key: 'type', label: '单据类型', tag: true },
          { key: 'date', label: '单据日期', width: 120 },
          { key: 'docNo', label: '单据号', link: true, width: 150 },
          { key: 'supplier', label: '供应商', width: 190 },
          { key: 'dept', label: '部门', width: 120 },
          { key: 'buyer', label: '采购员' },
          { align: 'right', key: 'lineCount', label: '商品数', quantity: true },
          { align: 'right', key: 'qty', label: '业务数量', quantity: true },
          { align: 'right', key: 'inAmount', label: '入库金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '采购净额',
            money: true,
            strong: true,
          },
        ],
      },
    },
  },
  sale: {
    badge: '销售 · 毛利 · 客户',
    detailTitle: '销售报表明细',
    filterKeyword: '客户 / 编码 / 名称',
    filters: ['全部客户', '全部部门', '全部业务员'],
    insightTitle: '销售经营洞察',
    name: '销售复盘',
    note: '当前销售看板用于页面效果和筛选联调；毛利额/毛利率口径待确认，客户流失、回款率、排行等公式及配置版本未确认前，不作为正式经营指标。',
    tableDefaultDim: '按客户',
    kpis: [
      {
        label: '销售金额',
        value: '2,900,000.00',
        meta: '同比 +52%',
        tone: 'good',
      },
      {
        label: '销售净额',
        value: '2,728,000.00',
        meta: '扣退货后 94.1%',
        tone: 'good',
      },
      { label: '毛利额', value: '待配置', meta: '毛利率口径待确认', tone: 'warn' },
      { label: '客户数', value: '110', meta: '新客 41 户', tone: 'good' },
      {
        label: '应收余额',
        value: '1,060,000.00',
        meta: '逾期 49.5 万',
        tone: 'warn',
      },
    ],
    formulas: [
      {
        label: '毛利率',
        text: '毛利额、财务成本、部门结算成本和退货冲回口径需确认配置版本后启用。',
        tone: 'warn',
      },
      {
        label: '销售净额',
        text: '销售出库 290.0 万 - 销售退货 17.2 万 = 272.8 万',
        tone: 'good',
      },
      {
        label: '同比',
        text: '本期 272.8 万 / 去年同期 179.5 万 - 1 = +52%',
        tone: 'good',
      },
      {
        label: '客户流失',
        text: '老客 178 家中近 2 月未复购 111 家 = 62%',
        tone: 'danger',
      },
      {
        label: '欠款逾期',
        text: '逾期 49.5 万 / 净应收 106.0 万 = 47%',
        tone: 'danger',
      },
      {
        label: '客单价',
        text: '销售净额 272.8 万 / 成交客户 110 户 = 2.5 万/户',
      },
      {
        label: '品类结构',
        text: '汽机油 73%，汽车轮胎 21%，柴油 4%',
        tone: 'warn',
      },
      { label: '新客贡献', text: '本期新客 41 户，占销售 33%', tone: 'good' },
    ],
    insights: [
      {
        title: '战略品牌',
        items: [
          { name: '美孚', value: '221.3 万', meta: '占 78% · 96 户' },
          { name: '路极', value: '29.3 万', meta: '占 10% · 25 户' },
          { name: '液体黄金', value: '18.0 万', meta: '占 6% · 9 户' },
          {
            name: '自有(路通源)',
            value: '1.6 万',
            meta: '占 1% · 11 户',
            tone: 'warn',
          },
        ],
      },
      {
        title: 'TOP 业务员',
        items: [
          { name: '陈朝杰', value: '240.1 万' },
          { name: '李松', value: '21.0 万' },
          { name: '詹豪', value: '3.6 万', tone: 'warn' },
        ],
      },
      {
        title: 'TOP 客户',
        items: saleRows
          .slice(0, 5)
          .map((item) => ({
            name: item.customer,
            value: `${item.netAmount.toFixed(1)} 万`,
          })),
      },
    ],
    rank: {
      title: '客户销售排行',
      modes: [
        { label: '净额', key: 'netAmount' },
        { label: '销售额', key: 'saleAmount' },
        { label: '退货', key: 'returnAmount' },
      ],
      items: saleRows.map((item) => ({
        count: `${Math.round(item.saleQty / 12)} 单`,
        name: item.customer,
        values: {
          netAmount: item.netAmount,
          saleAmount: item.saleAmount,
          returnAmount: item.returnAmount,
        },
      })),
    },
    trend: {
      title: '销售金额与毛利趋势',
      lines: [
        { color: '#0b3b6f', key: 'sales', label: '销售金额', strokeWidth: 3 },
        { color: '#2e6b4f', key: 'profit', label: '毛利额', strokeWidth: 3 },
        { color: '#a8422f', key: 'return', label: '退货金额', strokeWidth: 2 },
        { color: '#4e8ad0', key: 'net', label: '销售净额', strokeWidth: 2 },
      ],
      points: [
        ['09-01', 82, 7.9, 3.1, 78.9],
        ['09-04', 96, 9.2, 4.4, 91.6],
        ['09-07', 74, 6.8, 2.6, 71.4],
        ['09-10', 112, 11.1, 7.1, 104.9],
        ['09-13', 136, 14.2, 8.6, 127.4],
        ['09-16', 128, 13.4, 6.5, 121.5],
        ['09-19', 154, 16.1, 10.4, 143.6],
        ['09-22', 183, 18.6, 9.8, 173.2],
        ['09-25', 166, 17.2, 8.3, 157.7],
        ['09-28', 194, 20.4, 12.1, 181.9],
      ].map(([label, sales, profit, ret, net]) => ({
        label: label as string,
        values: {
          net: net as number,
          profit: profit as number,
          return: ret as number,
          sales: sales as number,
        },
      })),
    },
    dims: {
      按客户: {
        title: '按客户明细',
        rows: saleRows,
        columns: [
          { key: 'customer', label: '客户', width: 220 },
          { key: 'seller', label: '业务员' },
          { align: 'right', key: 'saleQty', label: '销售数量', quantity: true },
          { align: 'right', key: 'saleAmount', label: '销售金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '销售净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'costAmount', label: '成本金额', money: true },
          { align: 'right', key: 'profitAmount', label: '毛利额', money: true },
          { align: 'right', key: 'profitRate', label: '毛利率', percent: true },
          { align: 'right', key: 'receivable', label: '应收余额', money: true },
          { align: 'center', key: 'risk', label: '风险', tag: true },
        ],
      },
      按商品: {
        title: '按商品明细',
        rows: saleGoodsRows,
        columns: [
          { key: 'code', label: '商品编码', width: 120 },
          { key: 'name', label: '商品名称', width: 220 },
          { key: 'spec', label: '规格型号', width: 120 },
          { align: 'right', key: 'saleQty', label: '销售数量', quantity: true },
          { align: 'right', key: 'saleAmount', label: '销售金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '销售净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'costAmount', label: '成本金额', money: true },
          { align: 'right', key: 'profitAmount', label: '毛利额', money: true },
          { align: 'right', key: 'profitRate', label: '毛利率', percent: true },
        ],
      },
      按业务员: {
        title: '按业务员明细',
        rows: [
          {
            customerCount: 82,
            dept: '大客户部',
            netAmount: 240.1,
            profitAmount: 24.9,
            profitRate: 10.4,
            receivable: 72.6,
            returnAmount: 12.1,
            seller: '陈朝杰',
          },
          {
            customerCount: 19,
            dept: '华东销售一部',
            netAmount: 21,
            profitAmount: 2.4,
            profitRate: 11.4,
            receivable: 18.1,
            returnAmount: 3.2,
            seller: '李松',
          },
          {
            customerCount: 9,
            dept: '华东销售二部',
            netAmount: 3.6,
            profitAmount: 0.8,
            profitRate: 22.2,
            receivable: 4.9,
            returnAmount: 1,
            seller: '詹豪',
          },
        ],
        columns: [
          { key: 'seller', label: '业务员' },
          { key: 'dept', label: '部门', width: 140 },
          {
            align: 'right',
            key: 'customerCount',
            label: '客户数',
            quantity: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '销售净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'profitAmount', label: '毛利额', money: true },
          { align: 'right', key: 'profitRate', label: '毛利率', percent: true },
          { align: 'right', key: 'receivable', label: '应收余额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
        ],
      },
      按部门: {
        title: '按部门明细',
        rows: [
          {
            customerCount: 82,
            dept: '大客户部',
            netAmount: 240.1,
            profitAmount: 24.9,
            profitRate: 10.4,
            sellerCount: 1,
          },
          {
            customerCount: 19,
            dept: '华东销售一部',
            netAmount: 21,
            profitAmount: 2.4,
            profitRate: 11.4,
            sellerCount: 1,
          },
          {
            customerCount: 9,
            dept: '华东销售二部',
            netAmount: 3.6,
            profitAmount: 0.8,
            profitRate: 22.2,
            sellerCount: 1,
          },
        ],
        columns: [
          { key: 'dept', label: '部门', width: 160 },
          {
            align: 'right',
            key: 'sellerCount',
            label: '业务员数',
            quantity: true,
          },
          {
            align: 'right',
            key: 'customerCount',
            label: '客户数',
            quantity: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '销售净额',
            money: true,
            strong: true,
          },
          { align: 'right', key: 'profitAmount', label: '毛利额', money: true },
          { align: 'right', key: 'profitRate', label: '毛利率', percent: true },
        ],
      },
      按单据: {
        title: '按单据明细',
        rows: Array.from({ length: 22 }, (_, index) => ({
          customer: saleRows[index % saleRows.length]!.customer,
          date: `2026-09-${String(28 - (index % 20)).padStart(2, '0')}`,
          dept: ['大客户部', '华东销售一部', '华东销售二部'][index % 3]!,
          docNo: `${index % 6 === 0 ? 'XTH' : 'XCK'}-2609${String(100 + index)}`,
          lineCount: (index % 8) + 1,
          netAmount: index % 6 === 0 ? -(0.6 + index * 0.2) : 3.2 + index * 0.5,
          returnAmount: index % 6 === 0 ? 0.6 + index * 0.2 : 0,
          saleAmount: index % 6 === 0 ? 0 : 3.2 + index * 0.5,
          seller: ['陈朝杰', '李松', '詹豪'][index % 3]!,
          type: index % 6 === 0 ? '销售退货' : '销售出库',
        })),
        columns: [
          { align: 'center', key: 'type', label: '单据类型', tag: true },
          { key: 'date', label: '单据日期', width: 120 },
          { key: 'docNo', label: '单据号', link: true, width: 150 },
          { key: 'customer', label: '客户', width: 220 },
          { key: 'dept', label: '部门', width: 130 },
          { key: 'seller', label: '业务员' },
          { align: 'right', key: 'lineCount', label: '商品数', quantity: true },
          { align: 'right', key: 'saleAmount', label: '销售金额', money: true },
          {
            align: 'right',
            key: 'returnAmount',
            label: '退货金额',
            money: true,
          },
          {
            align: 'right',
            key: 'netAmount',
            label: '销售净额',
            money: true,
            strong: true,
          },
        ],
      },
    },
  },
  stock: {
    badge: '库存 · 周转 · 风险',
    detailTitle: '库存报表明细',
    filterKeyword: '编码 / 名称 / 规格',
    filters: ['全部仓库', '全部分类', '全部状态'],
    insightTitle: '库存风险洞察',
    name: '库存复盘',
    note: '库存余额、出入库趋势、仓库/分类/商品分布和低库存风险优先使用系统分析接口；呆滞、周转和库存成本口径待确认，接口数据仍为非正式驾驶舱参考。',
    tableDefaultDim: '按商品',
    kpis: [
      {
        label: '库存金额',
        value: '3,268,000.00',
        meta: '较期初 +27.2 万',
        tone: 'warn',
      },
      {
        label: '库存数量',
        value: '86,420',
        meta: 'SKU 1,426 个',
        tone: 'normal',
      },
      {
        label: '入库数量',
        value: '38,926',
        meta: '入库金额 132.8 万',
        tone: 'good',
      },
      {
        label: '出库数量',
        value: '34,580',
        meta: '出库成本 105.6 万',
        tone: 'normal',
      },
      {
        label: '风险 SKU',
        value: '66',
        meta: '低库存 46 · 零/负 20',
        tone: 'danger',
      },
    ],
    formulas: [
      {
        label: '库存金额',
        text: '当前库存数量 86,420 * 成本价汇总 = 326.8 万',
        tone: 'warn',
      },
      {
        label: '库存净变化',
        text: '入库数量 38,926 - 出库数量 34,580 = +4,346',
        tone: 'good',
      },
      {
        label: '周转天数',
        text: '周转天数口径待确认，当前为占位展示。',
        tone: 'warn',
      },
      {
        label: '低库存 SKU',
        text: '当前库存低于安全库存的商品 46 个',
        tone: 'danger',
      },
      {
        label: '零库存 SKU',
        text: '当前库存数量等于 0 的商品 SKU',
        tone: 'danger',
      },
      {
        label: '呆滞库存',
        text: '呆滞库存口径待确认，当前为占位展示。',
        tone: 'warn',
      },
      { label: '仓库集中', text: '前 3 个仓库库存金额占比 72%', tone: 'warn' },
      {
        label: '负库存',
        text: '当前库存数量小于 0 的商品 2 个',
        tone: 'danger',
      },
    ],
    insights: [
      {
        title: '仓库分布',
        items: [
          { name: '主仓', value: '142.6 万', meta: '占 43.6% · 682 SKU' },
          { name: '成都仓', value: '86.4 万', meta: '占 26.4% · 392 SKU' },
          { name: '眉山仓', value: '42.7 万', meta: '占 13.1% · 188 SKU' },
          {
            name: '退货仓',
            value: '18.9 万',
            meta: '占 5.8% · 74 SKU',
            tone: 'warn',
          },
        ],
      },
      {
        title: '库存风险',
        items: [
          {
            name: '博世机油滤清器',
            value: '零库存',
            meta: '近 30 日出库 426',
            tone: 'danger',
          },
          {
            name: '3M 玻璃水',
            value: '负库存 -18',
            meta: '需校正流水',
            tone: 'danger',
          },
          {
            name: '朝阳载重轮胎',
            value: '低库存',
            meta: '示例占位',
            tone: 'warn',
          },
        ],
      },
      {
        title: '金额 TOP 商品',
        items: stockRows
          .slice(0, 5)
          .map((item) => ({
            name: item.name,
            value: `${item.stockAmount.toFixed(1)} 万`,
            meta: item.risk,
          })),
      },
    ],
    rank: {
      title: '仓库库存分布',
      modes: [
        { label: '金额', key: 'stockAmount' },
        { label: '数量', key: 'stockQty' },
        { label: '低库存', key: 'lowStock' },
      ],
      items: [
        {
          count: '682 SKU',
          name: '主仓',
          values: { lowStock: 18, stockAmount: 142.6, stockQty: 38_240 },
        },
        {
          count: '392 SKU',
          name: '成都仓',
          values: { lowStock: 12, stockAmount: 86.4, stockQty: 21_580 },
        },
        {
          count: '188 SKU',
          name: '眉山仓',
          values: { lowStock: 9, stockAmount: 42.7, stockQty: 12_460 },
        },
        {
          count: '74 SKU',
          name: '退货仓',
          values: { lowStock: 4, stockAmount: 18.9, stockQty: 5280 },
        },
        {
          count: '90 SKU',
          name: '调拨仓',
          values: { lowStock: 3, stockAmount: 16.2, stockQty: 4860 },
        },
      ],
    },
    trend: {
      title: '库存出入库与结存趋势',
      lines: [
        { color: '#2e6b4f', key: 'inQty', label: '入库数量', strokeWidth: 3 },
        { color: '#e0ac5f', key: 'outQty', label: '出库数量', strokeWidth: 3 },
        {
          color: '#0b3b6f',
          key: 'stockQty',
          label: '结存数量',
          strokeWidth: 2,
        },
      ],
      points: [
        ['09-01', 1210, 940, 80_900],
        ['09-04', 1480, 1180, 81_860],
        ['09-07', 1040, 1300, 81_240],
        ['09-10', 1660, 1260, 82_620],
        ['09-13', 1840, 1420, 83_460],
        ['09-16', 1320, 1680, 82_910],
        ['09-19', 2010, 1560, 84_130],
        ['09-22', 2280, 1740, 85_360],
        ['09-25', 1760, 1900, 85_020],
        ['09-28', 2380, 1960, 86_420],
      ].map(([label, inQty, outQty, stockQty]) => ({
        label: label as string,
        values: {
          inQty: inQty as number,
          outQty: outQty as number,
          stockQty: stockQty as number,
        },
      })),
    },
    dims: {
      按商品: {
        title: '按商品明细',
        rows: stockRows,
        columns: [
          { key: 'code', label: '商品编码', width: 120 },
          { key: 'name', label: '商品名称', width: 220 },
          { key: 'spec', label: '规格型号', width: 130 },
          { key: 'category', label: '分类' },
          {
            align: 'right',
            key: 'stockQty',
            label: '当前库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'stockAmount',
            label: '库存金额',
            money: true,
            strong: true,
          },
          {
            align: 'right',
            key: 'availableQty',
            label: '可用库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'occupiedQty',
            label: '占用数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'inTransitQty',
            label: '在途数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'safeStock',
            label: '安全库存',
            quantity: true,
          },
          { align: 'center', key: 'risk', label: '风险', tag: true },
        ],
      },
      按仓库: {
        title: '按仓库明细',
        rows: [
          {
            lowStock: 18,
            name: '主仓',
            outQty: 18_320,
            sku: 682,
            stockAmount: 142.6,
            stockQty: 38_240,
            staleSku: 8,
          },
          {
            lowStock: 12,
            name: '成都仓',
            outQty: 8240,
            sku: 392,
            stockAmount: 86.4,
            stockQty: 21_580,
            staleSku: 5,
          },
          {
            lowStock: 9,
            name: '眉山仓',
            outQty: 4860,
            sku: 188,
            stockAmount: 42.7,
            stockQty: 12_460,
            staleSku: 4,
          },
          {
            lowStock: 4,
            name: '退货仓',
            outQty: 1200,
            sku: 74,
            stockAmount: 18.9,
            stockQty: 5280,
            staleSku: 6,
          },
        ],
        columns: [
          { key: 'name', label: '仓库' },
          { align: 'right', key: 'sku', label: 'SKU 数', quantity: true },
          {
            align: 'right',
            key: 'stockQty',
            label: '库存数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'stockAmount',
            label: '库存金额',
            money: true,
            strong: true,
          },
          {
            align: 'right',
            key: 'lowStock',
            label: '低库存 SKU',
            quantity: true,
          },
          {
            align: 'right',
            key: 'availableQty',
            label: '可用库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'inTransitQty',
            label: '在途数量',
            quantity: true,
          },
        ],
      },
      按分类: {
        title: '按分类明细',
        rows: [
          {
            category: '油品',
            lowStock: 18,
            sku: 720,
            stockAmount: 194.2,
            stockQty: 48_620,
            staleSku: 8,
          },
          {
            category: '轮胎',
            lowStock: 12,
            sku: 218,
            stockAmount: 58.9,
            stockQty: 4860,
            staleSku: 7,
          },
          {
            category: '易损件',
            lowStock: 14,
            sku: 356,
            stockAmount: 42.8,
            stockQty: 18_940,
            staleSku: 4,
          },
          {
            category: '养护耗材',
            lowStock: 2,
            sku: 132,
            stockAmount: 30.9,
            stockQty: 13_820,
            staleSku: 1,
          },
        ],
        columns: [
          { key: 'category', label: '商品分类' },
          { align: 'right', key: 'sku', label: 'SKU 数', quantity: true },
          {
            align: 'right',
            key: 'stockQty',
            label: '库存数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'stockAmount',
            label: '库存金额',
            money: true,
            strong: true,
          },
          {
            align: 'right',
            key: 'lowStock',
            label: '低库存 SKU',
            quantity: true,
          },
          {
            align: 'right',
            key: 'availableQty',
            label: '可用库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'inTransitQty',
            label: '在途数量',
            quantity: true,
          },
        ],
      },
      出入库流水: {
        title: '出入库流水明细',
        rows: Array.from({ length: 24 }, (_, index) => ({
          balanceAmount: 326.8 - index * 1.6,
          balanceQty: 86_420 - index * 120,
          code: stockRows[index % stockRows.length]!.code,
          date: `2026-09-${String(28 - (index % 20)).padStart(2, '0')}`,
          docNo: `${index % 2 === 0 ? 'CRK' : 'XCK'}-2609${String(100 + index)}`,
          inAmount: index % 2 === 0 ? 2.6 + index * 0.2 : 0,
          inQty: index % 2 === 0 ? 80 + index * 16 : 0,
          name: stockRows[index % stockRows.length]!.name,
          outAmount: index % 2 === 0 ? 0 : 1.9 + index * 0.2,
          outQty: index % 2 === 0 ? 0 : 60 + index * 14,
          spec: stockRows[index % stockRows.length]!.spec,
          type: index % 2 === 0 ? '采购入库' : '销售出库',
          warehouse: ['主仓', '成都仓', '眉山仓'][index % 3]!,
        })),
        columns: [
          { key: 'date', label: '单据日期', width: 120 },
          { align: 'center', key: 'type', label: '单据类型', tag: true },
          { key: 'docNo', label: '单据号', link: true, width: 150 },
          { key: 'warehouse', label: '仓库' },
          { key: 'code', label: '商品编码', width: 120 },
          { key: 'name', label: '商品名称', width: 220 },
          { align: 'right', key: 'inQty', label: '入库数量', quantity: true },
          { align: 'right', key: 'outQty', label: '出库数量', quantity: true },
          {
            align: 'right',
            key: 'balanceQty',
            label: '结存数量',
            quantity: true,
          },
          { align: 'right', key: 'inAmount', label: '入库金额', money: true },
          { align: 'right', key: 'outAmount', label: '出库金额', money: true },
          {
            align: 'right',
            key: 'balanceAmount',
            label: '结存金额',
            money: true,
            strong: true,
          },
        ],
      },
      '低库存/风险': {
        title: '低库存 / 零库存 / 负库存清单',
        rows: [
          {
            code: 'YH-0071',
            currentQty: 0,
            gapQty: 280,
            lastOutDate: '2026-09-26',
            name: '博世机油滤清器',
            risk: '零库存',
            safeStock: 280,
            staleDays: 0,
            stockAmount: 0,
            warehouse: '主仓',
          },
          {
            code: 'YH-0088',
            currentQty: -18,
            gapQty: 218,
            lastOutDate: '2026-09-28',
            name: '3M 玻璃水',
            risk: '负库存',
            safeStock: 200,
            staleDays: 0,
            stockAmount: -0.2,
            warehouse: '成都仓',
          },
          {
            code: 'LT-0245',
            currentQty: 96,
            gapQty: 0,
            lastOutDate: '-',
            name: '朝阳载重轮胎',
            risk: '低库存',
            safeStock: 160,
            staleDays: 0,
            stockAmount: 14,
            warehouse: '眉山仓',
          },
          {
            code: 'LTT-0018',
            currentQty: 180,
            gapQty: 80,
            lastOutDate: '2026-09-22',
            name: '米其林轿车轮胎',
            risk: '低库存',
            safeStock: 260,
            staleDays: 6,
            stockAmount: 16.2,
            warehouse: '主仓',
          },
          {
            code: 'CY-0020',
            currentQty: 760,
            gapQty: 140,
            lastOutDate: '-',
            name: '壳牌灰壳超凡喜力',
            risk: '低库存',
            safeStock: 900,
            staleDays: 0,
            stockAmount: 32.4,
            warehouse: '退货仓',
          },
        ],
        columns: [
          { align: 'center', key: 'risk', label: '风险类型', tag: true },
          { key: 'code', label: '商品编码', width: 120 },
          { key: 'name', label: '商品名称', width: 220 },
          { key: 'warehouse', label: '仓库' },
          {
            align: 'right',
            key: 'currentQty',
            label: '当前库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'safeStock',
            label: '安全库存',
            quantity: true,
          },
          { align: 'right', key: 'gapQty', label: '缺口数量', quantity: true },
          {
            align: 'right',
            key: 'availableQty',
            label: '可用库存',
            quantity: true,
          },
          {
            align: 'right',
            key: 'occupiedQty',
            label: '占用数量',
            quantity: true,
          },
          {
            align: 'right',
            key: 'stockAmount',
            label: '库存金额',
            money: true,
            strong: true,
          },
        ],
      },
    },
  },
};

const activeReport = ref<ReportKey>('purchase');
const states = reactive<Record<ReportKey, ReportState>>({
  purchase: createState(configs.purchase),
  sale: createState(configs.sale),
  stock: createState(configs.stock),
});
const runtimeData = reactive<Record<ReportKey, RuntimeReportData>>({
  purchase: {
    loaded: false,
    options: {},
    pageTotal: 0,
    rank: [],
    rows: [],
    trend: [],
  },
  sale: {
    loaded: false,
    options: {},
    pageTotal: 0,
    rank: [],
    rows: [],
    trend: [],
  },
  stock: {
    loaded: false,
    options: {},
    pageTotal: 0,
    rank: [],
    rows: [],
    trend: [],
  },
});

const cockpitReadiness = [
  {
    title: '部门利润',
    status: '待汇总',
    description:
      '需汇集外销毛利、本级调拨利润、直接费用、分摊费用、库存及调账损益和其他经营收支。',
  },
  {
    title: '公司抵销',
    status: '待核算',
    description:
      '需按对外收入与财务成本计算公司利润，并展示内部收入成本抵销、未实现利润抵销和已实现利润调整。',
  },
  {
    title: '目标与下钻',
    status: '待配置',
    description:
      '正式驾驶舱指标、目标配置和下钻明细需复用已验收的数据服务；未配置正式指标时必须显示不可用原因，本页暂以边界说明代替正式不可用原因服务。',
  },
  {
    title: '当前展示数据',
    status: '接口联调',
    description:
      '采购、销售、库存看板优先使用系统分析接口；接口数据标记为“接口数据（非正式驾驶舱）”，接口未加载成功时标记为“静态占位（演示）”，只用于页面联调展示。',
  },
  {
    title: '排行边界',
    status: '非正式参考',
    description:
      '当前排行榜只按系统分析接口字段或静态占位排序，不作为正式部门利润排行、公司利润排行或目标评分排行。',
  },
  {
    title: '只读线索来源',
    status: '已接入参考',
    description:
      '资金、往来、费用、发票凭证、固定资产边界和异常审计已接入第一阶段只读页签，可作为驾驶舱后续下钻参考，暂不汇入正式利润、评分或排行榜。',
  },
];
const loading = ref(false);
let requestSeq = 0;

const { hasAccessByCodes } = useAccess();
const canExport = computed(() =>
  hasAccessByCodes(['erp:system-report:export']),
);
const report = computed(() =>
  hydrateReport(activeReport.value, configs[activeReport.value]),
);
const state = computed(() => states[activeReport.value]);
const emptyTableDim: TableDim = { columns: [], rows: [], title: '' };
const tableDim = computed<TableDim>(
  () =>
    report.value.dims[state.value.dim] ||
    report.value.dims[report.value.tableDefaultDim] ||
    emptyTableDim,
);
const visibleColumns = computed(() =>
  tableDim.value.columns.filter((column) => !state.value.hidden[column.key]),
);
const sortedRows = computed(() => {
  const rows = [...tableDim.value.rows];
  const { sortDir, sortKey } = state.value;
  if (!sortKey) return rows;
  return rows.toSorted(
    (a, b) =>
      compareValue(a[sortKey], b[sortKey]) * (sortDir === 'asc' ? 1 : -1),
  );
});
const pagedRows = computed(() => {
  if (runtimeData[activeReport.value].rows.length > 0) {
    return sortedRows.value;
  }
  const start = (state.value.page - 1) * rowsPerPage;
  return sortedRows.value.slice(start, start + rowsPerPage);
});
const pageTotal = computed(
  () => runtimeData[activeReport.value].pageTotal || sortedRows.value.length,
);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(pageTotal.value / rowsPerPage)),
);
const totals = computed(() =>
  visibleColumns.value.map((column, index) => {
    if (index === 0) return `合计 / ${pageTotal.value} 条`;
    if (column.money) return `${formatNumber(sum(column.key), 1)} 万`;
    if (column.quantity) return formatNumber(sum(column.key), 0);
    return '-';
  }),
);
const rankRows = computed(() => {
  const mode = state.value.rankMode;
  const numeric = (value: number | string | undefined) =>
    typeof value === 'number' ? value : Number(value || 0) || 0;
  const rows = report.value.rank.items.toSorted(
    (a, b) => numeric(b.values[mode]) - numeric(a.values[mode]),
  );
  const max = Math.max(...rows.map((item) => numeric(item.values[mode])), 1);
  return rows.slice(0, 8).map((item, index) => ({
    ...item,
    color: [
      '#0b3b6f',
      '#14539e',
      '#2c6fbf',
      '#4e8ad0',
      '#6c9fda',
      '#8ab4e4',
      '#a8c8ec',
      '#c3d8f2',
    ][index],
    percent: Math.max(3, (numeric(item.values[mode]) / max) * 100),
    value: formatRankValue(item.values[mode], mode),
  }));
});
const chart = computed(() => buildChart(report.value.trend));

function createState(config: ReportConfig): ReportState {
  return {
    colsOpen: false,
    dim: config.tableDefaultDim,
    exportOpen: false,
    filterValues: {},
    grain: '按天',
    hidden: {},
    keyword: '',
    page: 1,
    period: '本月',
    rankMode: config.rank.modes[0]?.key || '',
    sortDir: 'desc',
    sortKey: '',
  };
}

function hydrateReport(
  reportKey: ReportKey,
  config: ReportConfig,
): ReportConfig {
  const data = runtimeData[reportKey];
  const currentDim = state.value?.dim || config.tableDefaultDim;
  const hydrated: ReportConfig = {
    ...config,
    dims: { ...config.dims },
    formulas: hydrateFormulas(reportKey, config.formulas, data.summary),
    insights: hydrateInsights(
      reportKey,
      config.insights,
      data.summary,
      data.rank,
    ),
    kpis: hydrateKpis(reportKey, config.kpis, data.summary),
    rank: {
      ...config.rank,
      items: data.loaded ? data.rank.map((item) => toRankItem(reportKey, item))
        : config.rank.items,
      title: rankTitle(reportKey, currentDim, config.rank.title),
    },
    trend: {
      ...config.trend,
      points: data.loaded ? data.trend.map((item) => toTrendPoint(reportKey, item))
        : config.trend.points,
    },
  };
  if (data.loaded) {
    const baseDim =
      config.dims[currentDim] ||
      config.dims[config.tableDefaultDim] ||
      emptyTableDim;
    hydrated.dims[currentDim] = {
      ...baseDim,
      rows: data.rows.map((row) => toTableRow(reportKey, currentDim, row)),
    };
  }
  return hydrated;
}

function rankTitle(reportKey: ReportKey, dim: string, fallback: string) {
  if (reportKey === 'sale') {
    if (dim === '按商品') return '商品销售排行';
    if (dim === '按部门') return '部门销售排行';
    if (dim === '按业务员') return '业务员销售排行';
    return fallback;
  }
  if (reportKey === 'stock') {
    if (dim === '按商品') return '商品库存排行';
    if (dim === '按分类') return '分类库存排行';
    if (dim === '低库存/风险' || dim === '按风险') return '库存风险分布';
    return fallback;
  }
  return fallback;
}

function hydrateKpis(
  reportKey: ReportKey,
  fallback: Metric[],
  summary?: ErpSystemReportApi.Summary,
): Metric[] {
  if (!summary) return fallback;
  if (reportKey === 'purchase') {
    return [
      {
        label: '采购金额',
        value: formatMoneyYuan(summary.inAmount),
        meta: '已审核入库',
        tone: 'good',
      },
      {
        label: '入库数量',
        value: formatNumber(summary.inCount, 0),
        meta: `单据 ${formatNumber(summary.docCount, 0)} 单`,
        tone: 'normal',
      },
      {
        label: '未入数量',
        value: formatNumber(summary.pendingQty, 0),
        meta: '按采购订单未入库',
        tone: 'warn',
      },
      {
        label: '采购退货',
        value: formatMoneyYuan(summary.returnAmount),
        meta: '已审核退货',
        tone: 'danger',
      },
      {
        label: '采购净额',
        value: formatMoneyYuan(summary.netAmount),
        meta: `供应商 ${formatNumber(summary.supplierCount, 0)} 家`,
        tone: 'good',
      },
    ];
  }
  if (reportKey === 'sale') {
    return [
      {
        label: '销售金额',
        value: formatMoneyYuan(summary.saleAmount),
        meta: '已审核销售出库',
        tone: 'good',
      },
      {
        label: '销售数量',
        value: formatNumber(summary.saleCount, 0),
        meta: `单据 ${formatNumber(summary.docCount, 0)} 单`,
        tone: 'normal',
      },
      {
        label: '销售退货',
        value: formatMoneyYuan(summary.returnAmount),
        meta: '已审核销售退货',
        tone: 'danger',
      },
      {
        label: '销售净额',
        value: formatMoneyYuan(summary.netAmount),
        meta: `客户 ${formatNumber(summary.customerCount, 0)} 户`,
        tone: 'good',
      },
      { label: '毛利/应收', value: '占位', meta: '口径待确认', tone: 'warn' },
    ];
  }
  return [
    {
      label: '库存金额',
      value: formatMoneyYuan(summary.stockAmount),
      meta: '当前成本金额',
      tone: 'warn',
    },
    {
      label: '库存数量',
      value: formatNumber(summary.stockQty, 0),
      meta: `SKU ${formatNumber(summary.skuCount, 0)} 个`,
      tone: 'normal',
    },
    {
      label: '可用库存',
      value: formatNumber(summary.availableQty, 0),
      meta: `占用 ${formatNumber(summary.occupiedQty, 0)}`,
      tone: 'good',
    },
    {
      label: '在途数量',
      value: formatNumber(summary.inTransitQty, 0),
      meta: '当前在途/未入',
      tone: 'normal',
    },
    {
      label: '风险 SKU',
      value: formatNumber(
        (summary.lowStockSku || 0) +
          (summary.zeroStockSku || 0) +
          (summary.negativeStockSku || 0),
        0,
      ),
      meta: `低库存 ${formatNumber(summary.lowStockSku, 0)} · 零/负 ${formatNumber((summary.zeroStockSku || 0) + (summary.negativeStockSku || 0), 0)}`,
      tone: 'danger',
    },
  ];
}

function hydrateFormulas(
  reportKey: ReportKey,
  fallback: Formula[],
  summary?: ErpSystemReportApi.Summary,
): Formula[] {
  if (!summary) return fallback;
  if (reportKey === 'purchase') {
    const totalQty =
      Number(summary.inCount || 0) + Number(summary.pendingQty || 0);
    return [
      {
        label: '采购净额',
        text: `入库金额 ${formatMoneyYuan(summary.inAmount)} - 退货金额 ${formatMoneyYuan(summary.returnAmount)} = ${formatMoneyYuan(summary.netAmount)}`,
        tone: 'good',
      },
      {
        label: '入库率',
        text: `入库数量 ${formatNumber(summary.inCount, 0)} / 采购相关数量 ${formatNumber(totalQty, 0)} = ${formatNumber(percent(summary.inCount, totalQty), 1)}%`,
      },
      {
        label: '未入数量',
        text: `已审核采购订单明细未入库数量汇总 = ${formatNumber(summary.pendingQty, 0)}`,
        tone: 'warn',
      },
      {
        label: '退货率',
        text: `退货金额 ${formatMoneyYuan(summary.returnAmount)} / 入库金额 ${formatMoneyYuan(summary.inAmount)} = ${formatNumber(percent(summary.returnAmount, summary.inAmount), 1)}%`,
        tone: 'danger',
      },
      {
        label: '供应商数',
        text: `当前筛选范围发生采购业务供应商 ${formatNumber(summary.supplierCount, 0)} 家`,
      },
    ];
  }
  if (reportKey === 'sale') {
    return [
      {
        label: '销售净额',
        text: `销售金额 ${formatMoneyYuan(summary.saleAmount)} - 销售退货 ${formatMoneyYuan(summary.returnAmount)} = ${formatMoneyYuan(summary.netAmount)}`,
        tone: 'good',
      },
      {
        label: '退货率',
        text: `退货金额 ${formatMoneyYuan(summary.returnAmount)} / 销售金额 ${formatMoneyYuan(summary.saleAmount)} = ${formatNumber(percent(summary.returnAmount, summary.saleAmount), 1)}%`,
        tone: 'danger',
      },
      {
        label: '客户数',
        text: `当前筛选范围发生销售业务客户 ${formatNumber(summary.customerCount, 0)} 户`,
      },
      {
        label: '单据数',
        text: `已审核销售出库/退货单据 ${formatNumber(summary.docCount, 0)} 单`,
      },
      {
        label: '毛利/应收',
        text: '毛利率、毛利额、应收余额、账龄和客户流失口径待确认，当前为占位展示。',
        tone: 'warn',
      },
    ];
  }
  return [
    {
      label: '库存金额',
      text: `当前库存成本金额汇总 = ${formatMoneyYuan(summary.stockAmount)}`,
      tone: 'warn',
    },
    {
      label: '可用库存',
      text: `库存数量 ${formatNumber(summary.stockQty, 0)} - 占用数量 ${formatNumber(summary.occupiedQty, 0)} = ${formatNumber(summary.availableQty, 0)}`,
      tone: 'good',
    },
    {
      label: '低库存',
      text: `当前库存小于商品库存下限的 SKU = ${formatNumber(summary.lowStockSku, 0)}`,
      tone: 'danger',
    },
    {
      label: '零/负库存',
      text: `零库存 ${formatNumber(summary.zeroStockSku, 0)} + 负库存 ${formatNumber(summary.negativeStockSku, 0)} = ${formatNumber((summary.zeroStockSku || 0) + (summary.negativeStockSku || 0), 0)}`,
      tone: 'danger',
    },
    {
      label: '在途数量',
      text: `当前在途/未入数量 = ${formatNumber(summary.inTransitQty, 0)}`,
    },
    {
      label: '呆滞/周转',
      text: '呆滞库存、周转天数口径待确认，当前为占位展示。',
      tone: 'warn',
    },
  ];
}

function hydrateInsights(
  reportKey: ReportKey,
  fallback: InsightGroup[],
  summary?: ErpSystemReportApi.Summary,
  rank: ErpSystemReportApi.Rank[] = [],
): InsightGroup[] {
  if (reportKey !== 'stock' || !summary) return fallback;
  const totalRisk =
    (summary.lowStockSku || 0) +
    (summary.zeroStockSku || 0) +
    (summary.negativeStockSku || 0);
  return [
    {
      title: '库存概览',
      items: [
        {
          name: '库存金额',
          value: formatMoneyYuan(summary.stockAmount),
          meta: '当前成本金额',
          tone: 'warn',
        },
        {
          name: '库存数量',
          value: formatNumber(summary.stockQty, 0),
          meta: `SKU ${formatNumber(summary.skuCount, 0)} 个`,
        },
        {
          name: '可用库存',
          value: formatNumber(summary.availableQty, 0),
          meta: `占用 ${formatNumber(summary.occupiedQty, 0)}`,
          tone: 'good',
        },
        {
          name: '在途数量',
          value: formatNumber(summary.inTransitQty, 0),
          meta: '当前在途/未入',
        },
      ],
    },
    {
      title: '库存风险',
      items: [
        {
          name: '风险 SKU',
          value: formatNumber(totalRisk, 0),
          meta: '低库存 + 零库存 + 负库存',
          tone: totalRisk > 0 ? 'danger' : 'good',
        },
        {
          name: '低库存',
          value: formatNumber(summary.lowStockSku, 0),
          meta: '低于商品库存下限',
          tone: (summary.lowStockSku || 0) > 0 ? 'warn' : 'good',
        },
        {
          name: '零库存',
          value: formatNumber(summary.zeroStockSku, 0),
          meta: '当前库存等于 0',
          tone: (summary.zeroStockSku || 0) > 0 ? 'danger' : 'good',
        },
        {
          name: '负库存',
          value: formatNumber(summary.negativeStockSku, 0),
          meta: '当前库存小于 0',
          tone: (summary.negativeStockSku || 0) > 0 ? 'danger' : 'good',
        },
      ],
    },
    {
      title: '排行摘要',
      items: rank.slice(0, 5).map((item) => ({
        name: item.name || '-',
        value: formatStockRankSummaryValue(item, state.value.rankMode),
        meta: `${formatNumber(item.count, 0)} 个 SKU`,
      })),
    },
  ];
}

function formatStockRankSummaryValue(
  item: ErpSystemReportApi.Rank,
  mode: string,
) {
  if (item.value === null || item.value === undefined) return '****';
  if (mode === 'stockAmount') return formatRankValue(toWan(item.value), mode);
  return formatRankValue(item.value, mode);
}

function toTrendPoint(
  reportKey: ReportKey,
  item: ErpSystemReportApi.Trend,
): TrendPoint {
  if (reportKey === 'purchase') {
    return {
      label: formatPeriodLabel(item.period),
      values: {
        in: toChartWan(item.inAmount),
        inbound: toChartWan(item.inAmount),
        net: toChartWan(item.netAmount),
        purchase: toChartWan(item.purchaseAmount || item.inAmount),
        return: toChartWan(item.returnAmount),
      },
    };
  }
  if (reportKey === 'sale') {
    return {
      label: formatPeriodLabel(item.period),
      values: {
        net: toChartWan(item.netAmount),
        profit: 0,
        receivable: 0,
        return: toChartWan(item.returnAmount),
        sale: toChartWan(item.saleAmount),
        sales: toChartWan(item.saleAmount),
      },
    };
  }
  return {
    label: formatPeriodLabel(item.period),
    values: {
      in: Number(item.inCount || 0),
      inAmount: toChartWan(item.inAmount),
      inQty: Number(item.inCount || 0),
      out: Number(item.outCount || 0),
      outAmount: toChartWan(item.outAmount),
      outQty: Number(item.outCount || 0),
      stock: Number(item.stockQty || 0),
      stockAmount: toChartWan(item.stockAmount),
      stockQty: Number(item.stockQty || 0),
    },
  };
}

function toRankItem(
  reportKey: ReportKey,
  item: ErpSystemReportApi.Rank,
): RankItem {
  if (reportKey === 'stock') {
    return {
      count: `${formatNumber(item.count, 0)} 个 SKU`,
      name: item.name || '-',
      values: {
        lowStock: Number(item.lowStockSku ?? item.value ?? 0),
        lowStockSku: Number(item.lowStockSku ?? item.value ?? 0),
        stockAmount: toWan(item.stockAmount),
        stockQty: Number(item.stockQty || 0),
      },
    };
  }
  if (reportKey === 'sale') {
    return {
      count: `${formatNumber(item.count, 0)} 条业务`,
      name: item.name || '-',
      values: {
        netAmount: toWan(item.netAmount),
        receivable: 0,
        returnAmount: toWan(item.returnAmount),
        saleAmount: toWan(item.saleAmount),
      },
    };
  }
  return {
    count: `${formatNumber(item.count, 0)} 条业务`,
    name: item.name || '-',
    values: {
      inAmount: toWan(item.inAmount),
      netAmount: toWan(item.netAmount),
      pendingQty: Number(item.pendingQty || 0),
      returnAmount: toWan(item.returnAmount),
    },
  };
}

function toTableRow(
  reportKey: ReportKey,
  dim: string,
  row: Record<string, any>,
) {
  if (reportKey === 'purchase') return toPurchaseTableRow(dim, row);
  if (reportKey === 'sale') return toSaleTableRow(dim, row);
  return toStockTableRow(dim, row);
}

function toPurchaseTableRow(dim: string, row: Record<string, any>) {
  if (dim === '按商品') {
    return {
      avgPrice: calcAvg(row.inAmount, row.inCount),
      code: row.code,
      drawing: row.drawingNo,
      inQty: Number(row.inCount || 0),
      name: row.name,
      pendingQty: Number(row.pendingQty || 0),
      purchaseAmount: toWan(row.inAmount),
      purchaseQty: Number(row.inCount || 0) + Number(row.pendingQty || 0),
      returnAmount: toWan(row.returnAmount),
      spec: row.standard,
      supplierCount: Number(row.supplierCount || 0),
    };
  }
  if (dim === '按部门') {
    return {
      dept: row.name,
      inAmount: toWan(row.inAmount),
      inQty: Number(row.inCount || 0),
      netAmount: toWan(row.netAmount),
      pendingQty: Number(row.pendingQty || 0),
      purchaseQty: Number(row.inCount || 0) + Number(row.pendingQty || 0),
      returnAmount: toWan(row.returnAmount),
      supplierCount: Number(row.supplierCount || 0),
    };
  }
  if (dim === '按单据') {
    return {
      bizCount: Number(row.bizCount || 0),
      buyer: row.userName,
      docDate: row.docDate,
      docNo: row.docNo,
      docType: row.docType,
      inAmount: toWan(row.inAmount),
      netAmount: toWan(row.netAmount),
      pendingQty: Number(row.pendingQty || 0),
      returnAmount: toWan(row.returnAmount),
      supplier: row.supplierName,
    };
  }
  return {
    buyer: row.userName,
    inAmount: toWan(row.inAmount),
    inQty: Number(row.inCount || 0),
    netAmount: toWan(row.netAmount),
    pendingQty: Number(row.pendingQty || 0),
    purchaseQty: Number(row.inCount || 0) + Number(row.pendingQty || 0),
    returnAmount: toWan(row.returnAmount),
    returnRate: percent(row.returnAmount, row.inAmount),
    risk: buildPurchaseRisk(row),
    supplier: row.name,
  };
}

function toSaleTableRow(dim: string, row: Record<string, any>) {
  if (dim === '按商品') {
    return {
      code: row.code,
      costAmount: 0,
      name: row.name,
      netAmount: toWan(row.netAmount),
      profitAmount: 0,
      profitRate: 0,
      returnAmount: toWan(row.returnAmount),
      saleAmount: toWan(row.saleAmount),
      saleQty: Number(row.saleCount || 0),
      spec: row.standard,
    };
  }
  if (dim === '按部门' || dim === '按业务员') {
    if (dim === '按业务员') {
      return {
        customerCount: Number(row.customerCount || 0),
        dept: row.deptName,
        netAmount: toWan(row.netAmount),
        profitAmount: 0,
        profitRate: 0,
        receivable: 0,
        returnAmount: toWan(row.returnAmount),
        seller: row.name,
      };
    }
    return {
      customerCount: Number(row.customerCount || 0),
      dept: row.name,
      netAmount: toWan(row.netAmount),
      profitAmount: 0,
      profitRate: 0,
      returnAmount: toWan(row.returnAmount),
      saleAmount: toWan(row.saleAmount),
      saleQty: Number(row.saleCount || 0),
      sellerCount: Number(row.userCount || 0),
    };
  }
  if (dim === '按单据') {
    return {
      bizCount: Number(row.bizCount || 0),
      customer: row.customerName,
      date: row.docDate,
      dept: row.deptName,
      docDate: row.docDate,
      docNo: row.docNo,
      docType: row.docType,
      lineCount: Number(row.lineCount || 0),
      netAmount: toWan(row.netAmount),
      returnAmount: toWan(row.returnAmount),
      saleAmount: toWan(row.saleAmount),
      seller: row.userName,
      type: row.docType,
    };
  }
  return {
    costAmount: 0,
    customer: row.name,
    netAmount: toWan(row.netAmount),
    profitAmount: 0,
    profitRate: 0,
    receivable: 0,
    returnAmount: toWan(row.returnAmount),
    risk: '正常',
    saleAmount: toWan(row.saleAmount),
    saleQty: Number(row.saleCount || 0),
    seller: row.userName,
  };
}

function toStockTableRow(dim: string, row: Record<string, any>) {
  if (dim === '按仓库' || dim === '按分类') {
    return {
      availableQty: Number(row.availableQty || 0),
      category: dim === '按分类' ? row.name : row.categoryName,
      code: row.code,
      inTransitQty: Number(row.inTransitQty || 0),
      lowStock: Number(row.lowStockSku || 0),
      name: row.name,
      occupiedQty: Number(row.occupiedQty || 0),
      stockAmount: toWan(row.stockAmount),
      stockQty: Number(row.stockQty || 0),
      warehouse: row.warehouseName || row.name,
      warehouseCount: Number(row.warehouseCount || 0),
    };
  }
  if (dim === '出入库流水') {
    return {
      balanceAmount: toWan(row.costAmount),
      balanceQty: Number(row.totalCount || 0),
      code: row.code,
      date: row.docDate,
      docNo: row.docNo,
      inAmount: toWan(row.inAmount),
      inQty: Number(row.inCount || 0),
      name: row.name,
      outAmount: toWan(row.outAmount),
      outQty: Number(row.outCount || 0),
      spec: row.standard,
      type: row.docType,
      warehouse: row.warehouseName,
    };
  }
  if (dim === '低库存/风险') {
    return {
      availableQty: Number(row.availableQty || 0),
      code: row.code,
      currentQty: Number(row.stockQty || 0),
      gapQty: Number(row.gapQty || 0),
      lastOutDate: '-',
      name: row.name,
      occupiedQty: Number(row.occupiedQty || 0),
      risk: row.risk,
      safeStock: Number(row.stockMin || 0),
      staleDays: 0,
      stockAmount: toWan(row.stockAmount),
      warehouse: row.warehouseName,
    };
  }
  return {
    availableQty: Number(row.availableQty || 0),
    category: row.categoryName,
    code: row.code,
    inTransitQty: Number(row.inTransitQty || 0),
    name: row.name,
    occupiedQty: Number(row.occupiedQty || 0),
    risk: row.risk,
    safeStock: Number(row.stockMin || 0),
    spec: row.standard,
    stockAmount: toWan(row.stockAmount),
    stockQty: Number(row.stockQty || 0),
    turnoverDays: 0,
  };
}

function compareValue(
  a: number | string | undefined,
  b: number | string | undefined,
) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN');
}

function sum(key: string) {
  let total = 0;
  for (const row of sortedRows.value) {
    const value = row[key];
    if (typeof value === 'number') {
      total += value;
    }
  }
  return total;
}

function formatNumber(value: number | string | undefined, digits = 0) {
  if (value === null || value === undefined || value === '****')
    return value === '****' ? value : '0';
  const numericValue = Number(value || 0);
  return numericValue.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatMoneyYuan(value: number | undefined) {
  if (value === null || value === undefined) return '****';
  return formatNumber(value, 2);
}

function formatPeriodLabel(period?: string) {
  if (!period) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period.slice(5);
  if (/^\d{4}-\d{2}$/.test(period)) return period.slice(5);
  return period;
}

function toWan(value: number | string | undefined) {
  if (value === null || value === undefined) return '****' as any;
  return Number(value || 0) / 10_000;
}

function toChartWan(value: number | string | undefined) {
  if (value === null || value === undefined || value === '****') return 0;
  return Number(value || 0) / 10_000;
}

function calcAvg(amount: number | undefined, count: number | undefined) {
  const numericCount = Number(count || 0);
  if (amount === null || amount === undefined) return '****' as any;
  return numericCount === 0 ? 0 : Number(amount || 0) / numericCount;
}

function percent(
  numerator: number | undefined,
  denominator: number | undefined,
) {
  if (numerator === null || denominator === null) return 0;
  const base = Number(denominator || 0);
  return base === 0 ? 0 : (Number(numerator || 0) / base) * 100;
}

function buildPurchaseRisk(row: Record<string, any>) {
  if (Number(row.pendingQty || 0) > 0) return '待催入库';
  if (percent(row.returnAmount, row.inAmount) > 8) return '退货偏高';
  return '正常';
}

function formatCell(row: Record<string, number | string>, column: TableColumn) {
  const value = row[column.key];
  if (value === undefined || value === null || value === '') return '-';
  if (value === '****') return value;
  if (column.money) return `${formatNumber(value, 1)} 万`;
  if (column.percent) return `${formatNumber(value, 1)}%`;
  if (column.quantity)
    return typeof value === 'number' ? formatNumber(value, 0) : value;
  return value;
}

function formatRankValue(value: number | string | undefined, key: string) {
  if (value === null || value === undefined || value === '****') return '****';
  if (
    key.includes('Qty') ||
    key === 'pendingQty' ||
    key === 'stockQty' ||
    key === 'lowStock'
  ) {
    return formatNumber(value || 0, 0);
  }
  return `${formatNumber(value || 0, 1)} 万`;
}

function getCellClass(
  row: Record<string, number | string>,
  column: TableColumn,
) {
  const value = row[column.key];
  return {
    'is-danger':
      ['应收余额', '当前库存', '缺口数量', '退货率', '退货金额'].includes(
        column.label,
      ) && Number(value || 0) > 0,
    'is-good':
      ['毛利额', '采购净额', '销售净额'].includes(column.label) &&
      Number(value || 0) > 0,
    'is-strong': column.strong,
  };
}

function getTagClass(value: number | string | undefined) {
  if (
    ['毛利偏低', '负库存', '退货偏高', '逾期', '零库存'].includes(String(value))
  )
    return 'tag-danger';
  if (['低库存', '关注', '呆滞', '待催入库'].includes(String(value)))
    return 'tag-warn';
  if (['正常', '采购入库', '销售出库'].includes(String(value)))
    return 'tag-good';
  return 'tag-normal';
}

function handleDimChange(dim: string) {
  state.value.dim = dim;
  state.value.page = 1;
  state.value.sortKey = '';
  loadPage();
}

function handlePeriodChange(period: string) {
  state.value.period = period;
  state.value.page = 1;
  if (period !== '自定义') {
    state.value.dateRange = undefined;
  }
  loadAll();
}

function handleGrainChange(grain: string) {
  state.value.grain = grain;
  loadTrend();
}

function handleRankModeChange(mode: string) {
  state.value.rankMode = mode;
  loadRank();
}

function handleSort(column: TableColumn) {
  if (state.value.sortKey === column.key) {
    state.value.sortDir = state.value.sortDir === 'desc' ? 'asc' : 'desc';
  } else {
    state.value.sortKey = column.key;
    state.value.sortDir = 'desc';
  }
  loadPage();
}

function toggleColumn(column: TableColumn) {
  state.value.hidden[column.key] = !state.value.hidden[column.key];
}

function resetCurrent() {
  const current = state.value;
  current.period = '本月';
  current.dateRange = undefined;
  current.keyword = '';
  current.filterValues = {};
  current.page = 1;
  current.sortKey = '';
  current.sortDir = 'desc';
  current.hidden = {};
  current.rankMode = report.value.rank.modes[0]?.key || '';
  loadAll();
}

const periodMap: Record<string, ErpSystemReportApi.QueryParams['periodType']> =
  {
    今天: 'today',
    本周: 'week',
    本月: 'month',
    本季度: 'quarter',
    本年: 'year',
    自定义: 'custom',
  };

const grainMap: Record<string, ErpSystemReportApi.QueryParams['grain']> = {
  按天: 'day',
  按周: 'week',
  按月: 'month',
};

const dimensionMap: Record<ReportKey, Record<string, string>> = {
  purchase: {
    按供应商: 'supplier',
    按商品: 'product',
    按部门: 'dept',
    按单据: 'document',
  },
  sale: {
    按客户: 'customer',
    按商品: 'product',
    按部门: 'dept',
    按业务员: 'user',
    按单据: 'document',
  },
  stock: {
    按商品: 'product',
    按仓库: 'warehouse',
    按分类: 'category',
    出入库流水: 'flow',
    '低库存/风险': 'risk',
    按风险: 'risk',
  },
};

function normalizeOptions(list?: ErpSystemReportApi.OptionItem[]) {
  return (list || []).map((item: any) => ({
    label: item.label ?? item.name ?? item.nickname ?? item.value,
    value: item.value ?? item.id,
  }));
}

function selectOptions(filter: string) {
  const current = runtimeData[activeReport.value].options;
  if (filter.includes('供应商')) return normalizeOptions(current.suppliers);
  if (filter.includes('客户')) return normalizeOptions(current.customers);
  if (filter.includes('部门')) return normalizeOptions(current.departments);
  if (filter.includes('采购员') || filter.includes('业务员'))
    return normalizeOptions(current.users);
  if (filter.includes('仓库')) return normalizeOptions(current.warehouses);
  if (filter.includes('分类')) return normalizeOptions(current.categories);
  if (filter.includes('状态')) {
    return [
      { label: '正常库存', value: 'normal' },
      { label: '低库存', value: 'low' },
      { label: '零库存', value: 'zero' },
      { label: '负库存', value: 'negative' },
    ];
  }
  return [];
}

async function handleOptionSearch(filter: string, keyword: string) {
  if (
    !filter.includes('供应商') &&
    !filter.includes('客户') &&
    !filter.includes('采购员') &&
    !filter.includes('业务员') &&
    !filter.includes('仓库') &&
    !filter.includes('分类')
  ) {
    return;
  }
  const reportType = activeReport.value;
  try {
    runtimeData[reportType].options = await getSystemReportOptions(
      reportType,
      buildQueryParams({
        keyword: keyword || undefined,
        pageNo: 1,
      }),
    );
  } catch (error) {
    console.error(error);
  }
}

function buildQueryParams(
  extra: Partial<ErpSystemReportApi.QueryParams> = {},
): ErpSystemReportApi.QueryParams {
  const current = state.value;
  const filterValues = current.filterValues;
  const common: ErpSystemReportApi.QueryParams = {
    dimension: dimensionMap[activeReport.value][current.dim],
    grain: grainMap[current.grain],
    keyword: current.keyword || undefined,
    metric: current.rankMode || undefined,
    orderDirection: current.sortKey ? current.sortDir : undefined,
    orderField: current.sortKey || undefined,
    pageNo: current.page,
    pageSize: rowsPerPage,
    periodType: periodMap[current.period] || 'month',
  };
  if (current.period === '自定义' && current.dateRange?.length === 2) {
    common.startTime = current.dateRange[0];
    common.endTime = current.dateRange[1];
  }

  if (activeReport.value === 'purchase') {
    common.supplierId = filterValues['全部供应商'];
    common.deptId = filterValues['全部部门'];
    common.purchaser = filterValues['全部采购员']
      ? String(filterValues['全部采购员'])
      : undefined;
  } else if (activeReport.value === 'sale') {
    common.customerId = filterValues['全部客户'];
    common.deptId = filterValues['全部部门'];
    common.saleUserId = filterValues['全部业务员'];
  } else {
    common.warehouseId = filterValues['全部仓库'];
    common.categoryId = filterValues['全部分类'];
    common.stockStatus = filterValues['全部状态'];
  }

  return { ...common, ...extra };
}

async function loadAll() {
  const reportType = activeReport.value;
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const params = buildQueryParams();
    const [options, summary, trend, rank, pageResult] = await Promise.all([
      getSystemReportOptions(reportType, params),
      getSystemReportSummary(reportType, params),
      getSystemReportTrend(reportType, params),
      getSystemReportRank(reportType, params),
      getSystemReportPage(reportType, params),
    ]);
    if (seq !== requestSeq || reportType !== activeReport.value) return;
    Object.assign(runtimeData[reportType], {
      loaded: true,
      options,
      pageTotal: pageResult.total || 0,
      rank: rank || [],
      rows: pageResult.list || [],
      summary,
      trend: trend || [],
    });
  } catch (error) {
    console.error(error);
    message.error('报表数据加载失败');
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

async function loadTrend() {
  const reportType = activeReport.value;
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const trend = await getSystemReportTrend(reportType, buildQueryParams());
    if (seq !== requestSeq || reportType !== activeReport.value) return;
    runtimeData[reportType].loaded = true;
    runtimeData[reportType].trend = trend || [];
  } catch (error) {
    console.error(error);
    message.error('趋势数据加载失败');
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

async function loadRank() {
  const reportType = activeReport.value;
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const rank = await getSystemReportRank(reportType, buildQueryParams());
    if (seq !== requestSeq || reportType !== activeReport.value) return;
    runtimeData[reportType].loaded = true;
    runtimeData[reportType].rank = rank || [];
  } catch (error) {
    console.error(error);
    message.error('排行数据加载失败');
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

async function loadPage() {
  const reportType = activeReport.value;
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const pageResult = await getSystemReportPage(
      reportType,
      buildQueryParams(),
    );
    if (seq !== requestSeq || reportType !== activeReport.value) return;
    runtimeData[reportType].loaded = true;
    runtimeData[reportType].pageTotal = pageResult.total || 0;
    runtimeData[reportType].rows = pageResult.list || [];
  } catch (error) {
    console.error(error);
    message.error('明细数据加载失败');
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
}

function handleSearch() {
  state.value.page = 1;
  loadAll();
}

function handlePageChange(page: number) {
  state.value.page = page;
  loadPage();
}

async function handleExport() {
  loading.value = true;
  try {
    const data = await exportSystemReport(
      activeReport.value,
      buildQueryParams({ pageNo: 1, pageSize: 50_000 }),
    );
    downloadFileFromBlobPart({
      fileName: `${report.value.name}-${state.value.dim}.xls`,
      source: data,
    });
  } catch (error) {
    console.error(error);
    message.error('导出失败');
  } finally {
    loading.value = false;
  }
}

function buildChart(trend: ReportConfig['trend']) {
  const width = 1020;
  const height = 300;
  const left = 58;
  const right = 24;
  const top = 20;
  const bottom = 40;
  if (trend.points.length === 0) {
    const y = (value: number) => value;
    return { area: '', grid: [], height, paths: [], width, x: () => left, y };
  }
  const values = trend.points.flatMap((point) =>
    trend.lines.map((line) => point.values[line.key] || 0),
  );
  const maxValue = Math.max(...values, 1);
  const niceMax = Math.ceil((maxValue * 1.16) / 10) * 10;
  const x = (index: number) =>
    left +
    (index * (width - left - right)) / Math.max(1, trend.points.length - 1);
  const y = (value: number) =>
    height - bottom - (value / niceMax) * (height - top - bottom);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = (niceMax / 4) * index;
    return {
      label: formatAxis(value),
      y: y(value),
    };
  });
  const paths = trend.lines.map((line) => ({
    ...line,
    d: trend.points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.values[line.key] || 0).toFixed(1)}`,
      )
      .join(' '),
  }));
  const areaLine = trend.lines[0];
  const areaPath = areaLine
    ? trend.points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.values[areaLine.key] || 0).toFixed(1)}`,
        )
        .join(' ')
    : '';
  const area = areaLine
    ? `${areaPath} L${x(trend.points.length - 1).toFixed(1)} ${height - bottom} L${x(0).toFixed(1)} ${height - bottom} Z`
    : '';
  return { area, grid, height, paths, width, x, y };
}

function formatAxis(value: number) {
  if (value >= 10_000) return `${formatNumber(value / 10_000, 1)}万`;
  return formatNumber(value, 0);
}

onMounted(() => {
  loadAll();
});

watch(activeReport, () => {
  loadAll();
});
</script>

<template>
  <BusinessReportShell title="经营报表 · 部门利润、公司抵销及驾驶舱">
    <div class="system-report-page">
      <Tabs v-model:active-key="activeReport" class="system-report-tabs">
        <TabPane key="purchase" tab="采购报表" />
        <TabPane key="sale" tab="销售报表" />
        <TabPane key="stock" tab="库存报表" />
      </Tabs>

      <Alert
        class="mb-3"
        type="info"
        show-icon
        message="经营驾驶舱当前用于第一阶段展示和筛选联调，尚未形成正式经营指标。"
        description="部门利润需要汇集外销毛利、本级调拨利润、直接费用、分摊费用、库存及调账损益和其他经营收支；公司利润需要按对外收入与财务成本计算，并展示内部收入成本抵销、未实现利润抵销和已实现利润调整。毛利额/毛利率口径待确认；当前排行榜只按系统分析接口字段或静态占位排序，不作为正式部门利润排行、公司利润排行或目标评分排行；部门利润、公司抵销、排行榜、目标评分等正式公式和配置版本未确认前，不应作为正式经营驾驶舱。未配置正式指标时必须显示不可用原因，本页暂以边界说明代替正式不可用原因服务。"
      />

      <div class="cockpit-readiness">
        <article v-for="item in cockpitReadiness" :key="item.title">
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.status }}</span>
          </div>
          <p>{{ item.description }}</p>
        </article>
      </div>

      <section class="report-shell">
        <header class="report-hero">
          <div>
            <div class="report-title-row">
              <h1>{{ report.name }}</h1>
              <span class="report-badge">{{ report.badge }}</span>
            </div>
            <p>{{ report.note }}</p>
          </div>
          <div class="report-meta">
            <span>经营复盘</span>
            <span>四川兴宇</span>
            <span>2026 年至今</span>
            <span>{{
              runtimeData[activeReport].loaded ? '接口数据（非正式驾驶舱）' : '静态占位（演示）'
            }}</span>
          </div>
        </header>

        <div class="report-filter">
          <div class="period-tabs">
            <button
              v-for="period in [
                '今天',
                '本周',
                '本月',
                '本季度',
                '本年',
                '自定义',
              ]"
              :key="period"
              :class="{ active: state.period === period }"
              type="button"
              @click="handlePeriodChange(period)"
            >
              {{ period }}
            </button>
          </div>
          <DatePicker.RangePicker
            v-if="state.period === '自定义'"
            v-model:value="state.dateRange"
            class="custom-range"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD HH:mm:ss"
            @change="handleSearch"
          />
          <Select
            v-for="filter in report.filters"
            :key="filter"
            v-model:value="state.filterValues[filter]"
            :placeholder="filter"
            allow-clear
            class="report-select"
            :filter-option="false"
            option-filter-prop="label"
            :options="selectOptions(filter)"
            show-search
            @search="handleOptionSearch(filter, $event)"
          />
          <Input
            v-model:value="state.keyword"
            class="report-keyword"
            :placeholder="report.filterKeyword"
            allow-clear
          />
          <div class="filter-actions">
            <Button @click="resetCurrent">重置</Button>
            <Button :loading="loading" type="primary" @click="handleSearch"
              >查询</Button
            >
          </div>
        </div>

        <div class="metric-grid">
          <article
            v-for="item in report.kpis"
            :key="item.label"
            class="metric-card"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <em :class="`tone-${item.tone || 'normal'}`">{{ item.meta }}</em>
          </article>
        </div>

        <div class="analysis-grid">
          <article class="panel trend-panel">
            <div class="panel-head">
              <div>
                <h2>{{ report.trend.title }}</h2>
                <p>按当前筛选条件汇总核心业务趋势，支持按天 / 周 / 月聚合。</p>
              </div>
              <div class="mini-tabs">
                <button
                  v-for="grain in ['按天', '按周', '按月']"
                  :key="grain"
                  :class="{ active: state.grain === grain }"
                  type="button"
                  @click="handleGrainChange(grain)"
                >
                  {{ grain }}
                </button>
              </div>
            </div>
            <div class="legend-row">
              <span v-for="line in report.trend.lines" :key="line.key">
                <i :style="{ background: line.color }"></i>{{ line.label }}
              </span>
            </div>
            <div class="svg-chart">
              <svg
                :viewBox="`0 0 ${chart.width} ${chart.height}`"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id="erp-system-report-area"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0" stop-color="#0b3b6f" stop-opacity="0.18" />
                    <stop offset="1" stop-color="#0b3b6f" stop-opacity="0.02" />
                  </linearGradient>
                </defs>
                <line x1="58" x2="996" y1="260" y2="260" stroke="#cfd7e3" />
                <g v-for="line in chart.grid" :key="line.label">
                  <line
                    x1="58"
                    x2="996"
                    :y1="line.y"
                    :y2="line.y"
                    stroke="#e5ebf3"
                    stroke-dasharray="4 4"
                  />
                  <text x="48" :y="line.y + 4" text-anchor="end">
                    {{ line.label }}
                  </text>
                </g>
                <path :d="chart.area" fill="url(#erp-system-report-area)" />
                <path
                  v-for="line in chart.paths"
                  :key="line.key"
                  :d="line.d"
                  fill="none"
                  :stroke="line.color"
                  :stroke-width="line.strokeWidth || 2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <g
                  v-for="(point, index) in report.trend.points"
                  :key="point.label"
                >
                  <text
                    v-if="
                      index % 2 === 0 ||
                      index === report.trend.points.length - 1
                    "
                    :x="chart.x(index)"
                    y="292"
                    text-anchor="middle"
                  >
                    {{ point.label }}
                  </text>
                  <circle
                    v-for="line in report.trend.lines"
                    :key="line.key"
                    :cx="chart.x(index)"
                    :cy="chart.y(point.values[line.key] || 0)"
                    r="3.2"
                    :fill="line.color"
                  />
                </g>
              </svg>
            </div>
          </article>

          <article class="panel rank-panel">
            <div class="panel-head compact">
              <div>
                <h2>{{ report.rank.title }}</h2>
                <p>{{ report.insightTitle }}</p>
              </div>
              <div class="mini-tabs">
                <button
                  v-for="mode in report.rank.modes"
                  :key="mode.key"
                  :class="{ active: state.rankMode === mode.key }"
                  type="button"
                  @click="handleRankModeChange(mode.key)"
                >
                  {{ mode.label }}
                </button>
              </div>
            </div>
            <div class="rank-list">
              <div v-for="item in rankRows" :key="item.name" class="rank-item">
                <div class="rank-line">
                  <span>{{ item.name }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
                <div class="rank-track">
                  <i
                    :style="{
                      background: item.color,
                      width: `${item.percent}%`,
                    }"
                  ></i>
                </div>
                <small>{{ item.count || '发生业务' }}</small>
              </div>
            </div>
          </article>
        </div>

        <div class="review-grid">
          <article class="panel formula-panel">
            <div class="panel-title">
              <span></span>
              <h2>关键指标 · 怎么算出来的</h2>
            </div>
            <div class="formula-list">
              <div
                v-for="item in report.formulas"
                :key="item.label"
                class="formula-row"
              >
                <span :class="`tone-${item.tone || 'normal'}`">{{
                  item.label
                }}</span>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </article>

          <aside class="insight-card">
            <section v-for="group in report.insights" :key="group.title">
              <h3>{{ group.title }}</h3>
              <div
                v-for="item in group.items"
                :key="`${group.title}-${item.name}`"
                class="insight-row"
              >
                <span>{{ item.name }}</span>
                <strong :class="`tone-${item.tone || 'normal'}`">{{
                  item.value
                }}</strong>
                <em v-if="item.meta">{{ item.meta }}</em>
              </div>
            </section>
          </aside>
        </div>

        <article class="panel table-panel">
          <div class="table-head">
            <div>
              <h2>{{ tableDim.title }}</h2>
              <p>当前维度：{{ state.dim }}，展示 {{ pageTotal }} 条数据。</p>
            </div>
            <div class="table-actions">
              <Button @click="state.colsOpen = true">列设置</Button>
              <Button
                v-if="canExport"
                :loading="loading"
                type="primary"
                @click="handleExport"
                >导出</Button
              >
            </div>
          </div>

          <div class="dim-tabs">
            <button
              v-for="dim in Object.keys(report.dims)"
              :key="dim"
              :class="{ active: state.dim === dim }"
              type="button"
              @click="handleDimChange(dim)"
            >
              {{ dim }}
            </button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th
                    v-for="column in visibleColumns"
                    :key="column.key"
                    :style="{
                      minWidth: column.width ? `${column.width}px` : undefined,
                      textAlign: column.align || 'left',
                    }"
                    @click="handleSort(column)"
                  >
                    {{ column.label }}
                    <span class="sort-mark">{{
                      state.sortKey === column.key
                        ? state.sortDir === 'asc'
                          ? '▲'
                          : '▼'
                        : '⇅'
                    }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in pagedRows" :key="rowIndex">
                  <td
                    v-for="column in visibleColumns"
                    :key="column.key"
                    :class="getCellClass(row, column)"
                    :style="{ textAlign: column.align || 'left' }"
                  >
                    <span
                      v-if="column.tag"
                      class="status-tag"
                      :class="[getTagClass(row[column.key])]"
                      >{{ formatCell(row, column) }}</span
                    >
                    <a v-else-if="column.link">{{ formatCell(row, column) }}</a>
                    <template v-else>{{ formatCell(row, column) }}</template>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td
                    v-for="(total, index) in totals"
                    :key="index"
                    :style="{
                      textAlign: visibleColumns[index]?.align || 'left',
                    }"
                  >
                    {{ total }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="pager">
            <span
              >第
              {{ pageTotal === 0 ? 0 : (state.page - 1) * rowsPerPage + 1 }}-{{
                Math.min(state.page * rowsPerPage, pageTotal)
              }}
              条 / 共 {{ pageTotal }} 条</span
            >
            <div>
              <Button
                :disabled="state.page <= 1"
                @click="handlePageChange(state.page - 1)"
                >上一页</Button
              >
              <Button
                :disabled="state.page >= pageCount"
                @click="handlePageChange(state.page + 1)"
                >下一页</Button
              >
            </div>
          </div>
        </article>
      </section>

      <Modal
        v-model:open="state.colsOpen"
        title="列设置"
        :footer="null"
        width="520px"
      >
        <div class="column-list">
          <button
            v-for="column in tableDim.columns"
            :key="column.key"
            :class="{ muted: state.hidden[column.key] }"
            type="button"
            @click="toggleColumn(column)"
          >
            <span>{{ state.hidden[column.key] ? '隐藏' : '显示' }}</span>
            {{ column.label }}
          </button>
        </div>
      </Modal>

      <Modal
        v-model:open="state.exportOpen"
        title="导出说明"
        width="520px"
        @ok="state.exportOpen = false"
      >
        <p class="modal-copy">
          当前将按“{{ report.name }} / {{ state.dim }} /
          {{
            state.period
          }}”以及页面筛选条件导出当前系统分析接口返回数据；不得作为正式利润表、部门利润表、公司抵销表或绩效评分依据；毛利额/毛利率、排行榜、部门利润、公司抵销和目标评分等公式及配置版本未确认前，不应作为正式经营驾驶舱。
        </p>
      </Modal>
    </div>
  </BusinessReportShell>
</template>

<style scoped>
.system-report-page {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  color: #1b2430;
  background: #eef3f8;
}

.system-report-tabs {
  padding: 0 18px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #dce2ec;
  border-radius: 6px;
}

.system-report-tabs :deep(.ant-tabs-nav) {
  margin: 0;
}

.system-report-tabs :deep(.ant-tabs-tab) {
  padding: 14px 10px;
  font-size: 15px;
  font-weight: 600;
}

.cockpit-readiness {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.cockpit-readiness article {
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #dce2ec;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgb(11 35 58 / 4%);
}

.cockpit-readiness article div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.cockpit-readiness strong {
  color: #173461;
  font-size: 15px;
}

.cockpit-readiness span {
  flex: 0 0 auto;
  padding: 1px 8px;
  color: #b7791f;
  background: #fff8e5;
  border: 1px solid #f4d99b;
  border-radius: 999px;
  font-size: 12px;
}

.cockpit-readiness p {
  margin: 0;
  color: #5a6779;
  font-size: 12px;
  line-height: 1.7;
}

.report-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.report-hero,
.report-filter,
.metric-card,
.panel,
.insight-card {
  background: #fff;
  border: 1px solid #dce2ec;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgb(11 35 58 / 4%);
}

.report-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 28px 32px 22px;
  border-top: 5px solid #0b3b6f;
}

.report-title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.report-title-row h1 {
  margin: 0;
  font-size: 42px;
  font-weight: 800;
  line-height: 1.1;
  color: #173461;
}

.report-badge {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 22px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  background: #315ba1;
  border-radius: 20px;
}

.report-hero p {
  max-width: 920px;
  margin: 12px 0 0;
  color: #8390a2;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  justify-content: flex-end;
  max-width: 560px;
  font-size: 15px;
  font-weight: 600;
  color: #8390a2;
}

.report-filter {
  display: grid;
  grid-template-columns: auto repeat(3, minmax(150px, 1fr)) minmax(
      180px,
      1.1fr
    ) auto;
  gap: 10px;
  align-items: center;
  padding: 14px 16px;
}

.period-tabs,
.mini-tabs {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid #dce2ec;
  border-radius: 4px;
}

.period-tabs button,
.mini-tabs button {
  height: 32px;
  padding: 0 13px;
  font-size: 13px;
  color: #5a6779;
  cursor: pointer;
  background: #fff;
  border: 0;
  border-right: 1px solid #dce2ec;
}

.period-tabs button:last-child,
.mini-tabs button:last-child {
  border-right: 0;
}

.period-tabs button.active,
.mini-tabs button.active {
  font-weight: 700;
  color: #fff;
  background: #0b3b6f;
}

.report-select,
.report-keyword,
.custom-range {
  width: 100%;
}

.filter-actions,
.table-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 124px;
  padding: 18px;
}

.metric-card span {
  font-size: 14px;
  font-weight: 600;
  color: #7b8797;
}

.metric-card strong {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: #1b2430;
}

.metric-card em,
.insight-row em {
  font-style: normal;
}

.analysis-grid,
.review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 0.85fr);
  gap: 14px;
}

.panel {
  padding: 18px;
}

.panel-head,
.table-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.panel-head.compact {
  align-items: center;
}

.panel h2,
.insight-card h3 {
  margin: 0;
  color: #173461;
}

.panel h2 {
  font-size: 20px;
  font-weight: 800;
}

.panel p,
.table-head p {
  margin: 5px 0 0;
  color: #8390a2;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.legend-row span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5a6779;
}

.legend-row i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.svg-chart {
  height: 300px;
}

.svg-chart svg {
  display: block;
  width: 100%;
  height: 100%;
}

.svg-chart text {
  font-size: 11px;
  fill: #8b97a8;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.rank-line,
.insight-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: baseline;
}

.rank-line span,
.insight-row span {
  overflow: hidden;
  color: #344154;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-line strong,
.insight-row strong {
  color: #0b3b6f;
}

.rank-track {
  height: 8px;
  margin: 6px 0 4px;
  overflow: hidden;
  background: #edf2f7;
  border-radius: 4px;
}

.rank-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.rank-item small {
  color: #8b97a8;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.panel-title span {
  width: 8px;
  height: 34px;
  background: #e0ac5f;
}

.formula-list {
  display: flex;
  flex-direction: column;
}

.formula-row {
  display: grid;
  grid-template-columns: 142px minmax(0, 1fr);
  gap: 18px;
  padding: 13px 0;
  border-bottom: 1px dashed #dce4ef;
}

.formula-row span {
  font-size: 16px;
  font-weight: 800;
  color: #243348;
}

.formula-row p {
  margin: 0;
  font-size: 16px;
  color: #4a5667;
}

.insight-card {
  padding: 18px 22px;
  background: #f7faff;
}

.insight-card section + section {
  margin-top: 20px;
}

.insight-card h3 {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 800;
}

.insight-row {
  min-height: 34px;
  padding: 7px 0;
  border-bottom: 1px dashed #dfe7f1;
}

.insight-row em {
  grid-column: 2;
  font-size: 12px;
  color: #8b97a8;
}

.tone-good {
  color: #0a8f4d !important;
}

.tone-warn {
  color: #b8792b !important;
}

.tone-danger {
  color: #d92535 !important;
}

.tone-normal {
  color: #0b3b6f !important;
}

.table-head {
  margin-bottom: 10px;
}

.dim-tabs {
  display: flex;
  gap: 4px;
  margin: 0 -18px 14px;
  padding: 0 18px;
  border-bottom: 1px solid #e4eaf2;
}

.dim-tabs button {
  height: 42px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  color: #5a6779;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
}

.dim-tabs button.active {
  color: #2c6fbf;
  border-bottom-color: #2c6fbf;
}

.table-wrap {
  overflow: auto;
  border: 1px solid #e4eaf2;
  border-radius: 4px;
}

table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
}

th,
td {
  height: 44px;
  padding: 0 14px;
  white-space: nowrap;
  border-bottom: 1px solid #eef2f7;
}

th {
  font-size: 12px;
  font-weight: 700;
  color: #5a6779;
  cursor: pointer;
  background: #f5f7fa;
}

td {
  font-size: 13px;
  color: #1b2430;
}

tbody tr:nth-child(2n) {
  background: #fcfdff;
}

tfoot td {
  font-weight: 700;
  color: #0b3b6f;
  background: #f7f9fc;
  border-bottom: 0;
}

td a {
  color: #2c6fbf;
}

.sort-mark {
  margin-left: 6px;
  font-size: 10px;
  color: #b7c1cf;
}

.is-strong {
  font-weight: 700;
}

.is-danger {
  color: #a8422f;
}

.is-good {
  color: #2e6b4f;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 2px;
}

.tag-good {
  color: #24704c;
  background: #e8f6ef;
  border: 1px solid #bfe6d2;
}

.tag-warn {
  color: #946118;
  background: #fff7e6;
  border: 1px solid #f0d59a;
}

.tag-danger {
  color: #a8422f;
  background: #fff0ee;
  border: 1px solid #efc6bd;
}

.tag-normal {
  color: #315ba1;
  background: #edf3fb;
  border: 1px solid #c3d8f2;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  color: #7b8797;
}

.pager > div {
  display: flex;
  gap: 8px;
}

.column-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.column-list button {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  color: #1b2430;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dce2ec;
  border-radius: 4px;
}

.column-list button span {
  color: #2c6fbf;
}

.column-list button.muted {
  color: #9aa4b2;
  background: #f7f9fc;
}

.column-list button.muted span {
  color: #a8422f;
}

.modal-copy {
  margin: 0;
  color: #4a5667;
  line-height: 1.8;
}

@media (max-width: 1500px) {
  .report-filter {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .period-tabs,
  .filter-actions {
    grid-column: span 3;
  }
}

@media (max-width: 1180px) {
  .cockpit-readiness,
  .metric-grid,
  .analysis-grid,
  .review-grid {
    grid-template-columns: 1fr;
  }

  .report-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .report-meta {
    justify-content: flex-start;
    margin-top: 16px;
  }
}

@media (max-width: 760px) {
  .report-filter,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .period-tabs,
  .filter-actions {
    grid-column: auto;
  }

  .report-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .report-title-row h1 {
    font-size: 30px;
  }

  .formula-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
