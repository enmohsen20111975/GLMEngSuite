/**
 * Database Service - sql.js SQLite (Hostinger-compatible, no native compilation)
 * Uses on-demand loading with memory management
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import path from 'path'

// Database file paths
const DB_PATHS = {
  courses: path.resolve(process.cwd(), 'upload/Databases_extracted/Databases/courses.db'),
  workflows: path.resolve(process.cwd(), 'upload/Databases_extracted/Databases/workflows.db'),
  engmastery: path.resolve(process.cwd(), 'upload/Databases_extracted/Databases/engmastery.db'),
}

// Singleton instances - cached after first load
let sqlModule: any = null
let coursesDb: SqlJsDatabase | null = null
let workflowsDb: SqlJsDatabase | null = null
let engmasteryDb: SqlJsDatabase | null = null

/**
 * Get the sql.js module (initialize once)
 */
async function getSqlModule() {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) => {
        return path.resolve(process.cwd(), `node_modules/sql.js/dist/${file}`)
      }
    })
  }
  return sqlModule
}

/**
 * Load a database from file
 */
async function loadDb(dbPath: string): Promise<SqlJsDatabase> {
  const SQL = await getSqlModule()
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    return new SQL.Database(buffer)
  }
  return new SQL.Database()
}

/**
 * Initialize (just loads the sql.js WASM module)
 */
export async function initDatabase(): Promise<void> {
  await getSqlModule()
  console.log('✅ sql.js module ready (databases load on demand)')
}

/**
 * Save databases to disk (only if loaded and modified)
 */
export function saveDatabases(): void {
  try {
    if (workflowsDb && fs.existsSync(path.dirname(DB_PATHS.workflows))) {
      const data = workflowsDb.export()
      fs.writeFileSync(DB_PATHS.workflows, Buffer.from(data))
    }
    if (coursesDb && fs.existsSync(path.dirname(DB_PATHS.courses))) {
      const data = coursesDb.export()
      fs.writeFileSync(DB_PATHS.courses, Buffer.from(data))
    }
    if (engmasteryDb && fs.existsSync(path.dirname(DB_PATHS.engmastery))) {
      const data = engmasteryDb.export()
      fs.writeFileSync(DB_PATHS.engmastery, Buffer.from(data))
    }
  } catch (error) {
    console.error('Error saving databases:', error)
  }
}

// Database getters (cached lazy-load)
export async function getCoursesDb(): Promise<SqlJsDatabase> {
  if (!coursesDb) {
    coursesDb = await loadDb(DB_PATHS.courses)
  }
  return coursesDb
}

export async function getWorkflowsDb(): Promise<SqlJsDatabase> {
  if (!workflowsDb) {
    workflowsDb = await loadDb(DB_PATHS.workflows)
  }
  return workflowsDb
}

export async function getEngmasteryDb(): Promise<SqlJsDatabase> {
  if (!engmasteryDb) {
    engmasteryDb = await loadDb(DB_PATHS.engmastery)
  }
  return engmasteryDb
}

/**
 * Query helper - returns array of objects
 */
export function query<T = Record<string, unknown>>(db: SqlJsDatabase, sql: string, params: unknown[] = []): T[] {
  const result = db.exec(sql, params as (string | number | null | Uint8Array)[])
  if (result.length === 0) return []

  const columns = result[0].columns
  const values = result[0].values

  return values.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

/**
 * Query one row helper
 */
export function queryOne<T = Record<string, unknown>>(db: SqlJsDatabase, sql: string, params: unknown[] = []): T | undefined {
  const results = query<T>(db, sql, params)
  return results[0]
}

/**
 * Execute (INSERT/UPDATE/DELETE) helper
 */
export function execute(db: SqlJsDatabase, sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  db.run(sql, params as (string | number | null | Uint8Array)[])
  const result = db.exec('SELECT last_insert_rowid() as id, changes() as changes')
  const lastInsertRowid = (result[0]?.values[0]?.[0] as number) || 0
  const changes = (result[0]?.values[0]?.[1] as number) || 0
  saveDatabases()
  return { changes, lastInsertRowid }
}

/**
 * Database Service class - async convenience wrapper
 */
class DatabaseService {
  async queryCourses<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return query<T>(await getCoursesDb(), sql, params)
  }

  async queryOneCourse<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return queryOne<T>(await getCoursesDb(), sql, params)
  }

  async queryWorkflows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return query<T>(await getWorkflowsDb(), sql, params)
  }

  async queryOneWorkflow<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return queryOne<T>(await getWorkflowsDb(), sql, params)
  }

  async queryEngmastery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return query<T>(await getEngmasteryDb(), sql, params)
  }

  async queryOneEngmastery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return queryOne<T>(await getEngmasteryDb(), sql, params)
  }

  async executeWorkflows(sql: string, params: unknown[] = []) {
    return execute(await getWorkflowsDb(), sql, params)
  }

  async executeCourses(sql: string, params: unknown[] = []) {
    return execute(await getCoursesDb(), sql, params)
  }

  async executeEngmastery(sql: string, params: unknown[] = []) {
    return execute(await getEngmasteryDb(), sql, params)
  }
}

// Singleton
let _dbService: DatabaseService | null = null

export function getDatabaseService(): DatabaseService {
  if (!_dbService) {
    _dbService = new DatabaseService()
  }
  return _dbService
}

/**
 * Ensure database is initialized before use
 */
export async function ensureDatabase(): Promise<DatabaseService> {
  await getSqlModule()
  return getDatabaseService()
}
