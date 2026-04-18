# EngiSuite Analytics - Project Status

> Last updated: Session 3 (2026-04-18)

## Project Overview
Next.js 16 engineering calculation platform with sql.js database backend. Cloned and improved from EngiSuite-Analytics Express.js repository.

## Technology Stack
- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Database**: sql.js (WebAssembly SQLite) - NOT Prisma/better-sqlite3
- **State Management**: Zustand (active section store)
- **Charts**: Recharts (Data Analysis)
- **Workflow**: @xyflow/react (React Flow)
- **Animation**: Framer Motion
- **PDF**: pdfjs-dist (dynamic import, ssr: false)

## Database Mapping
- `upload/Databases_extracted/Databases/engmastery.db` → Courses (6), Modules (65), Lessons (1211)
- `upload/Databases_extracted/Databases/courses.db` → Disciplines (5), Lessons (22)
- `upload/Databases_extracted/Databases/workflows.db` → Equations (450), Pipelines (56), Categories (20)

## Feature Status

### ✅ Complete
| Feature | File | Notes |
|---------|------|-------|
| Dashboard | `dashboard-section.tsx` | Stats, domain distribution, recent equations |
| Calculators | `calculators-section.tsx` | 450+ equations, **bidirectional solving** (fill any values, auto-calculate unknown), numerical bisection solver |
| Pipelines | `pipelines-section.tsx` | Multi-step calculations, **bidirectional solving per step**, chain propagation, visual feedback |
| Workflow Builder | `workflow-builder-section.tsx` | React Flow canvas, 5 node types, **bidirectional solving in calc nodes**, properties panel, Run All |
| Unit Converter | `unit-converter-section.tsx` | Engineering unit conversions |
| Data Analysis | `data-analysis-section.tsx` | CSV/JSON upload, explorer, query builder, chart builder, report builder, dashboard builder |
| Learning | `learning-section.tsx` | Courses from engmastery.db |
| Settings | `settings-section.tsx` | Theme, preferences |
| Logic Simulator | `logic-simulator-section.tsx` | Digital logic gates, wiring, simulation |
| Diagram Studio | `diagram-studio-section.tsx` | Basic diagram tools |
| PDF Editor | `pdf-editor-section.tsx` | PDF.js rendering, annotation tools, export (dynamic import) |
| Equation Solve API | `api/equations/solve/route.ts` | POST endpoint with bidirectional solving (direct + numerical bisection) |
| Stats API | `api/stats/route.ts` | Uses sql.js |
| Equations API | `api/equations/route.ts` | Uses sql.js with inputs/outputs |
| Pipelines API | `api/pipelines/route.ts` | Uses sql.js |
| Courses API | `api/courses/route.ts` | Uses sql.js |

### ⚠️ Partially Complete
| Feature | Issue | Priority |
|---------|-------|----------|
| Electrical Simulator | Basic implementation, needs enhancement | Medium |
| Logic Simulator | Works but canvas-based, could be improved | Low |

### ❌ Removed
| Feature | Reason |
|---------|--------|
| AI Assistant | User cannot use AI on their website |

## Key Architecture Decisions

1. **sql.js over Prisma/better-sqlite3**: Hostinger deployment compatibility - no native compilation needed
2. **Dynamic PDF.js import**: `pdfjs-dist` uses `DOMMatrix` (browser-only API), must be loaded with `ssr: false`
3. **Client-side equation solving**: All calculations happen client-side using `new Function()` with safe context for speed
4. **Bidirectional solving pattern**: Same logic applied across Calculators, Pipelines, and Workflow Builder:
   - Forward: All inputs → compute outputs directly
   - Reverse: Output + some inputs → numerical bisection to find missing input
   - Auto-detect: When all but one variable is filled, auto-calculate the missing one
5. **Database service singleton**: `ensureDatabase()` auto-initializes sql.js on first API call

## Critical Files

- `/home/z/my-project/src/lib/database.ts` - sql.js database service (queries all 3 DBs)
- `/home/z/my-project/src/lib/calculation-engine.ts` - Engineering calculations + formula evaluator
- `/home/z/my-project/src/lib/engineering-pipelines.ts` - Built-in pipeline definitions
- `/home/z/my-project/src/stores/active-section-store.ts` - Zustand store for navigation
- `/home/z/my-project/src/components/app-shell.tsx` - Layout shell
- `/home/z/my-project/src/components/sidebar-nav.tsx` - Navigation sidebar

## Known Issues

1. **Server instability**: Dev server sometimes crashes after multiple rapid requests (likely memory pressure in sandbox). Restart with `npx next dev --port 3000`
2. **Formula parsing limitations**: Some complex equations with custom functions (select_cable, etc.) may not parse correctly for bidirectional solving
3. **Numerical solver bounds**: Bisection method may fail for equations with no real roots or discontinuities

## How to Restart Server
```bash
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 2
npx next dev --port 3000 > dev.log 2>&1 &
```
