'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Workflow,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  GripVertical,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Variable,
  Calculator,
  GitBranch,
  ArrowRightFromLine,
  Cog,
  Copy,
  Group,
  Download,
  Upload,
  Lightbulb,
} from 'lucide-react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
  useOnSelectionChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface EquationInput {
  id?: string
  name: string
  symbol: string
  unit?: string
  default_value?: string | number
  min?: string | number
  max?: string | number
  input_order?: number
}

interface EquationOutput {
  id?: string
  name: string
  symbol: string
  unit?: string
  formula?: string
  output_order?: number
}

interface EquationData {
  id: string | number
  name: string
  formula?: string
  equation?: string
  description?: string
  category?: string
  domain?: string
  difficulty?: string
  tags?: string
  inputs?: EquationInput[]
  outputs?: EquationOutput[]
  category_name?: string
  equation_latex?: string
}

interface CategoryData {
  id: string | number
  name: string
  slug?: string
  domain?: string
  icon?: string
  description?: string
  equation_count?: number
}

type WorkflowNodeType = 'input' | 'calculation' | 'process' | 'decision' | 'output'

interface WorkflowNodeData {
  label: string
  nodeType: WorkflowNodeType
  // INPUT
  variableName?: string
  variableValue?: string
  variableUnit?: string
  // CALCULATION
  equationId?: string | number
  equationName?: string
  equationFormula?: string
  equationInputs?: EquationInput[]
  equationOutputs?: EquationOutput[]
  inputValues?: Record<string, string>
  outputValues?: Record<string, string>
  valueSource?: Record<string, 'manual' | 'auto' | 'propagated'>
  // PROCESS
  processOperation?: string
  // DECISION
  conditionExpr?: string
  conditionVar?: string
  conditionOp?: string
  conditionVal?: string
  // OUTPUT
  displayValue?: string
  // Results
  computedResult?: Record<string, number>
  executionStatus?: 'idle' | 'running' | 'success' | 'error'
  decisionResult?: boolean
}

// ──────────────────────────────────────────────
// Built-in equation catalog (fallback + supplement)
// ──────────────────────────────────────────────

const BUILTIN_EQUATIONS: Record<string, EquationData[]> = {
  Electrical: [
    { id: 'builtin-ohm', name: "Ohm's Law", formula: 'V = I * R', domain: 'Electrical', category: 'Basic', inputs: [{ name: 'Current', symbol: 'I', unit: 'A', default_value: 10 }, { name: 'Resistance', symbol: 'R', unit: 'Ω', default_value: 5 }], outputs: [{ name: 'Voltage', symbol: 'V', unit: 'V', formula: 'I * R' }] },
    { id: 'builtin-power', name: 'Power Calculation', formula: 'P = V * I', domain: 'Electrical', category: 'Basic', inputs: [{ name: 'Voltage', symbol: 'V', unit: 'V', default_value: 230 }, { name: 'Current', symbol: 'I', unit: 'A', default_value: 10 }], outputs: [{ name: 'Power', symbol: 'P', unit: 'W', formula: 'V * I' }] },
    { id: 'builtin-vdrop', name: 'Voltage Drop', formula: 'Vd = (2*L*I*R)/1000', domain: 'Electrical', category: 'Cables', inputs: [{ name: 'Current', symbol: 'I', unit: 'A', default_value: 50 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 50 }, { name: 'Resistance', symbol: 'R', unit: 'Ω/km', default_value: 1.15 }], outputs: [{ name: 'Voltage Drop %', symbol: 'Vd', unit: '%', formula: 'voltage_drop(I, L, R, 400)' }] },
    { id: 'builtin-cable', name: 'Cable Sizing', formula: 'Cable = select_cable(I * 1.25)', domain: 'Electrical', category: 'Cables', inputs: [{ name: 'Load Current', symbol: 'I', unit: 'A', default_value: 80 }], outputs: [{ name: 'Cable Size', symbol: 'Cable', unit: 'mm²', formula: 'select_cable(I * 1.25)' }] },
    { id: 'builtin-pf', name: 'PF Correction', formula: 'Qc = P*(tan(acos(pf1)) - tan(acos(pf2)))', domain: 'Electrical', category: 'Power Factor', inputs: [{ name: 'Active Power', symbol: 'P', unit: 'kW', default_value: 100 }, { name: 'Initial PF', symbol: 'pf1', unit: '', default_value: 0.7 }, { name: 'Target PF', symbol: 'pf2', unit: '', default_value: 0.95 }], outputs: [{ name: 'Capacitor kVAr', symbol: 'Qc', unit: 'kVAr', formula: 'pf_correction_capacitor(P, pf1, pf2)' }] },
    { id: 'builtin-sc', name: 'Short Circuit Current', formula: 'Isc = kVA*1000/(sqrt(3)*V*Z%)', domain: 'Electrical', category: 'Fault Analysis', inputs: [{ name: 'Transformer kVA', symbol: 'kVA', unit: 'kVA', default_value: 1000 }, { name: 'Impedance', symbol: 'Z', unit: '%', default_value: 5 }, { name: 'Voltage', symbol: 'V', unit: 'V', default_value: 400 }], outputs: [{ name: 'SC Current', symbol: 'Isc', unit: 'kA', formula: 'short_circuit_current(kVA, Z, V) / 1000' }] },
    { id: 'builtin-3phase', name: 'Three-Phase Power', formula: 'P = sqrt(3)*V*I*PF', domain: 'Electrical', category: 'Power', inputs: [{ name: 'Voltage', symbol: 'V', unit: 'V', default_value: 400 }, { name: 'Current', symbol: 'I', unit: 'A', default_value: 100 }, { name: 'Power Factor', symbol: 'PF', unit: '', default_value: 0.85 }], outputs: [{ name: 'Power', symbol: 'P', unit: 'W', formula: 'three_phase_power(V, I, PF)' }] },
  ],
  Mechanical: [
    { id: 'builtin-beam', name: 'Beam Deflection', formula: 'δ = 5wL⁴/(384EI)', domain: 'Mechanical', category: 'Structural', inputs: [{ name: 'Load', symbol: 'w', unit: 'N/m', default_value: 5000 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 6 }, { name: 'Elasticity', symbol: 'E', unit: 'GPa', default_value: 200 }, { name: 'Inertia', symbol: 'I', unit: 'cm⁴', default_value: 8356 }], outputs: [{ name: 'Deflection', symbol: 'delta', unit: 'mm', formula: 'beam_deflection(w, L, E*1e9, I*1e-8) * 1000' }] },
    { id: 'builtin-bend', name: 'Bending Stress', formula: 'σ = M/Z', domain: 'Mechanical', category: 'Structural', inputs: [{ name: 'Moment', symbol: 'M', unit: 'N·m', default_value: 50000 }, { name: 'Section Modulus', symbol: 'Z', unit: 'cm³', default_value: 530 }], outputs: [{ name: 'Stress', symbol: 'sigma', unit: 'MPa', formula: 'bending_stress(M, Z*1e-6) / 1e6' }] },
    { id: 'builtin-shear', name: 'Shear Stress', formula: 'τ = F/A', domain: 'Mechanical', category: 'Structural', inputs: [{ name: 'Force', symbol: 'F', unit: 'N', default_value: 10000 }, { name: 'Area', symbol: 'A', unit: 'mm²', default_value: 500 }], outputs: [{ name: 'Shear Stress', symbol: 'tau', unit: 'MPa', formula: 'shear_stress(F, A*1e-6) / 1e6' }] },
    { id: 'builtin-reynolds', name: 'Reynolds Number', formula: 'Re = ρvD/μ', domain: 'Mechanical', category: 'Fluid', inputs: [{ name: 'Density', symbol: 'rho', unit: 'kg/m³', default_value: 1000 }, { name: 'Velocity', symbol: 'v', unit: 'm/s', default_value: 2 }, { name: 'Diameter', symbol: 'D', unit: 'm', default_value: 0.05 }, { name: 'Viscosity', symbol: 'mu', unit: 'Pa·s', default_value: 0.001 }], outputs: [{ name: 'Reynolds Number', symbol: 'Re', unit: '', formula: 'reynolds_number(rho, v, D, mu)' }] },
  ],
  Civil: [
    { id: 'builtin-load', name: 'Load Analysis', formula: 'W = w * L', domain: 'Civil', category: 'Structural', inputs: [{ name: 'Unit Load', symbol: 'w', unit: 'kN/m', default_value: 25 }, { name: 'Span', symbol: 'L', unit: 'm', default_value: 6 }], outputs: [{ name: 'Total Load', symbol: 'W', unit: 'kN', formula: 'w * L' }] },
    { id: 'builtin-section', name: 'Section Modulus', formula: 'Z = I/y', domain: 'Civil', category: 'Structural', inputs: [{ name: 'Moment of Inertia', symbol: 'I', unit: 'cm⁴', default_value: 8356 }, { name: 'Distance to NA', symbol: 'y', unit: 'cm', default_value: 15 }], outputs: [{ name: 'Section Modulus', symbol: 'Z', unit: 'cm³', formula: 'I / y' }] },
    { id: 'builtin-defl', name: 'Deflection Check', formula: 'δ/L ≤ L/250', domain: 'Civil', category: 'Verification', inputs: [{ name: 'Deflection', symbol: 'delta', unit: 'mm', default_value: 15 }, { name: 'Span', symbol: 'L', unit: 'm', default_value: 6 }], outputs: [{ name: 'Deflection Ratio', symbol: 'ratio', unit: '', formula: 'delta / (L * 1000)' }] },
  ],
  Chemical: [
    { id: 'builtin-heat', name: 'Heat Transfer', formula: 'h = Nu*k/D', domain: 'Chemical', category: 'Thermal', inputs: [{ name: 'Reynolds', symbol: 'Re', unit: '', default_value: 10000 }, { name: 'Prandtl', symbol: 'Pr', unit: '', default_value: 7 }, { name: 'Conductivity', symbol: 'k', unit: 'W/m·K', default_value: 0.6 }, { name: 'Diameter', symbol: 'D', unit: 'm', default_value: 0.05 }], outputs: [{ name: 'h coefficient', symbol: 'h', unit: 'W/m²·K', formula: 'heat_transfer_coefficient(Re, Pr, k, D)' }] },
    { id: 'builtin-pdrop', name: 'Pressure Drop', formula: 'ΔP = f*(L/D)*(ρv²/2)', domain: 'Chemical', category: 'Fluid', inputs: [{ name: 'Friction Factor', symbol: 'f', unit: '', default_value: 0.02 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 100 }, { name: 'Diameter', symbol: 'D', unit: 'm', default_value: 0.05 }, { name: 'Density', symbol: 'rho', unit: 'kg/m³', default_value: 1000 }, { name: 'Velocity', symbol: 'v', unit: 'm/s', default_value: 2 }], outputs: [{ name: 'Pressure Drop', symbol: 'dP', unit: 'Pa', formula: 'pressure_drop(f, L, D, rho, v)' }] },
    { id: 'builtin-darcy', name: 'Darcy Friction', formula: 'f = f(Re, ε/D)', domain: 'Chemical', category: 'Fluid', inputs: [{ name: 'Reynolds', symbol: 'Re', unit: '', default_value: 50000 }, { name: 'Roughness', symbol: 'eps', unit: 'mm', default_value: 0.045 }, { name: 'Diameter', symbol: 'D', unit: 'm', default_value: 0.05 }], outputs: [{ name: 'Friction Factor', symbol: 'f', unit: '', formula: 'darcy_friction_factor(Re, eps/1000, D)' }] },
  ],
  HVAC: [
    { id: 'builtin-sensible', name: 'Sensible Heat', formula: 'Qs = 1.08*CFM*ΔT', domain: 'HVAC', category: 'Cooling', inputs: [{ name: 'Airflow', symbol: 'CFM', unit: 'CFM', default_value: 2000 }, { name: 'Temp Diff', symbol: 'dT', unit: '°F', default_value: 20 }], outputs: [{ name: 'Sensible Heat', symbol: 'Qs', unit: 'BTU/hr', formula: '1.08 * CFM * dT' }] },
    { id: 'builtin-latent', name: 'Latent Heat', formula: 'Ql = 0.68*CFM*ΔW', domain: 'HVAC', category: 'Cooling', inputs: [{ name: 'Airflow', symbol: 'CFM', unit: 'CFM', default_value: 2000 }, { name: 'Humidity Ratio Diff', symbol: 'dW', unit: 'gr/lb', default_value: 30 }], outputs: [{ name: 'Latent Heat', symbol: 'Ql', unit: 'BTU/hr', formula: '0.68 * CFM * dW' }] },
    { id: 'builtin-cooling', name: 'Cooling Load', formula: 'Qt = Qs + Ql', domain: 'HVAC', category: 'Cooling', inputs: [{ name: 'Sensible Heat', symbol: 'Qs', unit: 'BTU/hr', default_value: 43200 }, { name: 'Latent Heat', symbol: 'Ql', unit: 'BTU/hr', default_value: 40800 }], outputs: [{ name: 'Total Cooling', symbol: 'Qt', unit: 'BTU/hr', formula: 'Qs + Ql' }] },
  ],
  Math: [
    { id: 'builtin-sqrt', name: 'Square Root', formula: '√x', domain: 'Math', category: 'Basic', inputs: [{ name: 'Value', symbol: 'x', unit: '', default_value: 144 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'sqrt(x)' }] },
    { id: 'builtin-sin', name: 'Sine', formula: 'sin(x)', domain: 'Math', category: 'Trig', inputs: [{ name: 'Angle', symbol: 'x', unit: '°', default_value: 30 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'sin(x)' }] },
    { id: 'builtin-cos', name: 'Cosine', formula: 'cos(x)', domain: 'Math', category: 'Trig', inputs: [{ name: 'Angle', symbol: 'x', unit: '°', default_value: 60 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'cos(x)' }] },
    { id: 'builtin-tan', name: 'Tangent', formula: 'tan(x)', domain: 'Math', category: 'Trig', inputs: [{ name: 'Angle', symbol: 'x', unit: '°', default_value: 45 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'tan(x)' }] },
    { id: 'builtin-log', name: 'Logarithm (base 10)', formula: 'log₁₀(x)', domain: 'Math', category: 'Log', inputs: [{ name: 'Value', symbol: 'x', unit: '', default_value: 100 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'log(x)' }] },
    { id: 'builtin-exp', name: 'Exponential', formula: 'eˣ', domain: 'Math', category: 'Log', inputs: [{ name: 'Value', symbol: 'x', unit: '', default_value: 2 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'exp(x)' }] },
    { id: 'builtin-pow', name: 'Power', formula: 'x^y', domain: 'Math', category: 'Basic', inputs: [{ name: 'Base', symbol: 'x', unit: '', default_value: 2 }, { name: 'Exponent', symbol: 'y', unit: '', default_value: 10 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'pow(x, y)' }] },
    { id: 'builtin-abs', name: 'Absolute Value', formula: '|x|', domain: 'Math', category: 'Basic', inputs: [{ name: 'Value', symbol: 'x', unit: '', default_value: -42 }], outputs: [{ name: 'Result', symbol: 'result', unit: '', formula: 'abs(x)' }] },
  ],
}

