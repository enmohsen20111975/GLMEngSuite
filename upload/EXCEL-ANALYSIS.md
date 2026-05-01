# Excel Sheets Analysis - GLMEngSuite Data & Feature Extraction

## Summary of Findings

10 Excel spreadsheets contain **massive engineering data** and **100+ formulas** that can add **6 new pipeline calculators** and **enrich existing features** with real lookup tables.

---

## 1. CABLE VOLTAGE DROP CALCULATOR ⚡

### Current App Status: PARTIALLY COVERED (LV Cable Sizing pipeline has basic VD step)

### New Data Available:
- **278-row cable detail table** with Resistance (Ω/km) and Reactance (Ω/km) for:
  - **Aluminum & Copper** conductors
  - **PVC & XLPE** insulation types
  - 1c, 2c, 3c, 3.5c, 4c configurations
  - Sizes: 1.5mm² to 1000mm²
  - Air ampacity ratings for each size
  - Short circuit current ratings (1-second) for ALU & CU

### Key Formulas Extracted:
```
Total Length = Length × No. of Cables per Run
Total Load = Lighting Load + Motor Load
Starting Current (Lighting) = Lighting Load / (√3 × Voltage × Starting PF) × 1000
Starting Current (Motor) = (Motor Load / (√3 × Voltage × Running PF)) × 1000 × Lock Rotor Multiplier
Full Load Current = Total Load / (√3 × Voltage × Running PF) × 1000
Voltage Drop (Starting) = √3 × I_start × (R×cosφ_start + X×sinφ_start) × (Length/1000) / No. of Runs
Voltage Drop (Running) = √3 × I_run × (R×cosφ_run + X×sinφ_run) × (Length/1000) / No. of Runs
% Regulation = Voltage Drop / Supply Voltage
```

### New Features Possible:
- Multi-cable-run voltage drop calculation
- Starting vs Running condition analysis
- ALU/CU conductor material selection
- Lookup-based R/X values instead of simplified ρ/A formula
- Voltage drop accumulation across cascaded cables

---

## 2. CABLE TRUNKING SIZE CALCULATOR 🔧

### Current App Status: NOT IMPLEMENTED

### New Data Available:
- **Cable Factor Table** (IEEE) - 15 entries:
  - Solid: 1.5mm² (7.1), 2.5mm² (10.2)
  - Stranded: 1.5mm² (8.1), 2.5mm² (11.4), 4mm² (15.2), 6mm² (22.9), 10mm² (36.3), 16mm² (50.3), 25mm² (75.4), 35mm² (95), 50mm² (132.7), 70mm² (176.7), 95mm² (227), 120mm² (284), 150mm² (346)

- **Trunking Factor Table** (IEEE) - 10+ entries:
  - 75×25mm → 738, 50×37.5mm → 767, 100×50mm → 993, 50×50mm → 1037
  - 75×37.5mm → 1146, 100×37.5mm → 1542, 75×50mm → 1555, 100×50mm → 2091

### Key Formulas Extracted:
```
Cable Factor = lookup(Cable Type, Cable Size)
Total Cable Factor = Σ (Cable Factor × No. of Cables)
Total After Expansion = Total Cable Factor × (1 + Future Expansion %)
Selected Trunking = smallest trunking where Factor ≥ Total After Expansion
```

### New Pipeline: Cable Trunking Sizing
- Input: cable list (type, size, quantity), expansion factor
- Output: recommended trunking size with fill percentage

---

## 3. CONDUIT SIZE CALCULATOR 🔩

### Current App Status: NOT IMPLEMENTED

### New Data Available:
- Conduit sizing logic per NEC

### Key Formulas Extracted:
```
Total Cable Area = Σ (π × (Outer Dia/2)² × No. of Cables)
Conduit Area = π × (Conduit Dia/2)²
Fill Up % = 40% (NEC standard for 3+ cables)
Fill Up Area = Conduit Area × Fill Up %
Required Conduits = ⌈Total Cable Area / Fill Up Area⌉
```

