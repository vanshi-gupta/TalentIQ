import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addErrorHandler, createApp } from '../server/app.js';
import { closeDatabase, getDb, initDatabase } from '../server/database.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentiq-auth-'));
let app: Express;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  initDatabase({ dbPath: path.join(tempDir, 'auth.db'), seed: false });
  app = createApp();
  addErrorHandler(app);
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Authentication & Role Authorization', () => {
  it('blocks unauthenticated access to protected routes', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/candidates').expect(401);
    await request(app).get('/api/resumes').expect(401);
    await request(app).get('/api/candidate/dashboard').expect(401);
    await request(app).post('/api/jobs').send({ title: 'Test' }).expect(401);
  });

  it('registers recruiter and candidate, hashes passwords, and enforces role guards', async () => {
    const recruiterAgent = request.agent(app);
    const candidateAgent = request.agent(app);

    const recReg = await recruiterAgent
      .post('/api/auth/register')
      .send({
        email: 'recruiter@firm.in',
        password: 'StrongPassword123',
        role: 'recruiter',
        fullName: 'Vikram Rao',
        phone: '+91 98765 11111',
        company: 'FinTech India',
      })
      .expect(201);

    expect(recReg.body.user.role).toBe('recruiter');
    const storedHash = (getDb().prepare('SELECT password_hash FROM users WHERE email = ?').get('recruiter@firm.in') as { password_hash: string }).password_hash;
    expect(storedHash).toMatch(/^scrypt\$/);
    expect(storedHash).not.toContain('StrongPassword123');

    await candidateAgent
      .post('/api/auth/register')
      .send({
        email: 'candidate@talent.in',
        password: 'StrongPassword123',
        role: 'candidate',
        fullName: 'Neha Verma',
        phone: '+91 98765 22222',
      })
      .expect(201);

    // Role isolation: candidate cannot hit recruiter endpoints; recruiter cannot hit candidate endpoints
    await candidateAgent.get('/api/candidates').expect(403);
    await candidateAgent.post('/api/jobs').send({
      title: 'Hacker Job',
      description: 'At least thirty characters required for job description validation.',
      requiredSkills: ['React'],
    }).expect(403);
    await recruiterAgent.get('/api/candidate/dashboard').expect(403);

    // Candidate CAN access their own portal
    const candDash = await candidateAgent.get('/api/candidate/dashboard').expect(200);
    expect(candDash.body.candidate.name).toBe('Neha Verma');

    // Logout revokes session on backend
    await recruiterAgent.post('/api/auth/logout').expect(200);
    await recruiterAgent.get('/api/auth/me').expect(401);
  });

  it('rejects wrong credentials and supports token-based password reset', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@firm.in', password: 'WrongPassword!' })
      .expect(401);

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'recruiter@firm.in' })
      .expect(200);
    expect(forgot.body.previewToken).toBeTruthy();

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.previewToken, password: 'UpdatedPassword99' })
      .expect(200);

    // Old password fails, new password succeeds
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@firm.in', password: 'StrongPassword123' })
      .expect(401);

    const loggedIn = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recruiter@firm.in', password: 'UpdatedPassword99' })
      .expect(200);
    expect(loggedIn.body.user.email).toBe('recruiter@firm.in');
  });
});
