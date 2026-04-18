# EngiSuite Analytics — Project Status File

> **Purpose**: This file serves as persistent memory for the project. All agents must read this before starting work and update it after completing tasks. This prevents re-reading and repeating work.

**Last Updated**: 2025-04-18
**Current Phase**: Rebuild from Original Repo with sql.js

---

## 1. Project Overview

**EngiSuite Analytics** is an engineering calculation platform rebuilt from the original Express.js + React (Vite) repository as Next.js 16 with App Router.

- **Original Repo**: `/home/z/EngiSuite-Analytics-original/` (Express + React/Vite + Prisma/MySQL + sql.js/SQLite)
- **New Project**: `/home/z/my-project/` (Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + sql.js)
- **Uploaded Databases**: `/home/z/my-project/upload/Databases_extracted/Databases/`

### Key Decision: sql.js instead of better-sqlite3
- better-sqlite3 requires native compilation (node-gyp) → fails on Hostinger shared hosting
- sql.js is WebAssembly-based → no native compilation → works everywhere
- Original repo already uses sql.js for courses.db and workflows.db

---

## 2. Uploaded Database Contents (SOURCE OF TRUTH)

### engmastery.db (courses database)
- **disciplines**: 5 rows (electrical, mechanical, civil, chemical, hvac)
- **chapters**: 20 rows (grouped by discipline)
- **lessons**: 22 rows (with articles, simulations, practice problems)
- **articles**: 3 rows (full HTML content)
- **simulations**: 0 rows
- **practice_problems**: 0 rows

### courses.db (learning courses database)
- **courses**: 6 rows (electrical, mechanical, civil, chemical, hvac, thermodynamics)
- **modules**: 65 rows
- **chapters**: 247 rows
- **lessons**: 1211 rows (with full markdown content and type: reading/interactive)
- **quizzes**: 1211 rows (JSON questions with options and explanations)

### workflows.db (main engineering database)
- **equation_categories**: 20 rows (electrical, mechanical, civil, chemical, hvac, etc.)
- **equations**: 450 rows (with formula, latex, tags, domain)
- **equation_inputs**: 14 rows
- **equation_outputs**: 4 rows
- **engineering_standards**: 32 rows (IEC, NEC, EN standards)
- **standard_coefficients**: 40 rows (derating tables, temperature corrections)
- **calculation_pipelines**: 56 rows (cable sizing, PF correction, beam design, HVAC, etc.)
- **calculation_steps**: 189 rows (with formulas, input/output config as JSON)
- **calculation_dependencies**: 256 rows
- **report_templates**: 6 rows
- **workflow_categories**: 3 rows
- **calculation_executions**: 2 rows

### users.db (user/auth database)
- **users**: 0 rows (empty)
- Many tables for auth, subscriptions, projects, etc. (all empty)

---

## 3. Original Repo Features (Must All Be Rebuilt)

### 3.1 Backend Features (from original Express server)
| Feature | Original Route | Description |
|---------|---------------|-------------|
| Equations/Calculators | `/api/equations` | 450 equations with inputs/outputs, solve with mathjs |
| Pipelines | `/api/pipelines` | 56 calculation pipelines with 189 steps |
| Local Pipelines | `/api/local-pipelines` | Hardcoded engineering pipelines with calculate() functions |
| Calculation Engine | CalculationEngine class | DAG-based execution, formula evaluation, standards lookup |
| Workflows | `/api/workflows` | Visual workflow builder with categorized nodes |
| Learning/Courses | `/api/learning` | Courses, modules, chapters, lessons, quizzes |
| Analytics | `/api/analytics` | Data analysis, datasets |
| VDA (Visual Data Analysis) | `/api/vda` | File upload, query builder, report/dashboard builder |
| PDF Editor | Canvas-based | PDF editing functionality |
| Logic Simulator | Canvas-based | Digital logic gate simulator |
| Electrical Simulator | Canvas-based | Circuit simulator with components |
| Hydraulic Simulator | Canvas-based | Hydraulic system simulator |
| Diagram Studio | Canvas-based | General diagram/canvas tool |
| Report Generator | ReportGenerator service | HTML/PDF report generation |
| Canvas States | `/api/canvas` | Save/load canvas states |
| Projects | `/api/projects` | Project management |
| ~~AI Assistant~~ | ~~`/api/ai`~~ | **REMOVE - user cannot use AI** |

