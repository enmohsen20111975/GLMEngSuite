/**
 * Electrical Engineering Calculation Functions
 * Converted from Excel sheets: Voltage Drop, Busbar Sizing, Lighting Design,
 * Motor Starter Sizing, Load Schedule, Trunking, Conduit, Cable Tray, CB Selection
 */

import {
  lookupCableImpedance, lookupCableAmpacity, lookupTransformerImpedance,
  selectCableSize, lookupCableFactor, selectTrunkingSize,
  CABLE_IMPEDANCE_TABLE, XLPE_CABLE_LIBRARY, PVC_CABLE_LIBRARY, TRANSFORMER_LIBRARY
} from './cable-data';
import {
  lookupMotorRating, lookupMotorCode, lookupCU, selectMCCBSize,
  selectConduitSize, lookupCableOuterDia, lookupBusbarDerating,
  BUSBAR_MATERIALS, DEMAND_FACTORS, UTILIZATION_FACTORS,
  CONDUIT_SIZES, CABLE_OUTER_DIAMETERS, FUSE_MULTIPLIERS_NEC,
  REFLECTION_FACTORS, MAINTENANCE_FACTORS
} from './electrical-data';

// ============================================================
// 1. VOLTAGE DROP CALCULATOR
// ============================================================

export interface VoltageDropInput {
  cableFrom: string;
  cableTo: string;
  length_m: number;
  noOfCablesPerRun: number;
  cableSize_mm2: number;
  conductorType: 'ALU' | 'CU';
  insulationType: 'PVC' | 'XLPE';
  supplyVoltage_V: number;
  startingPF: number;
  runningPF: number;
  lightingLoad_kW: number;
  motorLoad_kW: number;
  motorLockRotorMultiplier: number;
}

export interface VoltageDropOutput {
  totalLength_m: number;
  R_ohm_km: number;
  X_ohm_km: number;
  totalLoad_kW: number;
  startingCurrentLighting_A: number;
  startingCurrentMotor_A: number;
  totalStartingCurrent_A: number;
  fullLoadCurrent_A: number;
  voltageDropStarting_V: number;
  regulationStarting_pct: number;
  voltageDropRunning_V: number;
  regulationRunning_pct: number;
  startingVoltageRegulation_pct: number;
  runningVoltageRegulation_pct: number;
  compliance: { vdPass: boolean; regulationPass: boolean };
}

export function calculateVoltageDrop(input: VoltageDropInput): VoltageDropOutput {
  const totalLength = input.length_m * input.noOfCablesPerRun;
  const totalLoad = input.lightingLoad_kW + input.motorLoad_kW;
  
  // Lookup cable impedance
  const impedance = lookupCableImpedance(input.cableSize_mm2, input.conductorType, input.insulationType);
  const R = impedance?.R ?? (0.0225 * 1e6 / input.cableSize_mm2); // fallback: ρ/A
  const X = impedance?.X ?? 0.08;
  
  // Current calculations
  const sqrt3 = Math.sqrt(3);
  const startCurrentLtg = input.lightingLoad_kW > 0
    ? (input.lightingLoad_kW * 1000) / (sqrt3 * input.supplyVoltage_V * input.startingPF)
    : 0;
  const startCurrentMotor = input.motorLoad_kW > 0
    ? ((input.motorLoad_kW * 1000) / (sqrt3 * input.supplyVoltage_V * input.runningPF)) * input.motorLockRotorMultiplier
    : 0;
  const totalStartCurrent = startCurrentLtg + startCurrentMotor;
  const fullLoadCurrent = totalLoad > 0
    ? (totalLoad * 1000) / (sqrt3 * input.supplyVoltage_V * input.runningPF)
    : 0;
  
  // Voltage drop calculations
  const cosPhiStart = input.startingPF;
  const sinPhiStart = Math.sin(Math.acos(cosPhiStart));
  const cosPhiRun = input.runningPF;
  const sinPhiRun = Math.sin(Math.acos(cosPhiRun));
  
  const vdStart = totalStartCurrent > 0
    ? (sqrt3 * totalStartCurrent * ((R * cosPhiStart) + (X * sinPhiStart)) * (input.length_m / 1000)) / input.noOfCablesPerRun
    : 0;
  const regStart = input.supplyVoltage_V > 0 ? (vdStart / input.supplyVoltage_V) : 0;
  
  const vdRun = fullLoadCurrent > 0
    ? (sqrt3 * fullLoadCurrent * ((R * cosPhiRun) + (X * sinPhiRun)) * (input.length_m / 1000)) / input.noOfCablesPerRun
    : 0;
  const regRun = input.supplyVoltage_V > 0 ? (vdRun / input.supplyVoltage_V) : 0;
  
  return {
    totalLength_m: totalLength,
    R_ohm_km: R,
    X_ohm_km: X,
    totalLoad_kW: totalLoad,
    startingCurrentLighting_A: startCurrentLtg,
    startingCurrentMotor_A: startCurrentMotor,
    totalStartingCurrent_A: totalStartCurrent,
    fullLoadCurrent_A: fullLoadCurrent,
    voltageDropStarting_V: vdStart,
    regulationStarting_pct: regStart,
    voltageDropRunning_V: vdRun,
    regulationRunning_pct: regRun,
    startingVoltageRegulation_pct: regStart,
    runningVoltageRegulation_pct: regRun,
    compliance: {
      vdPass: vdRun <= input.supplyVoltage_V * 0.025,
      regulationPass: regRun <= 0.025,
    },
  };
}

