// Cable data for electrical engineering calculations
// Based on IEC 60364-5-52, IEC 60228, and typical manufacturer data
// All impedance values per conductor per km

// ============================================================
// Cable Impedance Table (IEC 60228)
// ============================================================

interface CableImpedanceData {
  R_copper: number;   // Resistance at 70°C (PVC) / 90°C (XLPE) in Ω/km
  R_aluminum: number; // Resistance at 70°C (PVC) / 90°C (XLPE) in Ω/km
  X: number;          // Reactance in Ω/km (typical for multi-core cables)
}

export const CABLE_IMPEDANCE_TABLE: Record<number, CableImpedanceData> = {
  1.5:  { R_copper: 12.10,  R_aluminum: 20.00, X: 0.100 },
  2.5:  { R_copper: 7.410,  R_aluminum: 12.10, X: 0.098 },
  4:    { R_copper: 4.610,  R_aluminum: 7.560, X: 0.095 },
  6:    { R_copper: 3.080,  R_aluminum: 5.090, X: 0.093 },
  10:   { R_copper: 1.830,  R_aluminum: 3.030, X: 0.091 },
  16:   { R_copper: 1.150,  R_aluminum: 1.910, X: 0.088 },
  25:   { R_copper: 0.727,  R_aluminum: 1.200, X: 0.085 },
  35:   { R_copper: 0.524,  R_aluminum: 0.868, X: 0.083 },
  50:   { R_copper: 0.387,  R_aluminum: 0.641, X: 0.082 },
  70:   { R_copper: 0.268,  R_aluminum: 0.443, X: 0.080 },
  95:   { R_copper: 0.193,  R_aluminum: 0.320, X: 0.079 },
  120:  { R_copper: 0.153,  R_aluminum: 0.253, X: 0.078 },
  150:  { R_copper: 0.124,  R_aluminum: 0.206, X: 0.077 },
  185:  { R_copper: 0.0991, R_aluminum: 0.164, X: 0.077 },
  240:  { R_copper: 0.0754, R_aluminum: 0.125, X: 0.076 },
  300:  { R_copper: 0.0601, R_aluminum: 0.100, X: 0.075 },
  400:  { R_copper: 0.0470, R_aluminum: 0.0778, X: 0.074 },
  500:  { R_copper: 0.0366, R_aluminum: 0.0605, X: 0.073 },
  630:  { R_copper: 0.0283, R_aluminum: 0.0469, X: 0.072 },
};

/**
 * Look up cable impedance data for a given cable size, conductor type, and insulation.
 * Returns R and X values in Ω/km.
 */
export function lookupCableImpedance(
  cableSize_mm2: number,
  conductorType: 'ALU' | 'CU',
  insulationType: 'PVC' | 'XLPE'
): { R: number; X: number } {
  const data = CABLE_IMPEDANCE_TABLE[cableSize_mm2];
  if (!data) {
    // Fallback: use resistivity-based calculation
    const rho = conductorType === 'CU' ? 0.0225 : 0.036; // Ω·mm²/m
    const tempFactor = insulationType === 'XLPE' ? 1.11 : 1.0; // higher temp → higher R
    return {
      R: (rho / cableSize_mm2) * 1000 * tempFactor,
      X: 0.080,
    };
  }

  const R = conductorType === 'CU' ? data.R_copper : data.R_aluminum;
  // XLPE operates at higher temp → ~3% higher resistance
  const R_adjusted = insulationType === 'XLPE' ? R * 1.03 : R;

  return {
    R: R_adjusted,
    X: data.X,
  };
}

// ============================================================
// Cable Ampacity Data (IEC 60364-5-52)
// ============================================================

const CABLE_AMPACITY: Record<string, Record<number, number>> = {
  // insulation → size → ampacity (A) — 3-core cables in air at 30°C ambient
  'PVC': {
    1.5: 18, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 73, 25: 96, 35: 119,
    50: 144, 70: 186, 95: 227, 120: 262, 150: 301, 185: 346, 240: 408,
    300: 470, 400: 555,
  },
  'XLPE': {
    1.5: 22, 2.5: 30, 4: 40, 6: 52, 10: 71, 16: 87, 25: 116, 35: 143,
    50: 174, 70: 225, 95: 275, 120: 318, 150: 366, 185: 423, 240: 498,
    300: 572, 400: 665,
  },
};

const CABLE_SIZES_ORDERED = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];