### 3.2 Frontend Pages (from original React frontend)
| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/dashboard` | Basic version exists |
| Calculators | `/calculators` | Basic version exists |
| Scientific Calculator | `/engineering-calculator` | MISSING |
| Pipelines | `/pipelines` | Basic version exists (missing local pipelines) |
| Visual Workflow | `/visual-workflow` | Basic version exists (missing categorized functions) |
| Cable Sizing | `/cable-sizing` | MISSING (use local pipeline) |
| Reports | `/reports` | MISSING |
| Learning | `/learning` | Basic version exists (missing full content) |
| Unit Converter | `/unit-converter` | Exists |
| Logic Simulator | `/logic-simulator` | MISSING (needs wiring fix) |
| PDF Editor | `/pdf-editor` | MISSING |
| Data Analysis | `/data-analysis` | MISSING |
| Data Upload | `/data-upload` | MISSING |
| Visual Query Builder | `/visual-query-builder` | MISSING |
| Visual Report Builder | `/visual-report-builder` | MISSING |
| Visual Dashboard Builder | `/visual-dashboard-builder` | MISSING |
| Diagram Studio | `/diagram-studio` | MISSING |
| Electrical Simulator | `/simulators/electrical` | MISSING |
| Hydraulic Simulator | `/simulators/hydraulic` | MISSING |
| Fluid Simulator | `/simulators/fluid` | MISSING |
| ~~AI Assistant~~ | ~~`/ai-assistant`~~ | **REMOVE** |
| Settings | `/settings` | Basic version exists |

### 3.3 Engineering Calculation Functions (from CalculationEngine)
Available in formulas: sqrt, sin, cos, tan, asin, acos, atan, log, ln, exp, pow, abs, round, ceil, floor, max, min, sum, avg, select_cable, select_standard_size, next_standard_size, apply_demand_factor, lookup_cu_table, voltage_drop, pf_correction_capacitor, three_phase_power, short_circuit_current, beam_deflection, bending_stress, shear_stress, reynolds_number, darcy_friction_factor, pressure_drop, heat_transfer_coefficient

### 3.4 Local Engineering Pipelines (hardcoded with calculate() functions)
1. **LV Cable Sizing** (4 steps): Load Analysis → Cable Selection → Voltage Drop → Short-Circuit Check
2. **Power Factor Correction** (3 steps): Existing Power Analysis → Correction Sizing → Capacitor Bank Selection
3. **Steel Beam Design** (3 steps): Load Analysis → Section Selection → Deflection Check
4. **HVAC Cooling Load** (3+ steps): Sensible Heat → Latent Heat → Equipment Selection
5. More pipelines in `/src/data/pipelines/` directory

---

## 4. Current Project Architecture

### Technology Stack
- Next.js 16.1.3 with App Router (standalone output)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- **CHANGING TO**: sql.js (from Prisma/better-sqlite3)
- Zustand for state
- @xyflow/react for workflow builder
- mathjs for equation solving
- framer-motion for animations

### SPA Architecture
- Single page at `/` (`src/app/page.tsx`)
- Zustand store (`active-section-store`) for navigation
- All sections rendered based on `activeSection`

### Current File Structure
```
src/
├── app/
│   ├── page.tsx          # SPA entry
│   ├── layout.tsx        # Root layout
│   └── api/              # API routes
│       ├── route.ts      # Health check
│       ├── equations/    # CRUD + solve
│       ├── categories/   # List
│       ├── pipelines/    # List + execute
│       ├── courses/      # List
│       ├── units/        # List
│       ├── stats/        # Dashboard stats
│       └── ai/           # TO REMOVE
├── components/
│   ├── layout/           # AppShell, Sidebar, Header, Footer
│   ├── sections/         # Dashboard, Calculators, Pipelines, Workflow, etc.
│   └── ui/               # shadcn/ui components (40+)
├── lib/
│   └── prisma.ts         # TO REPLACE with sql.js database service
├── stores/
│   └── active-section-store.ts
└── hooks/
```

---

## 5. Implementation Plan

### Phase 1: Database & Infrastructure (CURRENT)
- [x] Analyze uploaded databases
- [ ] Replace Prisma with sql.js database service
- [ ] Import ALL data from uploaded databases
- [ ] Remove AI Assistant section and API routes
- [ ] Fix app not running issues

### Phase 2: Core Features
- [ ] Rebuild Calculation Engine (from original CalculationEngine class)
- [ ] Rebuild equation solver with full engineering functions
- [ ] Rebuild pipeline executor with DAG-based execution
- [ ] Import 450 equations with full inputs/outputs
- [ ] Import 56 calculation pipelines with 189 steps
- [ ] Import local engineering pipelines with calculate() functions

### Phase 3: Advanced Features
- [ ] Data Analysis system (file upload, query builder, report/dashboard builder)
- [ ] PDF Editor
- [ ] Logic Simulator with working wiring
- [ ] Electrical Simulator
- [ ] Hydraulic Simulator
- [ ] Diagram Studio / Canvas
- [ ] Workflow Builder with categorized function lists
- [ ] Report Generator

### Phase 4: Learning & Content
- [ ] Import full course data (1211 lessons, 1211 quizzes)
- [ ] Build course viewer with markdown rendering
- [ ] Build quiz system
- [ ] Build simulation viewer

---

## 6. Critical Files Reference

### Original Repo Key Files
- Server: `/home/z/EngiSuite-Analytics-original/src/server.ts`
- Database Service: `/home/z/EngiSuite-Analytics-original/src/services/database.service.ts` (already uses sql.js!)
- Calculation Engine: `/home/z/EngiSuite-Analytics-original/src/services/calculationEngine.service.ts`
- Report Generator: `/home/z/EngiSuite-Analytics-original/src/services/reportGenerator.service.ts`
- Local Pipelines: `/home/z/EngiSuite-Analytics-original/src/routes/localPipelines.routes.ts`
- Engineering Pipelines Data: `/home/z/EngiSuite-Analytics-original/src/data/engineeringPipelines.ts`
- Pipeline Data: `/home/z/EngiSuite-Analytics-original/src/data/pipelines/*.ts`
- VDA Context: `/home/z/EngiSuite-Analytics-original/frontend-react/src/contexts/VDADataContext.jsx`
- Logic Simulator: `/home/z/EngiSuite-Analytics-original/frontend-react/src/pages/LogicSimulatorPage.jsx`
- PDF Editor: `/home/z/EngiSuite-Analytics-original/frontend-react/src/pages/PDFEditorPage.jsx`
- Electrical Simulator: `/home/z/EngiSuite-Analytics-original/frontend-react/src/components/simulator/`
- Learning Simulations: `/home/z/EngiSuite-Analytics-original/frontend-react/src/components/learning/simulations/`

### Database Files
- engmastery.db: `/home/z/my-project/upload/Databases_extracted/Databases/engmastery.db`
- courses.db: `/home/z/my-project/upload/Databases_extracted/Databases/courses.db`
- workflows.db: `/home/z/my-project/upload/Databases_extracted/Databases/workflows.db`
- users.db: `/home/z/my-project/upload/Databases_extracted/Databases/users.db`

---

## 7. Change Log

| Date | Change |
|------|--------|
| 2025-04-18 | Created PROJECT_STATUS.md with full analysis |
| 2025-04-18 | Analyzed all 4 uploaded databases |
| 2025-04-18 | Cloned original repo to /home/z/EngiSuite-Analytics-original/ |
| 2025-04-18 | Read original repo source code (server, database service, calculation engine, local pipelines) |
