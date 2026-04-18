/**
 * Database Service - sql.js SQLite (Hostinger-compatible, no native compilation)
 * Loads and queries the uploaded engineering databases
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

// Singleton instances
let coursesDb: SqlJsDatabase | null = null
let workflowsDb: SqlJsDatabase | null = null
let engmasteryDb: SqlJsDatabase | null = null
let initialized = false

/**
 * Initialize all database connections
 */
export async function initDatabase(): Promise<void> {
  if (initialized) return

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        return path.resolve(process.cwd(), `node_modules/sql.js/dist/${file}`)
      }
    })

    // Load courses database
    if (fs.existsSync(DB_PATHS.courses)) {
      coursesDb = new SQL.Database(fs.readFileSync(DB_PATHS.courses))
    } else {
      coursesDb = new SQL.Database()
    }

    // Load workflows database
    if (fs.existsSync(DB_PATHS.workflows)) {
      workflowsDb = new SQL.Database(fs.readFileSync(DB_PATHS.workflows))
    } else {
      workflowsDb = new SQL.Database()
    }

    // Load engmastery database
    if (fs.existsSync(DB_PATHS.engmastery)) {
      engmasteryDb = new SQL.Database(fs.readFileSync(DB_PATHS.engmastery))
    } else {
      engmasteryDb = new SQL.Database()
    }

    initialized = true
    console.log('✅ sql.js databases initialized (courses, workflows, engmastery)')
  } catch (error) {
    console.error('❌ Failed to initialize sql.js databases:', error)
    throw error
  }
}

/**
 * Save databases to disk
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

// Database getters
export function getCoursesDb(): SqlJsDatabase {
  if (!coursesDb) throw new Error('Courses database not initialized. Call initDatabase() first.')
  return coursesDb
}

export function getWorkflowsDb(): SqlJsDatabase {
  if (!workflowsDb) throw new Error('Workflows database not initialized. Call initDatabase() first.')
  return workflowsDb
}

export function getEngmasteryDb(): SqlJsDatabase {
  if (!engmasteryDb) throw new Error('Engmastery database not initialized. Call initDatabase() first.')
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
 * Database Service class - convenience wrapper
 */
class DatabaseService {
  // Courses database queries
  queryCourses<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return query<T>(getCoursesDb(), sql, params)
  }

  queryOneCourse<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return queryOne<T>(getCoursesDb(), sql, params)
  }

  // Workflows database queries
  queryWorkflows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return query<T>(getWorkflowsDb(), sql, params)
  }

  queryOneWorkflow<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return queryOne<T>(getWorkflowsDb(), sql, params)
  }

  // Engmastery database queries
  queryEngmastery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return query<T>(getEngmasteryDb(), sql, params)
  }

  queryOneEngmastery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return queryOne<T>(getEngmasteryDb(), sql, params)
  }

  // Execute on specific databases
  executeWorkflows(sql: string, params: unknown[] = []) {
    return execute(getWorkflowsDb(), sql, params)
  }

  executeCourses(sql: string, params: unknown[] = []) {
    return execute(getCoursesDb(), sql, params)
  }

  executeEngmastery(sql: string, params: unknown[] = []) {
    return execute(getEngmasteryDb(), sql, params)
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
 * Ensure database is initialized before use (auto-init)
 */
export async function ensureDatabase(): Promise<DatabaseService> {
  if (!initialized) {
    await initDatabase()
  }
  return getDatabaseService()
}