// mV/A/m values for 3-phase balanced load (typical copper, multi-core)
const CABLE_MV_PER_A_PER_M: Record<string, Record<number, number>> = {
  'PVC': {
    1.5: 29, 2.5: 18, 4: 11, 6: 7.5, 10: 4.5, 16: 2.8, 25: 1.8, 35: 1.3,
    50: 0.95, 70: 0.65, 95: 0.47, 120: 0.37, 150: 0.30, 185: 0.24,
    240: 0.185, 300: 0.148, 400: 0.115,
  },
  'XLPE': {
    1.5: 29, 2.5: 18, 4: 11, 6: 7.5, 10: 4.5, 16: 2.8, 25: 1.8, 35: 1.3,
    50: 0.95, 70: 0.65, 95: 0.47, 120: 0.37, 150: 0.30, 185: 0.24,
    240: 0.185, 300: 0.148, 400: 0.115,
  },
};

/**
 * Select cable size based on required current, insulation, and installation method.
 * Returns an object with size, ampacity, and mV/A/m data.
 */
export function selectCableSize(
  current: number,
  insulation: string = 'PVC',
  installation: string = 'air'
): { size_mm2: number; ampacity: number; mV_per_A_per_m: number } {
  const insKey = insulation === 'XLPE' ? 'XLPE' : 'PVC';
  const table = CABLE_AMPACITY[insKey];
  const mVTable = CABLE_MV_PER_A_PER_M[insKey];
  if (!table) {
    return { size_mm2: 16, ampacity: 73, mV_per_A_per_m: 2.8 };
  }

  // Installation derating
  const instFactor = installation === 'ground' ? 0.9 : installation === 'ducts' ? 0.8 : 1.0;

  for (const size of CABLE_SIZES_ORDERED) {
    if ((table[size] ?? 0) * instFactor >= current) {
      return {
        size_mm2: size,
        ampacity: (table[size] ?? 0) * instFactor,
        mV_per_A_per_m: mVTable?.[size] ?? 1,
      };
    }
  }
  return {
    size_mm2: 400,
    ampacity: (table[400] ?? 555) * instFactor,
    mV_per_A_per_m: mVTable?.[400] ?? 0.115,
  };
}

/**
 * Look up cable ampacity for a given size and insulation type.
 */
export function lookupCableAmpacity(size_mm2: number, insulation: string = 'PVC'): number {
  const insKey = insulation === 'XLPE' ? 'XLPE' : 'PVC';
  const table = CABLE_AMPACITY[insKey];
  if (!table) return 0;
  return table[size_mm2] ?? 0;
}

// ============================================================
// XLPE / PVC Cable Libraries
// ============================================================

export interface CableLibraryEntry {
  size_mm2: number;
  noOfCores: number;
  insulation: 'XLPE' | 'PVC';
  voltageGrade_kV: number;
  conductorType: 'CU' | 'ALU';
  ampacityAir_A: number;
  ampacityGround_A: number;
  outerDia_mm: number;
  weight_kg_per_m: number;
  mV_per_A_per_m: number;
}

