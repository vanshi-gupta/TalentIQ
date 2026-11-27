import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addErrorHandler, createApp } from '../server/app.js';
import { closeDatabase, initDatabase } from '../server/database.js';
import { createDocx, createPdf } from './fixtures.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'talentiq-api-'));
const uploadsDir = path.join(tempDir, 'uploads');
let app: Express;
let agent: ReturnType<typeof request.agent>;
let uploadJobId: string;
let jordanResumeId: string;
let jordanCandidateId: string;
let jordanStoredName: string;

const PDF_LINES = [
  'Jordan Blake',
  'jordan.blake@example.com | (415) 555-0142 | San Francisco, CA',
  'Senior Frontend Engineer',
  'Summary',
  'Frontend engineer with 6 years of experience building accessible React design systems.',
  'Skills',
  'React, TypeScript, Node.js, GraphQL, CSS, Accessibility',
  'Experience',
  'Senior Frontend Engineer at Northstar Labs',
  '2020 - Present',
  'Built design systems and component libraries with React and TypeScript.',
  'Education',
  'Bachelor of Science in Computer Science',
  'State University, 2018',
];

const DOCX_LINES = [
  'Alex Morgan',
  'alex.morgan@example.com | Seattle, WA',
  'Platform Engineer',
  'Summary',
  'Backend platform engineer with 5 years of experience.',
  'Skills',
  'Node.js, PostgreSQL, AWS, Docker, Kubernetes',
  'Experience',
  'Platform Engineer at Cloudline',
  '2021 - Present',
  'Built reliable Node.js services on AWS.',
  'Education',
  'Bachelor of Science in Software Engineering',
];

function uploadPdf(buffer: Buffer, filename = 'jordan-blake.pdf', jobId: string | null = uploadJobId) {
  let pending = agent.post('/api/resumes/upload');
  if (jobId) pending = pending.field('jobId', jobId);
  return pending.attach('file', buffer, { filename, contentType: 'application/pdf' });
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.MAX_FILE_SIZE_MB = '10';
  process.env.GEMINI_API_KEY = '';
  initDatabase({ dbPath: path.join(tempDir, 'api.db'), seed: false });
  app = createApp();
  addErrorHandler(app);
  agent = request.agent(app);

  await agent
    .post('/api/auth/register')
    .send({
      email: 'recruiter.api@talentiq.in',
      password: 'Password@123',
      role: 'recruiter',
      fullName: 'Riya Kapoor',
      company: 'TalentIQ Labs',
    })
    .expect(201);

  const job = await agent
    .post('/api/jobs')
    .send({
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      location: 'Remote',
      employmentType: 'Full-time',
      description:
        'Build accessible React design systems with TypeScript, Node.js and GraphQL. Partner with product and design to ship polished interfaces.',
      requiredSkills: ['React', 'TypeScript', 'Node.js'],
      preferredSkills: ['GraphQL', 'Accessibility'],
      minExperience: 4,
      maxExperience: 8,
      educationRequirement: "Bachelor's degree",
      status: 'active',
    })
    .expect(201);
  uploadJobId = job.body.id;
});

