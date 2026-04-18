---
Task ID: 1
Agent: Main
Task: Fix server and implement interactive bidirectional equation solving

Work Log:
- Diagnosed server OOM issue caused by loading 31MB courses.db into memory all at once
- Rewrote database.ts to use lazy loading - databases only load when their API is called
- Updated all 11 API route files to use async/await for database calls
- Optimized equations API from N+1 queries to batch queries (2 queries instead of 2*N)
- Optimized stats API to use Promise.all for parallel queries with fallback for courses.db
- Rewrote calculators-section.tsx with major improvements:
  - DB inputs/outputs as PRIMARY source of truth (formula parser as fallback)
  - All variables (inputs AND outputs) have editable number fields
  - Instant auto-calculation with 300ms debounce
  - Bidirectional solving: fill any variable, the unknown auto-calculates
  - Visual distinction: inputs=standard, outputs=amber, auto-calc=emerald, manual=amber badge
  - Robust solver: forward (direct eval) + reverse (numerical bisection)
  - Error handling for multiple unknowns, NaN results, solve failures
- Set up favicon from uploaded images (32px and 180px apple-touch-icon)
- Verified Data Analysis section is already complete with upload, query builder, charts, reports, dashboards
- Verified Logic Simulator section is already complete with gates, wiring, canvas simulation
- Verified Pipelines section already has bidirectional solving with auto-calc
- Verified Workflow Builder section already has bidirectional solving with calculation nodes
- Server now runs stably with NODE_OPTIONS="--max-old-space-size=384"

Stage Summary:
- Server OOM fixed with lazy database loading
- Interactive bidirectional equation solving implemented in Calculators section
- All existing sections verified as functional
- Favicon configured from user's uploaded images
- Server running stably on port 3000
