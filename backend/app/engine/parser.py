"""Resume parsing: file -> text -> structured profile.

Uses PyMuPDF (PDF) and python-docx (DOCX) for extraction. spaCy (if installed) is used for
named-entity extraction (person name, organisations, dates); otherwise rule-based heuristics
are used. `parser_info()` reports which mode is active so the UI never overstates capability.
"""
from __future__ import annotations
import io
import re
from datetime import date

from . import skills as sk

_nlp = None
_nlp_tried = False


def get_nlp():
    """Load spaCy model if available (en_core_web_sm). Returns None if not."""
    global _nlp, _nlp_tried
    if _nlp_tried:
        return _nlp
    _nlp_tried = True
    try:
        import spacy  # type: ignore
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            _nlp = None
    except Exception:
        _nlp = None
    return _nlp


def parser_info() -> dict:
    nlp = get_nlp()
    try:
        import fitz  # noqa: F401
        pdf = "PyMuPDF"
    except Exception:
        pdf = "unavailable (install PyMuPDF)"
    return {
        "entity_extraction": "spaCy en_core_web_sm" if nlp else "rule-based heuristics (spaCy model not installed)",
        "pdf_reader": pdf,
        "docx_reader": "python-docx",
    }


# ------------------------------------------------------------------ text extraction
class ResumeParseError(Exception):
    pass


def extract_text(filename: str, data: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        try:
            import fitz  # PyMuPDF
        except Exception as e:  # pragma: no cover
            raise ResumeParseError("PDF support requires PyMuPDF (pip install pymupdf).") from e
        try:
            doc = fitz.open(stream=data, filetype="pdf")
            text = "\n".join(page.get_text("text") for page in doc)
        except Exception as e:
            raise ResumeParseError(f"Could not read PDF: {e}") from e
    elif ext == "docx":
        try:
            import docx
            d = docx.Document(io.BytesIO(data))
            parts = [p.text for p in d.paragraphs]
            for t in d.tables:
                for row in t.rows:
                    parts.append(" | ".join(c.text for c in row.cells))
            text = "\n".join(parts)
        except Exception as e:
            raise ResumeParseError(f"Could not read DOCX: {e}") from e
    elif ext == "txt":
        text = data.decode("utf-8", errors="ignore")
    else:
        raise ResumeParseError("Unsupported file type. Please upload a PDF or DOCX file.")
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < 40:
        raise ResumeParseError("No readable text found. Scanned/image-only resumes are not supported (no OCR).")
    return text


# ------------------------------------------------------------------ sectioning
SECTION_ALIASES = {
    "summary": ["summary", "professional summary", "profile", "objective", "career objective", "about me", "about"],
    "skills": ["skills", "technical skills", "key skills", "core competencies", "skills & tools", "technologies",
               "skills and tools"],
    "experience": ["experience", "work experience", "professional experience", "employment history",
                   "work history", "internships", "internship experience"],
    "education": ["education", "academic background", "academics", "qualifications", "educational qualification",
                  "education & training"],
    "projects": ["projects", "academic projects", "personal projects", "key projects", "selected projects"],
    "certifications": ["certifications", "certificates", "licenses", "courses", "certifications & courses",
                       "training & certifications"],
    "achievements": ["achievements", "awards", "honors", "accomplishments", "awards & achievements"],
}
_HEADER_LOOKUP = {a: k for k, v in SECTION_ALIASES.items() for a in v}


def split_sections(text: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in text.split("\n"):
        key = re.sub(r"[^a-z &]", "", line.strip().lower()).strip(" :")
        if key in _HEADER_LOOKUP and len(line.strip()) < 40:
            current = _HEADER_LOOKUP[key]
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items()}


# ------------------------------------------------------------------ field extractors
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?<![\w])\+?\d[\d\s().-]{8,17}\d(?![\w])")
LINK_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:linkedin\.com/in|github\.com)/[\w\-./]+", re.I)
NAME_STOP = {"resume", "curriculum", "vitae", "cv", "profile", "summary", "email", "phone", "address", "objective"}


