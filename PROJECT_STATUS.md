# EngiSuite Analytics — Project Status File

> **Purpose**: This file serves as persistent memory for the project. All agents must read this before starting work and update it after completing tasks.

**Last Updated**: 2025-04-18 (Session 3)
**Current Phase**: Core Features Implemented — Smart Calculator + Data Analysis + PDF Editor + Workflow Builder

---

## 1. Project Overview

**EngiSuite Analytics** is an engineering calculation platform rebuilt from the original Express.js + React (Vite) repository as Next.js 16 with App Router.

- **Original Repo**: `/home/z/EngiSuite-Analytics-original/` (Express + React/Vite + Prisma/MySQL + sql.js/SQLite)
- **New Project**: `/home/z/my-project/` (Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + sql.js)
- **Uploaded Databases**: `/home/z/my-project/upload/Databases_extracted/Databases/`

### Key Decision: sql.js instead of better-sqlite3
- better-sqlite3 requires native compilation (node-gyp) → fails on Hostinger shared hosting
- sql.js is WebAssembly-based → no native compilation → works everywhere
- All API routes now use `ensureDatabase()` from `@/lib/database` (sql.js)

---

## 2. Uploaded Database Contents (SOURCE OF TRUTH)

### engmastery.db (courses database — naming is confusing but this has the main course content)
- **courses**: 6 rows (electrical, mechanical, civil, chemical, industrial, mechatronics)
- **modules**: 65 rows
- **chapters**: 247 rows
- **lessons**: 1,211 rows (with full markdown content)
- **quizzes**: 1,211 rows (JSON questions with options and explanations)

### courses.db (engmastery/learning content — naming is confusing)
- **disciplines**: 5 rows (electrical, mechanical, civil, chemical, industrial)
- **chapters**: 20 rows
- **lessons**: 22 rows
- **articles**: 3 rows (full HTML content)

### workflows.db (main engineering database)
- **equation_categories**: 20 rows (electrical, mechanical, civil, chemical, hvac, etc.)
- **equations**: 450 rows (with formula, latex, tags, domain)
- **equation_inputs**: 14 rows (only 4 equations have explicit inputs)
- **equation_outputs**: 4 rows (only 4 equations have explicit outputs)
- **engineering_standards**: 32 rows (IEC, NEC, EN standards)
- **standard_coefficients**: 40 rows (derating tables, temperature corrections)
- **calculation_pipelines**: 56 rows
- **calculation_steps**: 189 rows (with formulas, input/output config as JSON)
- **calculation_dependencies**: 256 rows
- **report_templates**: 6 rows
- **workflow_categories**: 3 rows

### users.db (empty - schema only)
- 41 tables, all 0 rows

---

## 3. Implementation Status (Current Session)

### ✅ COMPLETED
| Feature | Status | Details |
|---------|--------|---------|
| **sql.js Database Service** | ✅ Done | `src/lib/database.ts` — loads 3 SQLite DBs via sql.js WASM |
| **API Routes** | ✅ Done | All 13 API routes use sql.js (not Prisma) |
| **Smart Calculator** | ✅ Done | Auto-parses formula variables, ALL inputs+outputs editable, auto-calc, reverse calculation |
| **Reverse Calculation** | ✅ Done | Leave ONE field empty → auto-solved via bisection method |
| **Data Analysis** | ✅ Done | 6 tabs: Upload, Explore, Query Builder, Charts, Report Builder, Dashboard Builder |
| **PDF Editor** | ✅ Done | PDF.js rendering, 11 tools, stamps, undo/redo, page management, dynamic import (SSR-safe) |
| **Workflow Builder** | ✅ Done | React Flow, 5 node types, categorized equations, 5 examples, execution engine |
| **Logic Simulator** | ✅ Exists | Basic 8-gate simulator with wiring (needs improvement for 20+ gates) |
| **Electrical Simulator** | ✅ Exists | Canvas-based circuit builder with components |
| **Diagram Studio** | ✅ Exists | Canvas-based shape editor with templates |
| **Pipelines** | ✅ Done | 4 local pipelines + DB pipelines, step-by-step with output fields editable |
| **Learning/Courses** | ✅ Done | Course catalog with modules/chapters/lessons from engmastery.db |
| **Unit Converter** | ✅ Done | 8 categories with live conversion |
| **Dashboard** | ✅ Done | Stats, quick actions, domain distribution |
| **AI Assistant** | ✅ Removed | No AI references in the codebase |
| **Header Section Titles** | ✅ Fixed | All 12 sections have proper titles |
| **Dark Mode** | ✅ Working | next-themes with system/light/dark toggle |

