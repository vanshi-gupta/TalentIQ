import path from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import type { EducationEntry, ExperienceEntry } from '../types.js';
import { canonicalSkill, dedupeSkills, extractSkillsFromText } from './skills.js';

export interface ParsedResume {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  summary: string | null;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  yearsExperience: number;
  resumeText: string;
  warnings: string[];
}

export type ResumeFileType = 'pdf' | 'docx';

const ROLE_WORDS = /(engineer|developer|designer|manager|analyst|scientist|architect|consultant|specialist|director|lead|researcher|administrator|founder|intern|recruiter|marketer)/i;
const SECTION_HEADINGS = [
  'summary', 'professional summary', 'profile', 'about', 'experience', 'work experience',
  'professional experience', 'employment history', 'education', 'skills', 'technical skills',
  'core skills', 'projects', 'certifications', 'awards', 'publications', 'languages',
  'contact', 'interests', 'volunteer', 'references',
];

function normaliseText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[\t]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 120_000);
}

function isSectionHeading(line: string): boolean {
  const cleaned = line.replace(/[:•|-]+$/g, '').trim().toLowerCase();
  if (!cleaned) return false;
  if (SECTION_HEADINGS.includes(cleaned)) return true;
  return cleaned.length < 42 && SECTION_HEADINGS.some((heading) => cleaned.startsWith(heading + ' '));
}

export function extractSection(text: string, names: string[]): string {
  const lines = text.split('\n');
  const wanted = names.map((name) => name.toLowerCase());
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const cleaned = lines[index].replace(/[:•|-]+$/g, '').trim().toLowerCase();
    const inlineMatch = wanted.some((name) => cleaned === name || cleaned.startsWith(name + ':'));
    if (inlineMatch) {
      start = index;
      break;
    }
  }
  if (start === -1) return '';
  const collected: string[] = [];
  const firstLine = lines[start];
  const inline = firstLine.includes(':') ? firstLine.slice(firstLine.indexOf(':') + 1).trim() : '';
  if (inline) collected.push(inline);
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionHeading(line)) break;
    collected.push(line);
  }
  return collected.join('\n').trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function fallbackName(originalName: string): string {
  const base = path.basename(originalName, path.extname(originalName))
    .replace(/[_-]+/g, ' ')
    .replace(/\b(resume|cv|curriculum vitae|final|copy|updated)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base && /[a-z]/i.test(base) ? titleCase(base).slice(0, 80) : 'Unnamed Candidate';
}

function extractName(text: string, originalName: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 24);
  for (const rawLine of lines) {
    let line = rawLine.split('|')[0].split('•')[0].trim();
    if (!line || line.length > 64) continue;
    if (/@|https?:|www\.|linkedin|github|\d{3}[-.)\s]\d{3}/i.test(line)) continue;
    if (ROLE_WORDS.test(line) || isSectionHeading(line)) continue;
    line = line.replace(/^(name|full name)\s*[:|-]\s*/i, '').trim();
    if (!/^[A-Za-z][A-Za-z.'’\- ]{1,62}$/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (words.every((word) => word === word.toUpperCase()) && words.join('').length < 6) continue;
    return titleCase(line);
  }
  return fallbackName(originalName);
}

function extractTitle(text: string, experience: ExperienceEntry[]): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 30);
  for (const line of lines) {
    if (line.length > 90 || /@|https?:|\d{3}[-.)\s]\d{3}/.test(line)) continue;
    if (ROLE_WORDS.test(line) && line.split(' ').length <= 9) {
      return line.replace(/^[^A-Za-z]+/, '').slice(0, 90);
    }
  }
  return experience[0]?.title ?? null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const pattern = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
  for (const match of text.matchAll(pattern)) {
    const candidate = match[0].trim();
    const digits = candidate.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return candidate;
  }
  return null;
}

