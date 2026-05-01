// Engineering Pipeline Definitions — Local Data (no DB dependency)
// Each pipeline is a sequence of steps where outputs of step N feed into inputs of step N+1

import { lookupCableImpedance } from '@/lib/engineering/cable-data';
import {
  lookupBusbarDerating,
  BUSBAR_MATERIALS,
  lookupCU,
  lookupMotorCode,
  selectCableSize as selectCableSizeFromLib,
  lookupCableAmpacity,
  lookupTransformerImpedance,
  selectMCCBSize,
} from '@/lib/engineering/electrical-data';

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
// Pipeline 5: Voltage Drop Calculator
// ─────────────────────────────────────────────────────────────────────────────

const voltageDropCalculator: EngineeringPipeline = {
  id: 'voltage-drop-calculator',
  name: 'Voltage Drop Calculator',
  description: 'Calculate voltage drop for cable runs considering conductor type, insulation, starting and running conditions per IEC 60364-5-52. Evaluates both starting and running voltage drop with compliance checks.',
  domain: 'electrical',
  difficulty: 'intermediate',
  estimated_time: '8-12 min',
  icon: '📉',
  steps: [
    {
      stepNumber: 1,
      name: 'Cable Route Data',
      description: 'Define the cable route parameters including length, number of parallel cables, cable size, conductor material, and insulation type. These parameters determine the cable impedance used in voltage drop calculations.',
      standard_ref: 'IEC 60364-5-52',
      formula_display: [
        'Total length = length_m × noOfCablesPerRun',
        'R, X from cable impedance tables (Ω/km)',
        'R depends on conductor type (CU/ALU) and insulation (PVC/XLPE)',
      ],
      inputs: [
        { name: 'cableFrom', label: 'Cable From', unit: '', type: 'number', min: 0, max: 9999, default: 1, required: true, help: 'Source location identifier for the cable run' },
        { name: 'cableTo', label: 'Cable To', unit: '', type: 'number', min: 0, max: 9999, default: 2, required: true, help: 'Destination location identifier for the cable run' },
        { name: 'length_m', label: 'Cable Length', unit: 'm', type: 'number', min: 1, max: 5000, default: 80, required: true, help: 'One-way cable route length in meters' },
        { name: 'noOfCablesPerRun', label: 'No. of Cables Per Run', unit: '', type: 'number', min: 1, max: 10, default: 1, required: true, help: 'Number of parallel cables per phase (increases current capacity, reduces effective impedance)' },
        { name: 'cableSize_mm2', label: 'Cable Size', unit: 'mm²', type: 'select', options: [
          { value: 16, label: '16 mm²' }, { value: 25, label: '25 mm²' }, { value: 35, label: '35 mm²' },
          { value: 50, label: '50 mm²' }, { value: 70, label: '70 mm²' }, { value: 95, label: '95 mm²' },
          { value: 120, label: '120 mm²' }, { value: 150, label: '150 mm²' }, { value: 185, label: '185 mm²' },
          { value: 240, label: '240 mm²' }, { value: 300, label: '300 mm²' }, { value: 400, label: '400 mm²' },
        ], default: 70, required: true, help: 'Cross-sectional area of each cable conductor per phase' },
        { name: 'conductorType', label: 'Conductor Type', unit: '', type: 'select', options: [
          { value: 'CU', label: 'Copper (CU)' }, { value: 'ALU', label: 'Aluminum (ALU)' },
        ], default: 'CU', required: true, help: 'Conductor material — copper has lower resistance per unit area but is more expensive' },
        { name: 'insulationType', label: 'Insulation Type', unit: '', type: 'select', options: [
          { value: 'PVC', label: 'PVC (70°C max)' }, { value: 'XLPE', label: 'XLPE (90°C max)' },
        ], default: 'PVC', required: true, help: 'Cable insulation material — affects maximum operating temperature and resistance' },
      ],
      outputs: [
        { name: 'totalLength_m', label: 'Total Cable Length', unit: 'm', precision: 1 },
        { name: 'R_ohm_km', label: 'Resistance (R)', unit: 'Ω/km', precision: 4 },
        { name: 'X_ohm_km', label: 'Reactance (X)', unit: 'Ω/km', precision: 4 },
      ],
      calculate(inp) {
        const len = Number(inp.length_m);
        const nCables = Math.max(Number(inp.noOfCablesPerRun), 1);
        const size = Number(inp.cableSize_mm2);
        const condType = String(inp.conductorType) as 'ALU' | 'CU';
        const insType = String(inp.insulationType) as 'PVC' | 'XLPE';

        const impedance = lookupCableImpedance(size, condType, insType);

        return {
          totalLength_m: Math.round(len * nCables * 10) / 10,
          R_ohm_km: Math.round(impedance.R * 10000) / 10000,
          X_ohm_km: Math.round(impedance.X * 10000) / 10000,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Load Data',
      description: 'Enter the supply voltage and load characteristics including lighting and motor loads. Starting power factor is used for motor starting voltage drop, and running power factor for steady-state operation.',
      standard_ref: 'IEC 60364-5-52',
      formula_display: [
        'Total load = lightingLoad_kW + motorLoad_kW',
        'Motor starting current = motorLoad_kW × lockRotorMultiplier / (efficiency × PF)',
        'Full load current (FLC) = motorLoad_kW / (√3 × V × PF × η)',
        'Starting current = FLC × lockRotorMultiplier',
      ],
      inputs: [
        { name: 'supplyVoltage_V', label: 'Supply Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 433, required: true, help: 'Line-to-line supply voltage at the source (433V typical for 380V systems at transformer)' },
        { name: 'startingPF', label: 'Starting Power Factor', unit: '', type: 'number', min: 0.1, max: 0.8, default: 0.6, required: true, help: 'Power factor during motor starting (typically 0.2–0.6, lower for larger motors)' },
        { name: 'runningPF', label: 'Running Power Factor', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.85, required: true, help: 'Power factor during normal running condition' },
        { name: 'lightingLoad_kW', label: 'Lighting Load', unit: 'kW', type: 'number', min: 0, max: 1000, default: 5, required: true, help: 'Connected lighting load in kW (resistive, PF ≈ 1.0)' },
        { name: 'motorLoad_kW', label: 'Motor Load', unit: 'kW', type: 'number', min: 0, max: 1000, default: 15, required: true, help: 'Connected motor load in kW (inductive, affects starting current)' },
        { name: 'motorLockRotorMultiplier', label: 'Motor Lock Rotor Multiplier', unit: '', type: 'number', min: 1, max: 8, default: 3, required: true, help: 'Ratio of starting current to full-load current (DOL: 5–8, Star-Delta: 1.7–3, VFD: 1.0–1.5)' },
      ],
      outputs: [
        { name: 'totalLoad_kW', label: 'Total Connected Load', unit: 'kW', precision: 2 },
        { name: 'lightingCurrent_A', label: 'Lighting Current', unit: 'A', precision: 2 },
        { name: 'motorFLC_A', label: 'Motor Full-Load Current', unit: 'A', precision: 2 },
        { name: 'motorStartingCurrent_A', label: 'Motor Starting Current', unit: 'A', precision: 2 },
        { name: 'totalStartingCurrent_A', label: 'Total Starting Current', unit: 'A', precision: 2 },
        { name: 'totalRunningCurrent_A', label: 'Total Running Current', unit: 'A', precision: 2 },
      ],
      calculate(inp) {
        const V = Number(inp.supplyVoltage_V);
        const startPF = Number(inp.startingPF);
        const runPF = Number(inp.runningPF);
        const lighting = Number(inp.lightingLoad_kW);
        const motor = Number(inp.motorLoad_kW);
        const lrMultiplier = Number(inp.motorLockRotorMultiplier);

        const totalLoad = lighting + motor;

        // Lighting current (assume PF=1, 3-phase)
        const lightingI = (lighting * 1000) / (Math.sqrt(3) * V);

        // Motor full-load current (assume efficiency ≈ 0.9 if not given)
        const motorEff = 0.9;
        const motorFLC = (motor * 1000) / (Math.sqrt(3) * V * runPF * motorEff);

        // Motor starting current
        const motorStartingI = motorFLC * lrMultiplier;

        // Total currents
        const totalStarting = lightingI + motorStartingI;
        const totalRunning = lightingI + motorFLC;

        return {
          totalLoad_kW: Math.round(totalLoad * 100) / 100,
          lightingCurrent_A: Math.round(lightingI * 100) / 100,
          motorFLC_A: Math.round(motorFLC * 100) / 100,
          motorStartingCurrent_A: Math.round(motorStartingI * 100) / 100,
          totalStartingCurrent_A: Math.round(totalStarting * 100) / 100,
          totalRunningCurrent_A: Math.round(totalRunning * 100) / 100,
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Voltage Drop Results',
      description: 'Calculate voltage drop under both starting and running conditions, determine % regulation, and verify compliance with IEC 60364-5-52 limits (≤ 3% running, ≤ 5% starting).',
      standard_ref: 'IEC 60364-5-52 § 525',
      formula_display: [
        'VD = √3 × I × L × (R·cosφ + X·sinφ) / (cables × 1000)',
        'VD% = (VD / V_supply) × 100',
        '% Regulation = VD% at running condition',
        'Compliance: VD_running ≤ 3%, VD_starting ≤ 5%',
      ],
      inputs: [
        { name: 'totalLength_m', label: 'Total Cable Length', unit: 'm', type: 'number', min: 1, max: 5000, required: true, help: 'Total cable length from Step 1', fromPreviousStep: 'totalLength_m' },
        { name: 'R_ohm_km', label: 'Cable Resistance (R)', unit: 'Ω/km', type: 'number', min: 0, max: 10, required: true, help: 'Cable resistance from Step 1', fromPreviousStep: 'R_ohm_km' },
        { name: 'X_ohm_km', label: 'Cable Reactance (X)', unit: 'Ω/km', type: 'number', min: 0, max: 1, required: true, help: 'Cable reactance from Step 1', fromPreviousStep: 'X_ohm_km' },
        { name: 'noOfCablesPerRun', label: 'No. of Cables Per Run', unit: '', type: 'number', min: 1, max: 10, default: 1, required: true, help: 'Number of parallel cables per phase' },
        { name: 'supplyVoltage_V', label: 'Supply Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 433, required: true, help: 'Supply voltage' },
        { name: 'totalStartingCurrent_A', label: 'Total Starting Current', unit: 'A', type: 'number', min: 0, max: 10000, required: true, help: 'Total starting current from Step 2', fromPreviousStep: 'totalStartingCurrent_A' },
        { name: 'totalRunningCurrent_A', label: 'Total Running Current', unit: 'A', type: 'number', min: 0, max: 10000, required: true, help: 'Total running current from Step 2', fromPreviousStep: 'totalRunningCurrent_A' },
        { name: 'startingPF', label: 'Starting Power Factor', unit: '', type: 'number', min: 0.1, max: 0.8, default: 0.6, required: true, help: 'Power factor during starting' },
        { name: 'runningPF', label: 'Running Power Factor', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.85, required: true, help: 'Power factor during running' },
      ],
      outputs: [
        { name: 'vd_starting_V', label: 'Voltage Drop (Starting)', unit: 'V', precision: 2 },
        { name: 'vd_starting_pct', label: 'Voltage Drop % (Starting)', unit: '%', precision: 2 },
        { name: 'vd_running_V', label: 'Voltage Drop (Running)', unit: 'V', precision: 2 },
        { name: 'vd_running_pct', label: 'Voltage Drop % (Running)', unit: '%', precision: 2 },
        { name: 'regulation_pct', label: '% Regulation', unit: '%', precision: 2 },
        { name: 'running_compliant', label: 'Running VD ≤ 3%', unit: '', precision: 0, isCompliance: true },
        { name: 'starting_compliant', label: 'Starting VD ≤ 5%', unit: '', precision: 0, isCompliance: true },
      ],
      calculate(inp) {
        const L = Number(inp.totalLength_m);
        const R = Number(inp.R_ohm_km);
        const X = Number(inp.X_ohm_km);
        const nCables = Math.max(Number(inp.noOfCablesPerRun), 1);
        const V = Number(inp.supplyVoltage_V);
        const Istart = Number(inp.totalStartingCurrent_A);
        const Irun = Number(inp.totalRunningCurrent_A);
        const pfStart = Number(inp.startingPF);
        const pfRun = Number(inp.runningPF);

        const sinStart = Math.sqrt(1 - pfStart * pfStart);
        const sinRun = Math.sqrt(1 - pfRun * pfRun);

        // Voltage drop: VD = √3 × I × L × (R·cosφ + X·sinφ) / (cables × 1000)
        const vdStartV = (Math.sqrt(3) * Istart * L * (R * pfStart + X * sinStart)) / (nCables * 1000);
        const vdRunV = (Math.sqrt(3) * Irun * L * (R * pfRun + X * sinRun)) / (nCables * 1000);

        const vdStartPct = (vdStartV / V) * 100;
        const vdRunPct = (vdRunV / V) * 100;

        return {
          vd_starting_V: Math.round(vdStartV * 100) / 100,
          vd_starting_pct: Math.round(vdStartPct * 100) / 100,
          vd_running_V: Math.round(vdRunV * 100) / 100,
          vd_running_pct: Math.round(vdRunPct * 100) / 100,
          regulation_pct: Math.round(vdRunPct * 100) / 100,
          running_compliant: vdRunPct <= 3.0,
          starting_compliant: vdStartPct <= 5.0,
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 6: Busbar Sizing
// ─────────────────────────────────────────────────────────────────────────────

const busbarSizing: EngineeringPipeline = {
  id: 'busbar-sizing',
  name: 'Busbar Sizing',
  description: 'Size busbar systems per IEC 60890 and Egyptian Code: determine derating factors for installation conditions, calculate required cross-section for both continuous current and short-circuit withstand, and verify compliance.',
  domain: 'electrical',
  difficulty: 'advanced',
  estimated_time: '12-18 min',
  icon: '🔲',
  steps: [
    {
      stepNumber: 1,
      name: 'Busbar Parameters',
      description: 'Define the busbar system electrical requirements: desired continuous current rating, prospective fault current, fault duration, and temperature limits. These determine the minimum cross-section for both normal and fault conditions.',
      standard_ref: 'IEC 60890 / Egyptian Code',
      formula_display: [
        'Desired current rating (continuous)',
        'Fault current and duration for short-circuit sizing',
        'Operating and final fault temperatures for material k factor',
        'Busbar material: copper or aluminum',
      ],
      inputs: [
        { name: 'desiredCurrent_A', label: 'Desired Current Rating', unit: 'A', type: 'number', min: 50, max: 6300, default: 630, required: true, help: 'Continuous current the busbar must carry under normal operating conditions' },
        { name: 'faultCurrent_kA', label: 'Prospective Fault Current', unit: 'kA', type: 'number', min: 1, max: 100, default: 50, required: true, help: 'Maximum prospective short-circuit current at the busbar location' },
        { name: 'faultDuration_s', label: 'Fault Duration', unit: 's', type: 'number', min: 0.1, max: 5, default: 1, required: true, help: 'Duration of short-circuit (typically 1s for main busbars, 0.4s for sub-busbars)' },
        { name: 'operatingTemp_C', label: 'Operating Temperature', unit: '°C', type: 'number', min: 30, max: 120, default: 85, required: true, help: 'Maximum continuous operating temperature of the busbar' },
        { name: 'finalFaultTemp_C', label: 'Final Fault Temperature', unit: '°C', type: 'number', min: 100, max: 300, default: 185, required: true, help: 'Maximum temperature during short-circuit (Cu: 185°C bare, 250°C plated)' },
        { name: 'ambientTemp_C', label: 'Ambient Temperature', unit: '°C', type: 'number', min: 20, max: 60, default: 50, required: true, help: 'Maximum ambient temperature around the busbar enclosure' },
        { name: 'busbarMaterial', label: 'Busbar Material', unit: '', type: 'select', options: [
          { value: 'copper', label: 'Copper' }, { value: 'aluminum', label: 'Aluminum' },
        ], default: 'copper', required: true, help: 'Busbar conductor material — copper has higher conductivity and short-circuit withstand' },
      ],
      outputs: [
        { name: 'material_conductivity', label: 'Material Conductivity', unit: '% IACS', precision: 0 },
        { name: 'material_k_factor', label: 'Short-Circuit k Factor', unit: '', precision: 0 },
        { name: 'ambientDerating', label: 'Ambient Temp Derating', unit: '', precision: 3 },
      ],
      calculate(inp) {
        const material = String(inp.busbarMaterial);
        const ambientTemp = Number(inp.ambientTemp_C);
        const operatingTemp = Number(inp.operatingTemp_C);

        const matData = BUSBAR_MATERIALS[material] ?? BUSBAR_MATERIALS['copper'];

        // Ambient temperature derating: (θ_max - θ_amb) / (θ_max - 40)
        // Reference ambient is 40°C per IEC
        const ambientDerating = (operatingTemp - ambientTemp) / (operatingTemp - 40);

        return {
          material_conductivity: matData.conductivity,
          material_k_factor: matData.k_factor,
          ambientDerating: Math.round(ambientDerating * 1000) / 1000,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Derating Factors',
      description: 'Apply all derating factors for the busbar installation environment per IEC 60890 and Egyptian Code. These factors account for enclosure, ventilation, proximity, altitude, and other installation-specific conditions.',
      standard_ref: 'IEC 60890 / Egyptian Code',
      formula_display: [
        'K_total = K1 × K2 × K3 × K4 × K5 × K6 × K7 × K8',
        'K1 = enclosure area ratio factor',
        'K2 = insulating material factor',
        'K3 = busbar position factor',
        'K4 = installation media factor',
        'K5 = ventilation scheme factor',
        'K6 = cross-section / enclosure factor',
        'K7 = proximity bars factor',
        'K8 = altitude correction factor',
      ],
      inputs: [
        { name: 'k1_ea_ratio', label: 'K1: Enclosure/Busbar Area Ratio', unit: '', type: 'number', min: 0, max: 0.5, default: 0.12, required: true, help: 'Ratio of enclosure cross-section area to busbar cross-section area (0.12 typical)' },
        { name: 'k1_strips', label: 'K1: Number of Strips', unit: '', type: 'number', min: 1, max: 4, default: 2, required: true, help: 'Number of conductor strips per phase (affects K1 and current distribution)' },
        { name: 'k2_insulatingMaterial', label: 'K2: Insulating Material', unit: '', type: 'select', options: [
          { value: 'Bare', label: 'Bare (1.00)' }, { value: 'PVC', label: 'PVC (0.85)' },
          { value: 'Heat-shrink', label: 'Heat-shrink (0.90)' }, { value: 'Epoxy', label: 'Epoxy (0.88)' },
        ], default: 'Bare', required: true, help: 'Insulation covering on the busbar (bare has highest rating)' },
        { name: 'k3_position', label: 'K3: Busbar Position', unit: '', type: 'select', options: [
          { value: 'Edge-mounted bars', label: 'Edge-mounted bars (1.00)' },
          { value: 'Flat-mounted bars', label: 'Flat-mounted bars (0.92)' },
          { value: 'Vertical bars', label: 'Vertical bars (0.95)' },
        ], default: 'Edge-mounted bars', required: true, help: 'Orientation of busbar mounting within the enclosure' },
        { name: 'k4_installationMedia', label: 'K4: Installation Media', unit: '', type: 'select', options: [
          { value: 'Open air', label: 'Open air (1.00)' },
          { value: 'Ventilated ducting', label: 'Ventilated ducting (0.90)' },
          { value: 'Non-ventilated ducting', label: 'Non-ventilated ducting (0.78)' },
        ], default: 'Non-ventilated ducting', required: true, help: 'Installation medium surrounding the busbar enclosure' },
        { name: 'k5_ventilationScheme', label: 'K5: Ventilation Scheme', unit: '', type: 'select', options: [
          { value: 'With artificial ventilation', label: 'With artificial ventilation (1.00)' },
          { value: 'Without artificial ventilation', label: 'Without artificial ventilation (0.85)' },
        ], default: 'Without artificial ventilation', required: true, help: 'Whether the enclosure has forced (artificial) ventilation' },
        { name: 'k6_crossSectionRatio', label: 'K6: Cross-Section Ratio', unit: '', type: 'number', min: 0, max: 0.3, default: 0.05, required: true, help: 'Ratio of busbar cross-section to enclosure cross-section' },
        { name: 'k6_enclosureType', label: 'K6: Enclosure Type', unit: '', type: 'select', options: [
          { value: 'well', label: 'Well ventilated (0.95)' },
          { value: 'poorly', label: 'Poorly ventilated (0.85)' },
        ], default: 'well', required: true, help: 'Quality of enclosure ventilation' },
        { name: 'k7_proxyBars', label: 'K7: Proximity Busbar Systems', unit: '', type: 'number', min: 0, max: 4, default: 2, required: true, help: 'Number of nearby busbar systems that cause mutual heating' },
        { name: 'k8_altitude_m', label: 'K8: Altitude', unit: 'm', type: 'number', min: 0, max: 5000, default: 2200, required: true, help: 'Installation altitude above sea level in meters (>1000m requires derating)' },
      ],
      outputs: [
        { name: 'k1', label: 'K1 Factor', unit: '', precision: 3 },
        { name: 'k2', label: 'K2 Factor', unit: '', precision: 3 },
        { name: 'k3', label: 'K3 Factor', unit: '', precision: 3 },
        { name: 'k4', label: 'K4 Factor', unit: '', precision: 3 },
        { name: 'k5', label: 'K5 Factor', unit: '', precision: 3 },
        { name: 'k6', label: 'K6 Factor', unit: '', precision: 3 },
        { name: 'k7', label: 'K7 Factor', unit: '', precision: 3 },
        { name: 'k8', label: 'K8 Factor', unit: '', precision: 3 },
        { name: 'totalDeratingFactor', label: 'Total Derating Factor (K_total)', unit: '', precision: 4 },
      ],
      calculate(inp) {
        const factors = lookupBusbarDerating({
          k1_ea_ratio: Number(inp.k1_ea_ratio),
          k1_strips: Number(inp.k1_strips),
          k2_insulatingMaterial: String(inp.k2_insulatingMaterial),
          k3_position: String(inp.k3_position),
          k4_installationMedia: String(inp.k4_installationMedia),
          k5_ventilationScheme: String(inp.k5_ventilationScheme),
          k6_crossSectionRatio: Number(inp.k6_crossSectionRatio),
          k6_enclosureType: String(inp.k6_enclosureType),
          k7_proxyBars: Number(inp.k7_proxyBars),
          k8_altitude_m: Number(inp.k8_altitude_m),
        });

        const total = factors.k1 * factors.k2 * factors.k3 * factors.k4 * factors.k5 * factors.k6 * factors.k7 * factors.k8;

        return {
          k1: Math.round(factors.k1 * 1000) / 1000,
          k2: Math.round(factors.k2 * 1000) / 1000,
          k3: Math.round(factors.k3 * 1000) / 1000,
          k4: Math.round(factors.k4 * 1000) / 1000,
          k5: Math.round(factors.k5 * 1000) / 1000,
          k6: Math.round(factors.k6 * 1000) / 1000,
          k7: Math.round(factors.k7 * 1000) / 1000,
          k8: Math.round(factors.k8 * 1000) / 1000,
          totalDeratingFactor: Math.round(total * 10000) / 10000,
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Busbar Results',
      description: 'Calculate the required busbar cross-section for both continuous current and short-circuit withstand, select the final cross-section, and verify compliance with all criteria.',
      standard_ref: 'IEC 60890 / Egyptian Code',
      formula_display: [
        'I_derated = I_desired / K_total',
        'CS_current = I_derated / baseRating_per_mm²',
        'CS_SC = (I_fault × √t) / k_factor',
        'CS_final = max(CS_current, CS_SC)',
        'Compliance: I_rated ≥ I_desired, CS ≥ CS_SC',
      ],
      inputs: [
        { name: 'desiredCurrent_A', label: 'Desired Current', unit: 'A', type: 'number', min: 50, max: 6300, default: 630, required: true, help: 'Desired current rating from Step 1' },
        { name: 'totalDeratingFactor', label: 'Total Derating Factor', unit: '', type: 'number', min: 0.1, max: 1, required: true, help: 'Total derating factor from Step 2', fromPreviousStep: 'totalDeratingFactor' },
        { name: 'ambientDerating', label: 'Ambient Derating', unit: '', type: 'number', min: 0.5, max: 1.5, required: true, help: 'Ambient temperature derating from Step 1', fromPreviousStep: 'ambientDerating' },
        { name: 'faultCurrent_kA', label: 'Fault Current', unit: 'kA', type: 'number', min: 1, max: 100, default: 50, required: true, help: 'Fault current from Step 1' },
        { name: 'faultDuration_s', label: 'Fault Duration', unit: 's', type: 'number', min: 0.1, max: 5, default: 1, required: true, help: 'Fault duration from Step 1' },
        { name: 'material_k_factor', label: 'Material k Factor', unit: '', type: 'number', min: 50, max: 200, default: 166, required: true, help: 'Short-circuit k factor from Step 1', fromPreviousStep: 'material_k_factor' },
        { name: 'busbarMaterial', label: 'Busbar Material', unit: '', type: 'select', options: [
          { value: 'copper', label: 'Copper' }, { value: 'aluminum', label: 'Aluminum' },
        ], default: 'copper', required: true, help: 'Busbar material' },
      ],
      outputs: [
        { name: 'currentAfterDerating_A', label: 'Current After Derating', unit: 'A', precision: 1 },
        { name: 'cs_for_current_mm2', label: 'CS for Current', unit: 'mm²', precision: 0 },
        { name: 'cs_for_SC_mm2', label: 'CS for Short-Circuit', unit: 'mm²', precision: 0 },
        { name: 'finalCS_mm2', label: 'Final Required CS', unit: 'mm²', precision: 0 },
        { name: 'busbarRatedCurrent_A', label: 'Busbar Rated Current', unit: 'A', precision: 1 },
        { name: 'current_compliant', label: 'Current Rating Adequate', unit: '', precision: 0, isCompliance: true },
        { name: 'sc_compliant', label: 'Short-Circuit Withstand Adequate', unit: '', precision: 0, isCompliance: true },
      ],
      calculate(inp) {
        const desiredI = Number(inp.desiredCurrent_A);
        const kTotal = Number(inp.totalDeratingFactor);
        const kAmbient = Number(inp.ambientDerating);
        const faultI_kA = Number(inp.faultCurrent_kA);
        const faultT = Number(inp.faultDuration_s);
        const kFactor = Number(inp.material_k_factor);
        const material = String(inp.busbarMaterial);

        const matData = BUSBAR_MATERIALS[material] ?? BUSBAR_MATERIALS['copper'];

        // Current after derating
        const combinedDerating = kTotal * kAmbient;
        const currentAfterDerating = desiredI / combinedDerating;

        // Cross-section for current
        const csCurrent = currentAfterDerating / matData.baseRating_A_per_mm2;

        // Cross-section for short-circuit: S = I × √t / k
        const faultI_A = faultI_kA * 1000;
        const csSC = (faultI_A * Math.sqrt(faultT)) / kFactor;

        // Final cross-section is the larger
        const finalCS = Math.max(csCurrent, csSC);

        // Rated current of the busbar
        const ratedCurrent = finalCS * matData.baseRating_A_per_mm2 * combinedDerating;

        return {
          currentAfterDerating_A: Math.round(currentAfterDerating * 10) / 10,
          cs_for_current_mm2: Math.round(Math.ceil(csCurrent)),
          cs_for_SC_mm2: Math.round(Math.ceil(csSC)),
          finalCS_mm2: Math.round(Math.ceil(finalCS)),
          busbarRatedCurrent_A: Math.round(ratedCurrent * 10) / 10,
          current_compliant: ratedCurrent >= desiredI,
          sc_compliant: finalCS >= csSC,
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 7: Indoor Lighting Design
// ─────────────────────────────────────────────────────────────────────────────

const indoorLightingDesign: EngineeringPipeline = {
  id: 'indoor-lighting-design',
  name: 'Indoor Lighting Design',
  description: 'Design indoor lighting using the Lumen (Utilization Factor) method per CIE/IESNA: calculate room index, coefficient of utilization, maintenance factor, and determine the required number of fixtures and their arrangement.',
  domain: 'electrical',
  difficulty: 'intermediate',
  estimated_time: '8-12 min',
  icon: '💡',
  steps: [
    {
      stepNumber: 1,
      name: 'Room & Illuminance Data',
      description: 'Define the room dimensions, mounting height, working plane height, and the required illuminance level. These parameters determine the room index which affects the coefficient of utilization.',
      standard_ref: 'CIE / IESNA',
      formula_display: [
        'Room Index (RI) = (L × W) / (Hm × (L + W))',
        'Hm = mounting height − working plane height',
        'Hm = room height − fixture hanging − working plane height',
        'Required Lux per CIE/IESNA recommendations',
      ],
      inputs: [
        { name: 'method', label: 'Calculation Method', unit: '', type: 'select', options: [
          { value: 'lumen', label: 'Lumen Method (Utilization Factor)' },
        ], default: 'lumen', required: true, help: 'Lighting calculation method — Lumen method is the standard for general indoor lighting' },
        { name: 'roomLength_m', label: 'Room Length', unit: 'm', type: 'number', min: 1, max: 100, default: 7, required: true, help: 'Length of the room in meters' },
        { name: 'roomWidth_m', label: 'Room Width', unit: 'm', type: 'number', min: 1, max: 100, default: 4, required: true, help: 'Width of the room in meters' },
        { name: 'mountingHeight_m', label: 'Mounting Height', unit: 'm', type: 'number', min: 1, max: 20, default: 3, required: true, help: 'Height of the ceiling where fixtures will be mounted' },
        { name: 'workingPlaneHeight_m', label: 'Working Plane Height', unit: 'm', type: 'number', min: 0, max: 5, default: 0, required: true, help: 'Height of the working plane (desk height ≈ 0.75m, floor = 0)' },
        { name: 'fixtureHangingHeight_m', label: 'Fixture Hanging Length', unit: 'm', type: 'number', min: 0, max: 5, default: 0, required: true, help: 'Length of fixture suspension from ceiling (0 for surface-mounted)' },
        { name: 'requiredLux', label: 'Required Illuminance', unit: 'lux', type: 'number', min: 50, max: 5000, default: 200, required: true, help: 'Target maintained illuminance (CIE: offices 300-500 lux, corridors 100 lux, workshops 500-750 lux)' },
      ],
      outputs: [
        { name: 'hm_m', label: 'Effective Mounting Height (Hm)', unit: 'm', precision: 2 },
        { name: 'roomIndex', label: 'Room Index (RI)', unit: '', precision: 2 },
        { name: 'roomArea_m2', label: 'Room Area', unit: 'm²', precision: 2 },
      ],
      calculate(inp) {
        const L = Number(inp.roomLength_m);
        const W = Number(inp.roomWidth_m);
        const mountH = Number(inp.mountingHeight_m);
        const workH = Number(inp.workingPlaneHeight_m);
        const hangH = Number(inp.fixtureHangingHeight_m);

        const Hm = mountH - hangH - workH;
        const RI = (L * W) / (Hm * (L + W));
        const area = L * W;

        return {
          hm_m: Math.round(Math.max(Hm, 0.1) * 100) / 100,
          roomIndex: Math.round(RI * 100) / 100,
          roomArea_m2: Math.round(area * 100) / 100,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Fixture & Reflection Data',
      description: 'Specify the luminaire characteristics (lamp flux, lamps per fixture) and room surface reflection coefficients. The ceiling and wall reflection values affect the utilization factor, and the maintenance condition determines the depreciation allowance.',
      standard_ref: 'CIE / IESNA',
      formula_display: [
        'Lamp flux per fixture = lampFlux × lampsPerFixture',
        'Ceiling reflection: 0.7 (white), 0.5 (light), 0.3 (medium)',
        'Wall reflection: 0.5 (light), 0.3 (medium), 0.1 (dark)',
        'Maintenance factor: good=0.85, average=0.77, poor=0.65',
      ],
      inputs: [
        { name: 'lampFlux_lumen', label: 'Lamp Luminous Flux', unit: 'lm', type: 'number', min: 100, max: 50000, default: 1500, required: true, help: 'Luminous flux per lamp (LED panel: 1500-4000 lm, fluorescent: 2400-5200 lm)' },
        { name: 'lampsPerFixture', label: 'Lamps Per Fixture', unit: '', type: 'number', min: 1, max: 20, default: 1, required: true, help: 'Number of lamps in each luminaire/fixture' },
        { name: 'ceilingReflection', label: 'Ceiling Reflection', unit: '', type: 'select', options: [
          { value: '0.7', label: '0.7 — White/light ceiling' },
          { value: '0.5', label: '0.5 — Light ceiling' },
          { value: '0.3', label: '0.3 — Medium/dark ceiling' },
        ], default: '0.7', required: true, help: 'Reflectance of the ceiling surface (affects how much light bounces back to working plane)' },
        { name: 'wallReflection', label: 'Wall Reflection', unit: '', type: 'select', options: [
          { value: '0.5', label: '0.5 — Light walls' },
          { value: '0.3', label: '0.3 — Medium walls' },
          { value: '0.1', label: '0.1 — Dark walls' },
        ], default: '0.5', required: true, help: 'Reflectance of the wall surfaces' },
        { name: 'maintenanceCondition', label: 'Maintenance Condition', unit: '', type: 'select', options: [
          { value: 'good', label: 'Good (MF = 0.85)' },
          { value: 'average', label: 'Average (MF = 0.77)' },
          { value: 'poor', label: 'Poor (MF = 0.65)' },
        ], default: 'average', required: true, help: 'Expected maintenance level — good: regular cleaning, average: periodic, poor: rarely cleaned' },
      ],
      outputs: [
        { name: 'fixtureFlux_lumen', label: 'Total Flux Per Fixture', unit: 'lm', precision: 0 },
        { name: 'maintenanceFactor', label: 'Maintenance Factor', unit: '', precision: 2 },
        { name: 'ceilingReflection_val', label: 'Ceiling Reflection', unit: '', precision: 1 },
        { name: 'wallReflection_val', label: 'Wall Reflection', unit: '', precision: 1 },
      ],
      calculate(inp) {
        const flux = Number(inp.lampFlux_lumen);
        const lampsPerFix = Number(inp.lampsPerFixture);
        const ceiliRef = Number(inp.ceilingReflection);
        const wallRef = Number(inp.wallReflection);

        const mfMap: Record<string, number> = { good: 0.85, average: 0.77, poor: 0.65 };
        const mf = mfMap[String(inp.maintenanceCondition)] ?? 0.77;

        return {
          fixtureFlux_lumen: Math.round(flux * lampsPerFix),
          maintenanceFactor: mf,
          ceilingReflection_val: ceiliRef,
          wallReflection_val: wallRef,
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Lighting Results',
      description: 'Calculate the coefficient of utilization from the room index and reflection values, determine the required number of fixtures, and propose a practical arrangement (rows × columns).',
      standard_ref: 'CIE / IESNA',
      formula_display: [
        'N = (E_required × A) / (Φ_fixture × CU × MF)',
        'CU = coefficient of utilization from lookup table',
        'MF = maintenance factor',
        'Fixture arrangement: rows × columns ≈ √N × √N',
        'Actual Lux = N × Φ_fixture × CU × MF / A',
      ],
      inputs: [
        { name: 'roomIndex', label: 'Room Index', unit: '', type: 'number', min: 0.1, max: 20, required: true, help: 'Room index from Step 1', fromPreviousStep: 'roomIndex' },
        { name: 'roomArea_m2', label: 'Room Area', unit: 'm²', type: 'number', min: 1, max: 10000, required: true, help: 'Room area from Step 1', fromPreviousStep: 'roomArea_m2' },
        { name: 'requiredLux', label: 'Required Illuminance', unit: 'lux', type: 'number', min: 50, max: 5000, default: 200, required: true, help: 'Required maintained illuminance from Step 1' },
        { name: 'fixtureFlux_lumen', label: 'Total Flux Per Fixture', unit: 'lm', type: 'number', min: 100, max: 100000, required: true, help: 'Total flux per fixture from Step 2', fromPreviousStep: 'fixtureFlux_lumen' },
        { name: 'ceilingReflection_val', label: 'Ceiling Reflection', unit: '', type: 'number', min: 0, max: 1, required: true, help: 'Ceiling reflection from Step 2', fromPreviousStep: 'ceilingReflection_val' },
        { name: 'wallReflection_val', label: 'Wall Reflection', unit: '', type: 'number', min: 0, max: 1, required: true, help: 'Wall reflection from Step 2', fromPreviousStep: 'wallReflection_val' },
        { name: 'maintenanceFactor', label: 'Maintenance Factor', unit: '', type: 'number', min: 0.5, max: 1, required: true, help: 'Maintenance factor from Step 2', fromPreviousStep: 'maintenanceFactor' },
        { name: 'roomLength_m', label: 'Room Length', unit: 'm', type: 'number', min: 1, max: 100, default: 7, required: true, help: 'Room length for fixture spacing calculation' },
        { name: 'roomWidth_m', label: 'Room Width', unit: 'm', type: 'number', min: 1, max: 100, default: 4, required: true, help: 'Room width for fixture spacing calculation' },
      ],
      outputs: [
        { name: 'utilizationFactor', label: 'Coefficient of Utilization (CU)', unit: '', precision: 3 },
        { name: 'requiredFixtures', label: 'Required Fixtures', unit: '', precision: 0 },
        { name: 'fixturesAlongLength', label: 'Fixtures Along Length', unit: '', precision: 0 },
        { name: 'fixturesAcrossWidth', label: 'Fixtures Across Width', unit: '', precision: 0 },
        { name: 'totalFixtures', label: 'Total Fixtures (arranged)', unit: '', precision: 0 },
        { name: 'actualLux', label: 'Achieved Maintained Illuminance', unit: 'lux', precision: 0 },
        { name: 'spacingAlongLength_m', label: 'Spacing Along Length', unit: 'm', precision: 2 },
        { name: 'spacingAcrossWidth_m', label: 'Spacing Across Width', unit: 'm', precision: 2 },
      ],
      calculate(inp) {
        const RI = Number(inp.roomIndex);
        const area = Number(inp.roomArea_m2);
        const lux = Number(inp.requiredLux);
        const fixtureFlux = Number(inp.fixtureFlux_lumen);
        const ceilRef = Number(inp.ceilingReflection_val);
        const wallRef = Number(inp.wallReflection_val);
        const MF = Number(inp.maintenanceFactor);
        const roomL = Number(inp.roomLength_m);
        const roomW = Number(inp.roomWidth_m);

        // Look up CU
        const CU = lookupCU(RI, ceilRef, wallRef);

        // Required number of fixtures
        const N = Math.ceil((lux * area) / (fixtureFlux * CU * MF));

        // Fixture arrangement — distribute proportionally to room dimensions
        const ratio = roomL / roomW;
        let alongL = Math.max(1, Math.round(Math.sqrt(N * ratio)));
        let acrossW = Math.max(1, Math.ceil(N / alongL));

        // Adjust if total is less than required
        while (alongL * acrossW < N) {
          acrossW += 1;
        }

        const totalFixtures = alongL * acrossW;

        // Spacing
        const spacingL = roomL / alongL;
        const spacingW = roomW / acrossW;

        // Actual achieved lux
        const actualLux = (totalFixtures * fixtureFlux * CU * MF) / area;

        return {
          utilizationFactor: CU,
          requiredFixtures: N,
          fixturesAlongLength: alongL,
          fixturesAcrossWidth: acrossW,
          totalFixtures: totalFixtures,
          actualLux: Math.round(actualLux),
          spacingAlongLength_m: Math.round(spacingL * 100) / 100,
          spacingAcrossWidth_m: Math.round(spacingW * 100) / 100,
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 8: Motor Starter Sizing
// ─────────────────────────────────────────────────────────────────────────────

const motorStarterSizing: EngineeringPipeline = {
  id: 'motor-starter-sizing',
  name: 'Motor Starter Sizing',
  description: 'Size motor starter components per NEC 430-52: calculate full-load current, starting current, select fuse ratings, contactor sizes, and overload relay settings for DOL and Star-Delta starters.',
  domain: 'electrical',
  difficulty: 'intermediate',
  estimated_time: '10-15 min',
  icon: '⚙️',
  steps: [
    {
      stepNumber: 1,
      name: 'Motor Data',
      description: 'Enter the motor nameplate data including phase, power rating, NEMA code letter, efficiency, RPM, power factor, system voltage, starter type, and overload relay position.',
      standard_ref: 'NEC 430-52',
      formula_display: [
        'Motor kW = HP × 0.746',
        'FLC = kW / (√3 × V × PF × η)  [3-phase]',
        'FLC = kW / (V × PF × η)        [1-phase]',
        'Lock rotor kVA from NEMA code letter',
        'Starting current depends on starter type',
      ],
      inputs: [
        { name: 'phase', label: 'Phase', unit: '', type: 'select', options: [
          { value: '1-phase', label: '1-Phase' }, { value: '3-phase', label: '3-Phase' },
        ], default: '3-phase', required: true, help: 'Motor phase configuration' },
        { name: 'motorSize_HP', label: 'Motor Size', unit: 'HP', type: 'number', min: 0.5, max: 500, default: 10, required: true, help: 'Motor rated power in horsepower (1 HP ≈ 0.746 kW)' },
        { name: 'motorCode', label: 'NEMA Code Letter', unit: '', type: 'select', options: [
          { value: 'A', label: 'A (0–3.15 kVA/HP)' }, { value: 'B', label: 'B (3.15–3.55)' },
          { value: 'C', label: 'C (3.55–4.00)' }, { value: 'D', label: 'D (4.00–4.50)' },
          { value: 'E', label: 'E (4.50–5.00)' }, { value: 'F', label: 'F (5.00–5.60)' },
          { value: 'G', label: 'G (5.60–6.30)' }, { value: 'H', label: 'H (6.30–7.10)' },
          { value: 'J', label: 'J (7.10–8.00)' }, { value: 'K', label: 'K (8.00–9.00)' },
          { value: 'L', label: 'L (9.00–10.00)' }, { value: 'M', label: 'M (10.0–11.2)' },
          { value: 'N', label: 'N (11.2–12.5)' }, { value: 'P', label: 'P (12.5–14.0)' },
          { value: 'R', label: 'R (14.0–16.0)' }, { value: 'S', label: 'S (16.0–18.0)' },
          { value: 'T', label: 'T (18.0–20.0)' }, { value: 'U', label: 'U (20.0–22.4)' },
          { value: 'V', label: 'V (22.4+)' },
        ], default: 'G', required: true, help: 'NEMA code letter from motor nameplate — indicates locked-rotor kVA/HP' },
        { name: 'motorEfficiency', label: 'Motor Efficiency', unit: '', type: 'number', min: 0.5, max: 1.0, default: 1, required: true, help: 'Motor full-load efficiency (use 1.0 if unknown, or typical 0.88–0.95)' },
        { name: 'motorRPM', label: 'Motor Speed', unit: 'RPM', type: 'number', min: 300, max: 3600, default: 600, required: true, help: 'Motor rated speed in RPM (affects torque characteristics)' },
        { name: 'systemPF', label: 'System Power Factor', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.8, required: true, help: 'Motor operating power factor' },
        { name: 'systemVoltage_V', label: 'System Voltage', unit: 'V', type: 'number', min: 100, max: 1000, default: 415, required: true, help: 'Line-to-line supply voltage' },
        { name: 'starterType', label: 'Starter Type', unit: '', type: 'select', options: [
          { value: 'DOL', label: 'DOL (Direct-On-Line)' }, { value: 'Star-Delta', label: 'Star-Delta' },
        ], default: 'DOL', required: true, help: 'Motor starting method — DOL applies full voltage, Star-Delta reduces starting current to ~1/3' },
        { name: 'olRelayPosition', label: 'OL Relay Position', unit: '', type: 'select', options: [
          { value: 'in-line', label: 'In-line (motor current)' }, { value: 'in-winding', label: 'In-winding (winding current)' },
        ], default: 'in-line', required: true, help: 'Position of overload relay — in-line measures motor current, in-winding measures phase current (Star-Delta only)' },
      ],
      outputs: [
        { name: 'motor_kW', label: 'Motor Rated Power', unit: 'kW', precision: 2 },
        { name: 'torque_Nm', label: 'Rated Torque', unit: 'N·m', precision: 2 },
        { name: 'lockRotor_kVA_HP', label: 'Lock Rotor kVA/HP', unit: 'kVA/HP', precision: 2 },
        { name: 'lockRotor_kVA', label: 'Lock Rotor kVA', unit: 'kVA', precision: 2 },
        { name: 'fullLoadCurrent_A', label: 'Full-Load Current (FLC)', unit: 'A', precision: 2 },
        { name: 'startingCurrent_A', label: 'Starting Current', unit: 'A', precision: 2 },
      ],
      calculate(inp) {
        const HP = Number(inp.motorSize_HP);
        const kW = HP * 0.746;
        const rpm = Number(inp.motorRPM);
        const pf = Number(inp.systemPF);
        const eff = Number(inp.motorEfficiency);
        const V = Number(inp.systemVoltage_V);
        const is3phase = inp.phase === '3-phase';
        const starterType = String(inp.starterType);

        // Torque: T = (kW × 9550) / RPM
        const torque = (kW * 9550) / rpm;

        // Lock rotor from NEMA code
        const motorCodeData = lookupMotorCode(String(inp.motorCode));

        // Full-load current
        const FLC = is3phase
          ? (kW * 1000) / (Math.sqrt(3) * V * pf * eff)
          : (kW * 1000) / (V * pf * eff);

        // Starting current
        const lockRotorI = (motorCodeData.typical_kVA_HP * HP * 1000) / (is3phase ? Math.sqrt(3) * V : V);
        const startingI = starterType === 'Star-Delta' ? lockRotorI / 3 : lockRotorI;

        return {
          motor_kW: Math.round(kW * 100) / 100,
          torque_Nm: Math.round(torque * 100) / 100,
          lockRotor_kVA_HP: motorCodeData.typical_kVA_HP,
          lockRotor_kVA: Math.round(motorCodeData.typical_kVA_HP * HP * 100) / 100,
          fullLoadCurrent_A: Math.round(FLC * 100) / 100,
          startingCurrent_A: Math.round(startingI * 100) / 100,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Starter Component Sizing',
      description: 'Size all starter components based on the motor full-load and starting currents: fuse ratings per NEC 430-52, contactor sizes, and overload relay settings. Different rules apply for DOL vs Star-Delta configurations.',
      standard_ref: 'NEC 430-52',
      formula_display: [
        'Fuse rating (DOL): ≤ 300% × FLC (NEC 430-52 Table)',
        'Fuse rating (Star-Delta): ≤ 300% × FLC',
        'Main contactor: rated ≥ FLC (DOL) or ≥ 0.58 × FLC (Star-Delta)',
        'OL relay setting: 100–115% × FLC (in-line)',
        'OL relay setting: 58–65% × FLC (in-winding, Star-Delta)',
      ],
      inputs: [
        { name: 'fullLoadCurrent_A', label: 'Full-Load Current', unit: 'A', type: 'number', min: 0.1, max: 5000, required: true, help: 'FLC from Step 1', fromPreviousStep: 'fullLoadCurrent_A' },
        { name: 'startingCurrent_A', label: 'Starting Current', unit: 'A', type: 'number', min: 0.1, max: 50000, required: true, help: 'Starting current from Step 1', fromPreviousStep: 'startingCurrent_A' },
        { name: 'starterType', label: 'Starter Type', unit: '', type: 'select', options: [
          { value: 'DOL', label: 'DOL' }, { value: 'Star-Delta', label: 'Star-Delta' },
        ], default: 'DOL', required: true, help: 'Starter type from Step 1' },
        { name: 'olRelayPosition', label: 'OL Relay Position', unit: '', type: 'select', options: [
          { value: 'in-line', label: 'In-line' }, { value: 'in-winding', label: 'In-winding' },
        ], default: 'in-line', required: true, help: 'OL relay position from Step 1' },
      ],
      outputs: [
        { name: 'fuseSize_A', label: 'Fuse Rating', unit: 'A', precision: 0 },
        { name: 'mainContactor_A', label: 'Main Contactor Rating', unit: 'A', precision: 1 },
        { name: 'starContactor_A', label: 'Star Contactor Rating', unit: 'A', precision: 1 },
        { name: 'deltaContactor_A', label: 'Delta Contactor Rating', unit: 'A', precision: 1 },
        { name: 'olRelaySetting_A', label: 'OL Relay Setting', unit: 'A', precision: 2 },
        { name: 'olRelayRange', label: 'OL Relay Range', unit: 'A', precision: 2 },
      ],
      calculate(inp) {
        const FLC = Number(inp.fullLoadCurrent_A);
        const starterType = String(inp.starterType);
        const olPosition = String(inp.olRelayPosition);

        // Fuse sizing per NEC 430-52
        // Time-delay fuses: max 175% FLC, non-time-delay: max 300% FLC
        // Using time-delay fuse as standard practice
        const fuseMax = FLC * 1.75;
        const fuseSize = selectMCCBSize(Math.ceil(fuseMax));

        if (starterType === 'DOL') {
          // DOL: single contactor rated for FLC
          const mainContactor = selectMCCBSize(Math.ceil(FLC));
          const olSetting = FLC * 1.05; // 105% of FLC
          const olRange_min = FLC * 0.9;
          const olRange_max = FLC * 1.15;

          return {
            fuseSize_A: fuseSize,
            mainContactor_A: mainContactor,
            starContactor_A: 0, // not applicable for DOL
            deltaContactor_A: 0,
            olRelaySetting_A: Math.round(olSetting * 100) / 100,
            olRelayRange: `${Math.round(olRange_min * 100) / 100}–${Math.round(olRange_max * 100) / 100}`,
          };
        } else {
          // Star-Delta: three contactors
          // Main and Delta contactors carry line current = FLC
          // Star contactor carries winding current ≈ 0.58 × FLC
          const mainContactor = selectMCCBSize(Math.ceil(FLC));
          const deltaContactor = selectMCCBSize(Math.ceil(FLC));
          const starContactor = selectMCCBSize(Math.ceil(FLC * 0.58));

          // OL relay
          let olSetting: number;
          let olMin: number;
          let olMax: number;
          if (olPosition === 'in-winding') {
            // In-winding: measures phase current = FLC / √3 ≈ 0.58 × FLC
            olSetting = (FLC / Math.sqrt(3)) * 1.05;
            olMin = (FLC / Math.sqrt(3)) * 0.9;
            olMax = (FLC / Math.sqrt(3)) * 1.15;
          } else {
            // In-line: measures motor line current
            olSetting = FLC * 1.05;
            olMin = FLC * 0.9;
            olMax = FLC * 1.15;
          }

          return {
            fuseSize_A: fuseSize,
            mainContactor_A: mainContactor,
            starContactor_A: starContactor,
            deltaContactor_A: deltaContactor,
            olRelaySetting_A: Math.round(olSetting * 100) / 100,
            olRelayRange: `${Math.round(olMin * 100) / 100}–${Math.round(olMax * 100) / 100}`,
          };
        }
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 9: Cable & Breaker Selection
// ─────────────────────────────────────────────────────────────────────────────

const cableBreakerSelection: EngineeringPipeline = {
  id: 'cable-breaker-selection',
  name: 'Cable & Breaker Selection',
  description: 'Select cable size and breaker rating per IEC 60364/IEE/Egyptian Code: calculate design current, apply correction factors, select cable cross-section, verify voltage drop and short-circuit withstand, and coordinate with breaker protection.',
  domain: 'electrical',
  difficulty: 'advanced',
  estimated_time: '15-20 min',
  icon: '🔌',
  steps: [
    {
      stepNumber: 1,
      name: 'Load & Route Data',
      description: 'Define the load parameters and cable route including power, power factor, voltage, cable length, insulation type, and installation method. These determine the base design current and cable environmental conditions.',
      standard_ref: 'IEC 60364 / IEE / Egyptian Code',
      formula_display: [
        'I_b = load_kW / (√3 × voltage_kV × PF)',
        'Insulation: PVC (70°C) or XLPE (90°C)',
        'Installation: ground, ducts, or air',
      ],
      inputs: [
        { name: 'fromLocation', label: 'From Location', unit: '', type: 'number', min: 0, max: 9999, default: 1, required: true, help: 'Source location identifier' },
        { name: 'toLocation', label: 'To Location', unit: '', type: 'number', min: 0, max: 9999, default: 2, required: true, help: 'Destination location identifier' },
        { name: 'routeType', label: 'Route Type', unit: '', type: 'select', options: [
          { value: 'AIR', label: 'AIR' }, { value: 'XLPE', label: 'XLPE Underground' }, { value: 'PVC', label: 'PVC Underground' },
        ], default: 'AIR', required: true, help: 'Cable routing environment' },
        { name: 'voltage_kV', label: 'System Voltage', unit: 'kV', type: 'number', min: 0.1, max: 35, default: 0.38, required: true, help: 'Line-to-line system voltage in kV' },
        { name: 'load_kW', label: 'Connected Load', unit: 'kW', type: 'number', min: 0.1, max: 5000, default: 50, required: true, help: 'Total connected active power in kW' },
        { name: 'powerFactor', label: 'Power Factor', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.8, required: true, help: 'Load power factor' },
        { name: 'length_m', label: 'Cable Length', unit: 'm', type: 'number', min: 1, max: 5000, default: 60, required: true, help: 'One-way cable length in meters' },
        { name: 'insulation', label: 'Cable Insulation', unit: '', type: 'select', options: [
          { value: 'PVC', label: 'PVC (70°C max)' }, { value: 'XLPE', label: 'XLPE (90°C max)' },
        ], default: 'PVC', required: true, help: 'Cable insulation material' },
        { name: 'installation', label: 'Installation Method', unit: '', type: 'select', options: [
          { value: 'ground', label: 'Direct in ground' },
          { value: 'ducts', label: 'In ducts' },
          { value: 'air', label: 'In air (clipped/tray)' },
        ], default: 'air', required: true, help: 'Cable installation method per IEC 60364-5-52' },
      ],
      outputs: [
        { name: 'Ib', label: 'Design Current (I_b)', unit: 'A', precision: 2 },
        { name: 'load_kVA', label: 'Apparent Load', unit: 'kVA', precision: 2 },
      ],
      calculate(inp) {
        const load = Number(inp.load_kW);
        const pf = Number(inp.powerFactor);
        const V_kV = Number(inp.voltage_kV);

        const Ib = load / (Math.sqrt(3) * V_kV * pf);
        const kVA = load / pf;

        return {
          Ib: Math.round(Ib * 100) / 100,
          load_kVA: Math.round(kVA * 100) / 100,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Correction & Transformer Data',
      description: 'Apply correction factors for ambient temperature, cable grouping, and parallel cables. Also specify upstream transformer data for short-circuit calculations.',
      standard_ref: 'IEC 60364 / IEE / Egyptian Code',
      formula_display: [
        'CF = C_a × C_g × C_f × C_i',
        'I_t = I_b / CF (required tabulated current)',
        'Transformer impedance for S.C. calculation',
        'Upstream voltage drop consideration',
      ],
      inputs: [
        { name: 'transformer_kVA', label: 'Upstream Transformer Rating', unit: 'kVA', type: 'number', min: 50, max: 5000, default: 1000, required: true, help: 'Rating of the upstream supply transformer (for short-circuit calculation)' },
        { name: 'noOfParallelCables', label: 'No. of Parallel Cables', unit: '', type: 'number', min: 1, max: 10, default: 1, required: true, help: 'Number of cables in parallel per phase (increases total current capacity)' },
        { name: 'ambientTempFactor', label: 'Ambient Temp Factor (C_a)', unit: '', type: 'number', min: 0.5, max: 1.5, default: 1, required: true, help: 'Correction factor for ambient temperature (1.0 at 30°C, see IEC 60364 Table B.52.14)' },
        { name: 'groupingFactor', label: 'Grouping Factor (C_g)', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.91, required: true, help: 'Correction factor for number of circuits grouped together (see IEC 60364 Table B.52.17)' },
        { name: 'cf', label: 'Cable Foundation Factor (C_f)', unit: '', type: 'number', min: 0.5, max: 1.0, default: 1, required: true, help: 'Correction factor for thermal resistivity of soil (1.0 for normal soil)' },
        { name: 'ci', label: 'Thermal Insulation Factor (C_i)', unit: '', type: 'number', min: 0.5, max: 1.0, default: 1, required: true, help: 'Correction factor for thermal insulation (1.0 if no thermal insulation)' },
        { name: 'upstreamVD_pct', label: 'Upstream Voltage Drop', unit: '%', type: 'number', min: 0, max: 5, default: 0, required: true, help: 'Voltage drop already present in upstream network (0% if not known)' },
      ],
      outputs: [
        { name: 'CF', label: 'Combined Correction Factor', unit: '', precision: 4 },
        { name: 'It', label: 'Required Tabulated Current (I_t)', unit: 'A', precision: 2 },
        { name: 'transformerImpedance_pct', label: 'Transformer Impedance', unit: '%', precision: 2 },
      ],
      calculate(inp) {
        const Ib = Number(inp.Ib) || 0; // will be linked
        const Ca = Number(inp.ambientTempFactor);
        const Cg = Number(inp.groupingFactor);
        const Cf = Number(inp.cf);
        const Ci = Number(inp.ci);
        const kVA = Number(inp.transformer_kVA);
        const nParallel = Number(inp.noOfParallelCables);

        const CF = Ca * Cg * Cf * Ci;
        // Required tabulated current per cable
        const It = Ib / (CF * nParallel);

        const Z_pct = lookupTransformerImpedance(kVA);

        return {
          CF: Math.round(CF * 10000) / 10000,
          It: Math.round(It * 100) / 100,
          transformerImpedance_pct: Z_pct,
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Results & Compliance',
      description: 'Select cable size and breaker rating, calculate voltage drop and short-circuit withstand, and verify compliance with all IEC 60364 requirements.',
      standard_ref: 'IEC 60364 / IEE / Egyptian Code',
      formula_display: [
        'Cable size: selectCableSize(I_t, insulation, installation)',
        'Breaker: selectMCCBSize(I_b) — rated ≥ I_b',
        'VD = √3 × I_b × L × (R·cosφ + X·sinφ) / (parallel × 1000)',
        'VD% = (VD / V) × 100 ≤ 2.5% (with upstream)',
        'S.C. current = transformer full-load / Z%',
        'S_min = I_sc × √t / k (adiabatic check)',
        'Compliance: I_z ≥ I_b, VD% ≤ limit, S ≥ S_min',
      ],
      inputs: [
        { name: 'Ib', label: 'Design Current (I_b)', unit: 'A', type: 'number', min: 0.1, max: 5000, required: true, help: 'Design current from Step 1', fromPreviousStep: 'Ib' },
        { name: 'It', label: 'Required Tabulated Current', unit: 'A', type: 'number', min: 0.1, max: 5000, required: true, help: 'Required tabulated current from Step 2', fromPreviousStep: 'It' },
        { name: 'CF', label: 'Combined Correction Factor', unit: '', type: 'number', min: 0.1, max: 2, required: true, help: 'Combined correction factor from Step 2', fromPreviousStep: 'CF' },
        { name: 'transformer_kVA', label: 'Transformer Rating', unit: 'kVA', type: 'number', min: 50, max: 5000, default: 1000, required: true, help: 'Transformer kVA rating' },
        { name: 'transformerImpedance_pct', label: 'Transformer Impedance', unit: '%', type: 'number', min: 1, max: 15, required: true, help: 'Transformer impedance from Step 2', fromPreviousStep: 'transformerImpedance_pct' },
        { name: 'voltage_kV', label: 'System Voltage', unit: 'kV', type: 'number', min: 0.1, max: 35, default: 0.38, required: true, help: 'System voltage from Step 1' },
        { name: 'powerFactor', label: 'Power Factor', unit: '', type: 'number', min: 0.5, max: 1.0, default: 0.8, required: true, help: 'Power factor from Step 1' },
        { name: 'length_m', label: 'Cable Length', unit: 'm', type: 'number', min: 1, max: 5000, default: 60, required: true, help: 'Cable length from Step 1' },
        { name: 'noOfParallelCables', label: 'No. of Parallel Cables', unit: '', type: 'number', min: 1, max: 10, default: 1, required: true, help: 'Parallel cables from Step 2' },
        { name: 'insulation', label: 'Cable Insulation', unit: '', type: 'select', options: [
          { value: 'PVC', label: 'PVC (k=115)' }, { value: 'XLPE', label: 'XLPE (k=143)' },
        ], default: 'PVC', required: true, help: 'Cable insulation' },
        { name: 'installation', label: 'Installation Method', unit: '', type: 'select', options: [
          { value: 'ground', label: 'Ground' }, { value: 'ducts', label: 'Ducts' }, { value: 'air', label: 'Air' },
        ], default: 'air', required: true, help: 'Installation method' },
        { name: 'upstreamVD_pct', label: 'Upstream Voltage Drop', unit: '%', type: 'number', min: 0, max: 5, default: 0, required: true, help: 'Upstream VD from Step 2' },
      ],
      outputs: [
        { name: 'cableSize_mm2', label: 'Selected Cable Size', unit: 'mm²', precision: 0 },
        { name: 'cableAmpacity_A', label: 'Derated Cable Ampacity (I_z)', unit: 'A', precision: 1 },
        { name: 'breakerRating_A', label: 'Breaker Rating', unit: 'A', precision: 0 },
        { name: 'voltageDrop_V', label: 'Voltage Drop', unit: 'V', precision: 2 },
        { name: 'voltageDrop_pct', label: 'Total Voltage Drop %', unit: '%', precision: 2 },
        { name: 'scCurrent_kA', label: 'Short-Circuit Current', unit: 'kA', precision: 2 },
        { name: 'scMinSize_mm2', label: 'Min CS for S.C.', unit: 'mm²', precision: 1 },
        { name: 'ampacity_compliant', label: 'I_z ≥ I_b (Ampacity)', unit: '', precision: 0, isCompliance: true },
        { name: 'vd_compliant', label: 'VD ≤ 2.5% (Total)', unit: '', precision: 0, isCompliance: true },
        { name: 'sc_compliant', label: 'CS ≥ S_min (S.C.)', unit: '', precision: 0, isCompliance: true },
      ],
      calculate(inp) {
        const Ib = Number(inp.Ib);
        const It = Number(inp.It);
        const CF = Number(inp.CF);
        const transKVA = Number(inp.transformer_kVA);
        const Z_pct = Number(inp.transformerImpedance_pct);
        const V_kV = Number(inp.voltage_kV);
        const pf = Number(inp.powerFactor);
        const L = Number(inp.length_m);
        const nParallel = Math.max(Number(inp.noOfParallelCables), 1);
        const insType = String(inp.insulation);
        const instMethod = String(inp.installation);
        const upstreamVD = Number(inp.upstreamVD_pct);

        // Select cable size
        const cableSelection = selectCableSizeFromLib(It, insType, instMethod);
        const cableSize = cableSelection.size_mm2;

        // Get base ampacity and derate
        const baseAmpacity = lookupCableAmpacity(cableSize, insType);
        const deratedAmpacity = baseAmpacity * CF * nParallel;

        // Breaker selection
        const breakerRating = selectMCCBSize(Math.ceil(Ib));

        // Voltage drop
        const impedance = lookupCableImpedance(cableSize, 'CU', insType as 'PVC' | 'XLPE');
        const sinPhi = Math.sqrt(1 - pf * pf);
        const vdV = (Math.sqrt(3) * Ib * L * (impedance.R * pf + impedance.X * sinPhi)) / (nParallel * 1000);
        const V_LL = V_kV * 1000;
        const vdPct = (vdV / V_LL) * 100 + upstreamVD;

        // Short-circuit current at cable origin
        const transFLA = transKVA * 1000 / (Math.sqrt(3) * V_LL);
        const scCurrent = transFLA / (Z_pct / 100);

        // Short-circuit minimum size (1 second)
        const k = insType === 'XLPE' ? 143 : 115;
        const scMinSize = (scCurrent * Math.sqrt(1)) / k;

        return {
          cableSize_mm2: cableSize,
          cableAmpacity_A: Math.round(deratedAmpacity * 10) / 10,
          breakerRating_A: breakerRating,
          voltageDrop_V: Math.round(vdV * 100) / 100,
          voltageDrop_pct: Math.round(vdPct * 100) / 100,
          scCurrent_kA: Math.round(scCurrent / 1000 * 100) / 100,
          scMinSize_mm2: Math.round(scMinSize * 10) / 10,
          ampacity_compliant: deratedAmpacity >= Ib,
          vd_compliant: vdPct <= 2.5,
          sc_compliant: cableSize >= scMinSize,
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline 10: Load Schedule Generator
// ─────────────────────────────────────────────────────────────────────────────

const loadScheduleGenerator: EngineeringPipeline = {
  id: 'load-schedule-generator',
  name: 'Load Schedule Generator',
  description: 'Generate a load schedule per IEC 61439: calculate total connected load per phase, apply demand factors, determine maximum demand, select main breaker and feeder cable size, and verify phase balance.',
  domain: 'electrical',
  difficulty: 'intermediate',
  estimated_time: '10-15 min',
  icon: '📋',
  steps: [
    {
      stepNumber: 1,
      name: 'Panel Data',
      description: 'Define the electrical panel parameters: name, service voltage, bus rating, demand factor, and physical installation details.',
      standard_ref: 'IEC 61439',
      formula_display: [
        'Panel name and service voltage',
        'Bus rating determines maximum panel capacity',
        'Demand factor applied to total connected load',
      ],
      inputs: [
        { name: 'panelName', label: 'Panel Name', unit: '', type: 'number', min: 0, max: 9999, default: 1, required: true, help: 'Panel identifier or name' },
        { name: 'serviceVoltage_V', label: 'Service Voltage (L-L)', unit: 'V', type: 'number', min: 100, max: 1000, default: 380, required: true, help: 'Line-to-line service voltage feeding the panel' },
        { name: 'busRating_A', label: 'Bus Rating', unit: 'A', type: 'number', min: 50, max: 6300, default: 100, required: true, help: 'Main busbar current rating of the panel' },
        { name: 'demandFactor_pct', label: 'Demand Factor', unit: '%', type: 'number', min: 10, max: 100, default: 90, required: true, help: 'Percentage of connected load expected to operate simultaneously (90% typical for mixed loads)' },
        { name: 'location', label: 'Location', unit: '', type: 'number', min: 0, max: 9999, default: 1, required: true, help: 'Installation location identifier' },
        { name: 'mounting', label: 'Mounting Type', unit: '', type: 'select', options: [
          { value: 'floor', label: 'Floor-mounted' }, { value: 'wall', label: 'Wall-mounted' },
        ], default: 'floor', required: true, help: 'Panel mounting type' },
      ],
      outputs: [
        { name: 'busCapacity_kVA', label: 'Bus Capacity', unit: 'kVA', precision: 2 },
        { name: 'demandFactor', label: 'Demand Factor (decimal)', unit: '', precision: 2 },
      ],
      calculate(inp) {
        const V = Number(inp.serviceVoltage_V);
        const busA = Number(inp.busRating_A);
        const dfPct = Number(inp.demandFactor_pct);

        const busKVA = (Math.sqrt(3) * V * busA) / 1000;
        const df = dfPct / 100;

        return {
          busCapacity_kVA: Math.round(busKVA * 100) / 100,
          demandFactor: df,
        };
      }
    },
    {
      stepNumber: 2,
      name: 'Circuit Data',
      description: 'Enter the total load breakdown by category: lighting, motors, air conditioning, and other loads. The simplified approach distributes total loads across the three phases.',
      standard_ref: 'IEC 61439',
      formula_display: [
        'Total connected = lighting + motor + AC + other',
        'Phase distribution: balanced or custom',
        'Balanced: each phase = total / 3',
      ],
      inputs: [
        { name: 'totalLightingLoad_kW', label: 'Total Lighting Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 10, required: true, help: 'Total connected lighting load across all circuits (PF ≈ 1.0)' },
        { name: 'totalMotorLoad_kW', label: 'Total Motor Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 25, required: true, help: 'Total connected motor load (PF ≈ 0.8–0.85, includes HVAC compressors)' },
        { name: 'totalACLoad_kW', label: 'Total AC Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 15, required: true, help: 'Total air conditioning load (chillers, AHUs, FCUs)' },
        { name: 'totalOtherLoad_kW', label: 'Total Other Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 5, required: true, help: 'Other loads (sockets, equipment, UPS, etc.)' },
        { name: 'phaseDistribution', label: 'Phase Distribution', unit: '', type: 'select', options: [
          { value: 'balanced', label: 'Balanced (equal per phase)' },
          { value: 'custom', label: 'Custom (user-specified)' },
        ], default: 'balanced', required: true, help: 'How loads are distributed across phases — balanced is the default and most common' },
      ],
      outputs: [
        { name: 'totalConnected_kW', label: 'Total Connected Load', unit: 'kW', precision: 2 },
        { name: 'phaseR_kW', label: 'Phase R Load', unit: 'kW', precision: 2 },
        { name: 'phaseY_kW', label: 'Phase Y Load', unit: 'kW', precision: 2 },
        { name: 'phaseB_kW', label: 'Phase B Load', unit: 'kW', precision: 2 },
      ],
      calculate(inp) {
        const lighting = Number(inp.totalLightingLoad_kW);
        const motor = Number(inp.totalMotorLoad_kW);
        const ac = Number(inp.totalACLoad_kW);
        const other = Number(inp.totalOtherLoad_kW);
        const distribution = String(inp.phaseDistribution);

        const total = lighting + motor + ac + other;

        // Assumed power factors per load type
        // Lighting: PF=1, Motor: PF=0.8, AC: PF=0.85, Other: PF=0.9
        const total_kVA = lighting / 1.0 + motor / 0.8 + ac / 0.85 + other / 0.9;

        let phaseR: number, phaseY: number, phaseB: number;
        if (distribution === 'balanced') {
          phaseR = total / 3;
          phaseY = total / 3;
          phaseB = total / 3;
        } else {
          // Custom: slightly unbalanced (R slightly higher)
          phaseR = total * 0.35;
          phaseY = total * 0.33;
          phaseB = total * 0.32;
        }

        return {
          totalConnected_kW: Math.round(total * 100) / 100,
          phaseR_kW: Math.round(phaseR * 100) / 100,
          phaseY_kW: Math.round(phaseY * 100) / 100,
          phaseB_kW: Math.round(phaseB * 100) / 100,
        };
      }
    },
    {
      stepNumber: 3,
      name: 'Schedule Results',
      description: 'Calculate the total demand, spare capacity, main breaker size, feeder cable size, and verify phase balance. Apply the demand factor to determine the maximum demand on the panel.',
      standard_ref: 'IEC 61439',
      formula_display: [
        'Demand kVA = total connected kVA × demand factor',
        'Spare kVA = bus capacity − demand kVA',
        'Max demand current = demand kVA / (√3 × V)',
        'Main breaker = selectMCCBSize(max demand current)',
        'Feeder cable = selectCableSize(max demand current)',
        'Phase imbalance = (max_phase − min_phase) / avg_phase × 100%',
      ],
      inputs: [
        { name: 'totalConnected_kW', label: 'Total Connected Load', unit: 'kW', type: 'number', min: 0, max: 50000, required: true, help: 'Total connected load from Step 2', fromPreviousStep: 'totalConnected_kW' },
        { name: 'phaseR_kW', label: 'Phase R Load', unit: 'kW', type: 'number', min: 0, max: 5000, required: true, help: 'Phase R from Step 2', fromPreviousStep: 'phaseR_kW' },
        { name: 'phaseY_kW', label: 'Phase Y Load', unit: 'kW', type: 'number', min: 0, max: 5000, required: true, help: 'Phase Y from Step 2', fromPreviousStep: 'phaseY_kW' },
        { name: 'phaseB_kW', label: 'Phase B Load', unit: 'kW', type: 'number', min: 0, max: 5000, required: true, help: 'Phase B from Step 2', fromPreviousStep: 'phaseB_kW' },
        { name: 'serviceVoltage_V', label: 'Service Voltage', unit: 'V', type: 'number', min: 100, max: 1000, default: 380, required: true, help: 'Service voltage from Step 1' },
        { name: 'busRating_A', label: 'Bus Rating', unit: 'A', type: 'number', min: 50, max: 6300, default: 100, required: true, help: 'Bus rating from Step 1' },
        { name: 'demandFactor', label: 'Demand Factor (decimal)', unit: '', type: 'number', min: 0.1, max: 1, required: true, help: 'Demand factor from Step 1', fromPreviousStep: 'demandFactor' },
        { name: 'totalLightingLoad_kW', label: 'Lighting Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 10, required: true, help: 'Lighting load for kVA calculation' },
        { name: 'totalMotorLoad_kW', label: 'Motor Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 25, required: true, help: 'Motor load for kVA calculation' },
        { name: 'totalACLoad_kW', label: 'AC Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 15, required: true, help: 'AC load for kVA calculation' },
        { name: 'totalOtherLoad_kW', label: 'Other Load', unit: 'kW', type: 'number', min: 0, max: 5000, default: 5, required: true, help: 'Other load for kVA calculation' },
      ],
      outputs: [
        { name: 'totalConnected_kVA', label: 'Total Connected kVA', unit: 'kVA', precision: 2 },
        { name: 'demand_kVA', label: 'Demand kVA', unit: 'kVA', precision: 2 },
        { name: 'demand_kW', label: 'Demand kW', unit: 'kW', precision: 2 },
        { name: 'spare_kVA', label: 'Spare kVA', unit: 'kVA', precision: 2 },
        { name: 'maxDemandCurrent_A', label: 'Max Demand Current', unit: 'A', precision: 2 },
        { name: 'mainBreaker_A', label: 'Main Breaker Rating', unit: 'A', precision: 0 },
        { name: 'feederCable_mm2', label: 'Feeder Cable Size', unit: 'mm²', precision: 0 },
        { name: 'phaseImbalance_pct', label: 'Phase Imbalance', unit: '%', precision: 1 },
        { name: 'phaseImbalance_compliant', label: 'Phase Imbalance ≤ 10%', unit: '', precision: 0, isCompliance: true },
        { name: 'busCapacity_compliant', label: 'Demand ≤ Bus Capacity', unit: '', precision: 0, isCompliance: true },
      ],
      calculate(inp) {
        const V = Number(inp.serviceVoltage_V);
        const busA = Number(inp.busRating_A);
        const df = Number(inp.demandFactor);
        const phaseR = Number(inp.phaseR_kW);
        const phaseY = Number(inp.phaseY_kW);
        const phaseB = Number(inp.phaseB_kW);
        const totalKW = Number(inp.totalConnected_kW);
        const lighting = Number(inp.totalLightingLoad_kW);
        const motor = Number(inp.totalMotorLoad_kW);
        const ac = Number(inp.totalACLoad_kW);
        const other = Number(inp.totalOtherLoad_kW);

        // Calculate total kVA using per-category power factors
        const totalKVA = lighting / 1.0 + motor / 0.8 + ac / 0.85 + other / 0.9;

        // Demand
        const demandKVA = totalKVA * df;
        const demandKW = totalKW * df;

        // Bus capacity
        const busKVA = (Math.sqrt(3) * V * busA) / 1000;
        const spareKVA = busKVA - demandKVA;

        // Max demand current
        const maxDemandI = (demandKVA * 1000) / (Math.sqrt(3) * V);

        // Main breaker
        const mainBreaker = selectMCCBSize(Math.ceil(maxDemandI));

        // Feeder cable (using PVC in air as default)
        const feederCable = selectCableSizeFromLib(Math.ceil(maxDemandI), 'PVC', 'air').size_mm2;

        // Phase imbalance
        const phases = [phaseR, phaseY, phaseB];
        const maxPhase = Math.max(...phases);
        const minPhase = Math.min(...phases);
        const avgPhase = phases.reduce((a, b) => a + b, 0) / 3;
        const imbalance = avgPhase > 0 ? ((maxPhase - minPhase) / avgPhase) * 100 : 0;

        return {
          totalConnected_kVA: Math.round(totalKVA * 100) / 100,
          demand_kVA: Math.round(demandKVA * 100) / 100,
          demand_kW: Math.round(demandKW * 100) / 100,
          spare_kVA: Math.round(spareKVA * 100) / 100,
          maxDemandCurrent_A: Math.round(maxDemandI * 100) / 100,
          mainBreaker_A: mainBreaker,
          feederCable_mm2: feederCable,
          phaseImbalance_pct: Math.round(imbalance * 10) / 10,
          phaseImbalance_compliant: imbalance <= 10,
          busCapacity_compliant: demandKVA <= busKVA,
        };
      }
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Domain Pipeline Imports
// ─────────────────────────────────────────────────────────────────────────────

// Pipeline imports removed - all pipelines defined inline above

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const ENGINEERING_PIPELINES: EngineeringPipeline[] = [
  lvCableSizing,
  pfCorrection,
  beamDesign,
  hvacCoolingLoad,
  voltageDropCalculator,
  busbarSizing,
  indoorLightingDesign,
  motorStarterSizing,
  cableBreakerSelection,
  loadScheduleGenerator,
];

export function getPipelineById(id: string): EngineeringPipeline | undefined {
  return ENGINEERING_PIPELINES.find(p => p.id === id);
}