export const XLPE_CABLE_LIBRARY: CableLibraryEntry[] = [
  { size_mm2: 1.5,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 22,  ampacityGround_A: 30,  outerDia_mm: 10.5, weight_kg_per_m: 0.15, mV_per_A_per_m: 29 },
  { size_mm2: 2.5,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 30,  ampacityGround_A: 39,  outerDia_mm: 11.5, weight_kg_per_m: 0.19, mV_per_A_per_m: 18 },
  { size_mm2: 4,    noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 40,  ampacityGround_A: 51,  outerDia_mm: 12.5, weight_kg_per_m: 0.24, mV_per_A_per_m: 11 },
  { size_mm2: 6,    noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 52,  ampacityGround_A: 64,  outerDia_mm: 14.0, weight_kg_per_m: 0.32, mV_per_A_per_m: 7.5 },
  { size_mm2: 10,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 71,  ampacityGround_A: 86,  outerDia_mm: 16.0, weight_kg_per_m: 0.44, mV_per_A_per_m: 4.5 },
  { size_mm2: 16,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 87,  ampacityGround_A: 110, outerDia_mm: 18.5, weight_kg_per_m: 0.61, mV_per_A_per_m: 2.8 },
  { size_mm2: 25,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 116, ampacityGround_A: 143, outerDia_mm: 22.0, weight_kg_per_m: 0.87, mV_per_A_per_m: 1.8 },
  { size_mm2: 35,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 143, ampacityGround_A: 174, outerDia_mm: 24.5, weight_kg_per_m: 1.12, mV_per_A_per_m: 1.3 },
  { size_mm2: 50,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 174, ampacityGround_A: 207, outerDia_mm: 27.5, weight_kg_per_m: 1.46, mV_per_A_per_m: 0.95 },
  { size_mm2: 70,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 225, ampacityGround_A: 264, outerDia_mm: 31.5, weight_kg_per_m: 2.00, mV_per_A_per_m: 0.65 },
  { size_mm2: 95,   noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 275, ampacityGround_A: 319, outerDia_mm: 35.5, weight_kg_per_m: 2.62, mV_per_A_per_m: 0.47 },
  { size_mm2: 120,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 318, ampacityGround_A: 365, outerDia_mm: 39.0, weight_kg_per_m: 3.22, mV_per_A_per_m: 0.37 },
  { size_mm2: 150,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 366, ampacityGround_A: 418, outerDia_mm: 43.0, weight_kg_per_m: 3.95, mV_per_A_per_m: 0.30 },
  { size_mm2: 185,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 423, ampacityGround_A: 479, outerDia_mm: 47.5, weight_kg_per_m: 4.85, mV_per_A_per_m: 0.24 },
  { size_mm2: 240,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 498, ampacityGround_A: 561, outerDia_mm: 53.5, weight_kg_per_m: 6.20, mV_per_A_per_m: 0.185 },
  { size_mm2: 300,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 572, ampacityGround_A: 638, outerDia_mm: 59.0, weight_kg_per_m: 7.60, mV_per_A_per_m: 0.148 },
  { size_mm2: 400,  noOfCores: 3, insulation: 'XLPE', voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 665, ampacityGround_A: 735, outerDia_mm: 66.0, weight_kg_per_m: 9.80, mV_per_A_per_m: 0.115 },
];

export const PVC_CABLE_LIBRARY: CableLibraryEntry[] = [
  { size_mm2: 1.5,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 18,  ampacityGround_A: 24,  outerDia_mm: 9.8,  weight_kg_per_m: 0.13, mV_per_A_per_m: 29 },
  { size_mm2: 2.5,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 24,  ampacityGround_A: 31,  outerDia_mm: 10.8, weight_kg_per_m: 0.17, mV_per_A_per_m: 18 },
  { size_mm2: 4,    noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 32,  ampacityGround_A: 41,  outerDia_mm: 11.8, weight_kg_per_m: 0.21, mV_per_A_per_m: 11 },
  { size_mm2: 6,    noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 41,  ampacityGround_A: 52,  outerDia_mm: 13.2, weight_kg_per_m: 0.28, mV_per_A_per_m: 7.5 },
  { size_mm2: 10,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 57,  ampacityGround_A: 70,  outerDia_mm: 15.0, weight_kg_per_m: 0.38, mV_per_A_per_m: 4.5 },
  { size_mm2: 16,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 73,  ampacityGround_A: 93,  outerDia_mm: 17.5, weight_kg_per_m: 0.54, mV_per_A_per_m: 2.8 },
  { size_mm2: 25,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 96,  ampacityGround_A: 120, outerDia_mm: 20.5, weight_kg_per_m: 0.76, mV_per_A_per_m: 1.8 },
  { size_mm2: 35,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 119, ampacityGround_A: 147, outerDia_mm: 22.8, weight_kg_per_m: 0.97, mV_per_A_per_m: 1.3 },
  { size_mm2: 50,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 144, ampacityGround_A: 176, outerDia_mm: 25.5, weight_kg_per_m: 1.28, mV_per_A_per_m: 0.95 },
  { size_mm2: 70,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 186, ampacityGround_A: 225, outerDia_mm: 29.0, weight_kg_per_m: 1.74, mV_per_A_per_m: 0.65 },
  { size_mm2: 95,   noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 227, ampacityGround_A: 270, outerDia_mm: 33.0, weight_kg_per_m: 2.32, mV_per_A_per_m: 0.47 },
  { size_mm2: 120,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 262, ampacityGround_A: 311, outerDia_mm: 36.0, weight_kg_per_m: 2.82, mV_per_A_per_m: 0.37 },
  { size_mm2: 150,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 301, ampacityGround_A: 355, outerDia_mm: 40.0, weight_kg_per_m: 3.50, mV_per_A_per_m: 0.30 },
  { size_mm2: 185,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 346, ampacityGround_A: 405, outerDia_mm: 44.0, weight_kg_per_m: 4.30, mV_per_A_per_m: 0.24 },
  { size_mm2: 240,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 408, ampacityGround_A: 476, outerDia_mm: 49.5, weight_kg_per_m: 5.50, mV_per_A_per_m: 0.185 },
  { size_mm2: 300,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 470, ampacityGround_A: 544, outerDia_mm: 55.0, weight_kg_per_m: 6.80, mV_per_A_per_m: 0.148 },
  { size_mm2: 400,  noOfCores: 3, insulation: 'PVC',  voltageGrade_kV: 0.6/1, conductorType: 'CU', ampacityAir_A: 555, ampacityGround_A: 636, outerDia_mm: 62.0, weight_kg_per_m: 8.70, mV_per_A_per_m: 0.115 },
];