function extractLocation(text: string): string | null {
  const labelled = text.match(/(?:location|based in|address)\s*[:|-]\s*([A-Za-z][A-Za-z .,'-]{2,70})/i);
  if (labelled) return labelled[1].trim().replace(/\s{2,}/g, ' ').slice(0, 80);
  const city = text.match(/\b([A-Z][A-Za-z .'-]{2,35}),\s*([A-Z]{2})\b/);
  if (city) return `${city[1].trim()}, ${city[2]}`;
  if (/\bremote\b/i.test(text.slice(0, 1200))) return 'Remote';
  return null;
}

function extractSummary(text: string, candidateTitle: string | null, years: number, skills: string[]): string | null {
  const section = extractSection(text, ['professional summary', 'summary', 'profile', 'about']);
  if (section) {
    const cleaned = section.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 25) return cleaned.slice(0, 520);
  }
  if (!candidateTitle && years <= 0 && skills.length === 0) return null;
  const role = candidateTitle ?? 'Professional';
  const yearsText = years > 0 ? ` with ${years.toFixed(1).replace(/\.0$/, '')}+ years of experience` : '';
  const skillText = skills.length > 0 ? `, strongest in ${skills.slice(0, 5).join(', ')}` : '';
  return `${role}${yearsText}${skillText}. This summary was assembled from parsed resume fields and should be verified.`;
}

function extractSkills(text: string): { skills: string[]; fromSection: string[] } {
  const section = extractSection(text, ['technical skills', 'core skills', 'skills', 'technologies']);
  const fromSection: string[] = [];
  if (section) {
    const items = section
      .replace(/[•▪●]/g, '\n')
      .split(/[,\n|;]+/)
      .map((item) => item.replace(/^[\s:*-]+|[\s:*-]+$/g, '').trim())
      .filter((item) => item.length >= 2 && item.length <= 45);
    for (const item of items) {
      if (/^[a-z][a-z /+#.-]+$/i.test(item)) fromSection.push(canonicalSkill(item));
    }
  }
  const detected = extractSkillsFromText(text);
  const combined = dedupeSkills([...fromSection, ...detected]);
  return { skills: combined.slice(0, 40), fromSection };
}

function extractEducation(text: string): EducationEntry[] {
  const section = extractSection(text, ['education', 'academic background', 'academic qualifications']);
  const source = section || text;
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const entries: EducationEntry[] = [];
  const degreePattern = /(ph\.?\s?d|doctorate|master|m\.?s\.?|msc|m\.?tech|mba|bachelor|b\.?s\.?|b\.?a\.?|b\.?tech|b\.?e\.?|b\.?sc|associate|diploma|high school)/i;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!degreePattern.test(line) || line.length > 180) continue;
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    let institution = '';
    const near = [line, lines[index + 1] ?? '', lines[index + 2] ?? ''].join(' ');
    const instMatch = near.match(/([A-Z][A-Za-z.&' -]{2,70}(?:University|College|Institute|School|Academy))/);
    if (instMatch) institution = instMatch[1].trim();
    if (!institution) {
      const next = lines[index + 1];
      if (next && /(university|college|institute|school|academy)/i.test(next)) institution = next.replace(/,?\s*(19|20)\d{2}.*$/, '').trim();
    }
    const fieldMatch = line.match(/(?:in|of)\s+([A-Z][A-Za-z &-]{2,55})/);
    const degree = line
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\(?GPA\s*:?\s*[\d.]+\s*(?:\/\s*[\d.]+)?\)?/gi, '')
      .replace(/\(?[A-Z][A-Za-z .,'-]{2,50}\)?$/, '')
      .replace(/[,|].*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!degree || degree.length < 3) continue;
    const entry: EducationEntry = {
      degree: degree.slice(0, 120),
      field: fieldMatch ? fieldMatch[1].trim() : undefined,
      institution: institution.slice(0, 120) || undefined,
      year: yearMatch ? yearMatch[0] : undefined,
    };
    if (!entries.some((item) => item.degree.toLowerCase() === entry.degree.toLowerCase())) entries.push(entry);
    if (entries.length >= 4) break;
  }
  return entries;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function parseDateToken(token: string, isEnd: boolean): { year: number; month: number } | null {
  const cleaned = token.trim().toLowerCase();
  if (cleaned === 'present' || cleaned === 'current' || cleaned === 'now') {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const monthYear = cleaned.match(/([a-z]{3,9})\s+(\d{4})/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]];
    if (month !== undefined) return { year: Number(monthYear[2]), month: isEnd ? month + 1 : month };
  }
  const yearOnly = cleaned.match(/(\d{4})/);
  if (yearOnly) return { year: Number(yearOnly[1]), month: isEnd ? 12 : 0 };
  return null;
}

function mergeMonths(intervals: { start: number; end: number }[]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.map((i) => ({ ...i })).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  const totalMonths = merged.reduce((total, interval) => total + Math.max(0, interval.end - interval.start), 0);
  return Math.min(45, totalMonths / 12);
}

function extractExperience(text: string): { experience: ExperienceEntry[]; years: number } {
  const section = extractSection(text, ['professional experience', 'work experience', 'employment history', 'experience']);
  const source = section || text;
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const rangePattern = /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*\s+\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*\s+\d{4}|present|current|now|\d{4})/gi;
  const intervals: { start: number; end: number }[] = [];
  const experience: ExperienceEntry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matches = [...line.matchAll(rangePattern)];
    if (matches.length === 0) continue;
    const match = matches[0];
    const start = parseDateToken(match[1], false);
    const end = parseDateToken(match[2], true);
    if (!start || !end) continue;
    const startMonth = start.year * 12 + start.month;
    let endMonth = end.year * 12 + end.month;
    if (endMonth < startMonth && end.month === 0) endMonth = end.year * 12 + 12;
    if (endMonth > startMonth && endMonth - startMonth < 600) intervals.push({ start: startMonth, end: endMonth });
    const beforeDate = line.slice(0, match.index).replace(/[|•,–—-]+$/g, '').trim();
    let title = beforeDate;
    if (!title || title.length < 3) {
      for (let offset = 1; offset <= 2; offset += 1) {
        const previous = lines[index - offset];
        if (previous && !rangePattern.test(previous) && previous.length < 100) {
          title = previous.replace(/[|•,–—-]+$/g, '').trim();
          break;
        }
      }
    }
    const afterDate = line.slice((match.index ?? 0) + match[0].length).replace(/^[|•,–—-]+/, '').trim();
    let company = afterDate;
    if (!company) {
      const next = lines[index + 1];
      if (next && !rangePattern.test(next) && next.length < 100) company = next.trim();
    }
    const description = [lines[index + 2], lines[index + 3]]
      .filter((value): value is string => Boolean(value) && value.length > 30 && !rangePattern.test(value))
      .slice(0, 2)
      .join(' ')
      .slice(0, 260);
    title = (title || 'Role not specified').replace(/\s+/g, ' ').slice(0, 100);
    company = company.replace(/\s+/g, ' ').slice(0, 100);
    if (!experience.some((entry) => entry.title === title && entry.start === match[1])) {
      experience.push({
        title,
        company: company || undefined,
        start: match[1],
        end: match[2],
        description: description || undefined,
      });
    }
    if (experience.length >= 6) break;
  }
  let years = mergeMonths(intervals);
  if (years === 0) {
    const explicit = text.match(/(\d+(?:\.\d+)?)\+?\s*years?\s+(?:of\s+)?(?:professional\s+|relevant\s+)?experience/i);
    if (explicit) years = Math.min(45, Number(explicit[1]));
  }
  return { experience, years: Math.round(years * 10) / 10 };
}

export function parseResume(textInput: string, originalName: string): ParsedResume {
  const text = normaliseText(textInput);
  if (text.length < 24) {
    throw new Error('Not enough readable text was found in this resume. Scanned or image-only files are not supported.');
  }
  const warnings: string[] = [];
  const education = extractEducation(text);
  const experienceResult = extractExperience(text);
  const skillsResult = extractSkills(text);
  const name = extractName(text, originalName);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const location = extractLocation(text);
  const title = extractTitle(text, experienceResult.experience);
  const summary = extractSummary(text, title, experienceResult.years, skillsResult.skills);
  if (!email) warnings.push('No email address was detected.');
  if (!phone) warnings.push('No phone number was detected.');
  if (experienceResult.years === 0) warnings.push('No reliable employment dates were detected; verify experience manually.');
  if (education.length === 0) warnings.push('No formal education record was detected.');
  if (skillsResult.skills.length < 4) warnings.push('Only a few skills were recognized. Review the raw resume text.');
  return {
    name,
    email,
    phone,
    location,
    title,
    summary,
    skills: skillsResult.skills,
    education,
    experience: experienceResult.experience,
    yearsExperience: experienceResult.years,
    resumeText: text,
    warnings,
  };
}

export function fileTypeFromName(originalName: string): ResumeFileType | null {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  return null;
}

export function validateFileMagic(buffer: Buffer, fileType: ResumeFileType): boolean {
  if (fileType === 'pdf') return buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  if (fileType === 'docx') {
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  return false;
}

export async function extractResumeText(buffer: Buffer, fileType: ResumeFileType): Promise<string> {
  if (fileType === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > 60) throw new Error('This PDF has too many pages (maximum 60).');
    const result = await extractText(pdf, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join('\n') : result.text;
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function safeOriginalName(originalName: string): string {
  const base = path.basename(originalName || 'resume');
  return base.replace(/[\u0000-\u001F<>:"/\\|?*]/g, '_').slice(0, 180) || 'resume';
}
