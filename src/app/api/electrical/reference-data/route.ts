import { NextResponse } from 'next/server';
import {
  CABLE_IMPEDANCE_TABLE,
  XLPE_CABLE_LIBRARY,
  PVC_CABLE_LIBRARY,
  TRANSFORMER_LIBRARY,
  TRUNKING_SIZES,
} from '@/lib/engineering/cable-data';
import {
  CONDUIT_SIZES,
  MCCB_SIZES,
  MOTOR_RATINGS,
  MOTOR_CODE_TABLE,
  BUSBAR_MATERIALS,
  BUSBAR_DERATING_K1_TABLE,
  BUSBAR_DERATING_K2_TABLE,
  BUSBAR_DERATING_K3_TABLE,
  BUSBAR_DERATING_K4_TABLE,
  BUSBAR_DERATING_K5_TABLE,
  BUSBAR_DERATING_K6_TABLE,
  BUSBAR_DERATING_K8_TABLE,
  CABLE_OUTER_DIAMETERS,
  DEMAND_FACTORS,
  UTILIZATION_FACTORS,
  FUSE_MULTIPLIERS_NEC,
  REFLECTION_FACTORS,
  MAINTENANCE_FACTORS,
} from '@/lib/engineering/electrical-data';

export async function GET() {
  try {
    const referenceData = {
      // Cable impedance lookup table (Ω/km per IEC 60228)
      cableSizes: Object.entries(CABLE_IMPEDANCE_TABLE).map(([size, data]) => ({
        size_mm2: Number(size),
        R_copper_ohm_km: data.R_copper,
        R_aluminum_ohm_km: data.R_aluminum,
        X_ohm_km: data.X,
      })),

      // XLPE cable library
      xlpeCables: XLPE_CABLE_LIBRARY.map((c) => ({
        size_mm2: c.size_mm2,
        noOfCores: c.noOfCores,
        insulation: c.insulation,
        voltageGrade_kV: c.voltageGrade_kV,
        conductorType: c.conductorType,
        ampacityAir_A: c.ampacityAir_A,
        ampacityGround_A: c.ampacityGround_A,
        outerDia_mm: c.outerDia_mm,
        weight_kg_per_m: c.weight_kg_per_m,
        mV_per_A_per_m: c.mV_per_A_per_m,
      })),

      // PVC cable library
      pvcCables: PVC_CABLE_LIBRARY.map((c) => ({
        size_mm2: c.size_mm2,
        noOfCores: c.noOfCores,
        insulation: c.insulation,
        voltageGrade_kV: c.voltageGrade_kV,
        conductorType: c.conductorType,
        ampacityAir_A: c.ampacityAir_A,
        ampacityGround_A: c.ampacityGround_A,
        outerDia_mm: c.outerDia_mm,
        weight_kg_per_m: c.weight_kg_per_m,
        mV_per_A_per_m: c.mV_per_A_per_m,
      })),

      // Transformer library
      transformers: TRANSFORMER_LIBRARY.map((t) => ({
        kVA: t.kVA,
        impedance_pct: t.impedance_pct,
        noLoadLoss_kW: t.noLoadLoss_kW,
        loadLoss_kW: t.loadLoss_kW,
        voltageHV_kV: t.voltageHV_kV,
        voltageLV_kV: t.voltageLV_kV,
      })),

      // Trunking sizes
      trunkingSizes: TRUNKING_SIZES.map((t) => ({
        width_mm: t.width_mm,
        height_mm: t.height_mm,
        factor: t.factor,
      })),

      // Conduit sizes
      conduitSizes: CONDUIT_SIZES.map((c) => ({
        size_mm: c.size_mm,
        tradeSize: c.tradeSize,
        innerDia_mm: c.innerDia_mm,
        area_mm2: c.area_mm2,
        fillUpArea_40pct_mm2: c.fillUpArea_40pct_mm2,
      })),

      // Motor ratings
      motorRatings: MOTOR_RATINGS.map((m) => ({
        HP: m.HP,
        kW: m.kW,
        fullLoadCurrent_400V_3ph: m.fullLoadCurrent_400V_3ph,
      })),

      // Motor code letters (lock rotor kVA/HP)
      motorCodeLetters: Object.entries(MOTOR_CODE_TABLE).map(([code, data]) => ({
        code,
        min_kVA_per_HP: data.min,
        max_kVA_per_HP: data.max,
        typical_kVA_per_HP: (data.min + data.max) / 2,
      })),

      // MCCB sizes
      mccbSizes: MCCB_SIZES,

      // Busbar materials
      busbarMaterials: Object.entries(BUSBAR_MATERIALS).map(([name, data]) => ({
        name,
        conductivity: data.conductivity,
        resistivity: data.resistivity,
        density: data.density,
        k_factor: data.k_factor,
        baseRating_A_per_mm2: data.baseRating_A_per_mm2,
        currentDensity: data.currentDensity,
        materialConstant_K: data.materialConstant_K,
        permissibleStrength_kg_mm2: data.permissibleStrength_kg_mm2,
      })),

      // Busbar derating factor tables
      busbarDerating: {
        K1: BUSBAR_DERATING_K1_TABLE,
        K2: BUSBAR_DERATING_K2_TABLE,
        K3: BUSBAR_DERATING_K3_TABLE,
        K4: BUSBAR_DERATING_K4_TABLE,
        K5: BUSBAR_DERATING_K5_TABLE,
        K6: BUSBAR_DERATING_K6_TABLE,
        K8: BUSBAR_DERATING_K8_TABLE,
      },

      // Cable outer diameters
      cableOuterDiameters: Object.entries(CABLE_OUTER_DIAMETERS).map(([size, dia]) => ({
        size_mm2: Number(size),
        outerDia_mm: dia,
      })),

      // Cable factors (for trunking sizing)
      cableFactors: {
        solid: Object.entries(
          XLPE_CABLE_LIBRARY.reduce((acc, c) => {
            // Using a simplified factor mapping based on size
            acc[c.size_mm2] = Math.round(Math.PI * Math.pow(c.outerDia_mm / 2, 2) * 0.4);
            return acc;
          }, {} as Record<number, number>)
        ).map(([size, factor]) => ({ size_mm2: Number(size), factor })),
        stranded: Object.entries(
          XLPE_CABLE_LIBRARY.reduce((acc, c) => {
            acc[c.size_mm2] = Math.round(Math.PI * Math.pow(c.outerDia_mm / 2, 2) * 0.65);
            return acc;
          }, {} as Record<number, number>)
        ).map(([size, factor]) => ({ size_mm2: Number(size), factor })),
      },

      // Demand factors
      demandFactors: DEMAND_FACTORS,

      // Utilization factors
      utilizationFactors: UTILIZATION_FACTORS,

      // Fuse multipliers (NEC 430-52)
      fuseMultipliers: FUSE_MULTIPLIERS_NEC,

      // Reflection factors
      reflectionFactors: REFLECTION_FACTORS,

      // Maintenance factors
      maintenanceFactors: MAINTENANCE_FACTORS,
    };

    return NextResponse.json({ success: true, data: referenceData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
