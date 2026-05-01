// Electrical engineering data lookup functions and reference tables
// Used by electrical-calculations.ts and engineering-pipelines.ts

// ─────────────────────────────────────────────────────────────────────────────
// Busbar Material Data (IEC 60890 / Egyptian Code)
// ─────────────────────────────────────────────────────────────────────────────

export const BUSBAR_MATERIALS: Record<string, {
  conductivity: number;        // % IACS
  resistivity: number;         // Ω·mm²/m at 20°C
  density: number;             // kg/dm³
  k_factor: number;            // Short-circuit temperature factor
  baseRating_A_per_mm2: number; // Approx base current rating per mm² at 35°C
  currentDensity: number;      // A/mm² for continuous current sizing
  materialConstant_K: number;  // k for short-circuit adiabatic formula
  permissibleStrength_kg_mm2: number; // Mechanical permissible strength
}> = {
  copper: {
    conductivity: 100,
    resistivity: 0.01724,
    density: 8.89,
    k_factor: 166,           // copper, initial 85°C, final 185°C
    baseRating_A_per_mm2: 2.0,
    currentDensity: 1.6,     // A/mm² typical for continuous operation
    materialConstant_K: 143, // k factor for copper (XLPE final 250°C)
    permissibleStrength_kg_mm2: 12, // typical copper busbar mechanical strength
  },
  aluminum: {
    conductivity: 61,
    resistivity: 0.02826,
    density: 2.71,
    k_factor: 109,           // aluminum, initial 85°C, final 185°C
    baseRating_A_per_mm2: 1.3,
    currentDensity: 1.0,     // A/mm² typical for continuous operation
    materialConstant_K: 94,  // k factor for aluminum
    permissibleStrength_kg_mm2: 7, // typical aluminum busbar mechanical strength
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Busbar Derating Factors (IEC 60890 / Egyptian Code)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up busbar derating factors based on installation conditions.
 * Accepts individual parameters (for compatibility with electrical-calculations.ts)
 * Returns total derating factor and individual factors.
 */
export function lookupBusbarDerating(
  k1_ea_ratio: number,
  k1_strips: number,
  k2_insulatingMaterial: string,
  k3_position: string,
  k4_installationMedia: string,
  k5_ventilationScheme: string,
  k6_crossSectionRatio: number,
  k6_enclosureType: string,
  k7_proxyBars: number,
  k8_altitude_m: number
): { totalFactor: number; factors: { K1: number; K2: number; K3: number; K4: number; K5: number; K6: number; K7: number; K8: number } } {
  // K1: Enclosure area ratio factor
  const eaRatios = [0, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20];
  const k1_1strip = [0.80, 0.85, 0.88, 0.90, 0.92, 0.94, 0.96];
  const k1_2strip = [0.72, 0.78, 0.82, 0.85, 0.88, 0.90, 0.93];
  const k1Table = k1_strips >= 2 ? k1_2strip : k1_1strip;
  let k1 = 0.92;
  for (let i = eaRatios.length - 1; i >= 0; i--) {
    if (k1_ea_ratio >= eaRatios[i]) {
      k1 = k1Table[i];
      break;
    }
  }

  // K2: Insulating material factor
  const k2Map: Record<string, number> = {
    'Bare': 1.00,
    'PVC': 0.85,
    'Heat-shrink': 0.90,
    'Epoxy': 0.88,
  };
  const k2 = k2Map[k2_insulatingMaterial] ?? 0.90;

  // K3: Position factor (busbar orientation)
  const k3Map: Record<string, number> = {
    'Edge-mounted bars': 1.00,
    'Flat-mounted bars': 0.92,
    'Vertical bars': 0.95,
  };
  const k3 = k3Map[k3_position] ?? 0.95;

  // K4: Installation media factor
  const k4Map: Record<string, number> = {
    'Open air': 1.00,
    'Ventilated ducting': 0.90,
    'Non-ventilated ducting': 0.78,
  };
  const k4 = k4Map[k4_installationMedia] ?? 0.85;

  // K5: Ventilation scheme factor
  const k5Map: Record<string, number> = {
    'With artificial ventilation': 1.00,
    'Without artificial ventilation': 0.85,
  };
  const k5 = k5Map[k5_ventilationScheme] ?? 0.85;

  // K6: Cross-section / enclosure factor
  const k6Map: Record<string, number> = {
    'well': 0.95,
    'poorly': 0.85,
  };
  const k6_enclosure = k6Map[k6_enclosureType] ?? 0.90;
  // Also factor in cross-section ratio
  const k6_ratio = k6_crossSectionRatio <= 0.05 ? 1.00 :
                   k6_crossSectionRatio <= 0.10 ? 0.97 : 0.94;
  const k6 = k6_ratio * k6_enclosure;

  // K7: Proximity bars factor
  const k7Map: Record<number, number> = {
    0: 1.00,
    1: 0.95,
    2: 0.90,
    3: 0.87,
  };
  const k7 = k7Map[k7_proxyBars] ?? 0.85;

  // K8: Altitude correction factor (IEC 60890)
  const alt = k8_altitude_m;
  let k8 = 1.00;
  if (alt > 2000) k8 = 0.91;
  else if (alt > 1500) k8 = 0.94;
  else if (alt > 1000) k8 = 0.97;

  const factors = { K1: k1, K2: k2, K3: k3, K4: k4, K5: k5, K6: k6, K7: k7, K8: k8 };
  const totalFactor = k1 * k2 * k3 * k4 * k5 * k6 * k7 * k8;

  return { totalFactor, factors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Busbar Derating Factor Tables (for reference-data API)
// ─────────────────────────────────────────────────────────────────────────────

export const BUSBAR_DERATING_K1_TABLE = {
  eaRatios: [0, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20],
  singleStrip: [0.80, 0.85, 0.88, 0.90, 0.92, 0.94, 0.96],
  multiStrip: [0.72, 0.78, 0.82, 0.85, 0.88, 0.90, 0.93],
};

export const BUSBAR_DERATING_K2_TABLE = [
  { material: 'Bare', factor: 1.00 },
  { material: 'PVC', factor: 0.85 },
  { material: 'Heat-shrink', factor: 0.90 },
  { material: 'Epoxy', factor: 0.88 },
];

export const BUSBAR_DERATING_K3_TABLE = [
  { position: 'Edge-mounted bars', factor: 1.00 },
  { position: 'Flat-mounted bars', factor: 0.92 },
  { position: 'Vertical bars', factor: 0.95 },
];

export const BUSBAR_DERATING_K4_TABLE = [
  { media: 'Open air', factor: 1.00 },
  { media: 'Ventilated ducting', factor: 0.90 },
  { media: 'Non-ventilated ducting', factor: 0.78 },
];

export const BUSBAR_DERATING_K5_TABLE = [
  { scheme: 'With artificial ventilation', factor: 1.00 },
  { scheme: 'Without artificial ventilation', factor: 0.85 },
];

export const BUSBAR_DERATING_K6_TABLE = {
  enclosureTypes: [
    { type: 'well', factor: 0.95 },
    { type: 'poorly', factor: 0.85 },
  ],
  crossSectionRatios: [
    { ratio: '<=0.05', factor: 1.00 },
    { ratio: '<=0.10', factor: 0.97 },
    { ratio: '>0.10', factor: 0.94 },
  ],
};

export const BUSBAR_DERATING_K8_TABLE = [
  { altitude_m: 0, factor: 1.00 },
  { altitude_m: 1000, factor: 0.97 },
  { altitude_m: 1500, factor: 0.94 },
  { altitude_m: 2000, factor: 0.91 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Coefficient of Utilization (CU) for Indoor Lighting (CIE / IESNA)
// ─────────────────────────────────────────────────────────────────────────────

// CU table indexed by room index, ceiling reflection, wall reflection
// Format: CU[ceilingReflection][wallReflection][roomIndex]
const CU_TABLE: Record<string, Record<string, Record<string, number>>> = {
  '0.7': {
    '0.5': { '0.6': 0.28, '0.8': 0.35, '1.0': 0.41, '1.25': 0.47, '1.5': 0.51, '2.0': 0.58, '2.5': 0.62, '3.0': 0.66, '4.0': 0.70, '5.0': 0.74 },
    '0.3': { '0.6': 0.23, '0.8': 0.30, '1.0': 0.36, '1.25': 0.42, '1.5': 0.46, '2.0': 0.53, '2.5': 0.57, '3.0': 0.61, '4.0': 0.65, '5.0': 0.69 },
    '0.1': { '0.6': 0.20, '0.8': 0.27, '1.0': 0.32, '1.25': 0.38, '1.5': 0.42, '2.0': 0.49, '2.5': 0.53, '3.0': 0.57, '4.0': 0.61, '5.0': 0.65 },
  },
  '0.5': {
    '0.5': { '0.6': 0.24, '0.8': 0.31, '1.0': 0.37, '1.25': 0.42, '1.5': 0.47, '2.0': 0.53, '2.5': 0.57, '3.0': 0.61, '4.0': 0.65, '5.0': 0.69 },
    '0.3': { '0.6': 0.20, '0.8': 0.27, '1.0': 0.33, '1.25': 0.38, '1.5': 0.42, '2.0': 0.48, '2.5': 0.53, '3.0': 0.56, '4.0': 0.61, '5.0': 0.64 },
    '0.1': { '0.6': 0.17, '0.8': 0.24, '1.0': 0.29, '1.25': 0.34, '1.5': 0.38, '2.0': 0.44, '2.5': 0.49, '3.0': 0.52, '4.0': 0.57, '5.0': 0.60 },
  },
  '0.3': {
    '0.5': { '0.6': 0.20, '0.8': 0.26, '1.0': 0.32, '1.25': 0.37, '1.5': 0.42, '2.0': 0.48, '2.5': 0.52, '3.0': 0.55, '4.0': 0.59, '5.0': 0.63 },
    '0.3': { '0.6': 0.17, '0.8': 0.23, '1.0': 0.28, '1.25': 0.33, '1.5': 0.38, '2.0': 0.44, '2.5': 0.48, '3.0': 0.51, '4.0': 0.56, '5.0': 0.59 },
    '0.1': { '0.6': 0.14, '0.8': 0.20, '1.0': 0.25, '1.25': 0.30, '1.5': 0.34, '2.0': 0.40, '2.5': 0.44, '3.0': 0.48, '4.0': 0.52, '5.0': 0.56 },
  },
};

/**
 * Look up the Coefficient of Utilization (CU) for indoor lighting.
 * Interpolates from the standard CU table based on room index and reflections.
 */
export function lookupCU(
  roomIndex: number,
  ceilingReflection: number,
  wallReflection: number
): number {
  const crKey = String(ceilingReflection);
  const wrKey = String(wallReflection);

  const ceilingTable = CU_TABLE[crKey];
  if (!ceilingTable) return 0.45; // fallback
  const wallTable = ceilingTable[wrKey];
  if (!wallTable) return 0.40; // fallback

  // Find the two closest room indices for interpolation
  // Preserve original string keys for table lookup
  const riStringKeys = Object.keys(wallTable);
  const riKeys = riStringKeys.map(Number).sort((a, b) => a - b);
  const riStringKeysSorted = riStringKeys.sort((a, b) => Number(a) - Number(b));

  if (roomIndex <= riKeys[0]) return wallTable[riStringKeysSorted[0]];
  if (roomIndex >= riKeys[riKeys.length - 1]) return wallTable[riStringKeysSorted[riStringKeysSorted.length - 1]];

  // Linear interpolation between two nearest room indices
  let lowerIdx = 0;
  let upperIdx = riKeys.length - 1;
  for (let i = 0; i < riKeys.length - 1; i++) {
    if (roomIndex >= riKeys[i] && roomIndex <= riKeys[i + 1]) {
      lowerIdx = i;
      upperIdx = i + 1;
      break;
    }
  }

  const lowerCU = wallTable[riStringKeysSorted[lowerIdx]];
  const upperCU = wallTable[riStringKeysSorted[upperIdx]];
  const fraction = (roomIndex - riKeys[lowerIdx]) / (riKeys[upperIdx] - riKeys[lowerIdx]);

  return Math.round((lowerCU + fraction * (upperCU - lowerCU)) * 1000) / 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor Code Letters (NEC 430-52) — Lock Rotor kVA/HP
// ─────────────────────────────────────────────────────────────────────────────

export const MOTOR_CODE_TABLE: Record<string, { min: number; max: number }> = {
  'A': { min: 0,   max: 3.15 },
  'B': { min: 3.15, max: 3.55 },
  'C': { min: 3.55, max: 4.00 },
  'D': { min: 4.00, max: 4.50 },
  'E': { min: 4.50, max: 5.00 },
  'F': { min: 5.00, max: 5.60 },
  'G': { min: 5.60, max: 6.30 },
  'H': { min: 6.30, max: 7.10 },
  'J': { min: 7.10, max: 8.00 },
  'K': { min: 8.00, max: 9.00 },
  'L': { min: 9.00, max: 10.00 },
  'M': { min: 10.00, max: 11.20 },
  'N': { min: 11.20, max: 12.50 },
  'P': { min: 12.50, max: 14.00 },
  'R': { min: 14.00, max: 16.00 },
  'S': { min: 16.00, max: 18.00 },
  'T': { min: 18.00, max: 20.00 },
  'U': { min: 20.00, max: 22.40 },
  'V': { min: 22.40, max: 100.0 },
};

/**
 * Look up motor code letter to get lock rotor kVA/HP range.
 */
export function lookupMotorCode(code: string): { min_kVA_per_HP: number; max_kVA_per_HP: number } {
  const data = MOTOR_CODE_TABLE[code.toUpperCase()];
  if (!data) {
    return { min_kVA_per_HP: 3.15, max_kVA_per_HP: 3.55 }; // default to code B
  }
  return {
    min_kVA_per_HP: data.min,
    max_kVA_per_HP: data.max,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor Standard Ratings (IEC 60034-1)
// ─────────────────────────────────────────────────────────────────────────────

export const MOTOR_RATINGS = [
  { HP: 0.5,  kW: 0.37, fullLoadCurrent_400V_3ph: 1.2 },
  { HP: 0.75, kW: 0.55, fullLoadCurrent_400V_3ph: 1.6 },
  { HP: 1,    kW: 0.75, fullLoadCurrent_400V_3ph: 2.1 },
  { HP: 1.5,  kW: 1.10, fullLoadCurrent_400V_3ph: 2.8 },
  { HP: 2,    kW: 1.50, fullLoadCurrent_400V_3ph: 3.7 },
  { HP: 3,    kW: 2.20, fullLoadCurrent_400V_3ph: 5.2 },
  { HP: 5,    kW: 3.70, fullLoadCurrent_400V_3ph: 8.5 },
  { HP: 7.5,  kW: 5.50, fullLoadCurrent_400V_3ph: 12.0 },
  { HP: 10,   kW: 7.50, fullLoadCurrent_400V_3ph: 16.0 },
  { HP: 15,   kW: 11.0, fullLoadCurrent_400V_3ph: 23.0 },
  { HP: 20,   kW: 15.0, fullLoadCurrent_400V_3ph: 31.0 },
  { HP: 25,   kW: 18.5, fullLoadCurrent_400V_3ph: 38.0 },
  { HP: 30,   kW: 22.0, fullLoadCurrent_400V_3ph: 44.0 },
  { HP: 40,   kW: 30.0, fullLoadCurrent_400V_3ph: 59.0 },
  { HP: 50,   kW: 37.0, fullLoadCurrent_400V_3ph: 72.0 },
  { HP: 60,   kW: 45.0, fullLoadCurrent_400V_3ph: 87.0 },
  { HP: 75,   kW: 55.0, fullLoadCurrent_400V_3ph: 105.0 },
  { HP: 100,  kW: 75.0, fullLoadCurrent_400V_3ph: 142.0 },
  { HP: 125,  kW: 90.0, fullLoadCurrent_400V_3ph: 170.0 },
  { HP: 150,  kW: 110.0, fullLoadCurrent_400V_3ph: 210.0 },
  { HP: 200,  kW: 150.0, fullLoadCurrent_400V_3ph: 285.0 },
  { HP: 250,  kW: 185.0, fullLoadCurrent_400V_3ph: 350.0 },
  { HP: 300,  kW: 220.0, fullLoadCurrent_400V_3ph: 415.0 },
  { HP: 350,  kW: 260.0, fullLoadCurrent_400V_3ph: 490.0 },
  { HP: 400,  kW: 300.0, fullLoadCurrent_400V_3ph: 565.0 },
  { HP: 500,  kW: 370.0, fullLoadCurrent_400V_3ph: 695.0 },
];

/**
 * Look up motor rating data for a given HP.
 */
export function lookupMotorRating(hp: number): { HP: number; kW: number; fullLoadCurrent_400V_3ph: number } | null {
  return MOTOR_RATINGS.find(m => m.HP >= hp) ?? MOTOR_RATINGS[MOTOR_RATINGS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// MCCB / MCB Standard Sizes (IEC 60947-2)
// ─────────────────────────────────────────────────────────────────────────────

export const MCCB_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000];

/**
 * Select the next standard MCCB/MCB size >= required current.
 */
export function selectMCCBSize(current: number): number {
  return MCCB_SIZES.find(s => s >= current) ?? MCCB_SIZES[MCCB_SIZES.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// Conduit Sizes (IEC 60364-5-52 / BS EN 61386)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConduitSizeEntry {
  size_mm: number;
  tradeSize: string;
  innerDia_mm: number;
  area_mm2: number;
  fillUpArea_40pct_mm2: number; // 40% fill for 3+ cables
}

export const CONDUIT_SIZES: ConduitSizeEntry[] = [
  { size_mm: 16,  tradeSize: '1/2"',  innerDia_mm: 13.8,  area_mm2: 150,  fillUpArea_40pct_mm2: 60 },
  { size_mm: 20,  tradeSize: '3/4"',  innerDia_mm: 17.6,  area_mm2: 243,  fillUpArea_40pct_mm2: 97 },
  { size_mm: 25,  tradeSize: '1"',    innerDia_mm: 22.4,  area_mm2: 394,  fillUpArea_40pct_mm2: 158 },
  { size_mm: 32,  tradeSize: '1-1/4"', innerDia_mm: 29.0, area_mm2: 660,  fillUpArea_40pct_mm2: 264 },
  { size_mm: 40,  tradeSize: '1-1/2"', innerDia_mm: 35.8, area_mm2: 1006, fillUpArea_40pct_mm2: 402 },
  { size_mm: 50,  tradeSize: '2"',    innerDia_mm: 44.8,  area_mm2: 1576, fillUpArea_40pct_mm2: 630 },
  { size_mm: 63,  tradeSize: '2-1/2"', innerDia_mm: 56.8, area_mm2: 2535, fillUpArea_40pct_mm2: 1014 },
  { size_mm: 75,  tradeSize: '3"',    innerDia_mm: 68.0,  area_mm2: 3632, fillUpArea_40pct_mm2: 1453 },
  { size_mm: 90,  tradeSize: '3-1/2"', innerDia_mm: 81.6, area_mm2: 5227, fillUpArea_40pct_mm2: 2091 },
  { size_mm: 100, tradeSize: '4"',    innerDia_mm: 92.0,  area_mm2: 6648, fillUpArea_40pct_mm2: 2659 },
  { size_mm: 110, tradeSize: '4-1/2"', innerDia_mm: 101.0, area_mm2: 8012, fillUpArea_40pct_mm2: 3205 },
  { size_mm: 125, tradeSize: '5"',    innerDia_mm: 115.0, area_mm2: 10387, fillUpArea_40pct_mm2: 4155 },
  { size_mm: 150, tradeSize: '6"',    innerDia_mm: 138.0, area_mm2: 14957, fillUpArea_40pct_mm2: 5983 },
];

/**
 * Select the smallest conduit size that can accommodate the required fill area.
 */
export function selectConduitSize(requiredArea_mm2: number): ConduitSizeEntry | null {
  return CONDUIT_SIZES.find(c => c.fillUpArea_40pct_mm2 >= requiredArea_mm2) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cable Outer Diameters (typical for 3-core cables)
// ─────────────────────────────────────────────────────────────────────────────

export const CABLE_OUTER_DIAMETERS: Record<number, number> = {
  1.0: 6.2, 1.5: 7.0, 2.5: 8.2, 4: 9.5, 6: 10.8, 10: 13.0, 16: 15.2,
  25: 18.5, 35: 20.8, 50: 23.5, 70: 27.0, 95: 31.0, 120: 34.0,
  150: 38.0, 185: 42.0, 240: 47.5, 300: 53.0, 400: 59.0,
  500: 65.0, 630: 72.0,
};

/**
 * Look up cable outer diameter for a given size.
 */
export function lookupCableOuterDia(size_mm2: number): number {
  return CABLE_OUTER_DIAMETERS[size_mm2] ?? 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demand Factors (NEC / IEC)
// ─────────────────────────────────────────────────────────────────────────────

export const DEMAND_FACTORS: { loadType: string; factor: number }[] = [
  { loadType: 'Lighting', factor: 1.0 },
  { loadType: 'Heater', factor: 1.0 },
  { loadType: 'Drive', factor: 1.25 },
  { loadType: 'Motor', factor: 1.25 },
  { loadType: 'Ballast', factor: 1.25 },
  { loadType: 'AC', factor: 1.0 },
  { loadType: 'Inductive', factor: 1.25 },
  { loadType: 'Receptacle', factor: 0.6 },
  { loadType: 'Cooking', factor: 0.75 },
  { loadType: 'Welding', factor: 0.85 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilization Factors (NEC / IEC)
// ─────────────────────────────────────────────────────────────────────────────

export const UTILIZATION_FACTORS: { loadType: string; factor: number }[] = [
  { loadType: 'Lighting', factor: 1.0 },
  { loadType: 'Heater', factor: 1.0 },
  { loadType: 'Drive', factor: 0.9 },
  { loadType: 'Motor', factor: 0.85 },
  { loadType: 'Ballast', factor: 0.9 },
  { loadType: 'AC', factor: 1.0 },
  { loadType: 'Inductive', factor: 0.85 },
  { loadType: 'Receptacle', factor: 0.7 },
  { loadType: 'Cooking', factor: 0.8 },
  { loadType: 'Welding', factor: 0.75 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Fuse Multipliers (NEC 430-52)
// ─────────────────────────────────────────────────────────────────────────────

export const FUSE_MULTIPLIERS_NEC: { starterType: string; nonTimeDelay: number; timeDelay: number }[] = [
  { starterType: 'DOL', nonTimeDelay: 3.0, timeDelay: 1.75 },
  { starterType: 'Star-Delta', nonTimeDelay: 3.0, timeDelay: 1.75 },
  { starterType: 'Autotransformer', nonTimeDelay: 3.0, timeDelay: 1.75 },
  { starterType: 'VFD', nonTimeDelay: 1.5, timeDelay: 1.25 },
  { starterType: 'Soft-Starter', nonTimeDelay: 2.5, timeDelay: 1.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reflection Factors (CIE / IESNA for lighting design)
// ─────────────────────────────────────────────────────────────────────────────

export const REFLECTION_FACTORS: { surface: string; value: number }[] = [
  { surface: 'White paint / White ceiling tile', value: 0.70 },
  { surface: 'Light cream / Beige walls', value: 0.50 },
  { surface: 'Light grey / Natural concrete', value: 0.40 },
  { surface: 'Medium grey / Wood (light)', value: 0.30 },
  { surface: 'Dark grey / Brick', value: 0.20 },
  { surface: 'Dark paint / Wood (dark)', value: 0.10 },
  { surface: 'Window glass (clear)', value: 0.10 },
  { surface: 'Floor (general)', value: 0.20 },
  { surface: 'Carpet (light)', value: 0.30 },
  { surface: 'Carpet (dark)', value: 0.10 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Factors (CIE 97 / IESNA for lighting design)
// ─────────────────────────────────────────────────────────────────────────────

export const MAINTENANCE_FACTORS: { condition: string; factor: number; description: string }[] = [
  { condition: 'good', factor: 0.80, description: 'Clean environment, regular cleaning, air-conditioned spaces, offices' },
  { condition: 'average', factor: 0.70, description: 'Moderate dirt, occasional cleaning, workshops, retail' },
  { condition: 'poor', factor: 0.55, description: 'Dirty environment, infrequent cleaning, industrial areas, kitchens' },
  { condition: 'very-poor', factor: 0.45, description: 'Very dirty, rare cleaning, foundries, chemical plants' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from cable-data.ts for backward compatibility
// These functions are now defined in cable-data.ts but re-exported here
// so existing imports from electrical-data.ts continue to work.
// ─────────────────────────────────────────────────────────────────────────────

export { lookupCableAmpacity, lookupTransformerImpedance, selectCableSize } from './cable-data';