const PROCESS_OPERATIONS = [
  { value: 'sum', label: 'Sum', desc: 'Add all values' },
  { value: 'average', label: 'Average', desc: 'Mean of values' },
  { value: 'min', label: 'Min', desc: 'Minimum value' },
  { value: 'max', label: 'Max', desc: 'Maximum value' },
  { value: 'count', label: 'Count', desc: 'Count values' },
  { value: 'multiply', label: 'Multiply', desc: 'Product of values' },
  { value: 'divide', label: 'Divide', desc: 'First / Second' },
  { value: 'sort', label: 'Sort', desc: 'Ascending sort' },
  { value: 'filter', label: 'Filter', desc: 'Filter by threshold' },
]

const COMPARISON_OPERATORS = ['>', '<', '>=', '<=', '==', '!=']

// Domain icon/color mapping
const DOMAIN_STYLES: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  Electrical: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-700', icon: '⚡' },
  Mechanical: { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/30', border: 'border-slate-300 dark:border-slate-700', icon: '⚙️' },
  Civil: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-300 dark:border-orange-700', icon: '🏗️' },
  Chemical: { color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-300 dark:border-teal-700', icon: '🧪' },
  HVAC: { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-700', icon: '❄️' },
  Math: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-300 dark:border-purple-700', icon: '📐' },
}

const NODE_TYPE_STYLES: Record<WorkflowNodeType, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  input: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-400 dark:border-emerald-600', icon: <Variable className="h-3.5 w-3.5" /> },
  calculation: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-400 dark:border-amber-600', icon: <Calculator className="h-3.5 w-3.5" /> },
  process: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-400 dark:border-blue-600', icon: <Cog className="h-3.5 w-3.5" /> },
  decision: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-400 dark:border-orange-600', icon: <GitBranch className="h-3.5 w-3.5" /> },
  output: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-400 dark:border-rose-600', icon: <ArrowRightFromLine className="h-3.5 w-3.5" /> },
}

// ──────────────────────────────────────────────
// Custom Node Components
// ──────────────────────────────────────────────

function InputNode({ data, id }: NodeProps<Node<WorkflowNodeData>>) {
  const d = data as unknown as WorkflowNodeData
  const style = NODE_TYPE_STYLES.input
  return (
    <div className={`px-3 py-2 rounded-xl ${style.bg} border-2 ${style.border} shadow-lg min-w-[160px] max-w-[220px]`}>
      <Handle type="source" position={Position.Right} id="output" className="!bg-emerald-500 !w-3 !h-3 !-right-1.5" />
      <div className="flex items-center gap-1.5 mb-1.5">
        {style.icon}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>Input</span>
      </div>
      <div className="text-sm font-semibold truncate">{d.label}</div>
      {d.variableName && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {d.variableName}{d.variableUnit ? ` (${d.variableUnit})` : ''}: {d.variableValue ?? '—'}
        </div>
      )}
      {d.computedResult && Object.keys(d.computedResult).length > 0 && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-emerald-100 dark:bg-emerald-900/40 text-[10px] font-mono">
          {Object.entries(d.computedResult).map(([k, v]) => (
            <div key={k}>{k} = {typeof v === 'number' ? v.toFixed(4) : v}</div>
          ))}
        </div>
      )}
      {d.executionStatus === 'success' && (
        <div className="flex items-center gap-0.5 mt-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[9px] text-emerald-600">OK</span></div>
      )}
    </div>
  )
}

function CalculationNode({ data, id }: NodeProps<Node<WorkflowNodeData>>) {
  const d = data as unknown as WorkflowNodeData
  const style = NODE_TYPE_STYLES.calculation
  const eqInputs = d.equationInputs || []
  const eqOutputs = d.equationOutputs || []

  return (
    <div className={`px-3 py-2 rounded-xl ${style.bg} border-2 ${style.border} shadow-lg min-w-[180px] max-w-[260px]`}>
      {/* Input handles */}
      {eqInputs.map((inp, i) => (
        <Handle
          key={`in-${inp.symbol}`}
          type="target"
          position={Position.Left}
          id={`in-${inp.symbol}`}
          style={{ top: 40 + i * 22 }}
          className="!bg-amber-500 !w-2.5 !h-2.5 !-left-1.5"
        />
      ))}
      {/* Output handles */}
      {eqOutputs.map((out, i) => (
        <Handle
          key={`out-${out.symbol}`}
          type="source"
          position={Position.Right}
          id={`out-${out.symbol}`}
          style={{ top: 40 + i * 22 }}
          className="!bg-emerald-500 !w-2.5 !h-2.5 !-right-1.5"
        />
      ))}
      {/* Fallback handles if no equation selected */}
      {eqInputs.length === 0 && (
        <Handle type="target" position={Position.Left} id="input" className="!bg-amber-500 !w-2.5 !h-2.5 !-left-1.5" />
      )}
      {eqOutputs.length === 0 && (
        <Handle type="source" position={Position.Right} id="output" className="!bg-emerald-500 !w-2.5 !h-2.5 !-right-1.5" />
      )}

      <div className="flex items-center gap-1.5 mb-1.5">
        {style.icon}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>Calculation</span>
      </div>
      <div className="text-sm font-semibold truncate">{d.label}</div>
      {d.equationFormula && (
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{d.equationFormula}</div>
      )}

      {/* Input/Output labels */}
      {eqInputs.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {eqInputs.map(inp => {
            const source = d.valueSource?.[inp.symbol]
            const isAuto = source === 'auto'
            const isPropagated = source === 'propagated'
            const isManual = source === 'manual'
            return (
              <div key={inp.symbol} className={`text-[9px] text-muted-foreground flex items-center gap-1 ${isAuto ? 'text-emerald-600 dark:text-emerald-400' : isPropagated ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAuto ? 'bg-emerald-500' : isPropagated ? 'bg-violet-500' : isManual ? 'bg-sky-500' : 'bg-amber-400'}`} />
                {inp.symbol} {inp.unit ? `(${inp.unit})` : ''}
                {d.inputValues?.[inp.symbol] !== undefined && d.inputValues[inp.symbol] !== '' && <span className="font-mono ml-1">= {d.inputValues[inp.symbol]}</span>}
                {isAuto && <span className="ml-0.5 text-[7px] px-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">auto</span>}
                {isPropagated && <span className="ml-0.5 text-[7px] px-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300">linked</span>}
              </div>
            )
          })}
        </div>
      )}
      {eqOutputs.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {eqOutputs.map(out => {
            const source = d.valueSource?.[out.symbol]
            const isAuto = source === 'auto'
            const isManual = source === 'manual'
            const displayVal = d.outputValues?.[out.symbol] ?? (d.computedResult?.[out.symbol] !== undefined ? d.computedResult[out.symbol].toFixed(4) : undefined)
            return (
              <div key={out.symbol} className={`text-[9px] text-muted-foreground flex items-center gap-1 justify-end ${isAuto ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {displayVal !== undefined && (
                  <span className="font-mono mr-1">= {displayVal}</span>
                )}
                {isAuto && <span className="mr-0.5 text-[7px] px-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">calc</span>}
                {isManual && <span className="mr-0.5 text-[7px] px-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300">manual</span>}
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAuto ? 'bg-emerald-500' : isManual ? 'bg-sky-500' : 'bg-emerald-400'}`} />
                {out.symbol} {out.unit ? `(${out.unit})` : ''}
              </div>
            )
          })}
        </div>
      )}

      {d.computedResult && d.equationOutputs?.length === 0 && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-[10px] font-mono">
          {Object.entries(d.computedResult).map(([k, v]) => (
            <div key={k}>{k} = {typeof v === 'number' ? v.toFixed(4) : v}</div>
          ))}
        </div>
      )}

      {d.executionStatus === 'success' && (
        <div className="flex items-center gap-0.5 mt-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[9px] text-emerald-600">OK</span></div>
      )}
      {d.executionStatus === 'error' && (
        <div className="flex items-center gap-0.5 mt-1"><XCircle className="h-3 w-3 text-red-500" /><span className="text-[9px] text-red-600">Error</span></div>
      )}
    </div>
  )
}

function ProcessNode({ data, id }: NodeProps<Node<WorkflowNodeData>>) {
  const d = data as unknown as WorkflowNodeData
  const style = NODE_TYPE_STYLES.process
  return (
    <div className={`px-3 py-2 rounded-xl ${style.bg} border-2 ${style.border} shadow-lg min-w-[160px] max-w-[220px]`}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-blue-500 !w-2.5 !h-2.5 !-left-1.5" />
      <Handle type="source" position={Position.Right} id="output" className="!bg-emerald-500 !w-2.5 !h-2.5 !-right-1.5" />
      <div className="flex items-center gap-1.5 mb-1.5">
        {style.icon}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>Process</span>
      </div>
      <div className="text-sm font-semibold truncate">{d.label}</div>
      {d.processOperation && (
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
          {PROCESS_OPERATIONS.find(o => o.value === d.processOperation)?.label || d.processOperation}
        </div>
      )}
      {d.computedResult && Object.keys(d.computedResult).length > 0 && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-[10px] font-mono">
          {Object.entries(d.computedResult).map(([k, v]) => (
            <div key={k}>{k} = {typeof v === 'number' ? v.toFixed(4) : v}</div>
          ))}
        </div>
      )}
      {d.executionStatus === 'success' && (
        <div className="flex items-center gap-0.5 mt-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[9px] text-emerald-600">OK</span></div>
      )}
    </div>
  )
}