### New Pipeline: Conduit Sizing
- Input: cable list with outer diameters, conduit size
- Output: fill ratio, required number of conduits, compliance check

---

## 4. INDOOR LIGHTING DESIGN CALCULATOR 💡

### Current App Status: NOT IMPLEMENTED

### Two Calculation Methods Available:

#### Method 1: Sq.Ft Area Method
```
Required Fixtures = ⌈(Area × Footcandles) / (Lumens × Ballast Factor × No. Lamps × CU)⌉
Required Lamps = Fixtures × Lamps per Fixture
Fixture Spacing = √(Area / Fixtures)
Total kW = (Fixtures × Watts) / 1000
Watts/Sq.Ft = (Total kW × 1000) / Area
Energy Cost/Year = Total kW × Burning Hours × Energy Rate
```

#### Method 2: Lumen/Lux Method (Room Index)
```
Room Index K = (L × W) / (Hm × (L + W))
Utilization Factor = lookup(Room Index, Ceiling Reflection, Wall Reflection, Floor Reflection)
Maintenance Factor = lookup(Condition: Good=0.7-0.8, Average=0.6-0.7, Poor=0.5-0.6)
Required Fixtures = (E × L × W) / (F × n × UF × MF)
Fixtures Along Length = √(Fixtures × L/W)
Fixtures Across Width = √(Fixtures × W/L)
```

### New Data Available:
- Reflection factor tables (ceiling, wall, floor)
- Utilization factor lookup tables
- Maintenance factor ranges by condition

### New Pipeline: Indoor Lighting Design
- Input: room dimensions, required lux, fixture specs, reflection factors
- Output: fixture count, spacing, total load, energy cost

---

## 5. LOAD SCHEDULE (جدول الاحمال) 📋

### Current App Status: NOT IMPLEMENTED

### Multi-Panel Schedule Data Available:
- **6 panel types**: LP1-4 (typical floor), LPB (basement), LPG1-3 (ground shops), LPR (roof), MDP (main distribution)
- Complete schedule format per panel:
  - Load description, circuit number
  - Breaker: poles, AT rating
  - Points: number of points, VA per point
  - Phase load: R, Y, B (3-phase distribution)
  - Conductor: phase size, ground size
  - Conduit diameter

### Key Formulas Extracted:
```
Phase Load (VA) = No. of Points × VA per Point
Total Phase Load = Σ R + Σ Y + Σ B
Demand Load (kVA) = Total × Demand Factor / 1000
20% Spare Load = Demand Load × 0.2
Max Demand Load = Demand Load + Spare Load
Max Demand Current = Max Demand Load / (√3 × Voltage)
```

### New Feature: Load Schedule Generator
- Multi-panel support with cascading from MDP
- Automatic phase balancing (R/Y/B distribution)
- Demand factor application per panel type
- Feeder and main breaker sizing
- Conductor selection per circuit

---

## 6. CABLE CSA & BREAKER SELECTION 🔌

### Current App Status: PARTIALLY COVERED (cable sizing exists, breaker selection missing)

### New Data Available:

**XLPE Cable Library** (14 sizes: 4mm² to 300mm²):
- Current ratings: Ground, Ducts, Air
- mV/A/m values for voltage drop

**PVC Cable Library** (14 sizes: 4mm² to 300mm²):
- Current ratings: Ground, Ducts, Air
- mV/A/m values

**Transformer Library** (8 sizes: 315 to 2500 kVA):
- kVA vs Impedance %

### Key Formulas Extracted:
```
Design Current Ib = Max. Demand kW / (√3 × kV × PF)
Correction Factor CF = Ca × Cg × Cf × Ci
Target Ampacity It = Ib / CF
Cable Size = smallest size where CCC ≥ It
Derated Ampacity Iz = CCC × CF
S.C.C. Receiving End Impedance = SE Impedance + Cable Impedance
S.C.C. Receiving End (kA) = kV × 1000 / (√3 × R.E. Impedance in mΩ)
Voltage Drop = mV/A/m × Ib × L / (1000 × No. of Runs)
Accumulated VD = VD of cable + VD of upstream cable
Design SUCCEED if: Iz ≥ In AND VD ≤ 2.5% AND CCC ≥ S.C. rating
```