def extract_name(text: str) -> str | None:
    head = "\n".join([l for l in text.split("\n") if l.strip()][:8])
    nlp = get_nlp()
    if nlp:
        doc = nlp(head)
        for ent in doc.ents:
            if ent.label_ == "PERSON" and 2 <= len(ent.text.split()) <= 4:
                return ent.text.strip().title()
    for line in head.split("\n"):
        l = line.strip()
        if not l or EMAIL_RE.search(l) or re.search(r"\d", l):
            continue
        words = l.split()
        if 2 <= len(words) <= 4 and all(re.fullmatch(r"[A-Za-z.'\-]+", w) for w in words) \
                and not (set(w.lower() for w in words) & NAME_STOP):
            return l.title() if l.isupper() else l
    return None


def extract_contact(text: str) -> dict:
    head = text[:900]
    email = EMAIL_RE.search(head) or EMAIL_RE.search(text)
    phone = None
    for m in PHONE_RE.finditer(head):
        digits = re.sub(r"\D", "", m.group(0))
        if 10 <= len(digits) <= 13:
            phone = m.group(0).strip()
            break
    links = LINK_RE.findall(text)
    loc = None
    m = re.search(r"(?:Location|Address)\s*[:\-]\s*(.+)", head, re.I)
    if m:
        loc = m.group(1).strip()[:80]
    return {"email": email.group(0) if email else None, "phone": phone, "links": list(dict.fromkeys(links))[:3],
            "location": loc}


DEGREES = [
    (5, r"ph\.?d|doctorate|doctor of philosophy"),
    (4, r"m\.?tech|m\.?sc|m\.?s\b|m\.?e\b|mca|mba|master(?:'s|s)?|m\.?eng|m\.?a\b|m\.?com"),
    (3, r"b\.?tech|b\.?e\b|b\.?sc|b\.?s\b|bca|bachelor(?:'s|s)?|b\.?eng|b\.?a\b|b\.?com|b\.?des"),
    (2, r"diploma|associate"),
    (1, r"high school|12th|hsc|senior secondary|10th|ssc"),
]
LEVEL_NAME = {0: "Not specified", 1: "High School", 2: "Diploma", 3: "Bachelor's", 4: "Master's", 5: "PhD"}
FIELD_RE = re.compile(
    r"(?:in|of)\s+([A-Z][A-Za-z&,\- ]{3,50}?)(?:\s*[,|(\n]|\s+from\b|\s+at\b|$)")


def education_level_from_text(s: str) -> int:
    low = s.lower()
    for lvl, pat in DEGREES:
        if re.search(rf"(?<![a-z])(?:{pat})(?![a-z])", low):
            return lvl
    return 0


def extract_education(section: str, full: str) -> list[dict]:
    src = section or full
    entries = []
    for line in [l.strip() for l in src.split("\n") if l.strip()]:
        lvl = education_level_from_text(line)
        if lvl >= 2 or (section and lvl >= 1):
            fm = FIELD_RE.search(line)
            yrs = re.findall(r"(?:19|20)\d{2}", line)
            entries.append({"degree": line[:140], "level": lvl, "level_name": LEVEL_NAME[lvl],
                            "field": fm.group(1).strip() if fm else None,
                            "year": yrs[-1] if yrs else None})
    return entries[:5]


def highest_education(entries: list[dict]) -> int:
    return max([e["level"] for e in entries], default=0)


MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
RANGE_RE = re.compile(
    r"(?:(?P<m1>[A-Za-z]{3,9})\.?\s+)?(?P<y1>(?:19|20)\d{2})\s*(?:-|–|—|to)\s*"
    r"(?:(?P<m2>[A-Za-z]{3,9})\.?\s+)?(?P<y2>(?:19|20)\d{2}|present|current|now|till date)", re.I)