function DecisionNode({ data, id }: NodeProps<Node<WorkflowNodeData>>) {
  const d = data as unknown as WorkflowNodeData
  const style = NODE_TYPE_STYLES.decision
  const passed = d.decisionResult === true
  const failed = d.decisionResult === false

  return (
    <div className={`px-3 py-2 rounded-xl ${style.bg} border-2 ${passed ? 'border-emerald-500' : failed ? 'border-red-500' : style.border} shadow-lg min-w-[160px] max-w-[220px]`}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-orange-500 !w-2.5 !h-2.5 !-left-1.5" />
      <Handle type="source" position={Position.Right} id="true" style={{ top: '30%' }} className="!bg-emerald-500 !w-2.5 !h-2.5 !-right-1.5" />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} className="!bg-red-500 !w-2.5 !h-2.5 !-right-1.5" />
      <div className="flex items-center gap-1.5 mb-1.5">
        {style.icon}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>Decision</span>
      </div>
      <div className="text-sm font-semibold truncate">{d.label}</div>
      {d.conditionExpr && (
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{d.conditionExpr}</div>
      )}
      {d.conditionVar && d.conditionOp && d.conditionVal && (
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
          {d.conditionVar} {d.conditionOp} {d.conditionVal}
        </div>
      )}
      {passed && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-emerald-100 dark:bg-emerald-900/40 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span className="text-[10px] font-bold text-emerald-600">PASS</span>
        </div>
      )}
      {failed && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-red-100 dark:bg-red-900/40 flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-600" />
          <span className="text-[10px] font-bold text-red-600">FAIL</span>
        </div>
      )}
    </div>
  )
}

function OutputNode({ data, id }: NodeProps<Node<WorkflowNodeData>>) {
  const d = data as unknown as WorkflowNodeData
  const style = NODE_TYPE_STYLES.output
  return (
    <div className={`px-3 py-2 rounded-xl ${style.bg} border-2 ${style.border} shadow-lg min-w-[160px] max-w-[220px]`}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-rose-500 !w-2.5 !h-2.5 !-left-1.5" />
      <div className="flex items-center gap-1.5 mb-1.5">
        {style.icon}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>Output</span>
      </div>
      <div className="text-sm font-semibold truncate">{d.label}</div>
      {d.computedResult && Object.keys(d.computedResult).length > 0 && (
        <div className="mt-1.5 px-1.5 py-1 rounded bg-rose-100 dark:bg-rose-900/40 text-[10px] font-mono">
          {Object.entries(d.computedResult).map(([k, v]) => (
            <div key={k}>{k} = {typeof v === 'number' ? v.toFixed(4) : v}</div>
          ))}
        </div>
      )}
      {d.displayValue && !d.computedResult && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{d.displayValue}</div>
      )}
      {d.executionStatus === 'success' && (
        <div className="flex items-center gap-0.5 mt-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[9px] text-emerald-600">OK</span></div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  input: InputNode,
  calculation: CalculationNode,
  process: ProcessNode,
  decision: DecisionNode,
  output: OutputNode,
}

// ──────────────────────────────────────────────
// Equation Evaluator (client-side, mirrors server)
// ──────────────────────────────────────────────

function clientEvaluateFormula(formula: string, context: Record<string, number> = {}): number {
  const safeContext: Record<string, unknown> = {
    PI: Math.PI, E: Math.E,
    sqrt: Math.sqrt,
    sin: (v: number) => Math.sin(v * Math.PI / 180),
    cos: (v: number) => Math.cos(v * Math.PI / 180),
    tan: (v: number) => Math.tan(v * Math.PI / 180),
    asin: (v: number) => Math.asin(v) * 180 / Math.PI,
    acos: (v: number) => Math.acos(v) * 180 / Math.PI,
    atan: (v: number) => Math.atan(v) * 180 / Math.PI,
    log: Math.log10, ln: Math.log, exp: Math.exp,
    pow: Math.pow, abs: Math.abs, round: Math.round,
    ceil: Math.ceil, floor: Math.floor, max: Math.max, min: Math.min,
    ...context,
  }

  // Engineering functions
  const engFns: Record<string, (...args: number[]) => number> = {
    select_cable: (required: number) => {
      const sizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400]
      const amps = [14, 18, 24, 31, 44, 56, 75, 92, 110, 140, 170, 195, 225, 260, 305, 350, 400]
      for (let i = 0; i < amps.length; i++) { if (amps[i] >= required) return sizes[i] }
      return sizes[sizes.length - 1]
    },
    voltage_drop: (I: number, L: number, R: number, V: number) => {
      const vd = (2 * L * I * R) / 1000; return (vd / V) * 100
    },
    pf_correction_capacitor: (P: number, pf1: number, pf2: number) => {
      return P * (Math.tan(Math.acos(pf1)) - Math.tan(Math.acos(pf2)))
    },
    three_phase_power: (V: number, I: number, PF: number) => Math.sqrt(3) * V * I * PF,
    short_circuit_current: (kVA: number, Z: number, V: number) => (kVA * 1000) / (Math.sqrt(3) * V * (Z / 100)),
    beam_deflection: (w: number, L: number, E: number, I: number) => (5 * w * Math.pow(L, 4)) / (384 * E * I),
    bending_stress: (M: number, Z: number) => M / Z,
    shear_stress: (F: number, A: number) => F / A,
    reynolds_number: (rho: number, v: number, D: number, mu: number) => (rho * v * D) / mu,
    darcy_friction_factor: (Re: number, eps: number, D: number) => {
      if (Re < 2300) return 64 / Re
      return Math.pow(-1.8 * Math.log10(Math.pow(eps / (3.7 * D), 10) + Math.pow(5.74 / Math.pow(Re, 0.9), 10)), -2)
    },
    pressure_drop: (f: number, L: number, D: number, rho: number, v: number) => f * (L / D) * (rho * Math.pow(v, 2) / 2),
    heat_transfer_coefficient: (Re: number, Pr: number, k: number, D: number) => (0.023 * Math.pow(Re, 0.8) * Math.pow(Pr, 0.4) * k) / D,
  }
  Object.assign(safeContext, engFns)

  let evaluableFormula = formula
    .replace(/\^/g, '**')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'PI')

  try {
    const contextKeys = Object.keys(safeContext)
    const contextValues = Object.values(safeContext)
    const fn = new Function(...contextKeys, `return (${evaluableFormula})`)
    const result = fn(...contextValues)
    return Number(result) || 0
  } catch {
    return 0
  }
}

// ──────────────────────────────────────────────
// Bidirectional Solver Functions
// ──────────────────────────────────────────────

/**
 * Numerical solver using bisection method.
 * Finds the value of unknownVar such that evaluateFn(unknownVar) ≈ targetOutput.
 */