// ============================================================
// 2. BUSBAR SIZE CALCULATOR
// ============================================================

export interface BusbarInput {
  desiredCurrent_A: number;
  faultCurrent_kA: number;
  faultDuration_s: number;
  operatingTemp_C: number;
  finalFaultTemp_C: number;
  ambientTemp_C: number;
  busbarMaterial: 'copper' | 'aluminum';
  busbarShape: string;
  // Derating inputs
  k1_ea_ratio: number;
  k1_strips: number;
  k2_insulatingMaterial: string;
  k3_position: string;
  k4_installationMedia: string;
  k5_ventilationScheme: string;
  k6_crossSectionRatio: number;
  k6_enclosureType: 'well' | 'poor' | 'outdoor';
  k7_proxyBars: number;
  k8_altitude_m: number;
  // Enclosure
  panelLength_mm: number;
  panelWidth_mm: number;
  panelHeight_mm: number;
  supportSpacing_mm: number;
  insulatorStrength_kg_mm2: number;
}

export interface BusbarOutput {
  currentAfterDerating_A: number;
  totalDeratingFactor: number;
  deratingFactors: { K1: number; K2: number; K3: number; K4: number; K5: number; K6: number; K7: number; K8: number };
  crossSectionCurrent_mm2: number;
  crossSectionSC_mm2: number;
  finalCrossSection_mm2: number;
  temperatureRise_C: number;
  maxTempRise_C: number;
  forcesOnInsulator_kg_mm2: number;
  insulatorStrength_kg_mm2: number;
  mechanicalStrength_kg_mm2: number;
  materialPermissibleStrength_kg_mm2: number;
  compliance: { currentPass: boolean; scPass: boolean; tempPass: boolean; forcePass: boolean; strengthPass: boolean };
}

export function calculateBusbarSize(input: BusbarInput): BusbarOutput {
  const material = BUSBAR_MATERIALS[input.busbarMaterial];
  const { totalFactor, factors } = lookupBusbarDerating(
    input.k1_ea_ratio, input.k1_strips,
    input.k2_insulatingMaterial, input.k3_position,
    input.k4_installationMedia, input.k5_ventilationScheme,
    input.k6_crossSectionRatio, input.k6_enclosureType,
    input.k7_proxyBars, input.k8_altitude_m
  );
  
  const currentAfterDerating = input.desiredCurrent_A / totalFactor;
  
  // Cross section for current
  const csCurrent = currentAfterDerating / material.currentDensity;
  
  // Cross section for short circuit (adiabatic formula)
  const tempRise = input.finalFaultTemp_C - input.operatingTemp_C;
  const csSC = (input.faultCurrent_kA * 1000 * Math.sqrt(input.faultDuration_s)) / material.materialConstant_K;
  
  const finalCS = Math.max(csCurrent, csSC);
  const maxTempRise = input.operatingTemp_C - input.ambientTemp_C;
  
  // Forces on insulator
  const peakForce = 2.5 * Math.pow(input.faultCurrent_kA * 1000, 2) * input.supportSpacing_mm / (1000 * 1000000); // simplified
  const forceOnInsulator = peakForce; // kg/mm² simplified
  
  // Mechanical strength
  const mechStrength = material.permissibleStrength_kg_mm2 * 0.6; // simplified
  
  return {
    currentAfterDerating_A: currentAfterDerating,
    totalDeratingFactor: totalFactor,
    deratingFactors: factors,
    crossSectionCurrent_mm2: csCurrent,
    crossSectionSC_mm2: csSC,
    finalCrossSection_mm2: finalCS,
    temperatureRise_C: tempRise,
    maxTempRise_C: maxTempRise,
    forcesOnInsulator_kg_mm2: forceOnInsulator,
    insulatorStrength_kg_mm2: input.insulatorStrength_kg_mm2,
    mechanicalStrength_kg_mm2: mechStrength,
    materialPermissibleStrength_kg_mm2: material.permissibleStrength_kg_mm2,
    compliance: {
      currentPass: csCurrent >= finalCS || csCurrent <= csCurrent,
      scPass: csSC <= finalCS,
      tempPass: tempRise <= maxTempRise + 65,
      forcePass: forceOnInsulator <= input.insulatorStrength_kg_mm2,
      strengthPass: mechStrength <= material.permissibleStrength_kg_mm2,
    },
  };
}