def _mi(m: str | None, y: int, default: int) -> int:
    mm = MONTHS.get((m or "")[:3].lower(), default)
    return y * 12 + mm


def estimate_experience_years(section: str, full: str) -> float:
    """Merge date ranges from the experience section (not education) into total years."""
    src = section if section else full
    today = date.today()
    spans = []
    for m in RANGE_RE.finditer(src):
        y1 = int(m.group("y1"))
        end = m.group("y2").lower()
        y2 = today.year if not end.isdigit() else int(end)
        s = _mi(m.group("m1"), y1, 1)
        e = (today.year * 12 + today.month) if not end.isdigit() else _mi(m.group("m2"), y2, 12)
        if e >= s and (e - s) <= 12 * 40:
            spans.append((s, e))
    spans.sort()
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    from_dates = sum(e - s for s, e in merged) / 12.0
    stated = 0.0
    for m in re.finditer(r"(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b", full, re.I):
        v = float(m.group(1))
        if v <= 40:
            stated = max(stated, v)
    return round(max(from_dates, stated if not from_dates else min(stated, from_dates + 1)), 1)


def extract_experience(section: str) -> list[dict]:
    items, cur = [], None
    for raw in section.split("\n"):
        line = raw.strip()
        if not line:
            continue
        is_bullet = bool(re.match(r"^[•\-\*▪●◦·]\s*", line))
        if not is_bullet and (RANGE_RE.search(line) or re.search(r"\b(engineer|developer|analyst|intern|manager|"
                                                                  r"scientist|designer|consultant|lead|architect|"
                                                                  r"administrator|specialist)\b", line, re.I)) \
                and len(line) < 140:
            cur = {"title": line, "bullets": []}
            items.append(cur)
        elif cur is not None:
            cur["bullets"].append(re.sub(r"^[•\-\*▪●◦·]\s*", "", line))
        else:
            cur = {"title": line[:100], "bullets": []}
            items.append(cur)
    return items[:10]


def extract_projects(section: str) -> list[dict]:
    items, cur = [], None
    for raw in section.split("\n"):
        line = raw.strip()
        if not line:
            continue
        is_bullet = bool(re.match(r"^[•\-\*▪●◦·]\s*", line))
        if not is_bullet and len(line) < 110 and (cur is None or cur["description"] or len(line) < 70):
            cur = {"name": line, "description": ""}
            items.append(cur)
        elif cur is not None:
            txt = re.sub(r"^[•\-\*▪●◦·]\s*", "", line)
            cur["description"] = (cur["description"] + " " + txt).strip()
    return items[:8]


CERT_HINTS = re.compile(
    r"certified|certification|certificate|aws|azure|google cloud|pmp|scrum master|ccna|coursera|udemy|nptel|"
    r"edx|oracle|comptia|tensorflow developer|specialization", re.I)


def extract_certifications(section: str, full: str) -> list[str]:
    certs = []
    src = section.split("\n") if section else [l for l in full.split("\n") if CERT_HINTS.search(l) and len(l) < 120
                                                and "@" not in l]
    for l in src:
        l = re.sub(r"^[•\-\*▪●◦·]\s*", "", l.strip())
        if 4 < len(l) < 140:
            certs.append(l)
    return list(dict.fromkeys(certs))[:8]


def extract_achievements(section: str, full: str) -> list[str]:
    out = []
    if section:
        out = [re.sub(r"^[•\-\*▪●◦·]\s*", "", l.strip()) for l in section.split("\n") if len(l.strip()) > 10]
    else:
        for l in full.split("\n"):
            l = l.strip()
            if re.search(r"\b(award|won|winner|rank(?:ed)?|first place|hackathon|scholarship|improved|reduced|"
                         r"increased)\b", l, re.I) and re.search(r"\d", l) and 15 < len(l) < 200:
                out.append(re.sub(r"^[•\-\*▪●◦·]\s*", "", l))
    return out[:6]


