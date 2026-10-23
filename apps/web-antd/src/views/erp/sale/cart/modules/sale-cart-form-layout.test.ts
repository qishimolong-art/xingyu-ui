import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { keepFreightFeeAdjacent } from './sale-cart-form-layout';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('sale cart form layout', () => {
  it('moves fee amount directly after freight type', () => {
    const schema = [
      { fieldName: 'freightType' },
      { fieldName: 'logisticsCompany' },
      { fieldName: 'feeAmount' },
    ];

    expect(
      keepFreightFeeAdjacent(schema).map((item) => item.fieldName),
    ).toEqual(['freightType', 'feeAmount', 'logisticsCompany']);
  });

  it('keeps permission-filtered schemas unchanged when either field is hidden', () => {
    const schema = [
      { fieldName: 'freightType' },
      { fieldName: 'logisticsCompany' },
    ];

    expect(keepFreightFeeAdjacent(schema)).toBe(schema);
  });

  it('keeps fee amount directly after freight type in detail mode', () => {
    const freightTypeIndex = formSource.lastIndexOf(
      "isDetailFieldVisible('freightType')",
    );
    const feeAmountIndex = formSource.lastIndexOf(
      "isDetailFieldVisible('feeAmount')",
    );
    const logisticsCompanyIndex = formSource.lastIndexOf(
      "isDetailFieldVisible('logisticsCompany')",
    );

    expect(freightTypeIndex).toBeGreaterThan(-1);
    expect(feeAmountIndex).toBeGreaterThan(freightTypeIndex);
    expect(logisticsCompanyIndex).toBeGreaterThan(feeAmountIndex);
  });

  it('restores delivery method and vin in the detail basic fields', () => {
    expect(formSource).toContain("isDetailFieldVisible('deliveryMethod')");
    expect(formSource).toContain('formatDetailText(formData?.deliveryMethod)');
    expect(formSource).toContain("isDetailFieldVisible('vin')");
    expect(formSource).toContain('formatDetailText(formData?.vin)');
  });

  it('adds VIN recognition controls and model_list result area', () => {
    expect(formSource).toContain('handleRecognizeVin');
    expect(formSource).toContain('recognizeSaleCartVin');
    expect(formSource).toContain('sale-cart-vin-recognize-addon');
    expect(formSource).toContain('匹配车型列表 model_list');
    expect(formSource).toContain('vinModelList');
  });

  it('renders VIN response keys with Chinese labels', () => {
    const officialVinFieldLabels = [
      ['matching_mode', '匹配模式'],
      ['is_commercial', '是否商用'],
      ['cid', '车ID'],
      ['brand_name', '品牌名称'],
      ['cartype', '车型'],
      ['series_name', '车系'],
      ['name', '车型车款'],
      ['year', '年款'],
      ['yeartype', '年款'],
      ['price', '厂家指导价'],
      ['gearbox', '变速箱'],
      ['geartype', '变速箱类型'],
      ['engine_model', '发动机型号'],
      ['driven_type', '驱动方式'],
      ['displacement_ml', '排量(mL)'],
      ['displacementml', '排量(mL)'],
      ['displacement', '排量(L)'],
      ['nedczhyh', '油耗'],
      ['effluent_standard', '环保标准'],
      ['environmentalstandards', '排放标准'],
      ['scale', '车辆级别'],
      ['csjg', '车身结构'],
      ['cms', '车门数(个)'],
      ['doornum', '车门数(个)'],
      ['zws', '座位数(个)'],
      ['seatnum', '座位数(个)'],
      ['market_date', '上市时间'],
      ['listdate', '上市日期'],
      ['stop_date', '停产日期'],
      ['len', '长度(mm)'],
      ['length', '长度(mm)'],
      ['width', '宽度(mm)'],
      ['high', '高度(mm)'],
      ['wheelbase', '轴距(mm)'],
      ['trackfront', '前轮距(mm)'],
      ['trackrear', '后轮距(mm)'],
      ['full_weight', '整备质量(kg)'],
      ['front_tyre_size', '前轮胎规格'],
      ['rear_tyre_size', '后轮胎规格'],
      ['fronttiresize', '前轮胎尺寸'],
      ['reartiresize', '后轮胎尺寸'],
      ['rlxs', '燃料形式'],
      ['ryxh', '燃油标号'],
      ['fuelgrade', '燃油标号'],
      ['gearbox_number', '变速箱号'],
      ['chassis_number', '底盘号'],
      ['carlist', '可能的车型'],
      ['model_list', '可能的销售车型列表'],
      ['full_weight_max', '最大满载质量(kg)'],
      ['full_weight_zz', '核载质量'],
      ['img', '车型图片'],
      ['manufacturer', '厂商'],
      ['zdgl', '最大功率'],
      ['maxpower', '最大功率(kW)'],
      ['front_brake_type', '前制动器类型'],
      ['frontbraketype', '前制动类型'],
      ['rear_brake_type', '后制动器类型'],
      ['rearbraketype', '后制动类型'],
      ['parking_brake_type', '驻车制动类型'],
      ['parkingbraketype', '驻车制动类型'],
      ['qfs', '气缸数'],
      ['cylindernum', '气缸数'],
      ['gyfs', '供油方式'],
      ['fuelmethod', '喷射方式'],
      ['is_import', '是否进口'],
      ['isimport', '是否进口'],
      ['is_rules', 'vin是否合规'],
      ['iscorrect', 'VIN是否合规'],
      ['market_price', '市场参考价'],
      ['marketprice', '市场价'],
      ['gearnum', '变速箱档位数'],
      ['body_type', '车体结构'],
      ['bodytype', '车身型式'],
      ['bodystructure', '车体结构'],
      ['zdml', '最大马力'],
      ['maxhorsepower', '最大马力(Ps)'],
      ['version', '销售版本'],
    ];

    officialVinFieldLabels.forEach(([field, label]) => {
      expect(formSource).toContain(`${field}: '${label}'`);
    });
    expect(formSource).toContain('getVinFieldLabel(key)');
    expect(formSource).toContain('vinModelColumns');
    expect(formSource).toContain('<h3>其他信息</h3>');
  });
});