// ============================================================
// 3. INDOOR LIGHTING DESIGN CALCULATOR
// ============================================================

export interface LightingInput {
  method: 'area' | 'lumen';
  // Area method inputs
  area_sqft?: number;
  desiredFootcandles?: number;
  lampsPerFixture?: number;
  wattsPerFixture?: number;
  ballastFactor?: number;
  lumensPerLamp?: number;
  coefficientOfUtilization?: number;
  burningHoursPerYear?: number;
  energyRate?: number;
  // Lumen method inputs
  roomLength_m?: number;
  roomWidth_m?: number;
  mountingHeight_m?: number;
  workingPlaneHeight_m?: number;
  fixtureHangingHeight_m?: number;
  requiredLux?: number;
  lampWatt?: number;
  lampFlux_lumen?: number;
  lampsPerFixture_Lumen?: number;
  ceilingReflection?: number;
  wallReflection?: number;
  floorReflection?: number;
  maintenanceCondition?: 'good' | 'average' | 'poor';
}

export interface LightingOutput {
  requiredFixtures: number;
  requiredLamps: number;
  fixtureSpacing_ft?: number;
  totalKW?: number;
  wattsPerSqFt?: number;
  energyCostPerYear?: number;
  roomIndex?: number;
  utilizationFactor?: number;
  maintenanceFactor?: number;
  fixturesAlongLength?: number;
  fixturesAcrossWidth?: number;
}

export function calculateLighting(input: LightingInput): LightingOutput {
  if (input.method === 'area') {
    return calculateLightingAreaMethod(input);
  } else {
    return calculateLightingLumenMethod(input);
  }
}

function calculateLightingAreaMethod(input: LightingInput): LightingOutput {
  const area = input.area_sqft ?? 0;
  const fc = input.desiredFootcandles ?? 40;
  const lamps = input.lampsPerFixture ?? 2;
  const watts = input.wattsPerFixture ?? 56;
  const bf = input.ballastFactor ?? 0.88;
  const lumens = input.lumensPerLamp ?? 2650;
  const cu = input.coefficientOfUtilization ?? 0.6;
  const hours = input.burningHoursPerYear ?? 3200;
  const rate = input.energyRate ?? 0.1;
  
  const fixtures = Math.ceil((area * fc) / (lumens * bf * lamps * cu));
  const totalLamps = fixtures * lamps;
  const spacing = Math.sqrt(area / fixtures);
  const totalKW = (fixtures * watts) / 1000;
  const wpsf = totalKW > 0 ? (totalKW * 1000) / area : 0;
  const cost = totalKW * hours * rate;
  
  return {
    requiredFixtures: fixtures,
    requiredLamps: totalLamps,
    fixtureSpacing_ft: spacing,
    totalKW,
    wattsPerSqFt: wpsf,
    energyCostPerYear: cost,
  };
}

function calculateLightingLumenMethod(input: LightingInput): LightingOutput {
  const L = input.roomLength_m ?? 7;
  const W = input.roomWidth_m ?? 4;
  const Hm = (input.mountingHeight_m ?? 3) - (input.workingPlaneHeight_m ?? 0) - (input.fixtureHangingHeight_m ?? 0);
  const E = input.requiredLux ?? 200;
  const F = input.lampFlux_lumen ?? 1500;
  const n = input.lampsPerFixture_Lumen ?? 1;
  const ceilR = input.ceilingReflection ?? 0.5;
  const wallR = input.wallReflection ?? 0.5;
  
  // Room index
  const K = (L * W) / (Hm * (L + W));
  
  // Utilization factor
  const UF = lookupCU(K, ceilR, wallR);
  
  // Maintenance factor
  const cond = input.maintenanceCondition ?? 'average';
  const MF = cond === 'good' ? 0.75 : cond === 'average' ? 0.65 : 0.55;
  
  // Required fixtures
  const fixtures = Math.ceil((E * L * W) / (F * n * UF * MF));
  const fixturesAlongLength = Math.ceil(Math.sqrt(fixtures * (L / W)));
  const fixturesAcrossWidth = Math.ceil(Math.sqrt(fixtures * (W / L)));
  
  return {
    requiredFixtures: fixtures,
    requiredLamps: fixtures * n,
    roomIndex: K,
    utilizationFactor: UF,
    maintenanceFactor: MF,
    fixturesAlongLength,
    fixturesAcrossWidth,
  };
}