### New Pipeline: Cable & Breaker Selection (IEC/EEC/Egyptian Code)
- Input: source, destination, route type, load data, transformer data
- Steps: Design Current → Breaker Sizing → Cable Selection (with derating) → S.C. Check → VD Check → Pass/Fail

---

## 7. BUSBAR SIZE CALCULATOR ⚡

### Current App Status: NOT IMPLEMENTED

### 8 Derating Factors Available:
| Factor | Description | Values |
|--------|-------------|--------|
| K1 | Bus strips per phase | 1-3 strips (0.05-0.2 e/a ratio) |
| K2 | Insulating material | Bare=1.0, PVC=1.2, Painted=1.5 |
| K3 | Busbar position | Edge=1.0, Base 1-bar=0.95, Base several=0.75 |
| K4 | Installation media | Calm indoor=1.0, Calm outdoor=1.2, Non-vent duct=0.8 |
| K5 | Artificial ventilation | Without=0.9, With=1.0 |
| K6 | Enclosure/ventilation | 0.5-0.65 based on enclosure ratio |
| K7 | Proxy effect | 1-4 bars: 0.82-0.89 |
| K8 | Altitude | 2200m=0.88 → 5000m=0.74 |

### Key Formulas Extracted:
```
Total Derating Factor = K1 × K2 × K3 × K4 × K5 × K6 × K7 × K8
I1 (after derating) = I2 / Total Derating Factor
Cross Section (current) = I1 / Current Density
Cross Section (S.C.) = Isc × √t / K_material
Final Area = max(CS_current, CS_SC)
Forces on insulators F = F1 × (support spacing / 100)
Mechanical strength check: F ≤ F' (permissible insulator strength)
Temperature rise check: θt ≤ max allowed
```

### New Pipeline: Busbar Sizing
- Input: current rating, fault current, fault duration, temperature, 8 derating factors
- Output: busbar cross-section, mechanical strength check, temperature rise check

---

## 8. STAR DELTA & DOL STARTER 🔧

### Current App Status: NOT IMPLEMENTED

### Two Motor Types Supported:
- **1-Phase Synchronous** (DOL starter)
- **3-Phase Induction** (Star-Delta starter)

### Key Formulas Extracted:
```
Motor kW = HP × 0.746
Rated Torque (lb-ft) = 5252 × HP / RPM
Rated Torque (Nm) = 9500 × kW / RPM
Starting Torque = 3 × Rated Torque (if kW < 30kW) else 2 × Rated Torque
Lock Rotor Current (Min) = 1000 × HP × Code_Min / (√3 × Voltage) [3-phase]
Lock Rotor Current (Max) = 1000 × HP × Code_Max / (√3 × Voltage) [3-phase]
Starting Current = 6-7 × FL Current (DOL) or 3 × FL Current (Star-Delta)
Full Load Current = kW × 1000 / (√3 × Voltage × PF) [3-phase]
Phase Current = FL Current / √3 (Star-Delta)

Fuse (Non-Time Delay, Max) = 3 × FL Current (NEC 430-52)
Fuse (Time Delay, Max) = 1.75 × FL Current (NEC 430-52)

OL Relay (in line) = FL Current × 0.58 (Star-Delta)
OL Relay (in winding) = FL Current × 0.58
Main Contactor = FL Current × 1.2
Delta Contactor = FL Current × 0.58
Star Contactor = FL Current × 0.33
```

### New Data Available:
- **Standard Motor Ratings Table** (29 sizes: 0.18kW to 200kW)
  - Full load PF, 3/4th PF, Full load efficiency, 3/4th efficiency
- **Cable Current Rating Table** (29 sizes, 5 insulation types)
  - PVC (AL/CU), HRPVC (AL/CU), LT XLPE (AL/CU), HT XLPE (CU), EPR CSP (CU)
- **Motor Code Letters** (A-V) with locked rotor kVA/HP ranges
- **Contactor Configuration Reference** (NO/NC terminal assignments)

