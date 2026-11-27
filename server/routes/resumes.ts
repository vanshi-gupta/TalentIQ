import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { getDb, logActivity, mapResume, newId, nowIso } from '../database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canonicalSkill, dedupeSkills } from '../services/skills.js';
import { analyzeResumeIntegrity } from '../services/integrityRadarService.js';
import { findCandidate, findJob, persistMatch, cleanupResumeFile, requireCandidate } from '../services/matchService.js';
import {
  extractResumeText,
  fileTypeFromName,
  parseResume,
  safeOriginalName,
  validateFileMagic,
} from '../services/resumeParser.js';
import type { ResumeRecord } from '../types.js';

const router = Router();
router.use(requireAuth);

function maxUploadBytes(): number {
  const configured = Number(process.env.MAX_FILE_SIZE_MB || 10);
  const megabytes = Number.isFinite(configured) ? Math.min(25, Math.max(1, configured)) : 10;
  return megabytes * 1024 * 1024;
}

function uploadsDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || './data/uploads');
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
  'application/zip',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes(), files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => {
    if (!fileTypeFromName(file.originalname)) {
      callback(new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and DOCX resumes are accepted.'));
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, 'UNSUPPORTED_MIME_TYPE', 'The uploaded file does not have a valid resume content type.'));
      return;
    }
    callback(null, true);
  },
});

interface ResumeRow {
  id: string;
  candidate_id: string | null;
  user_id?: string | null;
  original_name: string;
  stored_name: string | null;
  file_type: string;
  file_size: number;
  status: string;
  error_message: string | null;
  text_length: number;
  integrity_report?: string | null;
  is_sample: number;
  created_at: string;
  resume_text?: string;
  candidate_name?: string | null;
}

function resumeRow(id: string): ResumeRow | undefined {
  return getDb()
    .prepare('SELECT r.*, c.resume_text, c.name AS candidate_name FROM resumes r LEFT JOIN candidates c ON c.id = r.candidate_id WHERE r.id = ?')
    .get(id) as ResumeRow | undefined;
}

router.post(
  '/upload',
  requireRole('recruiter'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Choose a PDF or DOCX resume to upload.');
    const originalName = safeOriginalName(req.file.originalname);
    const fileType = fileTypeFromName(originalName);
    if (!fileType) throw new AppError(400, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and DOCX resumes are accepted.');
    if (!validateFileMagic(req.file.buffer, fileType)) {
      throw new AppError(
        400,
        'INVALID_FILE_CONTENT',
        fileType === 'pdf'
          ? 'This file does not look like a valid PDF. Check that it is not corrupted or renamed.'
          : 'This file does not look like a valid DOCX document. Check that it is not corrupted or renamed.',
      );
    }

    const requestedJobId = typeof req.body?.jobId === 'string' ? req.body.jobId.trim() : '';
    const targetJob = requestedJobId ? findJob(requestedJobId) : null;
    if (requestedJobId && !targetJob) throw new AppError(404, 'JOB_NOT_FOUND', 'The selected job could not be found.');

    const directory = uploadsDir();
    fs.mkdirSync(directory, { recursive: true });
    const storedName = `${randomUUID()}.${fileType}`;
    const storedPath = path.resolve(directory, storedName);
    if (!storedPath.startsWith(directory + path.sep)) {
      throw new AppError(500, 'UPLOAD_PATH_ERROR', 'The upload could not be stored safely.');
    }
    await fs.promises.writeFile(storedPath, req.file.buffer, { flag: 'wx' });

    let parsedText: string;
    let parsed;
    try {
      parsedText = await extractResumeText(req.file.buffer, fileType);
      parsed = parseResume(parsedText, originalName);
    } catch (error) {
      const resumeId = newId();
      const message = error instanceof Error ? error.message : 'The resume could not be parsed.';
      const friendly = /password|encrypted/i.test(message)
        ? 'This PDF appears to be password-protected. Remove the password and try again.'
        : /Not enough readable text|image-only|scanned/i.test(message)
          ? message
          : 'We could not extract readable text from this resume. Try a text-based PDF or DOCX file.';
      getDb().prepare(
        `INSERT INTO resumes (id, candidate_id, user_id, original_name, stored_name, file_type, file_size, status, error_message, text_length, is_sample, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 'failed', ?, 0, 0, ?)`,
      ).run(resumeId, req.user!.id, originalName, storedName, fileType, req.file.size, friendly, nowIso());
      logActivity('resume_failed', `${originalName} could not be parsed: ${friendly}`, { meta: { resumeId } });
      throw new AppError(422, 'RESUME_UNREADABLE', friendly, { resumeId });
    }

    const timestamp = nowIso();
    const resumeId = newId();
    const existingRow = parsed.email
      ? (getDb().prepare('SELECT * FROM candidates WHERE lower(email) = ?').get(parsed.email.toLowerCase()) as { id: string } | undefined)
      : undefined;
    let candidateId: string;

    if (existingRow) {
      const current = findCandidate(existingRow.id, true);
      if (!current) throw new AppError(500, 'CANDIDATE_LOOKUP_FAILED', 'The existing candidate could not be loaded.');
      candidateId = current.id;
      getDb().prepare(
        `UPDATE candidates SET phone = ?, location = ?, title = ?, summary = ?, skills = ?, education = ?, experience = ?, years_experience = ?, resume_text = ?, updated_at = ? WHERE id = ?`,
      ).run(
        parsed.phone || current.phone,
        parsed.location || current.location,
        parsed.title || current.title,
        parsed.summary || current.summary,
        JSON.stringify(dedupeSkills([...current.skills, ...parsed.skills])),
        JSON.stringify(parsed.education.length ? parsed.education : current.education),
        JSON.stringify(parsed.experience.length ? parsed.experience : current.experience),
        Math.max(current.yearsExperience, parsed.yearsExperience),
        parsed.resumeText,
        timestamp,
        candidateId,
      );
    } else {
      candidateId = newId();
      getDb().prepare(
        `INSERT INTO candidates (id, name, email, phone, location, title, summary, skills, education, experience, years_experience, resume_text, stage, source, is_sample, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'upload', 0, ?, ?)`,
      ).run(
        candidateId,
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.location,
        parsed.title,
        parsed.summary,
        JSON.stringify(dedupeSkills(parsed.skills.map((skill) => canonicalSkill(skill)))),
        JSON.stringify(parsed.education),
        JSON.stringify(parsed.experience),
        parsed.yearsExperience,
        parsed.resumeText,
        timestamp,
        timestamp,
      );
    }

    const candidate = requireCandidate(candidateId, true);
    const integrityReport = analyzeResumeIntegrity(candidate);

    getDb().prepare(
      `INSERT INTO resumes (id, candidate_id, user_id, original_name, stored_name, file_type, file_size, status, error_message, text_length, integrity_report, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'processed', NULL, ?, ?, 0, ?)`,
    ).run(
      resumeId,
      candidateId,
      req.user!.id,
      originalName,
      storedName,
      fileType,
      req.file.size,
      parsed.resumeText.length,
      JSON.stringify(integrityReport),
      timestamp,
    );

    logActivity(
      'resume_processed',
      existingRow
        ? `A new resume was processed for ${parsed.name}.`
        : `${parsed.name}'s resume was parsed and added to the pipeline.`,
      { candidateId, meta: { resumeId, originalName, warnings: parsed.warnings.length } },
    );

    let match = null;
    if (targetJob) {
      match = persistMatch(candidate, targetJob);
      getDb()
        .prepare(
          `INSERT OR IGNORE INTO applications (id, job_id, candidate_id, user_id, stage, match_id, is_sample, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'screening', ?, 0, ?, ?)`,
        )
        .run(newId(), targetJob.id, candidateId, candidate.userId ?? null, match.id, timestamp, timestamp);
      logActivity('match_run', `${candidate.name} was matched to ${targetJob.title} at ${Math.round(match.overallScore)}%.`, {
        candidateId,
        jobId: targetJob.id,
        meta: { matchId: match.id, score: match.overallScore },
      });
    }

    const result: ResumeRecord = {
      id: resumeId,
      candidateId,
      originalName,
      fileType,
      fileSize: req.file.size,
      status: 'processed',
      errorMessage: null,
      textLength: parsed.resumeText.length,
      isSample: false,
      createdAt: timestamp,
      storedName,
      integrityReport,
    };
    res.status(201).json({
      resume: result,
      candidate,
      match,
      integrityReport,
      warnings: parsed.warnings,
      duplicateCandidate: Boolean(existingRow),
    });
  }),
);