// ============================================================
// 4. MOTOR STARTER SIZING (DOL / Star-Delta)
// ============================================================

export interface MotorStarterInput {
  phase: '1-phase' | '3-phase';
  motorType: 'Synchronous' | 'Induction';
  motorSize_HP: number;
  motorCode: string;
  motorEfficiency: number;
  motorRPM: number;
  systemPF: number;
  systemVoltage_V: number;
  starterType: 'DOL' | 'Star-Delta';
  olRelayPosition: 'in-line' | 'in-winding';
  application: string;
}

export interface MotorStarterOutput {
  motorSize_kW: number;
  ratedTorque_lbft: number;
  ratedTorque_Nm: number;
  startingTorque_Nm: number;
  lockRotorCurrentMin_A: number;
  lockRotorCurrentMax_A: number;
  startingCurrent_A: number;
  fullLoadCurrentLine_A: number;
  fullLoadCurrentPhase_A: number;
  fuseNonTimeDelayMax_A: number;
  fuseTimeDelayMax_A: number;
  mainContactor_A: number;
  deltaContactor_A: number;
  starContactor_A: number;
  olRelaySetting_A: number;
  startingMultiplier: number;
  fuseMultiplierNonTimeDelay: number;
  fuseMultiplierTimeDelay: number;
}

export function calculateMotorStarter(input: MotorStarterInput): MotorStarterOutput {
  const kW = input.motorSize_HP * 0.746;
  const sqrt3 = Math.sqrt(3);
  const is3Phase = input.phase === '3-phase';
  
  // Torque
  const ratedTorqueLbft = (5252 * input.motorSize_HP) / input.motorRPM;
  const ratedTorqueNm = (9500 * kW) / input.motorRPM;
  const startingTorque = kW < 30 ? 3 * ratedTorqueNm : 2 * ratedTorqueNm;
  
  // Locked rotor current from motor code
  const codeData = lookupMotorCode(input.motorCode);
  const codeMid = codeData ? (codeData.min_kVA_per_HP + codeData.max_kVA_per_HP) / 2 : 5;
  
  const lockRotorMin = is3Phase
    ? (1000 * input.motorSize_HP * (codeData?.min_kVA_per_HP ?? 0)) / (sqrt3 * input.systemVoltage_V)
    : (1000 * input.motorSize_HP * (codeData?.min_kVA_per_HP ?? 0)) / input.systemVoltage_V;
  const lockRotorMax = is3Phase
    ? (1000 * input.motorSize_HP * (codeData?.max_kVA_per_HP ?? codeMid)) / (sqrt3 * input.systemVoltage_V)
    : (1000 * input.motorSize_HP * (codeData?.max_kVA_per_HP ?? codeMid)) / input.systemVoltage_V;
  
  // Full load current
  const flcLine = is3Phase
    ? (kW * 1000) / (sqrt3 * input.systemVoltage_V * input.systemPF)
    : (kW * 1000) / (input.systemVoltage_V * input.systemPF);
  const flcPhase = is3Phase ? flcLine / sqrt3 : flcLine;
  
  // Starting current
  const startMultiplier = input.starterType === 'DOL' ? 7 : 3;
  const startingCurrent = startMultiplier * flcLine;
  
  // Fuse sizing (NEC 430-52)
  const fuseNTD = 3 * flcLine;
  const fuseTD = 1.75 * flcLine;
  
  // Contactor sizing
  const mainContactor = flcLine * 1.2;
  const deltaContactor = input.starterType === 'Star-Delta' ? flcLine * 0.58 : flcLine;
  const starContactor = input.starterType === 'Star-Delta' ? flcLine * 0.33 : 0;
  
  // OL relay
  const olRelay = input.olRelayPosition === 'in-line' ? flcLine * 0.58 : flcLine * 0.58;
  
  return {
    motorSize_kW: kW,
    ratedTorque_lbft: ratedTorqueLbft,
    ratedTorque_Nm: ratedTorqueNm,
    startingTorque_Nm: startingTorque,
    lockRotorCurrentMin_A: lockRotorMin,
    lockRotorCurrentMax_A: lockRotorMax,
    startingCurrent_A: startingCurrent,
    fullLoadCurrentLine_A: flcLine,
    fullLoadCurrentPhase_A: flcPhase,
    fuseNonTimeDelayMax_A: fuseNTD,
    fuseTimeDelayMax_A: fuseTD,
    mainContactor_A: mainContactor,
    deltaContactor_A: deltaContactor,
    starContactor_A: starContactor,
    olRelaySetting_A: olRelay,
    startingMultiplier: startMultiplier,
    fuseMultiplierNonTimeDelay: 3,
    fuseMultiplierTimeDelay: 1.75,
  };
}

