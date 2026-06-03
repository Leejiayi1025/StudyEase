import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '123456',
    database: process.env.MYSQL_DATABASE || 'studyease',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

// UUID v4 generator
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Query builder helpers that mimic Supabase client API
function buildSelectQuery(
  table: string,
  options: {
    columns?: string;
    filters?: Record<string, unknown>;
    orFilter?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    range?: { from: number; to: number };
    countOnly?: boolean;
  } = {}
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const columns = options.countOnly ? 'COUNT(*) as count' : (options.columns || '*');

  let sql = `SELECT ${columns} FROM ${table}`;
  const whereClauses: string[] = [];

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.startsWith('%') && value.endsWith('%')) {
        whereClauses.push(`${key} LIKE ?`);
        params.push(value);
      } else {
        whereClauses.push(`${key} = ?`);
        params.push(value);
      }
    }
  }

  if (options.orFilter) {
    whereClauses.push(`(${options.orFilter})`);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.ascending === false ? 'DESC' : 'ASC'}`;
  }

  if (options.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  if (options.range) {
    sql += ` LIMIT ? OFFSET ?`;
    params.push(options.range.to - options.range.from + 1);
    params.push(options.range.from);
  }

  return { sql, params };
}

// High-level DB client
function getDB() {
  const p = getPool();

  return {
    async query(sql: string, params: unknown[] = []) {
      const [rows] = await p.execute(sql, params as (string | number | null)[]);
      return rows;
    },

    from(table: string) {
      return new QueryBuilder(p, table);
    },
  };
}

class QueryBuilder {
  private pool: mysql.Pool;
  private table: string;
  private _select: string = '*';
  private _filters: Array<{ col: string; op: string; val: unknown }> = [];
  private _orFilter: string = '';
  private _orderBy: { column: string; ascending: boolean } | null = null;
  private _limit: number | null = null;
  private _range: { from: number; to: number } | null = null;
  private _countExact: boolean = false;

  constructor(pool: mysql.Pool, table: string) {
    this.pool = pool;
    this.table = table;
  }

  select(columns: string, options?: { count?: string; exact?: boolean; head?: boolean }) {
    this._select = columns;
    if (options?.exact) this._countExact = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this._filters.push({ col, op: '=', val });
    return this;
  }

  neq(col: string, val: unknown) {
    this._filters.push({ col, op: '!=', val });
    return this;
  }

  gte(col: string, val: unknown) {
    this._filters.push({ col, op: '>=', val });
    return this;
  }

  ilike(col: string, val: string) {
    this._filters.push({ col, op: 'LIKE', val });
    return this;
  }

  in(col: string, val: unknown[]) {
    this._filters.push({ col, op: 'IN', val });
    return this;
  }

  or(filter: string) {
    this._orFilter = filter;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this._orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  range(from: number, to: number) {
    this._range = { from, to };
    return this;
  }

  single() {
    this._limit = 1;
    return this;
  }

  maybeSingle() {
    this._limit = 1;
    return this;
  }

  private buildWhere(): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    const clauses: string[] = [];

    for (const f of this._filters) {
      if (f.op === 'IN') {
        const placeholders = (f.val as unknown[]).map(() => '?').join(', ');
        clauses.push(`${f.col} IN (${placeholders})`);
        params.push(...(f.val as unknown[]));
      } else if (f.op === 'LIKE') {
        clauses.push(`${f.col} ${f.op} ?`);
        params.push(f.val);
      } else {
        clauses.push(`${f.col} ${f.op} ?`);
        params.push(f.val);
      }
    }

    if (this._orFilter) {
      // Parse or filter like "word.ilike.%search%,meaning.ilike.%search%"
      const orParts = this._orFilter.split(',');
      const orClauses: string[] = [];
      for (const part of orParts) {
        const [col, op, val] = part.trim().split(/\.(.+)/);
        if (op === 'ilike' && val) {
          orClauses.push(`${col} LIKE ?`);
          params.push(val);
        }
      }
      if (orClauses.length > 0) {
        clauses.push(`(${orClauses.join(' OR ')})`);
      }
    }

    return {
      clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  private buildQuery(): { sql: string; params: unknown[] } {
    const { clause, params } = this.buildWhere();
    let sql: string;

    if (this._countExact) {
      sql = `SELECT COUNT(*) as count FROM ${this.table} ${clause}`;
      return { sql, params };
    }

    sql = `SELECT ${this._select} FROM ${this.table} ${clause}`;

    if (this._orderBy) {
      sql += ` ORDER BY ${this._orderBy.column} ${this._orderBy.ascending ? 'ASC' : 'DESC'}`;
    }

    if (this._range) {
      const limit = this._range.to - this._range.from + 1;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, this._range.from);
    } else if (this._limit) {
      sql += ` LIMIT ?`;
      params.push(this._limit);
    }

    return { sql, params };
  }

  async then(resolve: (value: { data: unknown; error: unknown; count?: number }) => void, reject?: (reason: Error) => void) {
    try {
      const { sql, params } = this.buildQuery();
      const [rows] = await this.pool.execute(sql, params as (string | number | null)[]);

      if (this._countExact) {
        const countRow = (rows as Record<string, unknown>[])[0];
        resolve({ data: null, error: null, count: Number(countRow?.count ?? 0) });
        return;
      }

      const data = this._limit === 1
        ? (rows as unknown[])[0] ?? null
        : rows;

      resolve({ data, error: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (reject) reject(error);
      else resolve({ data: null, error });
    }
  }
}

// Insert/Update helper
function createInsertBuilder(pool: mysql.Pool, table: string) {
  return {
    async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length === 0) return { data: null, error: null };

      const columns = Object.keys(rows[0]);
      const placeholders = `(${columns.map(() => '?').join(', ')})`;
      const allPlaceholders = rows.map(() => placeholders).join(', ');
      const values = rows.flatMap(row => columns.map(col => row[col]));

      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${allPlaceholders}`;
      await pool.execute(sql, values as (string | number | null)[]);

      // Return the first inserted row
      return { data: Array.isArray(data) ? data : data, error: null };
    },

    async update(data: Record<string, unknown>) {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const setClause = columns.map(col => `${col} = ?`).join(', ');

      return {
        eq: async (col: string, val: unknown) => {
          const sql = `UPDATE ${table} SET ${setClause} WHERE ${col} = ?`;
          await pool.execute(sql, [...values, val] as (string | number | null)[]);
          return { error: null };
        },
      };
    },
  };
}

export { getDB, getPool, uuid, createInsertBuilder };