router.get(
  '/',
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? '').trim();
    const candidateId = String(req.query.candidateId ?? '').trim();
    const clauses: string[] = [];
    const params: string[] = [];
    if (status === 'processed' || status === 'failed') {
      clauses.push('r.status = ?');
      params.push(status);
    }
    if (candidateId) {
      clauses.push('r.candidate_id = ?');
      params.push(candidateId);
    }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const rows = getDb()
      .prepare(`SELECT r.*, c.name AS candidate_name FROM resumes r LEFT JOIN candidates c ON c.id = r.candidate_id${where} ORDER BY r.created_at DESC`)
      .all(...params) as unknown as Parameters<typeof mapResume>[0][];
    res.json({ resumes: rows.map((row) => mapResume(row)), total: rows.length });
  }),
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const row = resumeRow(req.params.id);
    if (!row) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found.');
    if (req.user!.role !== 'recruiter') {
      const ownerCand = row.candidate_id
        ? (getDb().prepare('SELECT user_id FROM candidates WHERE id = ?').get(row.candidate_id) as { user_id: string | null } | undefined)
        : undefined;
      if (row.user_id !== req.user!.id && ownerCand?.user_id !== req.user!.id) {
        throw new AppError(403, 'FORBIDDEN', 'You are not authorized to download this resume.');
      }
    }
    if (row.is_sample || !row.stored_name) {
      throw new AppError(404, 'SAMPLE_FILE_UNAVAILABLE', 'This is labeled sample data and does not include a downloadable file.');
    }
    const directory = uploadsDir();
    const filePath = path.resolve(directory, path.basename(row.stored_name));
    if (!filePath.startsWith(directory + path.sep)) {
      throw new AppError(400, 'INVALID_FILE_PATH', 'The stored resume path is invalid.');
    }
    if (!fs.existsSync(filePath)) throw new AppError(404, 'FILE_MISSING', 'The stored resume file is no longer available.');
    res.download(filePath, safeOriginalName(row.original_name));
  }),
);

router.get(
  '/:id',
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const row = resumeRow(req.params.id);
    if (!row) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found.');
    res.json({
      ...mapResume(row, true),
      resumeText: row.resume_text ?? '',
      candidateName: row.candidate_name ?? null,
    });
  }),
);

router.delete(
  '/:id',
  requireRole('recruiter'),
  asyncHandler(async (req, res) => {
    const row = resumeRow(req.params.id);
    if (!row) throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found.');
    getDb().prepare('DELETE FROM resumes WHERE id = ?').run(row.id);
    if (!row.is_sample) cleanupResumeFile(row.stored_name);
    logActivity('resume_deleted', `${row.original_name} was removed from the resume library.`, { meta: { resumeId: row.id } });
    res.status(204).send();
  }),
);

export default router;