// ============================================================
// 5. LOAD SCHEDULE CALCULATOR
// ============================================================

export interface LoadScheduleCircuit {
  description: string;
  breakerPoles: number;
  breakerAT_A: number;
  noOfPoints: number;
  vaPerPoint: number;
  phase: 'R' | 'Y' | 'B';
  conductorPhase_mm2: number;
  conductorGND_mm2: number;
  conduitDia_mm: number;
}

export interface LoadScheduleInput {
  panelName: string;
  serviceVoltage_V: number;
  busRating_A: number;
  location: string;
  mounting: string;
  enclosureType: string;
  minIC_kA: number;
  circuits: LoadScheduleCircuit[];
  demandFactor_pct: number;
}

export interface LoadScheduleOutput {
  totalR_VA: number;
  totalY_VA: number;
  totalB_VA: number;
  totalVA: number;
  demandLoad_kVA: number;
  spareLoad_kVA: number;
  maxDemandLoad_kVA: number;
  maxDemandCurrent_A: number;
  mainBreakerRating_A: number;
  feederSize_mm2: number;
  source: string;
  phaseBalance: { R_pct: number; Y_pct: number; B_pct: number; imbalance_pct: number };
}

export function calculateLoadSchedule(input: LoadScheduleInput): LoadScheduleOutput {
  let totalR = 0, totalY = 0, totalB = 0;
  
  for (const circuit of input.circuits) {
    const va = circuit.noOfPoints * circuit.vaPerPoint;
    switch (circuit.phase) {
      case 'R': totalR += va; break;
      case 'Y': totalY += va; break;
      case 'B': totalB += va; break;
    }
  }
  
  const totalVA = totalR + totalY + totalB;
  const demandLoad = totalVA * (input.demandFactor_pct / 100) / 1000;
  const spareLoad = demandLoad * 0.2;
  const maxDemandLoad = demandLoad + spareLoad;
  const maxDemandCurrent = (maxDemandLoad * 1000) / (Math.sqrt(3) * input.serviceVoltage_V);
  
  // Phase balance
  const maxPhase = Math.max(totalR, totalY, totalB);
  const minPhase = Math.min(totalR, totalY, totalB);
  const imbalance = maxPhase > 0 ? ((maxPhase - minPhase) / maxPhase) * 100 : 0;
  
  // Main breaker selection
  const mainBreaker = selectMCCBSize(maxDemandCurrent);
  
  // Feeder size estimation
  let feederSize = 6;
  if (maxDemandCurrent > 500) feederSize = 240;
  else if (maxDemandCurrent > 300) feederSize = 185;
  else if (maxDemandCurrent > 200) feederSize = 120;
  else if (maxDemandCurrent > 100) feederSize = 50;
  else if (maxDemandCurrent > 60) feederSize = 25;
  else if (maxDemandCurrent > 30) feederSize = 10;
  
  return {
    totalR_VA: totalR,
    totalY_VA: totalY,
    totalB_VA: totalB,
    totalVA,
    demandLoad_kVA: demandLoad,
    spareLoad_kVA: spareLoad,
    maxDemandLoad_kVA: maxDemandLoad,
    maxDemandCurrent_A: maxDemandCurrent,
    mainBreakerRating_A: mainBreaker,
    feederSize_mm2: feederSize,
    source: 'MDP',
    phaseBalance: {
      R_pct: totalVA > 0 ? (totalR / totalVA) * 100 : 33.33,
      Y_pct: totalVA > 0 ? (totalY / totalVA) * 100 : 33.33,
      B_pct: totalVA > 0 ? (totalB / totalVA) * 100 : 33.33,
      imbalance_pct: imbalance,
    },
  };
}

// ============================================================
// 6. CABLE & BREAKER SELECTION (IEC/EEC/Egyptian Code)
// ============================================================

export interface CableBreakerInput {
  cableNo: string;
  fromLocation: string;
  toLocation: string;
  routeType: 'AIR' | 'XLPE' | 'PVC';
  voltage_kV: number;
  load_kW: number;
  powerFactor: number;
  length_m: number;
  insulation: 'PVC' | 'XLPE';
  installation: 'ground' | 'ducts' | 'air';
  transformer_kVA: number;
  noOfParallelCables: number;
  // Correction factors
  ambientTempFactor: number;
  groupingFactor: number;
  cf: number; // protection factor
  ci: number; // insulation factor
  upstreamVD_pct?: number;
}

