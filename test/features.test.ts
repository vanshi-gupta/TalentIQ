import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addErrorHandler, createApp } from '../server/app.js';
import { closeDatabase, initDatabase } from '../server/database.js';
import { analyzeResumeIntegrity } from '../server/services/integrityRadarService.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentiq-features-'));
let app: Express;
let recruiterAgent: ReturnType<typeof request.agent>;
let candidateAgent: ReturnType<typeof request.agent>;
let dataJobId: string;
let analystJobId: string;
let candidateRecordId: string;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = '';
  initDatabase({ dbPath: path.join(tempDir, 'features.db'), seed: false });
  app = createApp();
  addErrorHandler(app);
  recruiterAgent = request.agent(app);
  candidateAgent = request.agent(app);

  await recruiterAgent
    .post('/api/auth/register')
    .send({ email: 'lead.recruiter@india.in', password: 'Password@123', role: 'recruiter', fullName: 'Aarav Mehta' })
    .expect(201);

  await candidateAgent
    .post('/api/auth/register')
    .send({ email: 'kiran.desai@india.in', password: 'Password@123', role: 'candidate', fullName: 'Kiran Desai' })
    .expect(201);

  // Create two genuine active jobs: Senior Data Scientist (high bar) and Junior Data Analyst (adjacent fit)
  const seniorJob = await recruiterAgent
    .post('/api/jobs')
    .send({
      title: 'Senior Data Scientist',
      company: 'Indus AI',
      location: 'Bengaluru, Karnataka',
      workMode: 'Hybrid',
      employmentType: 'Full-time',
      description: 'Lead machine learning systems with Python, PyTorch, Kubernetes, AWS, and Spark.',
      requiredSkills: ['Python', 'PyTorch', 'Kubernetes', 'AWS'],
      preferredSkills: ['Spark', 'SQL'],
      minExperience: 6,
      salaryMinInr: 2200000,
      salaryMaxInr: 3200000,
      educationRequirement: "Master's degree",
      status: 'active',
    })
    .expect(201);
  dataJobId = seniorJob.body.id;

  const jrJob = await recruiterAgent
    .post('/api/jobs')
    .send({
      title: 'Junior Data Analyst',
      company: 'Bharat Insights',
      location: 'Pune, Maharashtra',
      workMode: 'Remote',
      employmentType: 'Full-time',
      description: 'Analyze retail metrics using SQL, Python, Excel, and Power BI dashboards.',
      requiredSkills: ['SQL', 'Python', 'Excel'],
      preferredSkills: ['Power BI', 'Docker'],
      minExperience: 1,
      salaryMinInr: 600000,
      salaryMaxInr: 900000,
      educationRequirement: "Bachelor's degree",
      status: 'active',
    })
    .expect(201);
  analystJobId = jrJob.body.id;

  // Populate candidate profile with overlapping dates to test Integrity Radar + skills for Alternative Job Finder
  const prof = await candidateAgent
    .put('/api/candidate/profile')
    .send({
      phone: '+91 98111 22334',
      location: 'Pune, Maharashtra',
      title: 'Data Operations Associate',
      yearsExperience: 2,
      skills: ['Python', 'SQL', 'Excel'],
      education: [{ degree: 'B.Tech', field: 'Computer Science', institution: 'COEP Pune', year: '2022' }],
      experience: [
        {
          title: 'Data Associate',
          company: 'Alpha Corp',
          start: 'Jan 2023',
          end: 'Dec 2024',
          description: 'Built SQL reporting pipelines and Python automation scripts.',
        },
        {
          title: 'Operations Analyst',
          company: 'Beta Systems',
          start: 'Jun 2024',
          end: 'Mar 2025',
          description: 'Managed Excel dashboards and weekly KPI metrics.',
        },
      ],
    })
    .expect(200);
  candidateRecordId = prof.body.candidate.id;
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Unique TalentIQ Features & AI Fallbacks', () => {
  it('enforces server-side redaction in Blind Screening and audits Identity Reveal', async () => {
    const blindRes = await recruiterAgent.get(`/api/screening/blind?jobId=${analystJobId}`).expect(200);
    expect(blindRes.body.blindModeActive).toBe(true);
    const kiranBlind = blindRes.body.candidates.find((c: { candidateId: string }) => c.candidateId === candidateRecordId);
    expect(kiranBlind).toBeTruthy();
    expect(kiranBlind.revealed).toBe(false);
    expect(kiranBlind.anonymousId).toMatch(/^CAND-/);
    // Personal identifiers must NOT be leaked in blind response
    expect(kiranBlind.identity).toBeUndefined();
    expect(JSON.stringify(kiranBlind)).not.toContain('kiran.desai@india.in');
    expect(JSON.stringify(kiranBlind)).not.toContain('Kiran Desai');
    expect(JSON.stringify(kiranBlind)).not.toContain('98111');
    // Evidence Ledger must still be present
    expect(kiranBlind.match.evidence.length).toBeGreaterThan(0);

    // Reveal with audit reason
    const revealed = await recruiterAgent
      .post('/api/screening/reveal')
      .send({ candidateId: candidateRecordId, jobId: analystJobId, reason: 'Shortlisted for interview round' })
      .expect(201);
    expect(revealed.body.revealed).toBe(true);
    expect(revealed.body.identity.name).toBe('Kiran Desai');

    const auditList = await recruiterAgent.get('/api/screening/reveals').expect(200);
    expect(auditList.body.reveals.some((r: { candidate_id: string; reason: string }) =>
      r.candidate_id === candidateRecordId && r.reason === 'Shortlisted for interview round',
    )).toBe(true);
  });

  it('detects overlapping employment dates and missing info in Resume Integrity Radar', async () => {
    const report = await candidateAgent.get('/api/candidate/integrity').expect(200);
    expect(report.body.dateConflictCount).toBeGreaterThanOrEqual(1);
    expect(report.body.status).toBe('Manual verification recommended');
    expect(report.body.findings.some((f: { category: string; title: string }) =>
      f.category === 'date_conflict' && /overlap/i.test(f.title),
    )).toBe(true);

    const clean = analyzeResumeIntegrity({
      name: 'Clean Profile',
      skills: ['React'],
      education: [{ degree: 'B.Tech', institution: 'IIT Delhi', year: '2021' }],
      experience: [{ title: 'Frontend Engineer', company: 'Tech', start: 'Jul 2021', end: 'Present', description: 'Built React applications.' }],
      yearsExperience: 5,
      resumeText: 'Built React applications.',
    });
    expect(clean.dateConflictCount).toBe(0);
    expect(clean.status).toBe('Information consistent');
  });

  it('recommends genuine alternative jobs and bridges when candidate applies for a high-bar role', async () => {
    const applied = await candidateAgent
      .post('/api/candidate/apply')
      .send({ jobId: dataJobId, coverNote: 'Interested in ML transition.' })
      .expect(201);
    expect(applied.body.application.stage).toBe('applied');
    // Senior Data Scientist match is < 60%, so alternative genuine jobs are surfaced
    expect(applied.body.alternatives).toBeTruthy();
    expect(applied.body.alternatives.recommendations.some((r: { job: { id: string } }) => r.job.id === analystJobId)).toBe(true);
  });

  it('tracks hiring pipeline transitions with history while hiding recruiter notes from candidates', async () => {
    const pipe = await recruiterAgent.get('/api/screening/pipeline').expect(200);
    const appRow = pipe.body.applications.find((a: { jobId: string; candidateId: string }) =>
      a.jobId === dataJobId && a.candidateId === candidateRecordId,
    );
    expect(appRow).toBeTruthy();

    await recruiterAgent
      .patch(`/api/screening/pipeline/${appRow.id}`)
      .send({
        stage: 'shortlisted',
        reason: 'Strong SQL and Python base',
        recruiterNotes: 'CONFIDENTIAL_INTERNAL_NOTE_DO_NOT_EXPOSE',
      })
      .expect(200);

    const candApps = await candidateAgent.get('/api/candidate/applications').expect(200);
    expect(candApps.body.applications[0].statusLabel).toBe('Shortlisted');
    expect(JSON.stringify(candApps.body)).not.toContain('CONFIDENTIAL_INTERNAL_NOTE_DO_NOT_EXPOSE');
  });

  it('provides deterministic AI assistant fallbacks when GEMINI_API_KEY is missing', async () => {
    const summary = await recruiterAgent
      .post('/api/ai/summarize-candidate')
      .send({ candidateId: candidateRecordId })
      .expect(200);
    expect(summary.body.provider).toBe('local-fallback');
    expect(summary.body.suggestion.length).toBeGreaterThan(20);

    const feedback = await recruiterAgent
      .post('/api/ai/draft-feedback')
      .send({ candidateId: candidateRecordId, jobId: analystJobId, tone: 'encouraging' })
      .expect(200);
    expect(feedback.body.provider).toBe('local-fallback');
    expect(feedback.body.suggestion).toContain('Junior Data Analyst');

    // Candidate Career Growth Roadmap & Interview Prep
    const roadmap = await candidateAgent.get('/api/candidate/roadmap').expect(200);
    expect(roadmap.body.roadmap.milestones.length).toBeGreaterThan(0);
    const firstMs = roadmap.body.roadmap.milestones[0];
    const toggled = await candidateAgent
      .patch('/api/candidate/roadmap/milestone')
      .send({ milestoneId: firstMs.id, completed: true })
      .expect(200);
    expect(toggled.body.roadmap.milestones[0].completed).toBe(true);

    const prep = await candidateAgent.get(`/api/candidate/interview-prep?jobId=${analystJobId}`).expect(200);
    expect(prep.body.technicalQuestions.length).toBeGreaterThan(0);
    expect(prep.body.behavioralQuestions.length).toBeGreaterThan(0);
  });
});
