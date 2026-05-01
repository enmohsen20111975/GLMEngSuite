# Task 1 - DB Migration Agent

## Task
Fix ALL API routes that depend on missing sql.js databases to use Prisma instead.

## Problem
The API routes at `/api/stats` and `/api/pipelines` (and others) were failing with "no such table" errors because they used sql.js databases (workflows.db, courses.db, engmastery.db) loaded from `upload/Databases_extracted/Databases/` which NO LONGER EXISTS. The Prisma SQLite database at `db/custom.db` IS properly seeded with data.

## Solution
Rewrote all 12 API route files to use Prisma (`import { db } from '@/lib/db'`) instead of sql.js (`ensureDatabase` from `@/lib/database`).

## Files Modified
1. `src/app/api/stats/route.ts` - Prisma count/groupBy for stats
2. `src/app/api/pipelines/route.ts` - Prisma findMany with steps
3. `src/app/api/pipelines/[id]/route.ts` - Prisma findFirst by id/slug
4. `src/app/api/pipelines/execute/route.ts` - Prisma for DB pipeline lookup
5. `src/app/api/equations/route.ts` - Prisma findMany with inputs/outputs/category
6. `src/app/api/equations/solve/route.ts` - Prisma findFirst for equation lookup
7. `src/app/api/categories/route.ts` - Prisma findMany with _count
8. `src/app/api/courses/route.ts` - Prisma findMany with modules/lessons
9. `src/app/api/courses/[id]/route.ts` - Prisma findFirst with virtual chapters
10. `src/app/api/lessons/[id]/route.ts` - Prisma findFirst with navigation
11. `src/app/api/standards/route.ts` - Returns empty array (no Prisma model)
12. `src/app/api/report-templates/route.ts` - Returns empty array (no Prisma model)

## Verification
- All API routes return 200 status codes (tested via curl)
- ESLint passes with zero errors
- No remaining references to ensureDatabase/@/lib/database in API routes
- Frontend response format compatibility maintained