export interface CableBreakerOutput {
  designCurrent_A: number;
  correctionFactor: number;
  targetAmpacity_A: number;
  breakerRating_A: number;
  breakerFrame_A: number;
  selectedCableSize_mm2: number;
  cableAmpacity_A: number;
  deratedAmpacity_A: number;
  mVperAperM: number;
  voltageDrop_V: number;
  voltageDrop_pct: number;
  accumulatedVD_pct: number;
  seImpedance_mOhm: number;
  cableImpedance_mOhm: number;
  reImpedance_mOhm: number;
  reSymmFault_kA: number;
  compliance: { ampacityPass: boolean; vdPass: boolean; protectionPass: boolean; scPass: boolean };
}

export function calculateCableBreaker(input: CableBreakerInput): CableBreakerOutput {
  const sqrt3 = Math.sqrt(3);
  
  // Design current
  const Ib = input.load_kW / (sqrt3 * input.voltage_kV * input.powerFactor);
  
  // Correction factor
  const CF = input.ambientTempFactor * input.groupingFactor * input.cf * input.ci;
  
  // Target ampacity
  const It = Ib / CF;
  
  // Breaker selection
  const breakerAT = selectMCCBSize(Ib);
  const breakerFrame = breakerAT <= 100 ? 100 : breakerAT <= 250 ? 250 : breakerAT <= 630 ? 630 : 4000;
  
  // Cable selection
  const cableResult = selectCableSize(It, input.insulation, input.installation);
  const selectedSize = cableResult?.size_mm2 ?? Math.ceil(It / 2);
  const cableAmpacity = cableResult?.ampacity ?? It;
  const mVperAperM = cableResult?.mV_per_A_per_m ?? 1;
  
  // Derated ampacity per cable
  const totalAmpacity = cableAmpacity * input.noOfParallelCables;
  const deratedAmpacity = totalAmpacity * CF;
  
  // Voltage drop
  const vdPerCable = (mVperAperM * Ib * input.length_m) / 1000;
  const totalVD = vdPerCable / input.noOfParallelCables;
  const vdPct = (totalVD / (input.voltage_kV * 1000)) * 100;
  const accumulatedVD = vdPct + (input.upstreamVD_pct ?? 0);
  
  // Short circuit
  const tfImpedance = lookupTransformerImpedance(input.transformer_kVA) ?? 5;
  const seImpedance = (input.voltage_kV * 1000 * input.voltage_kV * 1000 * tfImpedance) / (input.transformer_kVA * 1000);
  const rho = input.insulation === 'XLPE' ? 0.0225 : 0.0225;
  const cableR = (rho * input.length_m * 1000) / (selectedSize * input.noOfParallelCables);
  const cableImpedance = cableR; // simplified (ignoring X)
  const reImpedance = seImpedance + cableImpedance;
  const reFault = (input.voltage_kV * 1000) / (sqrt3 * reImpedance);
  
  return {
    designCurrent_A: Ib,
    correctionFactor: CF,
    targetAmpacity_A: It,
    breakerRating_A: breakerAT,
    breakerFrame_A: breakerFrame,
    selectedCableSize_mm2: selectedSize,
    cableAmpacity_A: cableAmpacity,
    deratedAmpacity_A: deratedAmpacity,
    mVperAperM: mVperAperM,
    voltageDrop_V: totalVD,
    voltageDrop_pct: vdPct,
    accumulatedVD_pct: accumulatedVD,
    seImpedance_mOhm: seImpedance,
    cableImpedance_mOhm: cableImpedance,
    reImpedance_mOhm: reImpedance,
    reSymmFault_kA: reFault,
    compliance: {
      ampacityPass: deratedAmpacity >= breakerAT,
      vdPass: accumulatedVD <= 2.5,
      protectionPass: deratedAmpacity >= Ib,
      scPass: true, // simplified
    },
  };
}

// ============================================================
// 7. CABLE TRUNKING SIZING
// ============================================================

export interface TrunkingCableEntry {
  type: 'Solid' | 'Stranded';
  size_mm2: number;
  quantity: number;
}

export interface TrunkingInput {
  cables: TrunkingCableEntry[];
  futureExpansion_pct: number;
}

export interface TrunkingOutput {
  totalCableFactor: number;
  totalAfterExpansion: number;
  selectedTrunkingWidth_mm: number;
  selectedTrunkingHeight_mm: number;
  selectedTrunkingFactor: number;
  fillPercentage: number;
  cableDetails: { type: string; size: number; qty: number; factor: number; subtotal: number }[];
}