afterAll(() => {
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('API', () => {
  it('reports health and database connectivity', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('ok');
    expect(response.body.service).toBe('TalentIQ API');
    expect(response.body.aiConfigured).toBe(false);
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('round-trips candidate create, search, update, stage and delete', async () => {
    const created = await agent
      .post('/api/candidates')
      .send({
        name: 'Grace Hopper',
        email: 'GRACE@example.com',
        phone: '+1 555 0100',
        location: 'Arlington, VA',
        title: 'Staff Engineer',
        summary: 'Compiler pioneer and engineering leader.',
        skills: ['React.js', 'Node.js', 'SQL', 'react'],
        education: [
          {
            degree: 'PhD',
            field: 'Mathematics',
            institution: 'Yale University',
            year: '1934',
          },
        ],
        experience: [
          {
            title: 'Staff Engineer',
            company: 'Navy Research',
            start: '1944',
            end: '1966',
            description: 'Led compiler development.',
          },
        ],
        yearsExperience: 20,
        stage: 'screening',
      })
      .expect(201);

    expect(created.body.id).toBeTruthy();
    expect(created.body.email).toBe('grace@example.com');
    expect(created.body.skills).toEqual(['React', 'Node.js', 'SQL']);
    expect(created.body.stage).toBe('screening');
    expect(created.body.resumeCount).toBe(0);

    const candidateId = created.body.id as string;

    const fetched = await agent.get(`/api/candidates/${candidateId}`).expect(200);
    expect(fetched.body.name).toBe('Grace Hopper');
    expect(fetched.body.education[0].degree).toBe('PhD');

    const searched = await agent.get('/api/candidates?search=grace&stage=screening').expect(200);
    expect(searched.body.total).toBe(1);
    expect(searched.body.candidates[0].id).toBe(candidateId);

    const updated = await agent
      .put(`/api/candidates/${candidateId}`)
      .send({ title: 'Principal Engineer', skills: ['React', 'SQLite', 'Node.js'], yearsExperience: 22 })
      .expect(200);
    expect(updated.body.title).toBe('Principal Engineer');
    expect(updated.body.skills).toEqual(['React', 'SQLite', 'Node.js']);
    expect(updated.body.email).toBe('grace@example.com');
    expect(updated.body.education).toHaveLength(1);

    const staged = await agent
      .patch(`/api/candidates/${candidateId}/stage`)
      .send({ stage: 'interview' })
      .expect(200);
    expect(staged.body.stage).toBe('interview');

    await agent.delete(`/api/candidates/${candidateId}`).expect(204);
    await agent.get(`/api/candidates/${candidateId}`).expect(404);
  });

  it('validates candidate payloads', async () => {
    const response = await agent
      .post('/api/candidates')
      .send({ name: '', email: 'not-an-email' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);

    const missing = await agent.get('/api/candidates/does-not-exist').expect(404);
    expect(missing.body.error.code).toBe('CANDIDATE_NOT_FOUND');
  });

  it('round-trips job create, list, update and delete', async () => {
    const created = await agent
      .post('/api/jobs')
      .send({
        title: 'Product Designer',
        department: 'Design',
        location: 'Bengaluru, Karnataka',
        employmentType: 'Full-time',
        description:
          'Design thoughtful recruiting workflows and accessible product experiences for a global talent platform.',
        requiredSkills: ['Figma', 'UI/UX Design'],
        preferredSkills: ['User Research', 'Prototyping'],
        minExperience: 3,
        maxExperience: 6,
        educationRequirement: "Bachelor's degree",
        status: 'draft',
      })
      .expect(201);

    expect(created.body.title).toBe('Product Designer');
    expect(created.body.status).toBe('draft');
    expect(created.body.requiredSkills).toEqual(['Figma', 'UI/UX Design']);
    expect(created.body.minExperience).toBe(3);
    expect(created.body.maxExperience).toBe(6);
    const jobId = created.body.id as string;

    const list = await agent.get('/api/jobs?status=draft&search=designer').expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.jobs[0].id).toBe(jobId);

    const updated = await agent
      .put(`/api/jobs/${jobId}`)
      .send({ status: 'active', minExperience: 4, preferredSkills: ['User Research'] })
      .expect(200);
    expect(updated.body.status).toBe('active');
    expect(updated.body.minExperience).toBe(4);
    expect(updated.body.maxExperience).toBe(6);
    expect(updated.body.preferredSkills).toEqual(['User Research']);

    const invalidRange = await agent
      .put(`/api/jobs/${jobId}`)
      .send({ minExperience: 8, maxExperience: 5 })
      .expect(400);
    expect(invalidRange.body.error.code).toBe('INVALID_EXPERIENCE_RANGE');

    await agent.delete(`/api/jobs/${jobId}`).expect(204);
    await agent.get(`/api/jobs/${jobId}`).expect(404);
  });

  it('rejects missing, unsupported, corrupt and unreadable resume uploads', async () => {
    const missing = await agent.post('/api/resumes/upload').expect(400);
    expect(missing.body.error.code).toBe('FILE_REQUIRED');

    const unsupported = await agent
      .post('/api/resumes/upload')
      .attach('file', Buffer.from('plain text resume'), { filename: 'resume.txt', contentType: 'text/plain' })
      .expect(400);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const corrupt = await uploadPdf(Buffer.from('this is not a pdf'), 'corrupt.pdf', null).expect(400);
    expect(corrupt.body.error.code).toBe('INVALID_FILE_CONTENT');

    const unreadable = await uploadPdf(Buffer.from('%PDF-1.4\nthis has a header but no objects\n'), 'fake.pdf', null).expect(422);
    expect(unreadable.body.error.code).toBe('RESUME_UNREADABLE');
    expect(unreadable.body.error.details.resumeId).toBeTruthy();

    const failed = await agent.get('/api/resumes?status=failed').expect(200);
    expect(failed.body.resumes.some((resume: { originalName: string }) => resume.originalName === 'fake.pdf')).toBe(true);
  });

  it('parses a real PDF resume, creates a candidate and runs matching', async () => {
    const response = await uploadPdf(createPdf(PDF_LINES)).expect(201);

    expect(response.body.resume.status).toBe('processed');
    expect(response.body.resume.fileType).toBe('pdf');
    expect(response.body.resume.textLength).toBeGreaterThan(100);
    expect(response.body.duplicateCandidate).toBe(false);
    expect(response.body.candidate.name).toContain('Jordan');
    expect(response.body.candidate.email).toBe('jordan.blake@example.com');
    expect(response.body.candidate.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'GraphQL']));
    expect(response.body.match.overallScore).toBeGreaterThan(0);
    expect(response.body.match.source).toBe('deterministic');
    expect(response.body.match.explanation.factors).toHaveLength(4);

    jordanResumeId = response.body.resume.id;
    jordanStoredName = response.body.resume.storedName;
    jordanCandidateId = response.body.candidate.id as string;
    const candidateId = jordanCandidateId;

    const detail = await agent.get(`/api/resumes/${jordanResumeId}`).expect(200);
    expect(detail.body.status).toBe('processed');
    expect(detail.body.candidateName).toContain('Jordan');
    expect(detail.body.resumeText).toContain('React');

    const library = await agent.get('/api/resumes').expect(200);
    expect(library.body.resumes.some((resume: { id: string }) => resume.id === jordanResumeId)).toBe(true);

    const download = await agent.get(`/api/resumes/${jordanResumeId}/download`).expect(200);
    expect(download.headers['content-disposition']).toContain('jordan-blake.pdf');

    const candidate = await agent.get(`/api/candidates/${candidateId}`).expect(200);
    expect(candidate.body.resumeCount).toBe(1);
    expect(candidate.body.matchCount).toBe(1);
    expect(candidate.body.averageMatchScore).toBe(response.body.match.overallScore);
  });

  it('parses DOCX resumes and de-duplicates candidates by email', async () => {
    const docx = await createDocx(DOCX_LINES);
    const response = await agent
      .post('/api/resumes/upload')
      .field('jobId', uploadJobId)
      .attach('file', docx, {
        filename: 'alex-morgan.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(201);

    expect(response.body.resume.status).toBe('processed');
    expect(response.body.resume.fileType).toBe('docx');
    expect(response.body.candidate.name).toContain('Alex');
    expect(response.body.candidate.skills).toEqual(expect.arrayContaining(['Node.js', 'PostgreSQL', 'AWS']));
    expect(response.body.candidate.source).toBe('upload');
    expect(response.body.candidate.id).not.toBe(jordanCandidateId);

    const duplicate = await uploadPdf(createPdf(PDF_LINES), 'jordan-blake-updated.pdf').expect(201);
    expect(duplicate.body.duplicateCandidate).toBe(true);
    expect(duplicate.body.candidate.id).toBe(jordanCandidateId);
    expect(duplicate.body.candidate.email).toBe('jordan.blake@example.com');
    expect(duplicate.body.match.overallScore).toBeGreaterThan(0);

    const candidates = await agent.get('/api/candidates?search=jordan').expect(200);
    expect(candidates.body.total).toBe(1);
    expect(candidates.body.candidates[0].email).toBe('jordan.blake@example.com');
    expect(candidates.body.candidates[0].resumeCount).toBe(2);
    expect(candidates.body.candidates[0].latestJobId).toBe(uploadJobId);
    expect(candidates.body.candidates[0].latestJobTitle).toBe('Senior Frontend Engineer');
    expect(candidates.body.candidates[0].latestJobScore).toBeGreaterThan(0);
  });

  it('runs and explains job rankings through the matching API', async () => {
    const run = await agent.post('/api/matches/run').send({ jobId: uploadJobId }).expect(201);
    expect(run.body.job.id).toBe(uploadJobId);
    expect(run.body.candidateCount).toBeGreaterThanOrEqual(2);
    expect(run.body.matches.length).toBeGreaterThanOrEqual(2);
    expect(run.body.message).toContain('deterministic');
    expect(run.body.lastRunAt).toBeTruthy();

    const scores = run.body.matches.map((match: { overallScore: number }) => match.overallScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    for (const match of run.body.matches) {
      expect(match.source).toBe('deterministic');
      expect(match.weights.skills + match.weights.experience + match.weights.education + match.weights.keywords).toBeCloseTo(100, 1);
      expect(match.candidate.name).toBeTruthy();
    }

    const rankings = await agent.get(`/api/matches/job/${uploadJobId}`).expect(200);
    expect(rankings.body.matches.length).toBe(run.body.matches.length);

    const first = await agent.get(`/api/matches/${run.body.matches[0].id}`).expect(200);
    expect(first.body.explanation.summary.length).toBeGreaterThan(0);

    const missing = await agent.post('/api/matches/run').send({ jobId: 'missing-job' }).expect(404);
    expect(missing.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('exposes analytics, settings and processed-resume lifecycle', async () => {
    const analytics = await agent.get('/api/analytics').expect(200);
    expect(analytics.body.summary.totalCandidates).toBeGreaterThanOrEqual(2);
    expect(analytics.body.summary.resumesProcessed).toBeGreaterThanOrEqual(2);
    expect(analytics.body.summary.matchedCandidates).toBeGreaterThanOrEqual(1);
    expect(analytics.body.trend).toHaveLength(7);

    const dashboard = await agent.get('/api/analytics/dashboard').expect(200);
    expect(dashboard.body.stats.totalCandidates).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.recentActivity.length).toBeGreaterThan(0);

    const settings = await agent.get('/api/settings').expect(200);
    expect(settings.body.weights).toEqual({ skills: 55, experience: 25, education: 10, keywords: 10 });
    expect(typeof settings.body.apiKeyConfigured).toBe('boolean');
    expect(settings.body.sampleData).toEqual({ candidates: 0, jobs: 0, resumes: 0 });

    const demoRemoval = await agent.delete('/api/settings/demo-data').expect(200);
    expect(demoRemoval.body.removed.candidates).toBe(0);
    expect(demoRemoval.body.removed.jobs).toBe(0);
    expect(demoRemoval.body.removed.resumes).toBe(0);

    expect(fs.existsSync(path.join(uploadsDir, jordanStoredName))).toBe(true);
    await agent.delete(`/api/resumes/${jordanResumeId}`).expect(204);
    await agent.get(`/api/resumes/${jordanResumeId}`).expect(404);
    expect(fs.existsSync(path.join(uploadsDir, jordanStoredName))).toBe(false);
  });
});