### 🟡 NEEDS IMPROVEMENT
| Feature | Issue | Priority |
|---------|-------|----------|
| **Logic Simulator** | Only 8 gate types, needs 20+ like original | Medium |
| **Electrical Simulator** | Simplified V=IR, no nodal analysis | Low |
| **Learning Section** | Course catalog only, no lesson playback/quiz interaction | Medium |
| **Equation Inputs/Outputs** | Only 4/450 equations have explicit DB definitions, rest auto-parsed from formula | Medium |
| **PDF Editor** | pdfjs-dist worker loads from CDN (may need offline) | Low |

---

## 4. Smart Calculator Architecture (KEY FEATURE)

### How it works:
1. **Formula Parsing**: `parseFormulaVariables()` extracts ALL variable names from equations like `R_dc = (rho * L) / A`
2. **Auto-detection**: Distinguishes inputs vs outputs based on `=` assignment
3. **ALL fields editable**: Both inputs AND outputs are editable input fields
4. **Auto-calculate**: When all inputs are filled → outputs auto-calculated
5. **Reverse calculation**: If ONE field is empty → solved numerically via bisection method
6. **Client-side**: All calculations happen client-side using `clientEval()` (safe subset of math)
7. **Server-side**: `/api/equations/solve` also supports `solveFor` parameter for reverse calculation

### This logic applies across:
- **Calculators Section**: Full smart calculator with formula parsing
- **Pipelines Section**: Output fields are editable for reverse calculation
- **Workflow Builder**: CALCULATION nodes auto-create ports from equation variables

---

## 5. Current File Structure
```
src/
├── app/
│   ├── page.tsx              # SPA entry with dynamic PDF import
│   ├── layout.tsx            # Root layout with AppShell
│   └── api/                  # API routes (all use sql.js)
│       ├── equations/        # List + solve (with reverse calc)
│       ├── categories/       # Equation categories
│       ├── pipelines/        # List + detail + execute
│       ├── courses/          # List + detail
│       ├── lessons/          # Lesson detail + quiz
│       ├── units/            # Unit conversions
│       ├── standards/        # Engineering standards
│       ├── report-templates/ # Report templates
│       └── stats/            # Dashboard statistics
├── components/
│   ├── app-shell.tsx         # Main layout shell
│   ├── sidebar-nav.tsx       # Sidebar navigation
│   ├── header.tsx            # Header with section titles
│   ├── footer.tsx            # Sticky footer
│   ├── sections/             # All section components
│   │   ├── calculators-section.tsx      # Smart Calculator (auto-calc + reverse)
│   │   ├── pipelines-section.tsx        # Pipelines with editable outputs
│   │   ├── workflow-builder-section.tsx # React Flow workflow builder
│   │   ├── data-analysis-section.tsx    # 6-tab data analysis suite
│   │   ├── pdf-editor-section.tsx       # PDF.js editor (dynamic import)
│   │   ├── logic-simulator-section.tsx  # Logic gate simulator
│   │   ├── electrical-simulator-section.tsx
│   │   ├── diagram-studio-section.tsx
│   │   ├── learning-section.tsx
│   │   ├── unit-converter-section.tsx
│   │   ├── dashboard-section.tsx
│   │   └── settings-section.tsx
│   └── ui/                   # 40+ shadcn/ui components
├── lib/
│   ├── database.ts           # sql.js database service (3 DBs)
│   ├── calculation-engine.ts # Formula evaluator + DAG pipeline engine
│   ├── engineering-pipelines.ts # 4 local pipelines with calculate()
│   ├── report-generator.ts   # HTML/JSON report generation
│   └── db.ts                 # OLD Prisma client (unused, keep for reference)
├── stores/
│   └── active-section-store.ts
└── hooks/
```

---

## 6. Change Log

| Date | Change |
|------|--------|
| 2025-04-18 | Created PROJECT_STATUS.md with full analysis |
| 2025-04-18 | Analyzed all 4 uploaded databases |
| 2025-04-18 | Cloned original repo |
| 2025-04-18 | Session 2: Started section components, server kept crashing |
| 2025-04-18 | Session 3: Fixed server, rewrote Calculators with smart auto-calculate |
| 2025-04-18 | Session 3: Added reverse calculation (bisection solver) |
| 2025-04-18 | Session 3: Rewrote Data Analysis with 6 tabs (Upload, Explore, Query, Charts, Report, Dashboard) |
| 2025-04-18 | Session 3: Fixed PDF Editor SSR error (DOMMatrix → dynamic import) |
| 2025-04-18 | Session 3: Added editable output fields to Pipelines section |
| 2025-04-18 | Session 3: Workflow Builder rewritten with categorized equations and execution |
| 2025-04-18 | Session 3: Removed AI Assistant references, fixed header section titles |
| 2025-04-18 | Session 3: All 13 API routes using sql.js (not Prisma) |