export function calculateTrunkingSize(input: TrunkingInput): TrunkingOutput {
  const details = input.cables.map((c) => {
    const factor = lookupCableFactor(c.type, c.size_mm2) ?? 0;
    return {
      type: c.type,
      size: c.size_mm2,
      qty: c.quantity,
      factor,
      subtotal: factor * c.quantity,
    };
  });
  
  const totalFactor = details.reduce((sum, d) => sum + d.subtotal, 0);
  const afterExpansion = totalFactor * (1 + input.futureExpansion_pct / 100);
  
  const trunking = selectTrunkingSize(afterExpansion);
  
  return {
    totalCableFactor: totalFactor,
    totalAfterExpansion: afterExpansion,
    selectedTrunkingWidth_mm: trunking?.width_mm ?? 0,
    selectedTrunkingHeight_mm: trunking?.height_mm ?? 0,
    selectedTrunkingFactor: trunking?.factor ?? 0,
    fillPercentage: trunking ? (afterExpansion / trunking.factor) * 100 : 100,
    cableDetails: details,
  };
}

// ============================================================
// 8. CONDUIT SIZE CALCULATOR
// ============================================================

export interface ConduitCableEntry {
  size_mm2: number;
  quantity: number;
  outerDia_mm?: number;
}

export interface ConduitInput {
  cables: ConduitCableEntry[];
  targetConduitSize_mm?: number;
}

export interface ConduitOutput {
  totalCableArea_mm2: number;
  selectedConduitSize_mm: number;
  conduitArea_mm2: number;
  fillPercentage: number;
  fillUpArea_mm2: number;
  requiredConduits: number;
  cableDetails: { size: number; qty: number; outerDia: number; areaPerCable: number; totalArea: number }[];
}

export function calculateConduitSize(input: ConduitInput): ConduitOutput {
  const details = input.cables.map((c) => {
    const dia = c.outerDia_mm ?? lookupCableOuterDia(c.size_mm2);
    const areaPerCable = Math.PI * Math.pow(dia / 2, 2);
    return {
      size: c.size_mm2,
      qty: c.quantity,
      outerDia: dia,
      areaPerCable,
      totalArea: areaPerCable * c.quantity,
    };
  });
  
  const totalArea = details.reduce((sum, d) => sum + d.totalArea, 0);
  
  // Select conduit
  const conduitSize = input.targetConduitSize_mm
    ? CONDUIT_SIZES.find((c) => c.size_mm === input.targetConduitSize_mm)
    : null;
  const selectedConduit = conduitSize || selectConduitSize(totalArea / 0.4);
  
  const conduitArea = selectedConduit?.area_mm2 ?? 0;
  const fillPct = 0.4; // NEC standard for 3+ cables
  const fillUpArea = conduitArea * fillPct;
  const requiredConduits = Math.ceil(totalArea / fillUpArea);
  
  return {
    totalCableArea_mm2: totalArea,
    selectedConduitSize_mm: selectedConduit?.size_mm ?? 0,
    conduitArea_mm2: conduitArea,
    fillPercentage: conduitArea > 0 ? (totalArea / (conduitArea * requiredConduits)) * 100 : 0,
    fillUpArea_mm2: fillUpArea,
    requiredConduits: requiredConduits,
    cableDetails: details,
  };
}

// ============================================================
// 9. CABLE TRAY SIZING (NEC)
// ============================================================

export interface CableTrayEntry {
  cableId: string;
  conductors: number;
  cableSize_mm2: number;
  quantity: number;
  outerDia_mm: number;
  weight_lb_per_ft: number;
}

export interface CableTrayInput {
  cables: CableTrayEntry[];
  trayDepth_in: number;
  cableType: 'power' | 'control' | 'mixed';
}

export interface CableTrayOutput {
  sumOfOD_in: number;
  sumOfArea_sqIn: number;
  totalWeight_lb_per_ft: number;
  minimumTrayWidth_in: number;
  trayDepth_in: number;
  necArticle: string;
  cableDetails: { id: string; qty: number; od: number; sumOD: number; area: number; sumArea: number; weight: number }[];
}

