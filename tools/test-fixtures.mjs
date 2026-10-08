export class MemoryKV {
  constructor(entries = {}) {
    this.rows = new Map(Object.entries(entries).map(([key, value]) => [key, { value: JSON.stringify(value) }]));
  }
  async get(key) {
    const row = this.rows.get(key);
    if (!row || (row.expiration && row.expiration <= Date.now() / 1000)) return null;
    return row.value;
  }
  async put(key, value, options = {}) {
    this.rows.set(key, { value, expiration: options.expiration || (options.expirationTtl ? Math.floor(Date.now() / 1000) + options.expirationTtl : null) });
  }
  async delete(key) { this.rows.delete(key); }
  async list({ prefix = '', cursor = '0', limit = 1000 } = {}) {
    const keys = [...this.rows.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = Number(cursor || 0);
    const page = keys.slice(start, start + limit).map(name => ({ name, expiration: this.rows.get(name).expiration }));
    return { keys: page, list_complete: start + limit >= keys.length, cursor: String(start + limit) };
  }
}

// A strict D1 fixture for the SQL used by portable archives.
export class MemoryD1 {
  constructor(entries = {}) {
    this.rows = new Map(Object.entries(entries).map(([key, value]) => [key, { key, value: JSON.stringify(value), expiration: null }]));
  }
  prepare(sql) {
    const db = this;
    return { sql, args: [], bind(...args) { this.args = args; return this; },
      async all() {
        if (!sql.includes('WHERE key > ?')) throw new Error(`Unexpected fixture SQL: ${sql}`);
        return { results: [...db.rows.values()].filter(row => row.key > this.args[0]).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 500) };
      },
      async first() { return db.rows.get(this.args[0]) || null; },
      async run() {
        if (sql.startsWith('INSERT INTO kv_store')) { const [key, value, expiration] = this.args; db.rows.set(key, { key, value, expiration: expiration || null }); }
        else if (sql.startsWith('DELETE FROM kv_store')) db.rows.delete(this.args[0]);
        else throw new Error(`Unexpected fixture SQL: ${sql}`);
        return { success: true };
      }
    };
  }
  async batch(statements) { return Promise.all(statements.map(s => s.run())); }
}

export function modelEnv() {
  return { BOT_KV: new MemoryKV({
    'pf:providers:index': ['fixture'],
    'pf:provider:fixture': { id: 'fixture', name: 'Test provider', baseUrl: 'https://fixture.invalid/v1', format: 'openai', auth: 'none', enabled: true, status: 'healthy', keys: [] },
    'pf:models:index': ['model_fixture'],
    'pf:model:model_fixture': { id: 'model_fixture', providerId: 'fixture', providerName: 'Test provider', apiModelId: 'fixture-fast', displayName: 'Fixture Fast', enabled: true, status: 'healthy', capabilities: { chat: { supported: true }, streaming: { supported: true } }, stats: {}, pricing: { free: true } }
  }) };
}
