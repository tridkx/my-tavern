import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, ensureDataDirs } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

ensureDataDirs();

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(SCHEMA_SQL);

export type Row = Record<string, unknown>;

export function all<T = Row>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T = Row>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
}