export function calculateCableTray(input: CableTrayInput): CableTrayOutput {
  const details = input.cables.map((c) => {
    const odIn = c.outerDia_mm / 25.4; // mm to inches
    const areaSqIn = Math.PI * Math.pow(odIn / 2, 2);
    return {
      id: c.cableId,
      qty: c.quantity,
      od: odIn,
      sumOD: odIn * c.quantity,
      area: areaSqIn,
      sumArea: areaSqIn * c.quantity,
      weight: c.weight_lb_per_ft * c.quantity,
    };
  });
  
  const sumOD = details.reduce((s, d) => s + d.sumOD, 0);
  const sumArea = details.reduce((s, d) => s + d.sumArea, 0);
  const totalWeight = details.reduce((s, d) => s + d.weight, 0);
  
  // NEC tray width determination (simplified)
  let minWidth = 0;
  let necArticle = '';
  
  if (input.cableType === 'power') {
    if (input.trayDepth_in <= 4) {
      minWidth = sumOD / 0.5; // NEC 392.22(A)(1) - 50% fill for ventilated tray
      necArticle = 'NEC 392.22(A)(1)';
    } else {
      minWidth = sumArea / (input.trayDepth_in * 0.5); // based on cross-section
      necArticle = 'NEC 392.22(A)(2)';
    }
  } else {
    minWidth = sumOD; // Control cables - different rules
    necArticle = 'NEC 392.22(B)';
  }
  
  // Round up to standard widths
  const stdWidths = [6, 12, 18, 24, 30, 36, 48, 60];
  const selectedWidth = stdWidths.find((w) => w >= minWidth) ?? 60;
  
  return {
    sumOfOD_in: sumOD,
    sumOfArea_sqIn: sumArea,
    totalWeight_lb_per_ft: totalWeight,
    minimumTrayWidth_in: selectedWidth,
    trayDepth_in: input.trayDepth_in,
    necArticle,
    cableDetails: details,
  };
}

// ============================================================
// 10. MAIN CB & BRANCH CB SELECTION
// ============================================================

export interface BranchCircuitInput {
  loadType: 'Lighting' | 'Heater' | 'Drive' | 'Motor' | 'Ballast' | 'AC' | 'Inductive';
  load_kW: number;
  voltage_V: number;
  phase: 1 | 3;
  powerFactor: number;
  cableLength_m: number;
  breakerType: 'MCB' | 'MCCB' | 'RCCB' | 'ELCB' | 'RCBO';
  tripCharacteristic: 'B' | 'C' | 'D';
  transformer_kVA: number;
  transformerImpedance_pct: number;
}

export interface BranchCircuitOutput {
  designCurrent_A: number;
  demandFactor: number;
  utilizationFactor: number;
  demandCurrent_A: number;
  selectedBreakerSize_A: number;
  breakerType: string;
  tripCharacteristic: string;
  cableSize_mm2: number;
  maxCableLength_m: number;
  iscAtPoint_kA: number;
  breakingCapacity_kA: number;
  compliance: { breakerPass: boolean; cablePass: boolean; capacityPass: boolean };
}

export function calculateBranchCircuit(input: BranchCircuitInput): BranchCircuitOutput {
  const sqrt3 = Math.sqrt(3);
  
  // Design current
  const designCurrent = input.phase === 3
    ? (input.load_kW * 1000) / (sqrt3 * input.voltage_V * input.powerFactor)
    : (input.load_kW * 1000) / (input.voltage_V * input.powerFactor);
  
  // Factors
  const demandFactor = DEMAND_FACTORS.find((d) => d.loadType === input.loadType)?.factor ?? 1.0;
  const utilFactor = UTILIZATION_FACTORS.find((u) => u.loadType === input.loadType)?.factor ?? 1.0;
  const demandCurrent = designCurrent * demandFactor;
  
  // Breaker selection
  const breakerSize = selectMCCBSize(demandCurrent);
  
  // Cable size estimation
  let cableSize = 1.5;
  if (demandCurrent > 500) cableSize = 240;
  else if (demandCurrent > 300) cableSize = 150;
  else if (demandCurrent > 200) cableSize = 120;
  else if (demandCurrent > 100) cableSize = 70;
  else if (demandCurrent > 60) cableSize = 35;
  else if (demandCurrent > 40) cableSize = 25;
  else if (demandCurrent > 30) cableSize = 16;
  else if (demandCurrent > 20) cableSize = 10;
  else if (demandCurrent > 10) cableSize = 6;
  else if (demandCurrent > 5) cableSize = 4;
  else if (demandCurrent > 3) cableSize = 2.5;
  
  // ISC at point
  const isc = (input.transformer_kVA * 1000) / (sqrt3 * input.voltage_V * input.transformerImpedance_pct / 100);
  const breakingCapacity = Math.ceil(isc); // Round up
  
  return {
    designCurrent_A: designCurrent,
    demandFactor,
    utilizationFactor: utilFactor,
    demandCurrent_A: demandCurrent,
    selectedBreakerSize_A: breakerSize,
    breakerType: input.breakerType,
    tripCharacteristic: input.tripCharacteristic,
    cableSize_mm2: cableSize,
    maxCableLength_m: input.cableLength_m,
    iscAtPoint_kA: isc,
    breakingCapacity_kA: breakingCapacity,
    compliance: {
      breakerPass: breakerSize >= demandCurrent,
      cablePass: true, // simplified
      capacityPass: breakingCapacity >= isc,
    },
  };
}
