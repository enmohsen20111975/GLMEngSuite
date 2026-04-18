// Engineering Pipeline Definitions — Local Data (no DB dependency)
// Each pipeline is a sequence of steps where outputs of step N feed into inputs of step N+1

export interface PipelineInput {
  name: string;        // field key (snake_case)
  label: string;       // human-readable label
  unit: string;        // e.g. "A", "kVA", "m", "°C"
  type: 'number' | 'select';
  options?: { value: string | number; label: string }[];  // for select type
  min?: number;
  max?: number;
  default?: number | string;
  required: boolean;
  help: string;        // tooltip / guidance text
  fromPreviousStep?: string;  // output key from a prior step that auto-fills this
}

export interface PipelineOutput {
  name: string;        // field key
  label: string;
  unit: string;
  precision: number;   // decimal places to display
  isCompliance?: boolean;  // if true, value is boolean (pass/fail)
}

export interface PipelineStep {
  stepNumber: number;
  name: string;
  description: string;
  standard_ref: string;         // e.g. "IEC 60364-5-52"
  formula_display: string[];    // list of formula strings for report
  inputs: PipelineInput[];
  outputs: PipelineOutput[];
  calculate: (inputs: Record<string, number | string>) => Record<string, number | string | boolean>;
}

export interface EngineeringPipeline {
  id: string;
  name: string;
  description: string;
  domain: 'electrical' | 'mechanical' | 'civil' | 'hvac' | 'hydraulics';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: string;
  icon: string;
  steps: PipelineStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 1: LV Cable Sizing
// ─────────────────────────────────────────────────────────────────────────────

// Copper cable ampacity table at 30°C (IEC 60364-5-52, method B2)
// Key: cross-section mm², Value: base ampacity (A)
const COPPER_AMPACITY_B2: Record<number, number> = {
  1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101,
  35: 125, 50: 151, 70: 192, 95: 232, 120: 269, 150: 309,
  185: 353, 240: 415, 300: 477, 400: 560
};

const CABLE_SIZES = Object.keys(COPPER_AMPACITY_B2).map(Number).sort((a, b) => a - b);

// Ambient temperature correction factors (IEC 60364-5-52, Table B.52.14)
function ambientTempFactor(temp: number): number {
  if (temp <= 10) return 1.22;
  if (temp <= 15) return 1.17;
  if (temp <= 20) return 1.12;
  if (temp <= 25) return 1.06;
  if (temp <= 30) return 1.00;
  if (temp <= 35) return 0.94;
  if (temp <= 40) return 0.87;
  if (temp <= 45) return 0.79;
  if (temp <= 50) return 0.71;
  if (temp <= 55) return 0.61;
  return 0.50;
}

// Number of circuits grouping factor (IEC 60364-5-52, Table B.52.17)
function groupingFactor(n: number): number {
  if (n === 1) return 1.00;
  if (n === 2) return 0.80;
  if (n === 3) return 0.70;
  if (n === 4) return 0.65;
  if (n === 5) return 0.60;
  if (n === 6) return 0.57;
  return 0.50;
}

// Resistivity of copper at 70°C (Ω·mm²/m)
const RHO_CU = 0.0225;

function selectCableSize(requiredCurrent: number): number {
  return CABLE_SIZES.find(s => COPPER_AMPACITY_B2[s] >= requiredCurrent) ?? 400;
}

const lvCableSizing: EngineeringPipeline = {
  id: 'lv-cable-sizing',
  name: 'LV Cable Sizing',
  description: 'Size low-voltage copper cables per IEC 60364-5-52: determine design current, select cable cross-section, verify voltage drop, and check short-circuit rating.',
  domain: 'electrical',
  difficulty: 'intermediate',
  estimated_time: '10-15 min',
  icon: '⚡',
  steps: [
    {
      stepNumber: 1,
      name: 'Load Analysis',
      description: 'Calculate the design current from the connected load. The full-load current is the basis for all subsequent cable selection and protection coordination.',
      standard_ref: 'IEC 60364-4-43 § 433',
      formula_display: [
        'I_b = S / (√3 × V_LL)          [3-phase]',
        'I_b = S / V_LN                  [1-phase]',
        'P = S × cos φ',
        'Q = S × sin φ'
      ],
      inputs: [
        { name: 'kva_load', label: 'Apparent Load', unit: 'kVA', type: 'number', min: 0.1, max: 5000, default: 50, required: true, help: 'Total connected load in kVA (nameplate or calculated from demand)' },
        { name: 'power_factor', label: 'Power Factor (cos φ)', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.85, required: true, help: 'Power factor of the load (0.85 typical for motors, 1.0 for resistive loads)' },
        { name: 'phase_config', label: 'Phase Configuration', unit: '', type: 'select', options: [{ value: '3phase', label: '3-Phase (400 V L-L)' }, { value: '1phase', label: '1-Phase (230 V L-N)' }], default: '3phase', required: true, help: 'Three-phase systems use line-to-line voltage; single-phase use line-to-neutral' },
        { name: 'voltage_ll', label: 'System Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 400, required: true, help: 'Line-to-line voltage of the LV system (typically 400 V in IEC countries, 480 V in USA)' }
      ],
      outputs: [
        { name: 'current_a', label: 'Design Current (I_b)', unit: 'A', precision: 1 },
        { name: 'active_power_kw', label: 'Active Power (P)', unit: 'kW', precision: 2 },
        { name: 'reactive_power_kvar', label: 'Reactive Power (Q)', unit: 'kVAR', precision: 2 }
      ],
      calculate(inp) {
        const S = Number(inp.kva_load);
        const pf = Number(inp.power_factor);
        const Vll = Number(inp.voltage_ll);
        const is3phase = inp.phase_config === '3phase';
        const Ib = is3phase ? (S * 1000) / (Math.sqrt(3) * Vll) : (S * 1000) / (Vll / Math.sqrt(3));
        const P = S * pf;
        const Q = S * Math.sqrt(1 - pf * pf);
        return { current_a: Math.round(Ib * 10) / 10, active_power_kw: Math.round(P * 100) / 100, reactive_power_kvar: Math.round(Q * 100) / 100 };
      }
    },
    {
      stepNumber: 2,
      name: 'Cable Selection',
      description: 'Select the minimum cable cross-section that carries the design current after applying derating factors for ambient temperature and cable grouping. The derated ampacity must equal or exceed the design current.',
      standard_ref: 'IEC 60364-5-52 Table B.52.3 & B.52.14 & B.52.17',
      formula_display: [
        'I_z = I_z0 × C_a × C_g',
        'I_z ≥ I_b  (condition to satisfy)',
        'C_a = ambient temperature correction factor (Table B.52.14)',
        'C_g = grouping factor (Table B.52.17)',
        'Required I_z0 = I_b / (C_a × C_g)'
      ],
      inputs: [
        { name: 'current_a', label: 'Design Current (I_b)', unit: 'A', type: 'number', min: 0.1, max: 2000, required: true, help: 'Full-load current from Step 1', fromPreviousStep: 'current_a' },
        { name: 'installation_method', label: 'Installation Method', unit: '', type: 'select', options: [{ value: 'B2', label: 'B2 — Conduit in wall / trunking' }, { value: 'C', label: 'C — Clipped direct / surface' }, { value: 'E', label: 'E — Cable tray (perforated)' }, { value: 'D1', label: 'D1 — Direct in ground' }], default: 'B2', required: true, help: 'Installation method per IEC 60364-5-52 Table B.52.1 (affects base ampacity)' },
        { name: 'ambient_temp', label: 'Ambient Temperature', unit: '°C', type: 'number', min: -10, max: 60, default: 30, required: true, help: 'Maximum ambient temperature at cable location (use hottest expected, e.g. 40°C for plant rooms)' },
        { name: 'num_cables', label: 'Number of Circuits Grouped', unit: '', type: 'number', min: 1, max: 20, default: 1, required: true, help: 'Number of loaded circuits in the same conduit/tray (grouping causes mutual heating)' }
      ],
      outputs: [
        { name: 'cable_size_mm2', label: 'Selected Cable Size', unit: 'mm²', precision: 0 },
        { name: 'cable_ampacity_a', label: 'Derated Ampacity (I_z)', unit: 'A', precision: 1 },
        { name: 'derating_factor', label: 'Combined Derating Factor', unit: '', precision: 3 }
      ],
      calculate(inp) {
        const Ib = Number(inp.current_a);
        const ambTemp = Number(inp.ambient_temp);
        const nCircuits = Math.round(Number(inp.num_cables));

        // Method multiplier (B2=1.0 baseline, C=1.15, E=1.2, D1=0.9 relative)
        const methodMult: Record<string, number> = { B2: 1.0, C: 1.15, E: 1.20, D1: 0.90 };
        const mMult = methodMult[String(inp.installation_method)] ?? 1.0;

        const Ca = ambientTempFactor(ambTemp);
        const Cg = groupingFactor(nCircuits);
        const combinedFactor = Ca * Cg * mMult;

        // Required base ampacity
        const requiredBase = Ib / combinedFactor;
        const selectedSize = selectCableSize(requiredBase);
        const baseAmpacity = COPPER_AMPACITY_B2[selectedSize];
        const deratedAmpacity = baseAmpacity * combinedFactor;

        return {
          cable_size_mm2: selectedSize,
          cable_ampacity_a: Math.round(deratedAmpacity * 10) / 10,
          derating_factor: Math.round(combinedFactor * 1000) / 1000
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Voltage Drop Verification',
      description: 'Calculate the voltage drop along the cable run and verify it meets the IEC 60364-5-52 limits. Excessive voltage drop causes equipment malfunction and motor overheating. Limit: ≤ 3% for branch circuits, ≤ 5% from origin to furthest point.',
      standard_ref: 'IEC 60364-5-52 § 525',
      formula_display: [
        'ΔV = √3 × I_b × L × (R·cosφ + X·sinφ)   [3-phase]',
        'ΔV = 2 × I_b × L × (R·cosφ + X·sinφ)     [1-phase]',
        'R = ρ_Cu / A   (Ω/m at 70°C)',
        'X ≈ 0.08 mΩ/m  (typical for PVC/XLPE)',
        'ρ_Cu = 0.0225 Ω·mm²/m  at 70°C',
        'ΔV% = (ΔV / V_LL) × 100'
      ],
      inputs: [
        { name: 'cable_size_mm2', label: 'Cable Cross-Section', unit: 'mm²', type: 'number', min: 1, max: 400, required: true, help: 'Selected cable size from Step 2', fromPreviousStep: 'cable_size_mm2' },
        { name: 'cable_length_m', label: 'Cable Run Length (one-way)', unit: 'm', type: 'number', min: 1, max: 2000, default: 50, required: true, help: 'One-way cable length from supply point to load. Do NOT double; the formula accounts for return path.' },
        { name: 'current_a', label: 'Design Current (I_b)', unit: 'A', type: 'number', min: 0.1, max: 2000, required: true, help: 'Full-load current from Step 1', fromPreviousStep: 'current_a' },
        { name: 'voltage_ll', label: 'System Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 400, required: true, help: 'System line-to-line voltage' },
        { name: 'load_pf', label: 'Power Factor at Load', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.85, required: true, help: 'Power factor of the load (affects the reactive component of voltage drop)' }
      ],
      outputs: [
        { name: 'voltage_drop_v', label: 'Voltage Drop (ΔV)', unit: 'V', precision: 2 },
        { name: 'voltage_drop_pct', label: 'Voltage Drop (%)', unit: '%', precision: 2 },
        { name: 'compliant', label: '≤ 3% Limit (IEC 60364)', unit: '', precision: 0, isCompliance: true }
      ],
      calculate(inp) {
        const A = Number(inp.cable_size_mm2);
        const L = Number(inp.cable_length_m);
        const Ib = Number(inp.current_a);
        const Vll = Number(inp.voltage_ll);
        const pf = Number(inp.load_pf);
        const sinPhi = Math.sqrt(1 - pf * pf);

        const R_per_m = RHO_CU / A;       // Ω/m (conductor resistance at 70°C)
        const X_per_m = 0.00008;           // 0.08 mΩ/m typical reactance

        // 3-phase voltage drop formula
        const deltaV = Math.sqrt(3) * Ib * L * (R_per_m * pf + X_per_m * sinPhi);
        const deltaVpct = (deltaV / Vll) * 100;
        const compliant = deltaVpct <= 3.0;

        return {
          voltage_drop_v: Math.round(deltaV * 100) / 100,
          voltage_drop_pct: Math.round(deltaVpct * 100) / 100,
          compliant
        };
      }
    },
    {
      stepNumber: 4,
      name: 'Short-Circuit Rating Check',
      description: 'Verify the selected cable can withstand the prospective short-circuit current for the duration of the protective device clearing time using the adiabatic equation. This ensures cable insulation and conductor are not damaged during fault conditions.',
      standard_ref: 'IEC 60364-4-43 § 434.3.2 (Adiabatic equation)',
      formula_display: [
        'I²t ≤ k²S²  (adiabatic condition)',
        'S_min = (I_sc × √t) / k',
        'k = 115  (copper/PVC, initial 70°C, final 160°C per IEC 60364-4-43)',
        'k = 143  (copper/XLPE, initial 90°C, final 250°C)',
        'Minimum cross-section: S_min ≥ I_sc × √(t) / k'
      ],
      inputs: [
        { name: 'fault_level_ka', label: 'Prospective Fault Level', unit: 'kA', type: 'number', min: 0.1, max: 100, default: 10, required: true, help: 'Short-circuit current at the point of supply (from network data or short-circuit study). Use the maximum value.' },
        { name: 'cable_size_mm2', label: 'Selected Cable Cross-Section', unit: 'mm²', type: 'number', min: 1, max: 400, required: true, help: 'Cable size selected in Step 2', fromPreviousStep: 'cable_size_mm2' },
        { name: 'clearing_time_s', label: 'Protection Clearing Time', unit: 's', type: 'number', min: 0.01, max: 5, default: 0.4, required: true, help: 'Time for protective device to clear the fault. Use 0.4 s for branch circuits or actual fuse/CB operating time at fault level.' },
        { name: 'insulation_type', label: 'Cable Insulation', unit: '', type: 'select', options: [{ value: 'PVC', label: 'PVC (k = 115)' }, { value: 'XLPE', label: 'XLPE/EPR (k = 143)' }], default: 'PVC', required: true, help: 'Insulation material determines the k factor (temperature withstand coefficient)' }
      ],
      outputs: [
        { name: 'min_size_mm2', label: 'Minimum Required Cross-Section', unit: 'mm²', precision: 1 },
        { name: 'energy_let_through', label: 'Energy Let-Through (I²t)', unit: 'A²s', precision: 0 },
        { name: 'cable_withstand', label: 'Cable Withstand (k²S²)', unit: 'A²s', precision: 0 },
        { name: 'sc_compliant', label: 'Adiabatic Check (S ≥ S_min)', unit: '', precision: 0, isCompliance: true }
      ],
      calculate(inp) {
        const Isc = Number(inp.fault_level_ka) * 1000;  // convert kA to A
        const S = Number(inp.cable_size_mm2);
        const t = Number(inp.clearing_time_s);
        const k = inp.insulation_type === 'XLPE' ? 143 : 115;

        const minSize = (Isc * Math.sqrt(t)) / k;
        const energyLetThrough = Isc * Isc * t;
        const cableWithstand = k * k * S * S;
        const compliant = S >= minSize;

        return {
          min_size_mm2: Math.round(minSize * 10) / 10,
          energy_let_through: Math.round(energyLetThrough),
          cable_withstand: Math.round(cableWithstand),
          sc_compliant: compliant
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 2: Power Factor Correction
// ─────────────────────────────────────────────────────────────────────────────

// Standard capacitor bank sizes (kVAR)
const STD_CAPACITOR_SIZES = [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500];

function selectCapacitorSize(required: number): number {
  return STD_CAPACITOR_SIZES.find(s => s >= required) ?? STD_CAPACITOR_SIZES[STD_CAPACITOR_SIZES.length - 1];
}

const pfCorrection: EngineeringPipeline = {
  id: 'power-factor-correction',
  name: 'Power Factor Correction',
  description: 'Calculate the required capacitor bank size to improve power factor to a target value. Reduces reactive current, lowers kVA demand charges, and improves system capacity.',
  domain: 'electrical',
  difficulty: 'beginner',
  estimated_time: '5-8 min',
  icon: '🔋',
  steps: [
    {
      stepNumber: 1,
      name: 'Existing Power Analysis',
      description: 'Characterise the current power triangle from measured active power and power factor. This establishes the baseline reactive power (kVAR) that must be reduced.',
      standard_ref: 'IEC 60038 / IEEE 1459',
      formula_display: [
        'S_existing = P / cos φ_existing',
        'Q_existing = P × tan φ_existing',
        'tan φ = sin φ / cos φ = √(1 - cos²φ) / cos φ'
      ],
      inputs: [
        { name: 'active_power_kw', label: 'Active Power (P)', unit: 'kW', type: 'number', min: 0.1, max: 50000, default: 100, required: true, help: 'Measured or calculated active power of the facility or equipment to be corrected' },
        { name: 'measured_pf', label: 'Existing Power Factor', unit: '', type: 'number', min: 0.3, max: 1.0, default: 0.72, required: true, help: 'Current power factor (read from kWh meter, clamp meter, or power analyser). Values below 0.85 typically incur utility penalties.' }
      ],
      outputs: [
        { name: 'kva_existing', label: 'Existing Apparent Power (S)', unit: 'kVA', precision: 2 },
        { name: 'kvar_existing', label: 'Existing Reactive Power (Q)', unit: 'kVAR', precision: 2 }
      ],
      calculate(inp) {
        const P = Number(inp.active_power_kw);
        const pf = Number(inp.measured_pf);
        const S = P / pf;
        const Q = P * Math.tan(Math.acos(pf));
        return { kva_existing: Math.round(S * 100) / 100, kvar_existing: Math.round(Q * 100) / 100 };
      }
    },
    {
      stepNumber: 2,
      name: 'Correction Sizing',
      description: 'Determine the reactive power (kVAR) that the capacitor bank must supply to achieve the target power factor. The capacitors supply leading reactive power that cancels the lagging reactive power of inductive loads.',
      standard_ref: 'IEC 60831-1 / IEEE 18',
      formula_display: [
        'Q_c = P × (tan φ_existing − tan φ_target)',
        'tan φ = √(1 − cos²φ) / cos φ',
        'New S_target = P / cos φ_target',
        'kVAR saving = Q_existing − Q_c'
      ],
      inputs: [
        { name: 'active_power_kw', label: 'Active Power (P)', unit: 'kW', type: 'number', min: 0.1, max: 50000, required: true, help: 'Active power from Step 1', fromPreviousStep: 'active_power_kw' },
        { name: 'kvar_existing', label: 'Existing Reactive Power (Q)', unit: 'kVAR', type: 'number', min: 0, max: 50000, required: true, help: 'Existing reactive power from Step 1', fromPreviousStep: 'kvar_existing' },
        { name: 'target_pf', label: 'Target Power Factor', unit: '', type: 'number', min: 0.85, max: 1.0, default: 0.95, required: true, help: 'Desired power factor after correction. 0.95 is the common utility minimum; 0.98 avoids leading PF penalties.' }
      ],
      outputs: [
        { name: 'kvar_required', label: 'Total Required Capacitive kVAR', unit: 'kVAR', precision: 2 },
        { name: 'kvar_to_add', label: 'kVAR to Add (Capacitor Bank)', unit: 'kVAR', precision: 2 },
        { name: 'new_kva', label: 'New Apparent Power (S)', unit: 'kVA', precision: 2 }
      ],
      calculate(inp) {
        const P = Number(inp.active_power_kw);
        const Qexist = Number(inp.kvar_existing);
        const pfTarget = Number(inp.target_pf);
        const tanTarget = Math.tan(Math.acos(pfTarget));
        const Qtarget = P * tanTarget;
        const Qc = Qexist - Qtarget;
        const newKva = P / pfTarget;
        return {
          kvar_required: Math.round(Qtarget * 100) / 100,
          kvar_to_add: Math.round(Math.max(Qc, 0) * 100) / 100,
          new_kva: Math.round(newKva * 100) / 100
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Capacitor Bank Selection',
      description: 'Select the nearest standard capacitor bank size and calculate its operating current. The selected bank size must be ≥ the calculated kVAR. Oversizing by one standard step is acceptable and common.',
      standard_ref: 'IEC 60831-1 § 4 (standard capacitor ratings)',
      formula_display: [
        'Standard bank size ≥ Q_c  (round up to nearest standard)',
        'I_cap = Q_c_selected / (√3 × V_LL)',
        'Standard sizes: 5, 10, 12.5, 15, 20, 25, 30, 40, 50 ... kVAR'
      ],
      inputs: [
        { name: 'kvar_to_add', label: 'Required Capacitor kVAR', unit: 'kVAR', type: 'number', min: 0, max: 10000, required: true, help: 'kVAR to add from Step 2', fromPreviousStep: 'kvar_to_add' },
        { name: 'voltage_ll', label: 'System Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 400, required: true, help: 'Line-to-line voltage where capacitor bank will be connected' }
      ],
      outputs: [
        { name: 'standard_size_kvar', label: 'Selected Standard Capacitor Bank', unit: 'kVAR', precision: 1 },
        { name: 'capacitor_current_a', label: 'Capacitor Operating Current', unit: 'A', precision: 2 }
      ],
      calculate(inp) {
        const Qc = Number(inp.kvar_to_add);
        const Vll = Number(inp.voltage_ll);
        const stdSize = selectCapacitorSize(Qc);
        const Icap = (stdSize * 1000) / (Math.sqrt(3) * Vll);
        return {
          standard_size_kvar: stdSize,
          capacitor_current_a: Math.round(Icap * 100) / 100
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 3: Steel Beam Design (UDL)
// ─────────────────────────────────────────────────────────────────────────────

// Standard wide-flange / universal beam sections (Ix cm⁴, Zx cm³, weight kg/m)
const STEEL_SECTIONS: { name: string; Ix_cm4: number; Zx_cm3: number; weight_kg_m: number }[] = [
  { name: 'UB 127×76×13',  Ix_cm4: 473,    Zx_cm3: 74.6,  weight_kg_m: 13.0 },
  { name: 'UB 152×89×16',  Ix_cm4: 834,    Zx_cm3: 109,   weight_kg_m: 16.0 },
  { name: 'UB 178×102×19', Ix_cm4: 1356,   Zx_cm3: 153,   weight_kg_m: 19.0 },
  { name: 'UB 203×102×23', Ix_cm4: 2105,   Zx_cm3: 207,   weight_kg_m: 23.1 },
  { name: 'UB 203×133×25', Ix_cm4: 2340,   Zx_cm3: 231,   weight_kg_m: 25.1 },
  { name: 'UB 254×102×22', Ix_cm4: 2841,   Zx_cm3: 224,   weight_kg_m: 22.0 },
  { name: 'UB 254×146×31', Ix_cm4: 4413,   Zx_cm3: 348,   weight_kg_m: 31.1 },
  { name: 'UB 305×102×25', Ix_cm4: 4455,   Zx_cm3: 292,   weight_kg_m: 24.8 },
  { name: 'UB 305×165×40', Ix_cm4: 8503,   Zx_cm3: 557,   weight_kg_m: 40.3 },
  { name: 'UB 356×127×33', Ix_cm4: 8196,   Zx_cm3: 461,   weight_kg_m: 33.1 },
  { name: 'UB 356×171×45', Ix_cm4: 12070,  Zx_cm3: 688,   weight_kg_m: 45.0 },
  { name: 'UB 406×140×39', Ix_cm4: 12452,  Zx_cm3: 626,   weight_kg_m: 39.0 },
  { name: 'UB 406×178×54', Ix_cm4: 18626,  Zx_cm3: 927,   weight_kg_m: 54.1 },
  { name: 'UB 457×152×52', Ix_cm4: 21370,  Zx_cm3: 950,   weight_kg_m: 52.3 },
  { name: 'UB 457×191×67', Ix_cm4: 29380,  Zx_cm3: 1296,  weight_kg_m: 67.1 },
  { name: 'UB 533×210×82', Ix_cm4: 47540,  Zx_cm3: 1800,  weight_kg_m: 82.2 },
  { name: 'UB 610×229×101',Ix_cm4: 75780,  Zx_cm3: 2520,  weight_kg_m: 101  },
  { name: 'UB 762×267×134',Ix_cm4: 168500, Zx_cm3: 4470,  weight_kg_m: 134  },
];

function selectBeamSection(requiredZx: number) {
  return STEEL_SECTIONS.find(s => s.Zx_cm3 >= requiredZx) ?? STEEL_SECTIONS[STEEL_SECTIONS.length - 1];
}

const beamDesign: EngineeringPipeline = {
  id: 'steel-beam-design',
  name: 'Steel Beam Design (UDL)',
  description: 'Design a simply-supported steel beam under uniformly distributed load (UDL): calculate design actions per Eurocode load combinations, select a universal beam section, and verify deflection.',
  domain: 'civil',
  difficulty: 'intermediate',
  estimated_time: '10-15 min',
  icon: '🏗️',
  steps: [
    {
      stepNumber: 1,
      name: 'Load Analysis & Design Actions',
      description: 'Calculate factored design actions (bending moment and shear force) for a simply-supported beam with UDL. Eurocode 0 load combination: 1.35×G + 1.5×Q for ULS. The design bending moment and shear are then used to select the beam section.',
      standard_ref: 'EN 1990 Eq. 6.10 + EN 1991-1-1',
      formula_display: [
        'w_d = 1.35 × G_k + 1.5 × Q_k    [ULS design UDL]',
        'M_Ed = w_d × L² / 8              [max midspan moment]',
        'V_Ed = w_d × L / 2               [max end shear]',
        'w_char = G_k + Q_k               [SLS characteristic]'
      ],
      inputs: [
        { name: 'dead_load_kn_m', label: 'Dead Load (G_k)', unit: 'kN/m', type: 'number', min: 0, max: 500, default: 10, required: true, help: 'Permanent load: self-weight of slab, finishes, partitions (unfactored)' },
        { name: 'live_load_kn_m', label: 'Live Load (Q_k)', unit: 'kN/m', type: 'number', min: 0, max: 500, default: 15, required: true, help: 'Variable/imposed load: occupancy, storage (unfactored). Use EN 1991-1-1 for category values.' },
        { name: 'span_m', label: 'Beam Span', unit: 'm', type: 'number', min: 0.5, max: 50, default: 6, required: true, help: 'Clear span of the simply-supported beam between supports' }
      ],
      outputs: [
        { name: 'design_udl_kn_m', label: 'Design UDL (w_d, ULS)', unit: 'kN/m', precision: 2 },
        { name: 'char_udl_kn_m',   label: 'Characteristic UDL (w_char, SLS)', unit: 'kN/m', precision: 2 },
        { name: 'max_moment_kn_m', label: 'Design Bending Moment (M_Ed)', unit: 'kN·m', precision: 2 },
        { name: 'max_shear_kn',    label: 'Design Shear Force (V_Ed)', unit: 'kN', precision: 2 }
      ],
      calculate(inp) {
        const Gk = Number(inp.dead_load_kn_m);
        const Qk = Number(inp.live_load_kn_m);
        const L = Number(inp.span_m);
        const wd = 1.35 * Gk + 1.5 * Qk;
        const wChar = Gk + Qk;
        const MEd = (wd * L * L) / 8;
        const VEd = (wd * L) / 2;
        return {
          design_udl_kn_m: Math.round(wd * 100) / 100,
          char_udl_kn_m:   Math.round(wChar * 100) / 100,
          max_moment_kn_m: Math.round(MEd * 100) / 100,
          max_shear_kn:    Math.round(VEd * 100) / 100
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Beam Section Selection (ULS)',
      description: 'Select the minimum universal beam (UB) section that satisfies the bending resistance at ULS. The required elastic section modulus (Z_req) is compared against the catalogue to select the lightest adequate section. Shear resistance is also checked.',
      standard_ref: 'EN 1993-1-1 § 6.2.5 & § 6.2.6',
      formula_display: [
        'W_el,min = M_Ed / f_yd           [required elastic section modulus]',
        'f_yd = f_y / γ_M0 = f_y / 1.0   [design yield strength]',
        'M_Rd = W_el × f_yd ≥ M_Ed       [bending resistance check]',
        'V_Rd = A_v × (f_y / √3) / γ_M0  [shear resistance — simplified]'
      ],
      inputs: [
        { name: 'max_moment_kn_m', label: 'Design Bending Moment (M_Ed)', unit: 'kN·m', type: 'number', min: 0, max: 50000, required: true, help: 'M_Ed from Step 1', fromPreviousStep: 'max_moment_kn_m' },
        { name: 'steel_grade', label: 'Steel Grade', unit: '', type: 'select', options: [{ value: '275', label: 'S275 — f_y = 275 MPa' }, { value: '355', label: 'S355 — f_y = 355 MPa' }, { value: '460', label: 'S460 — f_y = 460 MPa' }], default: '275', required: true, help: 'Structural steel grade per EN 10025. S355 is common in commercial structures.' }
      ],
      outputs: [
        { name: 'required_z_cm3',      label: 'Required Section Modulus (W_el,min)', unit: 'cm³', precision: 1 },
        { name: 'selected_section',    label: 'Selected UB Section', unit: '', precision: 0 },
        { name: 'section_z_cm3',       label: 'Provided Section Modulus (W_el)', unit: 'cm³', precision: 0 },
        { name: 'section_ix_cm4',      label: 'Section Second Moment of Area (I_x)', unit: 'cm⁴', precision: 0 },
        { name: 'section_weight_kg_m', label: 'Section Self-Weight', unit: 'kg/m', precision: 1 }
      ],
      calculate(inp) {
        const MEd = Number(inp.max_moment_kn_m);
        const fy = Number(inp.steel_grade);  // MPa
        // f_yd = fy MPa = fy N/mm² → convert M_Ed kN·m to N·mm: × 1e6
        // W_el (cm³) = M_Ed (N·mm) / f_yd (N/mm²) ÷ 1000
        const Wmin_cm3 = (MEd * 1e6) / (fy * 1000);
        const section = selectBeamSection(Wmin_cm3);
        return {
          required_z_cm3: Math.round(Wmin_cm3 * 10) / 10,
          selected_section: section.name,
          section_z_cm3: section.Zx_cm3,
          section_ix_cm4: section.Ix_cm4,
          section_weight_kg_m: section.weight_kg_m
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Deflection Check (SLS)',
      description: 'Verify that the mid-span deflection under serviceability loads does not exceed the allowable limit. Excessive deflection causes cracking of finishes and is visually unacceptable. EN 1993-1-1 recommends δ ≤ L/250 for live load and L/350 for sensitive finishes.',
      standard_ref: 'EN 1993-1-1 § 7.2.1 (Table NA.2)',
      formula_display: [
        'δ_max = 5 × w_char × L⁴ / (384 × E × I_x)',
        'E = 210,000 MPa  (steel modulus of elasticity)',
        'δ_allow = L / 250  (general limit, EN 1993-1-1)',
        'δ_allow = L / 360  (plastered ceiling or sensitive finishes)',
        'Units: w in N/mm, L in mm, E in N/mm², I in mm⁴'
      ],
      inputs: [
        { name: 'char_udl_kn_m',   label: 'Characteristic UDL (w_char)', unit: 'kN/m', type: 'number', min: 0, max: 1000, required: true, help: 'Characteristic (unfactored) UDL from Step 1', fromPreviousStep: 'char_udl_kn_m' },
        { name: 'span_m',          label: 'Beam Span', unit: 'm', type: 'number', min: 0.5, max: 50, default: 6, required: true, help: 'Beam span (same as Step 1)' },
        { name: 'section_ix_cm4',  label: 'Section I_x', unit: 'cm⁴', type: 'number', min: 1, max: 500000, required: true, help: 'Second moment of area of selected section (from Step 2)', fromPreviousStep: 'section_ix_cm4' },
        { name: 'deflection_limit', label: 'Deflection Limit', unit: '', type: 'select', options: [{ value: '250', label: 'L/250 — General' }, { value: '360', label: 'L/360 — Plastered ceiling' }], default: '250', required: true, help: 'Allowable deflection limit as span fraction' }
      ],
      outputs: [
        { name: 'max_deflection_mm',     label: 'Maximum Deflection (δ_max)', unit: 'mm', precision: 2 },
        { name: 'allowable_deflection_mm', label: 'Allowable Deflection (δ_allow)', unit: 'mm', precision: 2 },
        { name: 'deflection_compliant',  label: 'Deflection Check (δ ≤ δ_allow)', unit: '', precision: 0, isCompliance: true }
      ],
      calculate(inp) {
        const w_kn_m = Number(inp.char_udl_kn_m);
        const L_m = Number(inp.span_m);
        const Ix_cm4 = Number(inp.section_ix_cm4);
        const limitDenominator = Number(inp.deflection_limit);

        const w = w_kn_m;              // kN/m
        const L = L_m;                  // m
        const E = 210000;               // kN/m²... we'll work in consistent units
        // Convert: w (kN/m), L (m), E (kN/m²=MPa×1000), I (m⁴)
        const E_kN_m2 = 210e6;         // kN/m²
        const I_m4 = Ix_cm4 * 1e-8;   // cm⁴ → m⁴

        const delta_m = (5 * w * Math.pow(L, 4)) / (384 * E_kN_m2 * I_m4);
        const delta_mm = delta_m * 1000;
        const allow_mm = (L_m * 1000) / limitDenominator;

        return {
          max_deflection_mm: Math.round(delta_mm * 100) / 100,
          allowable_deflection_mm: Math.round(allow_mm * 100) / 100,
          deflection_compliant: delta_mm <= allow_mm
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 4: HVAC Cooling Load (ASHRAE)
// ─────────────────────────────────────────────────────────────────────────────

// Standard cooling unit capacities (kW)
const STD_COOLING_UNITS = [2.5, 3.5, 5, 7, 8, 10, 12, 14, 17.5, 20, 25, 30, 35, 40, 50, 60, 70, 90, 100, 120, 150, 200];

function selectCoolingUnit(required_kw: number): number {
  return STD_COOLING_UNITS.find(s => s >= required_kw) ?? STD_COOLING_UNITS[STD_COOLING_UNITS.length - 1];
}

const hvacCoolingLoad: EngineeringPipeline = {
  id: 'hvac-cooling-load',
  name: 'HVAC Cooling Load Estimation',
  description: 'Estimate the total cooling load for a conditioned space using ASHRAE simplified method: sensible gains (fabric, solar, people, equipment) + latent gains (moisture from occupants and ventilation) to size the cooling unit.',
  domain: 'hvac',
  difficulty: 'intermediate',
  estimated_time: '8-12 min',
  icon: '❄️',
  steps: [
    {
      stepNumber: 1,
      name: 'Sensible Heat Gains',
      description: 'Calculate all sensible (dry) heat gains entering the space: conduction through envelope, solar through glazing, lighting, equipment, and occupants. These gains must be removed by the cooling system.',
      standard_ref: 'ASHRAE Handbook of Fundamentals, Chapter 18',
      formula_display: [
        'Q_envelope = U × A_wall × ΔT + U × A_roof × ΔT',
        'Q_solar    = A_window × SHGC × SC × I_solar',
        'Q_lighting = W/m² × floor area',
        'Q_equip    = W/m² × floor area',
        'Q_people   = 70 W/person (sensible at sedentary)',
        'Q_sensible = sum of all above (kW)'
      ],
      inputs: [
        { name: 'floor_area_m2',   label: 'Floor Area', unit: 'm²', type: 'number', min: 1, max: 50000, default: 100, required: true, help: 'Total conditioned floor area of the space' },
        { name: 'window_area_m2',  label: 'Window/Glazing Area', unit: 'm²', type: 'number', min: 0, max: 5000, default: 20, required: true, help: 'Total exposed window area (all orientations). Solar gain is a major contributor in glass-heavy buildings.' },
        { name: 'occupants',       label: 'Number of Occupants', unit: 'persons', type: 'number', min: 0, max: 5000, default: 20, required: true, help: 'Maximum simultaneous occupancy. Each person generates ~70 W sensible + 45 W latent at sedentary activity.' },
        { name: 'lighting_w_m2',   label: 'Lighting Load Density', unit: 'W/m²', type: 'number', min: 0, max: 100, default: 12, required: true, help: 'Installed lighting power density. Office: 10-15 W/m², retail: 20-30 W/m², lab: 20-40 W/m².' },
        { name: 'equipment_w_m2',  label: 'Equipment Load Density', unit: 'W/m²', type: 'number', min: 0, max: 200, default: 20, required: true, help: 'Office equipment, computers, servers. Office: 15-25 W/m², server room: 200-500 W/m².' },
        { name: 'delta_t',         label: 'Indoor/Outdoor Temperature Difference (ΔT)', unit: '°C', type: 'number', min: 1, max: 40, default: 12, required: true, help: 'Outdoor design dry-bulb minus indoor setpoint. E.g. 35°C outdoor − 23°C indoor = 12°C.' }
      ],
      outputs: [
        { name: 'envelope_gain_kw',  label: 'Envelope Conduction + Solar Gain', unit: 'kW', precision: 2 },
        { name: 'internal_gain_kw',  label: 'Internal Gains (Lights + Equip + People)', unit: 'kW', precision: 2 },
        { name: 'sensible_load_kw',  label: 'Total Sensible Cooling Load', unit: 'kW', precision: 2 }
      ],
      calculate(inp) {
        const A_floor = Number(inp.floor_area_m2);
        const A_win   = Number(inp.window_area_m2);
        const occ     = Number(inp.occupants);
        const lit     = Number(inp.lighting_w_m2);
        const equip   = Number(inp.equipment_w_m2);
        const dT      = Number(inp.delta_t);

        // Simplified envelope: U=0.4 W/m²K for walls/roof (typical modern construction)
        // Wall area ≈ perimeter × 3m height. Approximate perimeter from floor area assuming square floor
        const side_m = Math.sqrt(A_floor);
        const A_wall_m2 = 4 * side_m * 3.0;
        const U_wall = 0.4;  // W/m²K
        const U_glass = 1.8; // W/m²K double glazing
        const SHGC = 0.35;   // solar heat gain coefficient (tinted glass)
        const I_solar = 500; // W/m² (peak solar irradiance, horizontal projection)

        const Q_envelope_W = U_wall * (A_wall_m2 - A_win) * dT + U_glass * A_win * dT + A_win * SHGC * I_solar;
        const Q_internal_W = (lit + equip) * A_floor + occ * 70;

        const sensible_kw = (Q_envelope_W + Q_internal_W) / 1000;
        const envelope_kw = Q_envelope_W / 1000;
        const internal_kw = Q_internal_W / 1000;

        return {
          envelope_gain_kw: Math.round(envelope_kw * 100) / 100,
          internal_gain_kw: Math.round(internal_kw * 100) / 100,
          sensible_load_kw: Math.round(sensible_kw * 100) / 100
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Latent Heat Gains',
      description: 'Calculate latent (moisture) heat gains from occupants exhaling and fresh air ventilation bringing in humid outdoor air. Latent gains require additional dehumidification capacity in the cooling system.',
      standard_ref: 'ASHRAE 62.1-2022 (ventilation) + ASHRAE HVAC Fundamentals Ch. 1',
      formula_display: [
        'Q_lat_people  = occupants × 45 W/person  (sedentary)',
        'Q_lat_ventilation = Q_air × Δω × h_fg',
        'Δω = humidity ratio difference (outdoor − indoor)',
        'h_fg ≈ 2450 kJ/kg  (latent heat of vaporisation)',
        'ρ_air ≈ 1.2 kg/m³',
        'Q_lat_total = Q_lat_people + Q_lat_vent'
      ],
      inputs: [
        { name: 'occupants',      label: 'Number of Occupants', unit: 'persons', type: 'number', min: 0, max: 5000, required: true, help: 'Occupancy from Step 1', fromPreviousStep: 'occupants' },
        { name: 'fresh_air_m3_h', label: 'Fresh Air Ventilation Rate', unit: 'm³/h', type: 'number', min: 0, max: 500000, default: 720, required: true, help: 'Total outdoor air supply. ASHRAE 62.1 typical office: 8 L/s/person + 1 L/s/m². Or enter total m³/h from mechanical design.' },
        { name: 'outdoor_rh_pct', label: 'Outdoor Relative Humidity', unit: '%', type: 'number', min: 10, max: 100, default: 60, required: true, help: 'Outdoor design humidity for summer peak. Use local weather data (ASHRAE design conditions).' },
        { name: 'indoor_rh_pct',  label: 'Indoor Relative Humidity Setpoint', unit: '%', type: 'number', min: 30, max: 70, default: 50, required: true, help: 'Target indoor relative humidity (typically 50% for comfort).' },
        { name: 'outdoor_temp',   label: 'Outdoor Design Temperature', unit: '°C', type: 'number', min: 20, max: 50, default: 35, required: true, help: 'Summer outdoor dry-bulb design temperature (0.4% annual exceedance from ASHRAE App. DE).' }
      ],
      outputs: [
        { name: 'latent_people_kw', label: 'Latent Gain from Occupants', unit: 'kW', precision: 2 },
        { name: 'latent_vent_kw',   label: 'Latent Gain from Ventilation', unit: 'kW', precision: 2 },
        { name: 'latent_load_kw',   label: 'Total Latent Cooling Load', unit: 'kW', precision: 2 }
      ],
      calculate(inp) {
        const occ      = Number(inp.occupants);
        const Qv_m3h   = Number(inp.fresh_air_m3_h);
        const RH_out   = Number(inp.outdoor_rh_pct) / 100;
        const RH_in    = Number(inp.indoor_rh_pct) / 100;
        const T_out    = Number(inp.outdoor_temp);

        // Saturation vapour pressure (Buck equation, kPa)
        const psat_out = 0.61078 * Math.exp((17.27 * T_out) / (T_out + 237.3));
        const psat_in  = 0.61078 * Math.exp((17.27 * 23) / (23 + 237.3)); // assume 23°C indoor

        // Humidity ratio (kg water / kg dry air)
        const P_atm = 101.325; // kPa
        const w_out = 0.622 * (RH_out * psat_out) / (P_atm - RH_out * psat_out);
        const w_in  = 0.622 * (RH_in  * psat_in)  / (P_atm - RH_in  * psat_in);
        const delta_w = Math.max(w_out - w_in, 0);

        const mass_flow_kg_s = (Qv_m3h / 3600) * 1.2; // ρ_air = 1.2 kg/m³
        const h_fg = 2450; // kJ/kg

        const Q_lat_people_kW = (occ * 45) / 1000;
        const Q_lat_vent_kW   = mass_flow_kg_s * delta_w * h_fg;

        return {
          latent_people_kw: Math.round(Q_lat_people_kW * 100) / 100,
          latent_vent_kw:   Math.round(Q_lat_vent_kW * 100) / 100,
          latent_load_kw:   Math.round((Q_lat_people_kW + Q_lat_vent_kW) * 100) / 100
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Total Load & Equipment Selection',
      description: 'Sum sensible and latent loads, apply a design safety factor, and select the nearest standard cooling unit capacity. Also calculate the sensible heat ratio (SHR) which determines the required coil leaving conditions.',
      standard_ref: 'ASHRAE Handbook — HVAC Systems & Equipment, Ch. 1',
      formula_display: [
        'Q_total = (Q_sensible + Q_latent) × safety_factor',
        'Cooling tons = Q_total (kW) / 3.517',
        'SHR = Q_sensible / Q_total',
        'Estimated COP ≈ 3.0 − 3.5 (air-cooled chiller at 35°C ambient)',
        'Input power = Q_total / COP'
      ],
      inputs: [
        { name: 'sensible_load_kw', label: 'Total Sensible Load', unit: 'kW', type: 'number', min: 0, max: 50000, required: true, help: 'Total sensible load from Step 1', fromPreviousStep: 'sensible_load_kw' },
        { name: 'latent_load_kw',   label: 'Total Latent Load', unit: 'kW', type: 'number', min: 0, max: 50000, required: true, help: 'Total latent load from Step 2', fromPreviousStep: 'latent_load_kw' },
        { name: 'safety_factor',    label: 'Design Safety Factor', unit: '', type: 'number', min: 1.0, max: 1.5, default: 1.1, required: true, help: 'Multiplier to account for uncertainties (1.10 = 10% margin is typical for preliminary design)' }
      ],
      outputs: [
        { name: 'total_cooling_kw', label: 'Design Cooling Load', unit: 'kW', precision: 2 },
        { name: 'cooling_tons',     label: 'Design Cooling Load', unit: 'TR', precision: 2 },
        { name: 'shr',              label: 'Sensible Heat Ratio (SHR)', unit: '', precision: 3 },
        { name: 'selected_unit_kw', label: 'Selected Cooling Unit Capacity', unit: 'kW', precision: 1 },
        { name: 'estimated_input_kw', label: 'Estimated Electrical Input Power', unit: 'kW', precision: 1 }
      ],
      calculate(inp) {
        const Qs = Number(inp.sensible_load_kw);
        const Ql = Number(inp.latent_load_kw);
        const SF = Number(inp.safety_factor);

        const Qtotal = (Qs + Ql) * SF;
        const tons = Qtotal / 3.517;
        const shr = Qs / (Qs + Ql);
        const unitKw = selectCoolingUnit(Qtotal);
        const COP = 3.2; // typical air-cooled chiller at 35°C ambient
        const inputKw = Qtotal / COP;

        return {
          total_cooling_kw: Math.round(Qtotal * 100) / 100,
          cooling_tons: Math.round(tons * 100) / 100,
          shr: Math.round(shr * 1000) / 1000,
          selected_unit_kw: unitKw,
          estimated_input_kw: Math.round(inputKw * 10) / 10
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Domain Pipeline Imports
// ─────────────────────────────────────────────────────────────────────────────

import { ELECTRICAL_PIPELINES } from './pipelines/electrical.pipelines.js';
import { MECHANICAL_PIPELINES } from './pipelines/mechanical.pipelines.js';
import { CIVIL_PIPELINES } from './pipelines/civil.pipelines.js';
import { HYDRAULICS_PIPELINES } from './pipelines/hydraulics.pipelines.js';
import { HVAC_PIPELINES } from './pipelines/hvac.pipelines.js';

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ENGINEERING_PIPELINES: EngineeringPipeline[] = [
  // Core (original 4)
  lvCableSizing,
  pfCorrection,
  beamDesign,
  hvacCoolingLoad,
  // Electrical
  ...ELECTRICAL_PIPELINES,
  // Mechanical
  ...MECHANICAL_PIPELINES,
  // Civil / Structural
  ...CIVIL_PIPELINES,
  // Hydraulics / Water
  ...HYDRAULICS_PIPELINES,
  // HVAC (additional)
  ...HVAC_PIPELINES,
];

export function getPipelineById(id: string): EngineeringPipeline | undefined {
  return ENGINEERING_PIPELINES.find(p => p.id === id);
}