### New Pipeline: Motor Starter Sizing
- Input: motor type, size (HP/kW), RPM, voltage, PF, code letter
- Output: starter type recommendation, component sizing (contactor, OLR, fuse, cables)

---

## 9. MAIN CB & BRANCH CB SELECTION 🔌

### Current App Status: NOT IMPLEMENTED

### Key Features Available:
- Branch circuit breaker selection (RCB, MCCB, MCB, RCCB, ELCB, RCBO)
- Cable selection per branch circuit
- Maximum circuit length calculation
- Load type classification (Lighting, Heater, Drive, Motor, Ballast, AC, Inductive)

### New Data Available:
- **MCCB/ELCB standard sizes**: 0.5A to 6000A
- **Cable maximum lengths** for Cu/Al conductors per CB type (B, C, D)
- **Demand/Utilization factors** by load type
- **Cable sizing reference** per NEC (AWG and mm²)

### Key Formulas:
```
Branch CB = select based on load type and calculated current
Cable Size = lookup(MCCB rating, cable table)
Max Circuit Length = lookup(CB type, CB rating, cable size)
Demand Factor by load type: Motor=0.6, Lighting=1.0, Heating=1.0, Power Socket=2.0
Utilization Factor: Motor=0.75, Lighting=1.0
ISC at point ≈ kVA_transformer / (√3 × kV × Impedance%)
```

### New Pipeline: CB & Branch Circuit Selection
- Input: transformer data, load list with types
- Output: main CB selection, branch CB per circuit, cable sizes, max lengths

---

## 10. CABLE TRAY SIZING 📐

### Current App Status: NOT IMPLEMENTED

### Key Features Available:
- Cable entry with OD and weight
- Tray fill calculation per NEC
- Minimum tray width selection
- Tray depth specification

### Key Formulas:
```
Sum of OD = Σ (Cable OD × Qty)
Sum of Area = Σ (π × (OD/2)² × Qty)
Total Weight = Σ (Weight per ft × Qty)
Min Tray Width = based on NEC fill rules for cable type and tray depth
```

### New Pipeline: Cable Tray Sizing (NEC)
- Input: cable list (ID, size, quantity, OD, weight), tray depth
- Output: minimum tray width, total weight, NEC article reference

---

## PRIORITY RANKING FOR IMPLEMENTATION

| Priority | Pipeline | Impact | Complexity | Data Richness |
|----------|----------|--------|------------|---------------|
| 🔴 HIGH | Load Schedule Generator | Essential for any electrical project | Medium | Very High |
| 🔴 HIGH | Cable & Breaker Selection (IEC) | Core electrical design | Medium | Very High |
| 🟡 MEDIUM | Indoor Lighting Design | Common design task | Low | High |
| 🟡 MEDIUM | Busbar Sizing | Panel design essential | High | High |
| 🟡 MEDIUM | Motor Starter Sizing (DOL/Star-Delta) | Motor applications | Medium | High |
| 🟢 LOW | Cable Trunking Sizing | Supplementary | Low | Medium |
| 🟢 LOW | Conduit Sizing | Supplementary | Low | Low |
| 🟢 LOW | Cable Tray Sizing | Supplementary | Low | Medium |
| 🟢 LOW | CB & Branch Circuit Selection | Advanced coordination | High | High |

---

## REFERENCE DATA TO ADD TO APP

### Cable Impedance Tables (for Voltage Drop accuracy):
- 278 entries: size, conductor type, insulation, R (Ω/km), X (Ω/km), ampacity, S.C. rating

### Motor Standard Data:
- 29 standard motor sizes with PF and efficiency at full and 3/4 load

### Derating Factor Tables:
- Busbar: 8 derating factor lookup tables
- Cable: ambient temp, grouping, installation method

### Trunking & Conduit Tables:
- Cable factors (15 entries)
- Trunking factors (10+ entries)

### Protection Device Tables:
- MCCB/ELCB sizes (0.5A to 6000A)
- Motor code letters with kVA/HP ranges
- Fuse multipliers per NEC 430-52