function numericalSolve(
  evaluateFn: (val: number) => number,
  targetOutput: number,
  initialGuess = 1,
  tolerance = 0.0001,
  maxIterations = 200
): number | null {
  // Try to bracket the root
  let low = Math.min(0, initialGuess) - Math.abs(initialGuess || 1)
  let high = Math.max(0, initialGuess) + Math.abs(initialGuess || 1)

  // Expand bounds until we bracket the root
  let fLow = evaluateFn(low) - targetOutput
  let fHigh = evaluateFn(high) - targetOutput

  for (let attempt = 0; attempt < 30; attempt++) {
    if (fLow * fHigh <= 0) break // Root bracketed
    low -= Math.abs(low) * 2 + 1
    high += Math.abs(high) * 2 + 1
    fLow = evaluateFn(low) - targetOutput
    fHigh = evaluateFn(high) - targetOutput
  }

  if (fLow * fHigh > 0) {
    // Try with a much wider range
    low = -1e6
    high = 1e6
    fLow = evaluateFn(low) - targetOutput
    fHigh = evaluateFn(high) - targetOutput
    if (fLow * fHigh > 0) return null
  }

  // Bisection
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2
    const fMid = evaluateFn(mid) - targetOutput

    if (Math.abs(fMid) < tolerance) return mid
    if (fLow * fMid < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return (low + high) / 2
}

/**
 * Solve a calculation node for a single unknown variable.
 * Returns the computed value of the unknown variable, or null if unsolvable.
 */
function solveForUnknown(
  equationOutputs: EquationOutput[],
  allValues: Record<string, number>,
  unknownSymbol: string,
  inputDefs: EquationInput[]
): number | null {
  // Find which output formula contains the unknown
  for (const out of equationOutputs) {
    if (!out.formula) continue

    // Check if the unknown is an input variable
    const isInput = inputDefs.some(i => i.symbol === unknownSymbol)

    if (isInput) {
      // Reverse solve: we know the output and all inputs except one
      // Find the initial guess from defaults
      const inputDef = inputDefs.find(i => i.symbol === unknownSymbol)
      const defaultVal = inputDef?.default_value ? parseFloat(String(inputDef.default_value)) : 1

      // Try each output formula
      for (const o of equationOutputs) {
        if (!o.formula) continue
        // Check if this formula's output value is known
        const outVal = allValues[o.symbol]
        if (outVal === undefined || outVal === null) continue

        // Check if unknown appears in this formula
        const formulaStr = o.formula
        if (!formulaStr.includes(unknownSymbol) && unknownSymbol.length > 0) {
          // Try anyway - the unknown might be indirectly used
        }

        const evaluateFn = (val: number) => {
          const ctx = { ...allValues, [unknownSymbol]: val }
          return clientEvaluateFormula(formulaStr, ctx)
        }

        const result = numericalSolve(evaluateFn, outVal, defaultVal)
        if (result !== null && isFinite(result)) return result
      }
    } else {
      // Forward solve: unknown is an output, all inputs known
      const evalResult = clientEvaluateFormula(out.formula, allValues)
      if (evalResult !== 0 || Object.keys(allValues).length > 0) {
        // Check it's not just a failed eval
        const testResult = clientEvaluateFormula(out.formula, allValues)
        if (isFinite(testResult)) return testResult
      }
    }
  }

  return null
}

/**
 * Perform bidirectional solve on a calculation node.
 * Given current inputValues and outputValues, determine which variable
 * is the single unknown and solve for it.
 */
function bidirectionalSolve(
  equationInputs: EquationInput[],
  equationOutputs: EquationOutput[],
  inputValues: Record<string, string>,
  outputValues: Record<string, string>
): { solvedSymbol: string; solvedValue: number; source: 'auto' } | null {
  // Collect all known numeric values
  const knownValues: Record<string, number> = {}
  const allSymbols = [
    ...equationInputs.map(i => i.symbol),
    ...equationOutputs.map(o => o.symbol),
  ]

  let unknownSymbol: string | null = null
  let unknownCount = 0

  for (const symbol of allSymbols) {
    const inputVal = inputValues[symbol]
    const outputVal = outputValues[symbol]

    if (inputVal !== undefined && inputVal !== '' && !isNaN(parseFloat(inputVal))) {
      knownValues[symbol] = parseFloat(inputVal)
    } else if (outputVal !== undefined && outputVal !== '' && !isNaN(parseFloat(outputVal))) {
      knownValues[symbol] = parseFloat(outputVal)
    } else {
      unknownSymbol = symbol
      unknownCount++
    }
  }

  if (unknownCount !== 1 || !unknownSymbol) return null

  // Solve for the unknown
  const result = solveForUnknown(equationOutputs, knownValues, unknownSymbol, equationInputs)
  if (result !== null && isFinite(result)) {
    return { solvedSymbol: unknownSymbol, solvedValue: result, source: 'auto' }
  }

  return null
}

// ──────────────────────────────────────────────
// Pre-built Workflow Examples
// ──────────────────────────────────────────────

function createExampleNodes(): Record<string, Node<WorkflowNodeData>[]> {
  return {
    'cable-sizing': [
      { id: 'cs-1', type: 'input', position: { x: 50, y: 150 }, data: { label: 'Load Power', nodeType: 'input', variableName: 'P', variableValue: '50000', variableUnit: 'W' } },
      { id: 'cs-2', type: 'input', position: { x: 50, y: 300 }, data: { label: 'Voltage', nodeType: 'input', variableName: 'V', variableValue: '400', variableUnit: 'V' } },
      { id: 'cs-3', type: 'input', position: { x: 50, y: 450 }, data: { label: 'Power Factor', nodeType: 'input', variableName: 'PF', variableValue: '0.85', variableUnit: '' } },
      { id: 'cs-4', type: 'calculation', position: { x: 320, y: 200 }, data: { label: 'Load Current', nodeType: 'calculation', equationId: 'builtin-3phase', equationName: 'Three-Phase Power', equationFormula: 'P = sqrt(3)*V*I*PF → I = P/(sqrt(3)*V*PF)', equationInputs: [{ name: 'Voltage', symbol: 'V', unit: 'V', default_value: 400 }, { name: 'Current', symbol: 'I', unit: 'A', default_value: 100 }, { name: 'Power Factor', symbol: 'PF', unit: '', default_value: 0.85 }], equationOutputs: [{ name: 'Power', symbol: 'P', unit: 'W', formula: 'three_phase_power(V, I, PF)' }], inputValues: {} } },
      { id: 'cs-5', type: 'calculation', position: { x: 600, y: 200 }, data: { label: 'Cable Selection', nodeType: 'calculation', equationId: 'builtin-cable', equationName: 'Cable Sizing', equationFormula: 'select_cable(I*1.25)', equationInputs: [{ name: 'Load Current', symbol: 'I', unit: 'A', default_value: 80 }], equationOutputs: [{ name: 'Cable Size', symbol: 'Cable', unit: 'mm²', formula: 'select_cable(I*1.25)' }], inputValues: {} } },
      { id: 'cs-6', type: 'calculation', position: { x: 600, y: 380 }, data: { label: 'Voltage Drop', nodeType: 'calculation', equationId: 'builtin-vdrop', equationName: 'Voltage Drop', equationFormula: 'Vd% = (2*L*I*R)/1000/V*100', equationInputs: [{ name: 'Current', symbol: 'I', unit: 'A', default_value: 50 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 50 }, { name: 'Resistance', symbol: 'R', unit: 'Ω/km', default_value: 1.15 }], equationOutputs: [{ name: 'Voltage Drop %', symbol: 'Vd', unit: '%', formula: 'voltage_drop(I, L, R, 400)' }], inputValues: {} } },
      { id: 'cs-7', type: 'decision', position: { x: 900, y: 280 }, data: { label: 'VD ≤ 2.5%?', nodeType: 'decision', conditionVar: 'Vd', conditionOp: '<=', conditionVal: '2.5', conditionExpr: 'Vd <= 2.5' } },
      { id: 'cs-8', type: 'output', position: { x: 1180, y: 200 }, data: { label: 'Cable Verified ✓', nodeType: 'output' } },
      { id: 'cs-9', type: 'output', position: { x: 1180, y: 380 }, data: { label: 'Cable Rejected ✗', nodeType: 'output' } },
    ],
    'voltage-drop': [
      { id: 'vd-1', type: 'input', position: { x: 50, y: 150 }, data: { label: 'Current', nodeType: 'input', variableName: 'I', variableValue: '85', variableUnit: 'A' } },
      { id: 'vd-2', type: 'input', position: { x: 50, y: 280 }, data: { label: 'Cable Length', nodeType: 'input', variableName: 'L', variableValue: '80', variableUnit: 'm' } },
      { id: 'vd-3', type: 'input', position: { x: 50, y: 410 }, data: { label: 'Resistance', nodeType: 'input', variableName: 'R', variableValue: '0.87', variableUnit: 'Ω/km' } },
      { id: 'vd-4', type: 'calculation', position: { x: 350, y: 250 }, data: { label: 'Voltage Drop Calc', nodeType: 'calculation', equationId: 'builtin-vdrop', equationName: 'Voltage Drop', equationFormula: 'Vd = (2*L*I*R)/1000', equationInputs: [{ name: 'Current', symbol: 'I', unit: 'A', default_value: 85 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 80 }, { name: 'Resistance', symbol: 'R', unit: 'Ω/km', default_value: 0.87 }], equationOutputs: [{ name: 'Voltage Drop %', symbol: 'Vd', unit: '%', formula: 'voltage_drop(I, L, R, 400)' }], inputValues: {} } },
      { id: 'vd-5', type: 'decision', position: { x: 650, y: 250 }, data: { label: 'VD ≤ 4%?', nodeType: 'decision', conditionVar: 'Vd', conditionOp: '<=', conditionVal: '4', conditionExpr: 'Vd <= 4' } },
      { id: 'vd-6', type: 'output', position: { x: 950, y: 180 }, data: { label: 'Acceptable', nodeType: 'output' } },
      { id: 'vd-7', type: 'output', position: { x: 950, y: 320 }, data: { label: 'Oversized Drop', nodeType: 'output' } },
    ],
    'power-flow': [
      { id: 'pf-1', type: 'input', position: { x: 50, y: 120 }, data: { label: 'Voltage', nodeType: 'input', variableName: 'V', variableValue: '400', variableUnit: 'V' } },
      { id: 'pf-2', type: 'input', position: { x: 50, y: 240 }, data: { label: 'Current', nodeType: 'input', variableName: 'I', variableValue: '150', variableUnit: 'A' } },
      { id: 'pf-3', type: 'input', position: { x: 50, y: 360 }, data: { label: 'Power Factor', nodeType: 'input', variableName: 'PF', variableValue: '0.8', variableUnit: '' } },
      { id: 'pf-4', type: 'calculation', position: { x: 350, y: 180 }, data: { label: 'Active Power', nodeType: 'calculation', equationId: 'builtin-3phase', equationName: 'Three-Phase Power', equationFormula: 'P = sqrt(3)*V*I*PF', equationInputs: [{ name: 'Voltage', symbol: 'V', unit: 'V', default_value: 400 }, { name: 'Current', symbol: 'I', unit: 'A', default_value: 150 }, { name: 'Power Factor', symbol: 'PF', unit: '', default_value: 0.8 }], equationOutputs: [{ name: 'Power', symbol: 'P', unit: 'W', formula: 'three_phase_power(V, I, PF)' }], inputValues: {} } },
      { id: 'pf-5', type: 'calculation', position: { x: 350, y: 370 }, data: { label: 'PF Correction', nodeType: 'calculation', equationId: 'builtin-pf', equationName: 'PF Correction', equationFormula: 'Qc = P*(tan(acos(pf1))-tan(acos(pf2)))', equationInputs: [{ name: 'Active Power', symbol: 'P', unit: 'kW', default_value: 83 }, { name: 'Initial PF', symbol: 'pf1', unit: '', default_value: 0.8 }, { name: 'Target PF', symbol: 'pf2', unit: '', default_value: 0.95 }], equationOutputs: [{ name: 'Capacitor kVAr', symbol: 'Qc', unit: 'kVAr', formula: 'pf_correction_capacitor(P, pf1, pf2)' }], inputValues: {} } },
      { id: 'pf-6', type: 'output', position: { x: 680, y: 180 }, data: { label: 'Power Result', nodeType: 'output' } },
      { id: 'pf-7', type: 'output', position: { x: 680, y: 370 }, data: { label: 'Correction Needed', nodeType: 'output' } },
    ],
    'hvac-load': [
      { id: 'hv-1', type: 'input', position: { x: 50, y: 120 }, data: { label: 'Airflow', nodeType: 'input', variableName: 'CFM', variableValue: '2000', variableUnit: 'CFM' } },
      { id: 'hv-2', type: 'input', position: { x: 50, y: 240 }, data: { label: 'Temp Difference', nodeType: 'input', variableName: 'dT', variableValue: '20', variableUnit: '°F' } },
      { id: 'hv-3', type: 'input', position: { x: 50, y: 360 }, data: { label: 'Humidity Diff', nodeType: 'input', variableName: 'dW', variableValue: '30', variableUnit: 'gr/lb' } },
      { id: 'hv-4', type: 'calculation', position: { x: 350, y: 120 }, data: { label: 'Sensible Heat', nodeType: 'calculation', equationId: 'builtin-sensible', equationName: 'Sensible Heat', equationFormula: 'Qs = 1.08*CFM*dT', equationInputs: [{ name: 'Airflow', symbol: 'CFM', unit: 'CFM', default_value: 2000 }, { name: 'Temp Diff', symbol: 'dT', unit: '°F', default_value: 20 }], equationOutputs: [{ name: 'Sensible Heat', symbol: 'Qs', unit: 'BTU/hr', formula: '1.08 * CFM * dT' }], inputValues: {} } },
      { id: 'hv-5', type: 'calculation', position: { x: 350, y: 300 }, data: { label: 'Latent Heat', nodeType: 'calculation', equationId: 'builtin-latent', equationName: 'Latent Heat', equationFormula: 'Ql = 0.68*CFM*dW', equationInputs: [{ name: 'Airflow', symbol: 'CFM', unit: 'CFM', default_value: 2000 }, { name: 'Humidity Ratio Diff', symbol: 'dW', unit: 'gr/lb', default_value: 30 }], equationOutputs: [{ name: 'Latent Heat', symbol: 'Ql', unit: 'BTU/hr', formula: '0.68 * CFM * dW' }], inputValues: {} } },
      { id: 'hv-6', type: 'calculation', position: { x: 650, y: 210 }, data: { label: 'Total Cooling Load', nodeType: 'calculation', equationId: 'builtin-cooling', equationName: 'Cooling Load', equationFormula: 'Qt = Qs + Ql', equationInputs: [{ name: 'Sensible Heat', symbol: 'Qs', unit: 'BTU/hr', default_value: 43200 }, { name: 'Latent Heat', symbol: 'Ql', unit: 'BTU/hr', default_value: 40800 }], equationOutputs: [{ name: 'Total Cooling', symbol: 'Qt', unit: 'BTU/hr', formula: 'Qs + Ql' }], inputValues: {} } },
      { id: 'hv-7', type: 'output', position: { x: 950, y: 210 }, data: { label: 'Total Load', nodeType: 'output' } },
    ],
    'beam-design': [
      { id: 'bd-1', type: 'input', position: { x: 50, y: 100 }, data: { label: 'UDL', nodeType: 'input', variableName: 'w', variableValue: '5000', variableUnit: 'N/m' } },
      { id: 'bd-2', type: 'input', position: { x: 50, y: 220 }, data: { label: 'Span Length', nodeType: 'input', variableName: 'L', variableValue: '6', variableUnit: 'm' } },
      { id: 'bd-3', type: 'input', position: { x: 50, y: 340 }, data: { label: 'Elasticity', nodeType: 'input', variableName: 'E', variableValue: '200', variableUnit: 'GPa' } },
      { id: 'bd-4', type: 'input', position: { x: 50, y: 460 }, data: { label: 'Moment of Inertia', nodeType: 'input', variableName: 'I', variableValue: '8356', variableUnit: 'cm⁴' } },
      { id: 'bd-5', type: 'calculation', position: { x: 350, y: 250 }, data: { label: 'Beam Deflection', nodeType: 'calculation', equationId: 'builtin-beam', equationName: 'Beam Deflection', equationFormula: 'δ = 5wL⁴/(384EI)', equationInputs: [{ name: 'Load', symbol: 'w', unit: 'N/m', default_value: 5000 }, { name: 'Length', symbol: 'L', unit: 'm', default_value: 6 }, { name: 'Elasticity', symbol: 'E', unit: 'GPa', default_value: 200 }, { name: 'Inertia', symbol: 'I', unit: 'cm⁴', default_value: 8356 }], equationOutputs: [{ name: 'Deflection', symbol: 'delta', unit: 'mm', formula: 'beam_deflection(w, L, E*1e9, I*1e-8) * 1000' }], inputValues: {} } },
      { id: 'bd-6', type: 'decision', position: { x: 650, y: 250 }, data: { label: 'δ/L ≤ 1/250?', nodeType: 'decision', conditionVar: 'ratio', conditionOp: '<=', conditionVal: '0.004', conditionExpr: 'delta/(L*1000) <= 0.004' } },
      { id: 'bd-7', type: 'output', position: { x: 950, y: 180 }, data: { label: 'Beam OK ✓', nodeType: 'output' } },
      { id: 'bd-8', type: 'output', position: { x: 950, y: 340 }, data: { label: 'Beam Fails ✗', nodeType: 'output' } },
    ],
  }
}

function createExampleEdges(): Record<string, Edge[]> {
  return {
    'cable-sizing': [
      { id: 'cs-e1', source: 'cs-1', target: 'cs-4', sourceHandle: 'output', targetHandle: 'in-V', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e2', source: 'cs-2', target: 'cs-4', sourceHandle: 'output', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e3', source: 'cs-3', target: 'cs-4', sourceHandle: 'output', targetHandle: 'in-PF', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e4', source: 'cs-4', target: 'cs-5', sourceHandle: 'out-P', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e5', source: 'cs-4', target: 'cs-6', sourceHandle: 'out-P', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e6', source: 'cs-6', target: 'cs-7', sourceHandle: 'out-Vd', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
      { id: 'cs-e7', source: 'cs-7', target: 'cs-8', sourceHandle: 'true', animated: true, style: { stroke: '#16a34a' } },
      { id: 'cs-e8', source: 'cs-7', target: 'cs-9', sourceHandle: 'false', animated: true, style: { stroke: '#dc2626' } },
    ],
    'voltage-drop': [
      { id: 'vd-e1', source: 'vd-1', target: 'vd-4', sourceHandle: 'output', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'vd-e2', source: 'vd-2', target: 'vd-4', sourceHandle: 'output', targetHandle: 'in-L', animated: true, style: { stroke: '#059669' } },
      { id: 'vd-e3', source: 'vd-3', target: 'vd-4', sourceHandle: 'output', targetHandle: 'in-R', animated: true, style: { stroke: '#059669' } },
      { id: 'vd-e4', source: 'vd-4', target: 'vd-5', sourceHandle: 'out-Vd', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
      { id: 'vd-e5', source: 'vd-5', target: 'vd-6', sourceHandle: 'true', animated: true, style: { stroke: '#16a34a' } },
      { id: 'vd-e6', source: 'vd-5', target: 'vd-7', sourceHandle: 'false', animated: true, style: { stroke: '#dc2626' } },
    ],
    'power-flow': [
      { id: 'pf-e1', source: 'pf-1', target: 'pf-4', sourceHandle: 'output', targetHandle: 'in-V', animated: true, style: { stroke: '#059669' } },
      { id: 'pf-e2', source: 'pf-2', target: 'pf-4', sourceHandle: 'output', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'pf-e3', source: 'pf-3', target: 'pf-4', sourceHandle: 'output', targetHandle: 'in-PF', animated: true, style: { stroke: '#059669' } },
      { id: 'pf-e4', source: 'pf-4', target: 'pf-5', sourceHandle: 'out-P', targetHandle: 'in-P', animated: true, style: { stroke: '#059669' } },
      { id: 'pf-e5', source: 'pf-4', target: 'pf-6', sourceHandle: 'out-P', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
      { id: 'pf-e6', source: 'pf-5', target: 'pf-7', sourceHandle: 'out-Qc', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
    ],
    'hvac-load': [
      { id: 'hv-e1', source: 'hv-1', target: 'hv-4', sourceHandle: 'output', targetHandle: 'in-CFM', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e2', source: 'hv-2', target: 'hv-4', sourceHandle: 'output', targetHandle: 'in-dT', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e3', source: 'hv-1', target: 'hv-5', sourceHandle: 'output', targetHandle: 'in-CFM', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e4', source: 'hv-3', target: 'hv-5', sourceHandle: 'output', targetHandle: 'in-dW', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e5', source: 'hv-4', target: 'hv-6', sourceHandle: 'out-Qs', targetHandle: 'in-Qs', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e6', source: 'hv-5', target: 'hv-6', sourceHandle: 'out-Ql', targetHandle: 'in-Ql', animated: true, style: { stroke: '#059669' } },
      { id: 'hv-e7', source: 'hv-6', target: 'hv-7', sourceHandle: 'out-Qt', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
    ],
    'beam-design': [
      { id: 'bd-e1', source: 'bd-1', target: 'bd-5', sourceHandle: 'output', targetHandle: 'in-w', animated: true, style: { stroke: '#059669' } },
      { id: 'bd-e2', source: 'bd-2', target: 'bd-5', sourceHandle: 'output', targetHandle: 'in-L', animated: true, style: { stroke: '#059669' } },
      { id: 'bd-e3', source: 'bd-3', target: 'bd-5', sourceHandle: 'output', targetHandle: 'in-E', animated: true, style: { stroke: '#059669' } },
      { id: 'bd-e4', source: 'bd-4', target: 'bd-5', sourceHandle: 'output', targetHandle: 'in-I', animated: true, style: { stroke: '#059669' } },
      { id: 'bd-e5', source: 'bd-5', target: 'bd-6', sourceHandle: 'out-delta', targetHandle: 'input', animated: true, style: { stroke: '#059669' } },
      { id: 'bd-e6', source: 'bd-6', target: 'bd-7', sourceHandle: 'true', animated: true, style: { stroke: '#16a34a' } },
      { id: 'bd-e7', source: 'bd-6', target: 'bd-8', sourceHandle: 'false', animated: true, style: { stroke: '#dc2626' } },
    ],
  }
}

const EXAMPLES = [
  { key: 'cable-sizing', label: 'Cable Sizing IEC', desc: 'Load Current → Cable Selection → Voltage Drop → Verification', icon: '🔌' },
  { key: 'voltage-drop', label: 'Voltage Drop Analysis', desc: 'Current → Voltage Drop → Decision', icon: '⚡' },
  { key: 'power-flow', label: 'Power Flow Analysis', desc: '3-Phase Power → PF Correction', icon: '🔋' },
  { key: 'hvac-load', label: 'HVAC Load Calculation', desc: 'Sensible + Latent → Total Cooling', icon: '❄️' },
  { key: 'beam-design', label: 'Beam Design', desc: 'Load → Deflection → Pass/Fail', icon: '🏗️' },
]

// ──────────────────────────────────────────────
// Calculation Node Editor with Bidirectional Solving
// ──────────────────────────────────────────────

function CalculationNodeEditor({
  d,
  nodeId,
  equations,
  onUpdate,
}: {
  d: WorkflowNodeData
  nodeId: string
  equations: Record<string, EquationData[]>
  onUpdate: (id: string, data: Partial<WorkflowNodeData>) => void
}) {
  const [solveMessage, setSolveMessage] = React.useState<string | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const eqInputs = d.equationInputs || []
  const eqOutputs = d.equationOutputs || []
  const inputValues = d.inputValues || {}
  const outputValues = d.outputValues || {}
  const valueSource = d.valueSource || {}

  // Auto-solve with debounce when values change
  const triggerSolve = React.useCallback((newInputValues: Record<string, string>, newOutputValues: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (eqInputs.length === 0 || eqOutputs.length === 0) return

      const result = bidirectionalSolve(eqInputs, eqOutputs, newInputValues, newOutputValues)
      if (result) {
        const { solvedSymbol, solvedValue } = result
        const isInput = eqInputs.some(i => i.symbol === solvedSymbol)
        const formatted = parseFloat(solvedValue.toFixed(6)).toString()

        const updatedInputValues = { ...newInputValues }
        const updatedOutputValues = { ...newOutputValues }
        const updatedValueSource = { ...valueSource }

        if (isInput) {
          updatedInputValues[solvedSymbol] = formatted
        } else {
          updatedOutputValues[solvedSymbol] = formatted
        }
        updatedValueSource[solvedSymbol] = 'auto'

        onUpdate(nodeId, {
          inputValues: updatedInputValues,
          outputValues: updatedOutputValues,
          valueSource: updatedValueSource,
          computedResult: Object.fromEntries(
            eqOutputs.map(o => {
              const val = updatedOutputValues[o.symbol]
                ? parseFloat(updatedOutputValues[o.symbol])
                : updatedInputValues[o.symbol]
                  ? undefined
                  : undefined
              return [o.symbol, val ?? 0]
            }).filter(([, v]) => v !== undefined)
          ),
        })
        setSolveMessage(`Auto-solved ${solvedSymbol} = ${formatted}`)
      } else {
        setSolveMessage(null)
      }
    }, 300)
  }, [eqInputs, eqOutputs, nodeId, onUpdate, valueSource])

  // Handle input value change
  const handleInputChange = React.useCallback((symbol: string, value: string) => {
    const newInputValues = { ...inputValues, [symbol]: value }
    const newValueSource = { ...valueSource, [symbol]: value !== '' ? 'manual' as const : undefined }

    // Clear auto-computed output for this input if manually changed
    // Also try forward solve if all inputs are filled
    const allInputsFilled = eqInputs.every(inp =>
      newInputValues[inp.symbol] !== undefined && newInputValues[inp.symbol] !== '' && !isNaN(parseFloat(newInputValues[inp.symbol]))
    )

    if (allInputsFilled && eqOutputs.length > 0) {
      // Forward solve: compute all outputs
      const inputNums: Record<string, number> = {}
      for (const inp of eqInputs) {
        const v = parseFloat(newInputValues[inp.symbol])
        if (!isNaN(v)) inputNums[inp.symbol] = v
      }
      const newComputed: Record<string, number> = {}
      const newOutputVals = { ...outputValues }
      const newSources = { ...newValueSource }
      for (const out of eqOutputs) {
        if (out.formula) {
          const result = clientEvaluateFormula(out.formula, inputNums)
          if (isFinite(result)) {
            newComputed[out.symbol] = result
            newOutputVals[out.symbol] = parseFloat(result.toFixed(6)).toString()
            newSources[out.symbol] = 'auto'
          }
        }
      }
      onUpdate(nodeId, {
        inputValues: newInputValues,
        outputValues: newOutputVals,
        valueSource: newSources,
        computedResult: newComputed,
      })
      setSolveMessage(`Calculated ${Object.keys(newComputed).join(', ')}`)
    } else {
      // Try bidirectional solve
      onUpdate(nodeId, {
        inputValues: newInputValues,
        valueSource: newSources,
      })
      triggerSolve(newInputValues, outputValues)
    }
  }, [inputValues, outputValues, valueSource, eqInputs, eqOutputs, nodeId, onUpdate, triggerSolve])

  // Handle output value change
  const handleOutputChange = React.useCallback((symbol: string, value: string) => {
    const newOutputValues = { ...outputValues, [symbol]: value }
    const newValueSource = { ...valueSource, [symbol]: value !== '' ? 'manual' as const : undefined }

    onUpdate(nodeId, {
      outputValues: newOutputValues,
      valueSource: newValueSource,
    })

    // Try bidirectional solve (reverse)
    triggerSolve(inputValues, newOutputValues)
  }, [outputValues, valueSource, inputValues, nodeId, onUpdate, triggerSolve])

  // Solve button: explicitly solve
  const handleSolve = React.useCallback(() => {
    if (eqInputs.length === 0 || eqOutputs.length === 0) return

    // First try forward solve
    const inputNums: Record<string, number> = {}
    let allFilled = true
    for (const inp of eqInputs) {
      const v = parseFloat(inputValues[inp.symbol] || '')
      if (isNaN(v)) { allFilled = false; break }
      inputNums[inp.symbol] = v
    }

    if (allFilled) {
      const newComputed: Record<string, number> = {}
      const newOutputVals = { ...outputValues }
      const newSources = { ...valueSource }
      for (const out of eqOutputs) {
        if (out.formula) {
          const result = clientEvaluateFormula(out.formula, inputNums)
          if (isFinite(result)) {
            newComputed[out.symbol] = result
            newOutputVals[out.symbol] = parseFloat(result.toFixed(6)).toString()
            newSources[out.symbol] = 'auto'
          }
        }
      }
      onUpdate(nodeId, {
        outputValues: newOutputVals,
        valueSource: newSources,
        computedResult: newComputed,
      })
      setSolveMessage(`Calculated ${Object.keys(newComputed).join(', ')}`)
      return
    }

    // Try bidirectional solve
    const result = bidirectionalSolve(eqInputs, eqOutputs, inputValues, outputValues)
    if (result) {
      const { solvedSymbol, solvedValue } = result
      const isInput = eqInputs.some(i => i.symbol === solvedSymbol)
      const formatted = parseFloat(solvedValue.toFixed(6)).toString()

      const updatedInputValues = { ...inputValues }
      const updatedOutputValues = { ...outputValues }
      const updatedValueSource = { ...valueSource }

      if (isInput) {
        updatedInputValues[solvedSymbol] = formatted
      } else {
        updatedOutputValues[solvedSymbol] = formatted
      }
      updatedValueSource[solvedSymbol] = 'auto'

      const newComputed: Record<string, number> = {}
      for (const out of eqOutputs) {
        if (out.formula) {
          const ctx: Record<string, number> = {}
          for (const inp of eqInputs) {
            const v = parseFloat(updatedInputValues[inp.symbol] || '')
            if (!isNaN(v)) ctx[inp.symbol] = v
          }
          const r = clientEvaluateFormula(out.formula, ctx)
          if (isFinite(r)) newComputed[out.symbol] = r
        }
      }

      onUpdate(nodeId, {
        inputValues: updatedInputValues,
        outputValues: updatedOutputValues,
        valueSource: updatedValueSource,
        computedResult: newComputed,
      })
      setSolveMessage(`Solved ${solvedSymbol} = ${formatted}`)
    } else {
      // Count missing values
      const missing = [
        ...eqInputs.filter(i => !inputValues[i.symbol] || inputValues[i.symbol] === ''),
        ...eqOutputs.filter(o => !outputValues[o.symbol] || outputValues[o.symbol] === ''),
      ]
      setSolveMessage(`Need more values. Missing: ${missing.map(m => m.symbol).join(', ')}`)
    }
  }, [eqInputs, eqOutputs, inputValues, outputValues, valueSource, nodeId, onUpdate])

  // Reset node values
  const handleReset = React.useCallback(() => {
    const defaultInputs: Record<string, string> = {}
    for (const inp of eqInputs) {
      if (inp.default_value !== undefined) defaultInputs[inp.symbol] = String(inp.default_value)
    }
    onUpdate(nodeId, {
      inputValues: defaultInputs,
      outputValues: {},
      valueSource: {},
      computedResult: undefined,
      executionStatus: 'idle',
    })
    setSolveMessage(null)
  }, [eqInputs, nodeId, onUpdate])

  return (
    <>
      {/* Equation selector */}
      <div>
        <Label className="text-xs">Equation</Label>
        <Select
          value={String(d.equationId || '')}
          onValueChange={val => {
            let selectedEq: EquationData | undefined
            for (const domain of Object.keys(equations)) {
              selectedEq = equations[domain].find(eq => String(eq.id) === val)
              if (selectedEq) break
            }
            if (selectedEq) {
              const defaultInputs: Record<string, string> = {}
              for (const inp of selectedEq.inputs || []) {
                if (inp.default_value !== undefined) defaultInputs[inp.symbol] = String(inp.default_value)
              }
              onUpdate(nodeId, {
                equationId: selectedEq.id,
                equationName: selectedEq.name,
                equationFormula: selectedEq.formula || selectedEq.equation,
                equationInputs: selectedEq.inputs || [],
                equationOutputs: selectedEq.outputs || [],
                inputValues: defaultInputs,
                outputValues: {},
                valueSource: {},
                computedResult: undefined,
                executionStatus: 'idle',
              })
              setSolveMessage(null)
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select equation..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Object.entries(equations).map(([domain, eqs]) => (
              <React.Fragment key={domain}>
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>{DOMAIN_STYLES[domain]?.icon}</span> {domain}
                </div>
                {eqs.map(eq => (
                  <SelectItem key={String(eq.id)} value={String(eq.id)} className="text-xs">
                    {eq.name}
                  </SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Formula display */}
      {d.equationFormula && (
        <div className="px-2 py-1.5 rounded bg-muted text-[10px] font-mono break-all">
          {d.equationFormula}
        </div>
      )}

      {/* Input Variables */}
      {eqInputs.length > 0 && (
        <div>
          <Label className="text-xs mb-1.5 block font-semibold text-amber-600 dark:text-amber-400">
            Input Variables
          </Label>
          <div className="space-y-1.5">
            {eqInputs.map(inp => {
              const source = valueSource[inp.symbol]
              const isAuto = source === 'auto'
              const isManual = source === 'manual'
              const currentValue = inputValues[inp.symbol] ?? ''

              return (
                <div key={inp.symbol} className={`flex items-center gap-1.5 p-1 rounded ${isAuto ? 'bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-300 dark:ring-emerald-700' : isManual ? 'bg-sky-50 dark:bg-sky-950/20 ring-1 ring-sky-300 dark:ring-sky-700' : ''}`}>
                  <Badge variant="outline" className="text-[9px] h-5 min-w-[40px] justify-center font-mono shrink-0">
                    {inp.symbol}
                  </Badge>
                  <Input
                    value={currentValue}
                    onChange={e => handleInputChange(inp.symbol, e.target.value)}
                    placeholder={inp.default_value !== undefined ? String(inp.default_value) : '?'}
                    className={`h-7 text-xs flex-1 ${isAuto ? 'border-emerald-300 dark:border-emerald-700' : isManual ? 'border-sky-300 dark:border-sky-700' : ''}`}
                  />
                  <span className="text-[8px] text-muted-foreground min-w-[28px] shrink-0">{inp.unit || ''}</span>
                  {isAuto && (
                    <Badge className="text-[7px] h-4 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 shrink-0">auto</Badge>
                  )}
                  {isManual && (
                    <Badge className="text-[7px] h-4 px-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 border-0 shrink-0">manual</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Output Variables */}
      {eqOutputs.length > 0 && (
        <div>
          <Label className="text-xs mb-1.5 block font-semibold text-emerald-600 dark:text-emerald-400">
            Output Variables
          </Label>
          <div className="space-y-1.5">
            {eqOutputs.map(out => {
              const source = valueSource[out.symbol]
              const isAuto = source === 'auto'
              const isManual = source === 'manual'
              const currentValue = outputValues[out.symbol] ?? ''

              return (
                <div key={out.symbol} className={`flex items-center gap-1.5 p-1 rounded ${isAuto ? 'bg-emerald-50 dark:bg-emerald-950/20 ring-1 ring-emerald-300 dark:ring-emerald-700' : isManual ? 'bg-sky-50 dark:bg-sky-950/20 ring-1 ring-sky-300 dark:ring-sky-700' : ''}`}>
                  <Badge variant="outline" className="text-[9px] h-5 min-w-[40px] justify-center font-mono shrink-0">
                    {out.symbol}
                  </Badge>
                  <Input
                    value={currentValue}
                    onChange={e => handleOutputChange(out.symbol, e.target.value)}
                    placeholder="?"
                    className={`h-7 text-xs flex-1 ${isAuto ? 'border-emerald-300 dark:border-emerald-700' : isManual ? 'border-sky-300 dark:border-sky-700' : ''}`}
                  />
                  <span className="text-[8px] text-muted-foreground min-w-[28px] shrink-0">{out.unit || ''}</span>
                  {isAuto && (
                    <Badge className="text-[7px] h-4 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 shrink-0">calculated</Badge>
                  )}
                  {isManual && (
                    <Badge className="text-[7px] h-4 px-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 border-0 shrink-0">manual</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Solve message */}
      {solveMessage && (
        <div className={`text-[10px] px-2 py-1.5 rounded ${solveMessage.includes('Need') ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
          {solveMessage}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSolve}
        >
          <Calculator className="h-3 w-3" />
          Solve
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────
// Node Editor Panel
// ──────────────────────────────────────────────

function NodeEditorPanel({
  node,
  equations,
  onUpdate,
}: {
  node: Node<WorkflowNodeData> | null
  equations: Record<string, EquationData[]>
  onUpdate: (id: string, data: Partial<WorkflowNodeData>) => void
}) {
  if (!node) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>Select a node to edit its properties</p>
        <p className="text-xs mt-1">Double-click to rename</p>
      </div>
    )
  }

  const d = node.data as unknown as WorkflowNodeData

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          {NODE_TYPE_STYLES[d.nodeType]?.icon}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{d.nodeType}</span>
        </div>

        {/* Label */}
        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={d.label}
            onChange={e => onUpdate(node.id, { label: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        {/* INPUT node fields */}
        {d.nodeType === 'input' && (
          <>
            <div>
              <Label className="text-xs">Variable Name</Label>
              <Input
                value={d.variableName || ''}
                onChange={e => onUpdate(node.id, { variableName: e.target.value })}
                placeholder="e.g. Voltage"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input
                value={d.variableValue || ''}
                onChange={e => onUpdate(node.id, { variableValue: e.target.value })}
                placeholder="e.g. 400"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Input
                value={d.variableUnit || ''}
                onChange={e => onUpdate(node.id, { variableUnit: e.target.value })}
                placeholder="e.g. V"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {/* CALCULATION node fields */}
        {d.nodeType === 'calculation' && (
          <CalculationNodeEditor d={d} nodeId={node.id} equations={equations} onUpdate={onUpdate} />
        )}

        {/* PROCESS node fields */}
        {d.nodeType === 'process' && (
          <div>
            <Label className="text-xs">Operation</Label>
            <Select
              value={d.processOperation || ''}
              onValueChange={val => onUpdate(node.id, { processOperation: val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select operation..." />
              </SelectTrigger>
              <SelectContent>
                {PROCESS_OPERATIONS.map(op => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {op.label} — {op.desc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* DECISION node fields */}
        {d.nodeType === 'decision' && (
          <>
            <div>
              <Label className="text-xs">Variable</Label>
              <Input
                value={d.conditionVar || ''}
                onChange={e => {
                  const varName = e.target.value
                  const op = d.conditionOp || '>'
                  const val = d.conditionVal || '0'
                  onUpdate(node.id, {
                    conditionVar: varName,
                    conditionExpr: `${varName} ${op} ${val}`,
                  })
                }}
                placeholder="e.g. Vd"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Operator</Label>
              <Select
                value={d.conditionOp || '>'}
                onValueChange={val => {
                  const varName = d.conditionVar || 'result'
                  const condVal = d.conditionVal || '0'
                  onUpdate(node.id, {
                    conditionOp: val,
                    conditionExpr: `${varName} ${val} ${condVal}`,
                  })
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_OPERATORS.map(op => (
                    <SelectItem key={op} value={op} className="text-xs font-mono">{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Threshold</Label>
              <Input
                value={d.conditionVal || ''}
                onChange={e => {
                  const varName = d.conditionVar || 'result'
                  const op = d.conditionOp || '>'
                  onUpdate(node.id, {
                    conditionVal: e.target.value,
                    conditionExpr: `${varName} ${op} ${e.target.value}`,
                  })
                }}
                placeholder="e.g. 2.5"
                className="h-8 text-xs"
              />
            </div>
          </>
        )}

        {/* OUTPUT node fields */}
        {d.nodeType === 'output' && (
          <div>
            <Label className="text-xs">Display Label</Label>
            <Input
              value={d.displayValue || ''}
              onChange={e => onUpdate(node.id, { displayValue: e.target.value })}
              placeholder="Result label..."
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* Computed Result Display */}
        {d.computedResult && Object.keys(d.computedResult).length > 0 && (
          <div>
            <Label className="text-xs mb-1 block">Computed Result</Label>
            <div className="px-2 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-mono space-y-0.5">
              {Object.entries(d.computedResult).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="font-bold">{typeof v === 'number' ? v.toFixed(6) : v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

// ──────────────────────────────────────────────
// Equation Palette
// ──────────────────────────────────────────────

function EquationPalette({
  equations,
  onAddCalcNode,
  searchTerm,
  onSearchChange,
}: {
  equations: Record<string, EquationData[]>
  onAddCalcNode: (eq: EquationData) => void
  searchTerm: string
  onSearchChange: (v: string) => void
}) {
  const filteredEquations = React.useMemo(() => {
    if (!searchTerm) return equations
    const filtered: Record<string, EquationData[]> = {}
    for (const [domain, eqs] of Object.entries(equations)) {
      const matches = eqs.filter(eq =>
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      if (matches.length > 0) filtered[domain] = matches
    }
    return filtered
  }, [equations, searchTerm])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search equations..."
          className="h-7 pl-7 text-xs"
        />
      </div>
      <ScrollArea className="h-[calc(100vh-520px)] min-h-[200px]">
        <Accordion type="multiple" defaultValue={Object.keys(equations)} className="w-full">
          {Object.entries(filteredEquations).map(([domain, eqs]) => {
            const ds = DOMAIN_STYLES[domain]
            return (
              <AccordionItem key={domain} value={domain} className="border-b border-border/50">
                <AccordionTrigger className="py-2 px-1 hover:no-underline">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span>{ds?.icon || '📋'}</span>
                    <span className="font-semibold">{domain}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 ml-1">{eqs.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2 px-1">
                  <div className="space-y-1">
                    {eqs.map(eq => (
                      <button
                        key={String(eq.id)}
                        onClick={() => onAddCalcNode(eq)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors group flex items-center justify-between"
                      >
                        <div>
                          <div className="text-[11px] font-medium">{eq.name}</div>
                          {eq.formula && (
                            <div className="text-[9px] font-mono text-muted-foreground truncate max-w-[180px]">{eq.formula}</div>
                          )}
                        </div>
                        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </ScrollArea>
    </div>
  )
}

// ──────────────────────────────────────────────
// Main Workflow Builder Inner Component
// ──────────────────────────────────────────────

function WorkflowBuilderInner() {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = React.useState<Node<WorkflowNodeData> | null>(null)
  const [equations, setEquations] = React.useState<Record<string, EquationData[]>>(BUILTIN_EQUATIONS)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null)
  const [editLabel, setEditLabel] = React.useState('')
  const [sidebarTab, setSidebarTab] = React.useState<'palette' | 'editor'>('palette')

  // Fetch equations from API
  React.useEffect(() => {
    async function fetchEquations() {
      try {
        const res = await fetch('/api/equations?limit=200')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data?.length > 0) {
            // Merge API equations with built-in
            const merged: Record<string, EquationData[]> = { ...BUILTIN_EQUATIONS }
            for (const eq of json.data) {
              const domain = eq.domain || 'Other'
              if (!merged[domain]) merged[domain] = []
              // Don't duplicate
              if (!merged[domain].some(e => e.name === eq.name)) {
                merged[domain].push({
                  id: eq.id,
                  name: eq.name,
                  formula: eq.formula || eq.equation,
                  description: eq.description,
                  category: eq.category || eq.category_name,
                  domain: eq.domain,
                  difficulty: eq.difficulty,
                  tags: eq.tags,
                  inputs: (eq.inputs || []).map((inp: any) => ({
                    name: inp.name,
                    symbol: inp.symbol,
                    unit: inp.unit,
                    default_value: inp.default_value ?? inp.defaultVal,
                    min: inp.min,
                    max: inp.max,
                  })),
                  outputs: (eq.outputs || []).map((out: any) => ({
                    name: out.name,
                    symbol: out.symbol,
                    unit: out.unit,
                    formula: out.formula,
                  })),
                })
              }
            }
            setEquations(merged)
          }
        }
      } catch {
        // Keep built-in equations
      }
    }
    fetchEquations()
  }, [])

  // Handle selection
  const onNodeClick = React.useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<WorkflowNodeData>)
    setSidebarTab('editor')
  }, [])

  const onPaneClick = React.useCallback(() => {
    setSelectedNode(null)
    setSidebarTab('palette')
  }, [])

  // Connection handling
  const onConnect = React.useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: {
          stroke: params.sourceHandle === 'false' ? '#dc2626' : params.sourceHandle === 'true' ? '#16a34a' : '#059669',
          strokeWidth: 2,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      }, eds))
    },
    [setEdges]
  )

  // Node double-click for rename
  const onNodeDoubleClick = React.useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNodeId(node.id)
    setEditLabel((node.data as unknown as WorkflowNodeData).label || '')
  }, [])

  // Keyboard handling
  const onKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editingNodeId) return // Don't delete while editing
      setNodes(nds => nds.filter(n => !n.selected))
      setEdges(eds => eds.filter(e => !e.selected))
    }
  }, [setNodes, setEdges, editingNodeId])

  // Add node helper
  const addNode = React.useCallback((type: WorkflowNodeType, extraData?: Partial<WorkflowNodeData>) => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const labelMap: Record<WorkflowNodeType, string> = {
      input: 'Input',
      calculation: 'Calculation',
      process: 'Process',
      decision: 'Decision',
      output: 'Output',
    }
    const newNode: Node<WorkflowNodeData> = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: {
        label: extraData?.label || labelMap[type],
        nodeType: type,
        ...extraData,
      },
    }
    setNodes(nds => [...nds, newNode])
    return id
  }, [setNodes])

  // Add calculation node from equation
  const addCalcNodeFromEquation = React.useCallback((eq: EquationData) => {
    const defaultInputs: Record<string, string> = {}
    for (const inp of eq.inputs || []) {
      if (inp.default_value !== undefined) defaultInputs[inp.symbol] = String(inp.default_value)
    }
    addNode('calculation', {
      label: eq.name,
      equationId: eq.id,
      equationName: eq.name,
      equationFormula: eq.formula || eq.equation,
      equationInputs: eq.inputs || [],
      equationOutputs: eq.outputs || [],
      inputValues: defaultInputs,
      outputValues: {},
      valueSource: {},
    })
  }, [addNode])

  // Update node data
  const updateNodeData = React.useCallback((id: string, data: Partial<WorkflowNodeData>) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n
      return { ...n, data: { ...(n.data as unknown as WorkflowNodeData), ...data } as any }
    }))
    // Also update selected node reference
    setSelectedNode(prev => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, data: { ...(prev.data as unknown as WorkflowNodeData), ...data } as any }
    })
  }, [setNodes])

  // Clear canvas
  const clearCanvas = React.useCallback(() => {
    setNodes([])
    setEdges([])
    setSelectedNode(null)
  }, [setNodes, setEdges])

  // Load example
  const loadExample = React.useCallback((key: string) => {
    const exNodes = createExampleNodes()[key] || []
    const exEdges = createExampleEdges()[key] || []
    setNodes(exNodes)
    setEdges(exEdges)
    setSelectedNode(null)
  }, [setNodes, setEdges])

  // ──────────────────────────────────────────────
  // Workflow Execution Engine
  // ──────────────────────────────────────────────

  const executeWorkflow = React.useCallback(async () => {
    setIsExecuting(true)

    // Reset all nodes
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...(n.data as unknown as WorkflowNodeData),
        executionStatus: 'idle',
        computedResult: undefined,
        decisionResult: undefined,
      } as any,
    })))

    // Small delay for visual feedback
    await new Promise(r => setTimeout(r, 100))

    // Build a value store
    const valueStore: Record<string, number> = {}
    const nodeResults: Record<string, Record<string, number>> = {}

    // Topological sort
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const inDegree = new Map<string, number>()
    const adj = new Map<string, string[]>()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adj.set(node.id, [])
    }
    for (const edge of edges) {
      adj.get(edge.source)?.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const execOrder: string[] = []
    while (queue.length > 0) {
      const curr = queue.shift()!
      execOrder.push(curr)
      for (const next of adj.get(curr) || []) {
        inDegree.set(next, (inDegree.get(next) || 0) - 1)
        if (inDegree.get(next) === 0) queue.push(next)
      }
    }

    // Execute in order
    for (const nodeId of execOrder) {
      const node = nodeMap.get(nodeId)
      if (!node) continue
      const d = node.data as unknown as WorkflowNodeData

      // Gather incoming values from connected edges
      const incomingEdges = edges.filter(e => e.target === nodeId)
      const incomingValues: Record<string, number> = {}

      for (const edge of incomingEdges) {
        const sourceResults = nodeResults[edge.source]
        if (sourceResults) {
          // If source handle specifies an output symbol, use it
          if (edge.sourceHandle?.startsWith('out-')) {
            const sourceSymbol = edge.sourceHandle.replace('out-', '')
            const sourceVal = sourceResults[sourceSymbol]
            if (sourceVal !== undefined) {
              // Map to the target handle's symbol, or the source symbol if generic
              if (edge.targetHandle?.startsWith('in-')) {
                const targetSymbol = edge.targetHandle.replace('in-', '')
                incomingValues[targetSymbol] = sourceVal
              } else {
                incomingValues[sourceSymbol] = sourceVal
              }
            }
          } else if (edge.targetHandle?.startsWith('in-')) {
            const symbol = edge.targetHandle.replace('in-', '')
            const sourceVals = Object.values(sourceResults)
            if (sourceVals.length > 0) {
              incomingValues[symbol] = sourceVals[0]
              for (const [k, v] of Object.entries(sourceResults)) {
                if (k === symbol) {
                  incomingValues[symbol] = v
                  break
                }
              }
            }
          } else {
            Object.assign(incomingValues, sourceResults)
          }
        }
      }

      let results: Record<string, number> = {}

      switch (d.nodeType) {
        case 'input': {
          const val = parseFloat(d.variableValue || '0')
          if (!isNaN(val) && d.variableName) {
            results[d.variableName] = val
            valueStore[d.variableName] = val
          }
          results['value'] = val
          break
        }
        case 'calculation': {
          const eqInputs = d.equationInputs || []
          const eqOutputs = d.equationOutputs || []
          const inputVals: Record<string, number> = {}

          // Use input values from the node editor, overridden by incoming connections
          for (const inp of eqInputs) {
            const manualVal = d.inputValues?.[inp.symbol]
            const defaultVal = inp.default_value
            if (incomingValues[inp.symbol] !== undefined) {
              inputVals[inp.symbol] = incomingValues[inp.symbol]
            } else if (manualVal !== undefined && manualVal !== '') {
              const parsed = parseFloat(manualVal)
              if (!isNaN(parsed)) inputVals[inp.symbol] = parsed
            } else if (defaultVal !== undefined && defaultVal !== '') {
              const parsed = parseFloat(String(defaultVal))
              if (!isNaN(parsed)) inputVals[inp.symbol] = parsed
            }
          }

          // Also add any extra incoming values
          Object.assign(inputVals, incomingValues)

          // Compute each output formula
          if (eqOutputs.length > 0) {
            for (const out of eqOutputs) {
              if (out.formula) {
                try {
                  const val = clientEvaluateFormula(out.formula, { ...valueStore, ...inputVals })
                  results[out.symbol] = val
                } catch {
                  results[out.symbol] = 0
                }
              }
            }
          } else if (d.equationFormula) {
            // Try evaluating the formula directly
            try {
              const val = clientEvaluateFormula(d.equationFormula, { ...valueStore, ...inputVals })
              results['result'] = val
            } catch {
              results['result'] = 0
            }
          }

          // Store all results in value store
          Object.assign(valueStore, results)
          break
        }
        case 'process': {
          const vals = Object.values(incomingValues)
          const op = d.processOperation || 'sum'
          switch (op) {
            case 'sum': results['result'] = vals.reduce((a, b) => a + b, 0); break
            case 'average': results['result'] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; break
            case 'min': results['result'] = vals.length > 0 ? Math.min(...vals) : 0; break
            case 'max': results['result'] = vals.length > 0 ? Math.max(...vals) : 0; break
            case 'count': results['result'] = vals.length; break
            case 'multiply': results['result'] = vals.reduce((a, b) => a * b, 1); break
            case 'divide': results['result'] = vals.length >= 2 ? vals[0] / vals[1] : 0; break
            case 'sort': results['result'] = vals.length; results['sorted'] = JSON.stringify([...vals].sort((a, b) => a - b)) as any; break
            case 'filter': results['result'] = vals.filter(v => v > 0).length; break
            default: results['result'] = 0
          }
          Object.assign(valueStore, results)
          break
        }
        case 'decision': {
          // Get the variable value to check
          const varName = d.conditionVar || ''
          const op = d.conditionOp || '>'
          const threshold = parseFloat(d.conditionVal || '0')
          const varValue = incomingValues[varName] ?? valueStore[varName] ?? 0

          let passed = false
          switch (op) {
            case '>': passed = varValue > threshold; break
            case '<': passed = varValue < threshold; break
            case '>=': passed = varValue >= threshold; break
            case '<=': passed = varValue <= threshold; break
            case '==': passed = varValue === threshold; break
            case '!=': passed = varValue !== threshold; break
          }
          results = { [varName || 'value']: varValue, threshold, passed: passed ? 1 : 0 }
          valueStore[`${nodeId}_decision`] = passed ? 1 : 0

          // Update decision result
          setNodes(nds => nds.map(n => {
            if (n.id !== nodeId) return n
            return {
              ...n,
              data: {
                ...(n.data as unknown as WorkflowNodeData),
                computedResult: results,
                decisionResult: passed,
                executionStatus: 'success',
              } as any,
            }
          }))
          break
        }
        case 'output': {
          results = { ...incomingValues }
          Object.assign(valueStore, results)
          break
        }
      }

      nodeResults[nodeId] = results

      // Update node with results (except decision which is handled above)
      if (d.nodeType !== 'decision') {
        // For calculation nodes, also update outputValues and valueSource
        const extraUpdate: Partial<WorkflowNodeData> = {}
        if (d.nodeType === 'calculation') {
          const newOutputVals: Record<string, string> = { ...(d.outputValues || {}) }
          const newInputVals: Record<string, string> = { ...(d.inputValues || {}) }
          const newSources: Record<string, 'manual' | 'auto' | 'propagated'> = { ...(d.valueSource || {}) }

          for (const [k, v] of Object.entries(results)) {
            newOutputVals[k] = parseFloat(v.toFixed(6)).toString()
            newSources[k] = 'auto'
          }

          // Mark propagated inputs
          for (const inp of (d.equationInputs || [])) {
            if (incomingValues[inp.symbol] !== undefined) {
              newInputVals[inp.symbol] = parseFloat(incomingValues[inp.symbol].toFixed(6)).toString()
              newSources[inp.symbol] = 'propagated'
            }
          }

          extraUpdate.outputValues = newOutputVals
          extraUpdate.inputValues = newInputVals
          extraUpdate.valueSource = newSources
        }

        setNodes(nds => nds.map(n => {
          if (n.id !== nodeId) return n
          return {
            ...n,
            data: {
              ...(n.data as unknown as WorkflowNodeData),
              computedResult: results,
              executionStatus: 'success' as const,
              ...extraUpdate,
            } as any,
          }
        }))
      }

      // Small delay for visual step-by-step execution
      await new Promise(r => setTimeout(r, 150))
    }

    setIsExecuting(false)
  }, [nodes, edges, setNodes])

  // Auto-link same-symbol inputs
  const autoLink = React.useCallback(() => {
    const newEdges: Edge[] = []
    // For each calculation/process/decision node, find matching input symbols from upstream nodes
    for (const targetNode of nodes) {
      const d = targetNode.data as unknown as WorkflowNodeData
      if (d.nodeType === 'input' || d.nodeType === 'output') continue

      const targetInputs = d.equationInputs || []
      const targetVar = d.conditionVar

      for (const sourceNode of nodes) {
        if (sourceNode.id === targetNode.id) continue
        const sd = sourceNode.data as unknown as WorkflowNodeData
        const sourceOutputs = sd.equationOutputs || []

        // Check if source outputs match target inputs by symbol
        for (const out of sourceOutputs) {
          for (const inp of targetInputs) {
            if (out.symbol === inp.symbol) {
              const edgeId = `auto-${sourceNode.id}-${targetNode.id}-${out.symbol}`
              const exists = edges.some(e => e.source === sourceNode.id && e.target === targetNode.id && e.sourceHandle === `out-${out.symbol}` && e.targetHandle === `in-${inp.symbol}`)
              if (!exists) {
                newEdges.push({
                  id: edgeId,
                  source: sourceNode.id,
                  target: targetNode.id,
                  sourceHandle: `out-${out.symbol}`,
                  targetHandle: `in-${inp.symbol}`,
                  animated: true,
                  style: { stroke: '#059669', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                })
              }
            }
          }

          // For decision nodes, match condition variable
          if (targetVar && out.symbol === targetVar && d.nodeType === 'decision') {
            const edgeId = `auto-${sourceNode.id}-${targetNode.id}-decision`
            const exists = edges.some(e => e.source === sourceNode.id && e.target === targetNode.id && e.sourceHandle === `out-${out.symbol}`)
            if (!exists) {
              newEdges.push({
                id: edgeId,
                source: sourceNode.id,
                target: targetNode.id,
                sourceHandle: `out-${out.symbol}`,
                targetHandle: 'input',
                animated: true,
                style: { stroke: '#059669', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              })
            }
          }
        }

        // INPUT nodes output their variable name
        if (sd.nodeType === 'input' && sd.variableName) {
          for (const inp of targetInputs) {
            if (sd.variableName === inp.symbol) {
              const edgeId = `auto-${sourceNode.id}-${targetNode.id}-${inp.symbol}`
              const exists = edges.some(e => e.source === sourceNode.id && e.target === targetNode.id)
              if (!exists) {
                newEdges.push({
                  id: edgeId,
                  source: sourceNode.id,
                  target: targetNode.id,
                  sourceHandle: 'output',
                  targetHandle: `in-${inp.symbol}`,
                  animated: true,
                  style: { stroke: '#059669', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                })
              }
            }
          }

          // Match decision variable
          if (targetVar && sd.variableName === targetVar && d.nodeType === 'decision') {
            const edgeId = `auto-${sourceNode.id}-${targetNode.id}-decision`
            const exists = edges.some(e => e.source === sourceNode.id && e.target === targetNode.id)
            if (!exists) {
              newEdges.push({
                id: edgeId,
                source: sourceNode.id,
                target: targetNode.id,
                sourceHandle: 'output',
                targetHandle: 'input',
                animated: true,
                style: { stroke: '#059669', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              })
            }
          }
        }
      }
    }

    if (newEdges.length > 0) {
      setEdges(eds => [...eds, ...newEdges])
    }
  }, [nodes, edges, setEdges])

  // Node rename submit
  const submitRename = React.useCallback(() => {
    if (editingNodeId && editLabel.trim()) {
      updateNodeData(editingNodeId, { label: editLabel.trim() })
    }
    setEditingNodeId(null)
    setEditLabel('')
  }, [editingNodeId, editLabel, updateNodeData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5 text-emerald-600" />
            Workflow Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Build visual engineering calculation workflows with drag-and-drop
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoLink}
                  className="gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Auto-Link
                </Button>
              </TooltipTrigger>
              <TooltipContent>Auto-link matching symbols</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="default"
            size="sm"
            onClick={executeWorkflow}
            disabled={isExecuting || nodes.length === 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className="h-3.5 w-3.5" />
            {isExecuting ? 'Running...' : 'Run All'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Examples
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {EXAMPLES.map(ex => (
                <DropdownMenuItem key={ex.key} onClick={() => loadExample(ex.key)} className="flex items-start gap-2 py-2">
                  <span className="text-base mt-0.5">{ex.icon}</span>
                  <div>
                    <div className="text-sm font-medium">{ex.label}</div>
                    <div className="text-[10px] text-muted-foreground">{ex.desc}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-[260px_1fr_240px] gap-4">
        {/* Left sidebar - Palette + Node Types */}
        <div className="space-y-3">
          {/* Add Node buttons */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Nodes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {([
                { type: 'input' as WorkflowNodeType, desc: 'Data input' },
                { type: 'calculation' as WorkflowNodeType, desc: 'Engineering calc' },
                { type: 'process' as WorkflowNodeType, desc: 'Data processing' },
                { type: 'decision' as WorkflowNodeType, desc: 'Condition check' },
                { type: 'output' as WorkflowNodeType, desc: 'Result display' },
              ]).map(({ type, desc }) => {
                const style = NODE_TYPE_STYLES[type]
                return (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => addNode(type)}
                  >
                    <span className={`mr-1.5 ${style.color}`}>{style.icon}</span>
                    <span className="font-medium capitalize">{type}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">{desc}</span>
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          {/* Equation Palette */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Equations
              </CardTitle>
              <CardDescription className="text-[10px]">Click to add calculation node</CardDescription>
            </CardHeader>
            <CardContent>
              <EquationPalette
                equations={equations}
                onAddCalcNode={addCalcNodeFromEquation}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Canvas Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>• Drag nodes to reposition</p>
                <p>• Click port → click port to connect</p>
                <p>• Select + Delete key to remove</p>
                <p>• Double-click to rename</p>
                <p>• Scroll to zoom, drag to pan</p>
              </div>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nodes</span>
                  <div className="font-bold">{nodes.length}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Links</span>
                  <div className="font-bold">{edges.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas */}
        <Card className="overflow-hidden">
          <div className="h-[calc(100vh-280px)] min-h-[400px]" onKeyDown={onKeyDown} tabIndex={0}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-muted/30"
              deleteKeyCode={['Backspace', 'Delete']}
              snapToGrid
              snapGrid={[10, 10]}
              connectionLineStyle={{ stroke: '#059669', strokeWidth: 2 }}
              defaultEdgeOptions={{
                animated: true,
                style: { stroke: '#059669', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              }}
            >
              <Background color="#aaa" gap={16} size={1} />
              <Controls className="!bg-background !border-border !shadow-md" />
              <MiniMap
                className="!bg-background !border-border !shadow-md"
                nodeColor={(node) => {
                  const nt = (node.data as unknown as WorkflowNodeData)?.nodeType
                  switch (nt) {
                    case 'input': return '#059669'
                    case 'calculation': return '#d97706'
                    case 'process': return '#2563eb'
                    case 'decision': return '#ea580c'
                    case 'output': return '#e11d48'
                    default: return '#6b7280'
                  }
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          </div>
        </Card>

        {/* Right sidebar - Node Editor */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={sidebarTab === 'palette' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSidebarTab('palette')}
              >
                Equations
              </Button>
              <Button
                variant={sidebarTab === 'editor' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSidebarTab('editor')}
              >
                Properties
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sidebarTab === 'editor' ? (
              <NodeEditorPanel
                node={selectedNode}
                equations={equations}
                onUpdate={updateNodeData}
              />
            ) : (
              <EquationPalette
                equations={equations}
                onAddCalcNode={addCalcNodeFromEquation}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inline rename dialog */}
      {editingNodeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={submitRename}>
          <Card className="w-72" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rename Node</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setEditingNodeId(null); setEditLabel('') } }}
                autoFocus
                className="h-8 text-sm"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={submitRename} className="flex-1">Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingNodeId(null); setEditLabel('') }} className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}

// ──────────────────────────────────────────────
// Exported Component with ReactFlowProvider
// ──────────────────────────────────────────────

export function WorkflowBuilderSection() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  )
}