# ------------------------------------------------------------------ main entry
def parse_resume(text: str) -> dict:
    sections = split_sections(text)
    name = extract_name(text)
    contact = extract_contact(text)
    edu = extract_education(sections.get("education", ""), text)
    exp_section = sections.get("experience", "")
    years = estimate_experience_years(exp_section, text)
    skills_text = text  # whole document: skills may also be evidenced in projects/experience
    all_skills = sk.find_skills(skills_text)
    listed = set(sk.find_skills(sections.get("skills", ""))) if sections.get("skills") else set()
    tech = [s for s in all_skills if not sk.is_soft(s)]
    soft = [s for s in all_skills if sk.is_soft(s)]
    profile = {
        "name": name,
        "email": contact["email"],
        "phone": contact["phone"],
        "links": contact["links"],
        "location": contact["location"],
        "summary": sections.get("summary", "")[:600],
        "technical_skills": tech,
        "soft_skills": soft,
        "listed_skills": sorted(listed),
        "education": edu,
        "highest_education_level": highest_education(edu),
        "highest_education": LEVEL_NAME[highest_education(edu)],
        "certifications": extract_certifications(sections.get("certifications", ""), text),
        "experience": extract_experience(exp_section),
        "experience_years": years,
        "projects": extract_projects(sections.get("projects", "")),
        "achievements": extract_achievements(sections.get("achievements", ""), text),
        "sections_found": [k for k in sections if k != "header" and sections[k]],
    }
    return profile


def evidence_text(profile: dict, raw_text: str) -> list[str]:
    """Sentences/bullets that can serve as evidence for semantic skill matching."""
    lines = []
    for e in profile.get("experience", []):
        lines.append(e["title"])
        lines.extend(e["bullets"])
    for p in profile.get("projects", []):
        lines.append((p["name"] + ". " + p["description"]).strip())
    lines.extend(profile.get("achievements", []))
    if profile.get("summary"):
        lines.append(profile["summary"])
    if not lines:
        lines = [l.strip() for l in raw_text.split("\n") if len(l.strip()) > 25]
    return [l for l in lines if len(l) > 15][:80]


# ------------------------------------------------------------------ job description NLP
LEVEL_WORDS = [(5, r"ph\.?d|doctorate"), (4, r"master|m\.?tech|m\.?sc|mba|mca"),
               (3, r"bachelor|b\.?tech|b\.?e\b|b\.?sc|bca|degree"), (2, r"diploma")]


def extract_job_requirements(title: str, description: str) -> dict:
    """NLP extraction from a free-text job description."""
    text = f"{title}\n{description}"
    lines = description.split("\n")
    required, preferred = [], []
    mode = "required"
    for line in lines:
        low = line.lower()
        if re.search(r"nice to have|preferred|good to have|bonus|plus\b|desirable|optional", low) and len(line) < 80:
            mode = "preferred"
        elif re.search(r"requirement|must have|required|qualifications|what you.ll need|responsibilit", low) \
                and len(line) < 80:
            mode = "required"
        found = sk.find_skills(line)
        inline_pref = bool(re.search(r"nice to have|preferred|good to have|bonus|a plus|desirable", low))
        for s in found:
            (preferred if (mode == "preferred" or inline_pref) else required).append(s)
    required = list(dict.fromkeys(required))
    preferred = [s for s in dict.fromkeys(preferred) if s not in required]
    m = re.search(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)", text, re.I)
    min_exp = float(m.group(1)) if m else 0.0
    level = 0
    for lvl, pat in LEVEL_WORDS:
        if re.search(rf"(?<![a-z])(?:{pat})(?![a-z])", text.lower()):
            level = lvl
            break
    return {"required_skills": required, "preferred_skills": preferred, "min_experience": min_exp,
            "education_level": level}