// ============================================================
// Transformer Library (IEC 60076)
// ============================================================

export interface TransformerLibraryEntry {
  kVA: number;
  impedance_pct: number;
  noLoadLoss_kW: number;
  loadLoss_kW: number;
  voltageHV_kV: number;
  voltageLV_kV: number;
}

export const TRANSFORMER_LIBRARY: TransformerLibraryEntry[] = [
  { kVA: 100,  impedance_pct: 4.0, noLoadLoss_kW: 0.32, loadLoss_kW: 2.00,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 160,  impedance_pct: 4.0, noLoadLoss_kW: 0.44, loadLoss_kW: 2.80,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 250,  impedance_pct: 4.0, noLoadLoss_kW: 0.60, loadLoss_kW: 3.70,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 315,  impedance_pct: 4.0, noLoadLoss_kW: 0.72, loadLoss_kW: 4.40,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 400,  impedance_pct: 4.0, noLoadLoss_kW: 0.86, loadLoss_kW: 5.30,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 500,  impedance_pct: 4.0, noLoadLoss_kW: 1.03, loadLoss_kW: 6.40,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 630,  impedance_pct: 4.5, noLoadLoss_kW: 1.22, loadLoss_kW: 7.70,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 800,  impedance_pct: 4.5, noLoadLoss_kW: 1.45, loadLoss_kW: 9.30,  voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 1000, impedance_pct: 5.0, noLoadLoss_kW: 1.72, loadLoss_kW: 11.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 1250, impedance_pct: 5.0, noLoadLoss_kW: 2.05, loadLoss_kW: 13.20, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 1600, impedance_pct: 5.5, noLoadLoss_kW: 2.45, loadLoss_kW: 16.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 2000, impedance_pct: 6.0, noLoadLoss_kW: 2.95, loadLoss_kW: 19.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 2500, impedance_pct: 6.0, noLoadLoss_kW: 3.50, loadLoss_kW: 22.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 3150, impedance_pct: 6.5, noLoadLoss_kW: 4.20, loadLoss_kW: 26.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
  { kVA: 4000, impedance_pct: 7.0, noLoadLoss_kW: 5.00, loadLoss_kW: 31.00, voltageHV_kV: 11, voltageLV_kV: 0.4 },
];

/**
 * Look up transformer impedance percentage for a given kVA rating.
 * Interpolates between known sizes.
 */
export function lookupTransformerImpedance(kVA: number): number {
  if (kVA <= TRANSFORMER_LIBRARY[0].kVA) return TRANSFORMER_LIBRARY[0].impedance_pct;
  const last = TRANSFORMER_LIBRARY[TRANSFORMER_LIBRARY.length - 1];
  if (kVA >= last.kVA) return last.impedance_pct;

  for (let i = 0; i < TRANSFORMER_LIBRARY.length - 1; i++) {
    const lower = TRANSFORMER_LIBRARY[i];
    const upper = TRANSFORMER_LIBRARY[i + 1];
    if (kVA >= lower.kVA && kVA <= upper.kVA) {
      const fraction = (kVA - lower.kVA) / (upper.kVA - lower.kVA);
      return Math.round((lower.impedance_pct + fraction * (upper.impedance_pct - lower.impedance_pct)) * 100) / 100;
    }
  }
  return 5.0; // default
}

// ============================================================
// Cable Factors for Trunking Sizing (IEC 60364-5-52)
// ============================================================

// Cable factor = factor for each cable type/size used in trunking fill calculations
const CABLE_FACTOR_TABLE: Record<string, Record<number, number>> = {
  'Solid': {
    1.0: 2.0, 1.5: 3.5, 2.5: 5.2, 4: 7.6, 6: 10.1, 10: 15.4, 16: 22.9,
    25: 33.3, 35: 43.5, 50: 59.5, 70: 82.1, 95: 112.0, 120: 139.0,
    150: 173.0, 185: 214.0, 240: 278.0, 300: 347.0, 400: 457.0,
  },
  'Stranded': {
    1.0: 3.6, 1.5: 5.9, 2.5: 9.6, 4: 13.2, 6: 18.1, 10: 27.6, 16: 40.5,
    25: 58.5, 35: 76.5, 50: 104.0, 70: 143.0, 95: 194.0, 120: 241.0,
    150: 300.0, 185: 371.0, 240: 482.0, 300: 602.0, 400: 793.0,
  },
};

/**
 * Look up cable factor for trunking sizing.
 * Returns the factor for a given cable type and size, or null if not found.
 */
export function lookupCableFactor(type: 'Solid' | 'Stranded', size_mm2: number): number | null {
  const table = CABLE_FACTOR_TABLE[type];
  if (!table) return null;
  return table[size_mm2] ?? null;
}

// ============================================================
// Trunking Sizes (Standard IEC trunking dimensions)
// ============================================================

export interface TrunkingSize {
  width_mm: number;
  height_mm: number;
  factor: number; // Permissible cable factor
}

export const TRUNKING_SIZES: TrunkingSize[] = [
  { width_mm: 25,  height_mm: 16,  factor: 289 },
  { width_mm: 38,  height_mm: 16,  factor: 457 },
  { width_mm: 38,  height_mm: 25,  factor: 743 },
  { width_mm: 50,  height_mm: 25,  factor: 993 },
  { width_mm: 50,  height_mm: 38,  factor: 1556 },
  { width_mm: 63,  height_mm: 25,  factor: 1268 },
  { width_mm: 63,  height_mm: 38,  factor: 1986 },
  { width_mm: 75,  height_mm: 25,  factor: 1530 },
  { width_mm: 75,  height_mm: 38,  factor: 2386 },
  { width_mm: 75,  height_mm: 50,  factor: 3206 },
  { width_mm: 100, height_mm: 25,  factor: 2062 },
  { width_mm: 100, height_mm: 38,  factor: 3210 },
  { width_mm: 100, height_mm: 50,  factor: 4310 },
  { width_mm: 100, height_mm: 75,  factor: 6570 },
  { width_mm: 150, height_mm: 38,  factor: 4920 },
  { width_mm: 150, height_mm: 50,  factor: 6570 },
  { width_mm: 150, height_mm: 75,  factor: 10060 },
  { width_mm: 150, height_mm: 100, factor: 13580 },
  { width_mm: 200, height_mm: 50,  factor: 8850 },
  { width_mm: 200, height_mm: 75,  factor: 13560 },
  { width_mm: 200, height_mm: 100, factor: 18310 },
  { width_mm: 225, height_mm: 75,  factor: 15310 },
  { width_mm: 225, height_mm: 100, factor: 20680 },
  { width_mm: 300, height_mm: 75,  factor: 20510 },
  { width_mm: 300, height_mm: 100, factor: 27710 },
  { width_mm: 300, height_mm: 150, factor: 41980 },
  { width_mm: 375, height_mm: 75,  factor: 25710 },
  { width_mm: 375, height_mm: 100, factor: 34740 },
  { width_mm: 375, height_mm: 150, factor: 52600 },
  { width_mm: 450, height_mm: 75,  factor: 30910 },
  { width_mm: 450, height_mm: 100, factor: 41770 },
  { width_mm: 450, height_mm: 150, factor: 63220 },
  { width_mm: 450, height_mm: 200, factor: 85050 },
  { width_mm: 600, height_mm: 100, factor: 55810 },
  { width_mm: 600, height_mm: 150, factor: 84520 },
  { width_mm: 600, height_mm: 200, factor: 113720 },
];

/**
 * Select the smallest trunking size whose factor >= the required cable factor.
 */
export function selectTrunkingSize(requiredFactor: number): TrunkingSize | null {
  return TRUNKING_SIZES.find(t => t.factor >= requiredFactor) ?? null;
}
