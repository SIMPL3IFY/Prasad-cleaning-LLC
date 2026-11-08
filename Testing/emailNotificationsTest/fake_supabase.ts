// SCRUM-244: Stands in for @supabase/supabase-js (see import_map.json). Nothing reaches a database.
// It only provides what a function needs to reach its email code: db.sessions decides who is signed in,
// and db.respond decides what each query returns.

// deno-lint-ignore no-explicit-any
type Any = any

export type Result = { data?: unknown; error?: unknown }

export type Query = {
  table: string
  op: "select" | "insert" | "update"
  values?: unknown
}

export const db = {
  queries: [] as Query[],
  // Bearer token -> signed-in user. Any other token is rejected, like the real auth server.
  sessions: {} as Record<string, { id: string }>,
  respond: (_query: Query): Result => ({ data: null, error: null }),

  reset() {
    db.queries = []
    db.sessions = {}
    db.respond = () => ({ data: null, error: null })
  },
}

class FakeQuery {
  query: Query
  constructor(table: string) {
    this.query = { table, op: "select" }
    db.queries.push(this.query)
  }
  select(_columns?: string) {
    return this // After update()/insert() this is a RETURNING clause, so op stays as it was
  }
  insert(values: unknown) {
    this.query.op = "insert"
    this.query.values = values
    return this
  }
  update(values: unknown) {
    this.query.op = "update"
    this.query.values = values
    return this
  }
  eq(_column: string, _value: unknown) {
    return this
  }
  is(_column: string, _value: unknown) {
    return this
  }
  gte(_column: string, _value: unknown) {
    return this
  }
  lte(_column: string, _value: unknown) {
    return this
  }
  order(_column: string, _options: unknown) {
    return this
  }
  limit(_count: number) {
    return this
  }
  maybeSingle() {
    return Promise.resolve(db.respond(this.query))
  }
  then(resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(db.respond(this.query)).then(resolve, reject)
  }
}

export function createClient(_url: string, _key: string, options?: Any) {
  const authorization: string = options?.global?.headers?.Authorization ?? ""

  return {
    from: (table: string) => new FakeQuery(table),
    auth: {
      getUser: () => {
        const user = db.sessions[authorization.replace(/^Bearer /, "")] ?? null
        return Promise.resolve({
          data: { user },
          error: user ? null : { message: "Invalid JWT", status: 401 },
        })
      },
    },
  }
}
