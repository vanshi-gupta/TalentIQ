import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, initDatabase, parseJson, removeDemoData } from '../server/database.js';
import type { MatchWeights } from '../server/types.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentiq-db-'));

afterEach(() => {
  closeDatabase();
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('database initialization', () => {
  it('creates the schema, defaults and an empty workspace without demo data', () => {
    const dbPath = path.join(tempDir, 'empty.db');
    const db = initDatabase({ dbPath, seed: false });

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(String(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toLowerCase()).toBe('wal');
    expect(Number(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys)).toBe(1);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
      (row) => row.name,
    );
    expect(tables).toEqual(
      expect.arrayContaining(['activities', 'candidates', 'jobs', 'matches', 'resumes', 'settings']),
    );

    expect(Number(db.prepare('SELECT COUNT(*) AS count FROM candidates').get()?.count)).toBe(0);
    expect(Number(db.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count)).toBe(0);
    const jobColumns = (db.prepare('PRAGMA table_info(jobs)').all() as { name: string }[]).map((row) => row.name);
    expect(jobColumns).toContain('max_experience');

    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const weights = parseJson<MatchWeights>(settings.find((row) => row.key === 'weights')?.value, {
      skills: 0,
      experience: 0,
      education: 0,
      keywords: 0,
    });
    expect(weights).toEqual({ skills: 55, experience: 25, education: 10, keywords: 10 });
    const ai = parseJson<{ enabled: boolean; model: string }>(settings.find((row) => row.key === 'ai')?.value, {
      enabled: false,
      model: '',
    });
    expect(ai.enabled).toBe(true);
    expect(ai.model.length).toBeGreaterThan(0);
  });

  it('seeds clearly labeled demo data only once', () => {
    const dbPath = path.join(tempDir, 'seeded.db');
    const db = initDatabase({ dbPath, seed: true });

    const candidates = Number(db.prepare('SELECT COUNT(*) AS count FROM candidates').get()?.count);
    const jobs = Number(db.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count);
    const unlabeledCandidates = Number(db.prepare('SELECT COUNT(*) AS count FROM candidates WHERE is_sample = 0').get()?.count);
    const unlabeledJobs = Number(db.prepare('SELECT COUNT(*) AS count FROM jobs WHERE is_sample = 0').get()?.count);

    expect(candidates).toBe(4);
    expect(jobs).toBe(4);
    expect(unlabeledCandidates).toBe(0);
    expect(unlabeledJobs).toBe(0);
    const indianNames = db.prepare('SELECT name FROM candidates ORDER BY name').all() as { name: string }[];
    expect(indianNames.map((row) => row.name)).toEqual(expect.arrayContaining(['Ananya Sharma', 'Arjun Singh', 'Kavya Nair', 'Rohan Mehta']));

    closeDatabase();
    const reopened = initDatabase({ dbPath, seed: true });
    expect(Number(reopened.prepare('SELECT COUNT(*) AS count FROM candidates').get()?.count)).toBe(candidates);
    expect(Number(reopened.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count)).toBe(jobs);
  });

  it('removes only labelled sample records and keeps real records', () => {
    const dbPath = path.join(tempDir, 'remove-sample.db');
    const db = initDatabase({ dbPath, seed: true });
    db.prepare(
      `INSERT INTO candidates (id, name, email, stage, source, is_sample, created_at, updated_at)
       VALUES (?, ?, ?, 'new', 'manual', 0, ?, ?)`,
    ).run('real-candidate', 'Meera Iyer', 'meera@example.com', new Date().toISOString(), new Date().toISOString());

    const removed = removeDemoData();
    expect(removed.candidates).toBe(4);
    expect(removed.jobs).toBe(4);
    expect(removed.resumes).toBeGreaterThan(0);
    expect(Number(db.prepare('SELECT COUNT(*) AS count FROM candidates').get()?.count)).toBe(1);
    expect(db.prepare('SELECT name FROM candidates').get()?.name).toBe('Meera Iyer');
    expect(Number(db.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count)).toBe(0);
  });
});
