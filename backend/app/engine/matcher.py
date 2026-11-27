"""Explainable weighted matching engine.

score = w_skills*skills + w_experience*experience + w_education*education + w_semantic*semantic
Every component is returned with its raw value, weight and contribution so no score is unexplained.
Protected attributes (name, age, gender, religion, caste, photo...) are never inputs.
"""
from __future__ import annotations
from . import embedder, parser, skills as sk

DEFAULT_WEIGHTS = {"skills": 0.40, "experience": 0.25, "education": 0.15, "semantic": 0.20}
SEMANTIC_PARTIAL_CREDIT = 0.7


def normalise_weights(w: dict | None) -> dict:
    w = {**DEFAULT_WEIGHTS, **(w or {})}
    total = sum(max(0.0, float(v)) for v in w.values()) or 1.0
    return {k: max(0.0, float(v)) / total for k, v in w.items()}


def category_for(score: float) -> str:
    if score >= 80:
        return "Excellent Match"
    if score >= 65:
        return "Strong Match"
    if score >= 45:
        return "Moderate Match"
    return "Low Match"


def candidate_skill_set(profile: dict) -> set[str]:
    return set(profile.get("technical_skills", [])) | set(profile.get("soft_skills", []))


def _skill_matching(required: list[str], candidate: set[str], evidence: list[str]) -> dict:
    """Exact match first; for the rest, semantic evidence search over resume sentences."""
    exact = [s for s in required if s in candidate]
    rest = [s for s in required if s not in candidate]
    semantic, missing = [], []
    if rest and evidence:
        concepts = [sk.concept(s) for s in rest]
        sim = embedder.similarity_matrix(concepts, evidence)
        thr = embedder.concept_threshold()
        for i, s in enumerate(rest):
            j = int(sim[i].argmax())
            if sim[i, j] >= thr:
                semantic.append({"skill": s, "evidence": evidence[j][:200], "similarity": round(float(sim[i, j]), 2)})
            else:
                missing.append(s)
    else:
        missing = rest
    return {"exact": exact, "semantic": semantic, "missing": missing}


def score_candidate(profile: dict, raw_text: str, job: dict, weights: dict | None = None) -> dict:
    """job: {title, description, required_skills, preferred_skills, min_experience, education_level}"""
    w = normalise_weights(weights)
    cand = candidate_skill_set(profile)
    evidence = parser.evidence_text(profile, raw_text)
    req = job.get("required_skills") or []
    pref = job.get("preferred_skills") or []

    rm = _skill_matching(req, cand, evidence)
    pm = _skill_matching(pref, cand, evidence)

    def ratio(m, n):
        return (len(m["exact"]) + SEMANTIC_PARTIAL_CREDIT * len(m["semantic"])) / n if n else None

    r_ratio, p_ratio = ratio(rm, len(req)), ratio(pm, len(pref))
    if r_ratio is None and p_ratio is None:
        skills_score = 0.5  # nothing specified: neutral, flagged in explanation
    elif p_ratio is None:
        skills_score = r_ratio
    elif r_ratio is None:
        skills_score = p_ratio
    else:
        skills_score = 0.8 * r_ratio + 0.2 * p_ratio

    # experience
    years = float(profile.get("experience_years") or 0)
    min_exp = float(job.get("min_experience") or 0)
    exp_raw = 1.0 if min_exp <= 0 else min(1.0, years / min_exp)
    # Years in an unrelated field don't satisfy the requirement: discount experience when little of the
    # required skill set is evidenced (full credit once >=50% of skills are matched).
    has_skill_req = bool(req or pref)
    relevance = 0.3 + 0.7 * min(1.0, skills_score / 0.5) if has_skill_req else 1.0
    exp_score = exp_raw * relevance

    # education
    have = int(profile.get("highest_education_level") or 0)
    need = int(job.get("education_level") or 0)
    edu_score = 1.0 if need <= 0 else max(0.0, 1.0 - 0.4 * max(0, need - have))
    if need > 0 and have == 0:
        edu_score = 0.3  # unknown education: partial, flagged

    # semantic relevance: job text vs candidate evidence
    job_text = " ".join([job.get("title", ""), job.get("description", ""), " ".join(req), " ".join(pref)])
    cand_text = " ".join([" ".join(sorted(cand)), " ".join(evidence)]).strip() or raw_text[:3000]
    raw_cos = float(embedder.similarity_matrix([job_text], [cand_text])[0, 0])
    sem_score = embedder.calibrate(raw_cos)

    comps = {
        "skills": skills_score, "experience": exp_score, "education": edu_score, "semantic": sem_score}
    breakdown = {k: {"score": round(v * 100, 1), "weight": round(w[k] * 100, 1),
                     "contribution": round(v * w[k] * 100, 1)} for k, v in comps.items()}
    total = round(sum(v * w[k] for k, v in comps.items()) * 100, 1)

    result = {
        "total": total,
        "category": category_for(total),
        "breakdown": breakdown,
        "matched_skills": rm["exact"] + [s["skill"] for s in rm["semantic"]],
        "exact_skills": rm["exact"],
        "semantic_skills": rm["semantic"],
        "missing_skills": rm["missing"],
        "preferred_matched": pm["exact"] + [s["skill"] for s in pm["semantic"]],
        "preferred_missing": pm["missing"],
        "experience_years": years,
        "required_experience": min_exp,
        "experience_relevance": round(relevance, 2),
        "education": profile.get("highest_education", "Not specified"),
        "semantic_raw_cosine": round(raw_cos, 3),
        "engine": embedder.info()["engine"],
    }
    result["explanation"] = explain(profile, job, result)
    return result


# ------------------------------------------------------------------ explanation
def explain(profile: dict, job: dict, r: dict) -> dict:
    strengths, concerns, suggestions = [], [], []
    req = job.get("required_skills") or []
    if r["exact_skills"]:
        strengths.append(f"Explicitly lists {len(r['exact_skills'])} of {len(req)} required skills: "
                         f"{', '.join(r['exact_skills'][:6])}.")
    for s in r["semantic_skills"]:
        strengths.append(f"Likely has {s['skill']} experience (semantic match, {int(s['similarity'] * 100)}% "
                         f"similarity): \"{s['evidence'][:110]}\"")
    ey, need = r["experience_years"], r["required_experience"]
    if need and ey >= need:
        strengths.append(f"Meets the experience requirement ({ey:g} yrs vs {need:g} yrs required).")
    elif need:
        concerns.append(f"Experience below requirement ({ey:g} yrs vs {need:g} yrs required).")
        suggestions.append("Build more hands-on experience through internships, freelance work or substantial projects.")
    elif ey:
        strengths.append(f"{ey:g} years of detected experience.")
    if r.get("experience_relevance", 1) < 0.99 and ey:
        concerns.append(f"Experience credit reduced to {int(r['experience_relevance'] * 100)}% because few required "
                        "skills are evidenced (years in an unrelated area don't fully count).")
    need_lvl = int(job.get("education_level") or 0)
    have_lvl = int(profile.get("highest_education_level") or 0)
    if need_lvl and have_lvl >= need_lvl:
        strengths.append(f"Education ({r['education']}) meets the required level.")
    elif need_lvl:
        concerns.append(f"Education requirement ({parser.LEVEL_NAME[need_lvl]}) not clearly met "
                        f"(detected: {r['education']}).")
    if profile.get("projects"):
        strengths.append(f"{len(profile['projects'])} project(s) listed that can be reviewed for relevance.")
    if profile.get("certifications"):
        strengths.append(f"{len(profile['certifications'])} certification(s)/course(s) listed.")
    for s in r["missing_skills"]:
        concerns.append(f"No evidence of required skill: {s}.")
        suggestions.append(learning_tip(s))
    for s in r["preferred_missing"][:3]:
        suggestions.append(f"Optional: {learning_tip(s)}")
    if not req and not (job.get("preferred_skills")):
        concerns.append("The job has no skills specified, so the skills component is neutral (50%).")
    if r["breakdown"]["semantic"]["score"] >= 70:
        strengths.append("Overall resume content is semantically close to the job description.")
    elif r["breakdown"]["semantic"]["score"] < 30:
        concerns.append("Overall resume content has low semantic overlap with the job description.")
    b = r["breakdown"]
    summary = (f"Score {r['total']}% = skills {b['skills']['contribution']} + experience "
               f"{b['experience']['contribution']} + education {b['education']['contribution']} + semantic "
               f"{b['semantic']['contribution']} (weighted points out of 100).")
    return {"summary": summary, "strengths": strengths, "concerns": concerns,
            "improvement_suggestions": list(dict.fromkeys(suggestions))}


LEARN = {
    "Docker": "Containerise a small project with Docker and push it to Docker Hub; follow Docker's official 'Get Started' guide.",
    "AWS": "Deploy an app on AWS (EC2/S3/Lambda free tier); consider the AWS Cloud Practitioner certification.",
    "Azure": "Work through Microsoft Learn's Azure Fundamentals (AZ-900) path.",
    "GCP": "Complete Google Cloud Skills Boost 'Cloud Digital Leader' labs.",
    "Kubernetes": "Learn Kubernetes basics with minikube; deploy a multi-container app.",
    "Machine Learning": "Take a hands-on ML course and build an end-to-end project with scikit-learn.",
    "Deep Learning": "Complete a deep learning course (e.g. fast.ai) and train a model in PyTorch or TensorFlow.",
    "NLP": "Build a text classification or NER project using spaCy and Hugging Face transformers.",
    "SQL": "Practise SQL on real datasets (joins, window functions, aggregation) and document a project.",
    "FastAPI": "Build and deploy a small REST API with FastAPI, including auth and tests.",
    "React": "Build a multi-page React app with API integration and publish it.",
    "CI/CD": "Set up a GitHub Actions pipeline that tests and deploys a personal project.",
    "Testing": "Add unit and integration tests (pytest/JUnit) to an existing project and track coverage.",
    "System Design": "Study system design fundamentals and write up the design of a system you built.",
    "Terraform": "Provision a small cloud environment with Terraform and keep it in version control.",
    "Data Visualization": "Build dashboards in Power BI or Tableau from a public dataset.",
    "Communication": "Show communication through a blog post, talk or documented project write-up.",
    "Leadership": "Take ownership of a team project or mentor a junior; describe the outcome on your resume.",
}


def learning_tip(skill: str) -> str:
    return LEARN.get(skill, f"Learn {skill} through a structured course plus a small hands-on project you can show.")


# ------------------------------------------------------------------ skill gap & improvements
def skill_gap(profile: dict, job: dict, match: dict) -> dict:
    rows = []
    for s in job.get("required_skills") or []:
        if s in match["exact_skills"]:
            status = "Matched"
        elif s in [x["skill"] for x in match["semantic_skills"]]:
            status = "Implied"
        else:
            status = "Missing"
        rows.append({"skill": s, "status": status, "required": True})
    for s in job.get("preferred_skills") or []:
        if s in match["preferred_matched"]:
            status = "Matched"
        else:
            status = "Missing"
        rows.append({"skill": s, "status": status, "required": False})
    missing = [r["skill"] for r in rows if r["status"] == "Missing"]
    return {"rows": rows,
            "coverage": round(100 * sum(1 for r in rows if r["status"] != "Missing") / len(rows), 1) if rows else 0,
            "missing": missing,
            "recommendations": [{"skill": s, "action": learning_tip(s)} for s in missing]}


WEAK_PHRASES = ["responsible for", "worked on", "helped with", "assisted in", "duties included", "involved in",
                "tasked with"]


def improve_resume(profile: dict, raw_text: str, job: dict | None = None, match: dict | None = None) -> list[dict]:
    """Rule-based quality review. Never invents qualifications; suggestions are conditional on truth."""
    out = []

    def add(sev, area, msg):
        out.append({"severity": sev, "area": area, "message": msg})

    if not profile.get("email"):
        add("high", "Contact", "No email address detected. Recruiters need a way to reach you.")
    if not profile.get("phone"):
        add("medium", "Contact", "No phone number detected.")
    found = set(profile.get("sections_found", []))
    for sec, label in [("skills", "Skills"), ("experience", "Experience"), ("education", "Education"),
                       ("projects", "Projects")]:
        if sec not in found:
            add("high" if sec in ("skills", "education") else "medium", "Structure",
                f"No clearly labelled '{label}' section found. Use standard headings so parsers and recruiters find it.")
    if "summary" not in found:
        add("low", "Structure", "Consider a 2-3 line professional summary tailored to your target role.")
    if len(profile.get("technical_skills", [])) < 5:
        add("medium", "Skills", "Few technical skills detected. List the tools and technologies you have actually used.")
    # bullet quality
    bullets = [b for e in profile.get("experience", []) for b in e["bullets"]]
    bullets += [p["description"] for p in profile.get("projects", []) if p["description"]]
    weak = [b for b in bullets if any(p in b.lower() for p in WEAK_PHRASES)]
    if weak:
        add("medium", "Descriptions",
            f"{len(weak)} bullet(s) use passive phrases (e.g. \"{weak[0][:70]}...\"). Start with action verbs "
            "such as Built, Designed, Reduced, Led.")
    no_metric = [b for b in bullets if not any(ch.isdigit() for ch in b)]
    if bullets and len(no_metric) / len(bullets) > 0.7:
        add("medium", "Impact", "Most bullets have no measurable outcome. Add real numbers where true "
                                "(users, % improvement, time saved, dataset size).")
    for p in profile.get("projects", []):
        if len(p["description"].split()) < 12:
            add("medium", "Projects", f"Project '{p['name'][:50]}' has a thin description. Add the problem, your role, "
                                      "tech stack and result.")
    if not profile.get("projects") and profile.get("experience_years", 0) < 3:
        add("medium", "Projects", "No projects found. For early-career profiles, 2-3 projects are strong evidence of skill.")
    if not profile.get("certifications"):
        add("low", "Certifications", "No certifications or courses listed. Add genuine ones relevant to your field.")
    wc = len(raw_text.split())
    if wc < 150:
        add("medium", "Length", f"Resume is very short ({wc} words); add detail on responsibilities and results.")
    elif wc > 1100:
        add("low", "Length", f"Resume is long ({wc} words); aim for 1-2 pages focused on relevance.")
    if job and match:
        for s in match.get("missing_skills", [])[:5]:
            add("info", "Target role",
                f"'{job.get('title')}' asks for {s}. If you genuinely have it, add it with a concrete example; "
                f"if not: {learning_tip(s)}")
    if not out:
        add("info", "Overall", "No major issues detected by the automated review.")
    order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    return sorted(out, key=lambda x: order[x["severity"]])


# ------------------------------------------------------------------ interview questions
def interview_questions(profile: dict, job: dict, match: dict) -> dict:
    """Template-driven questions grounded in the candidate's actual profile (not an LLM)."""
    tech, project, exp, prob = [], [], [], []
    top = [s for s in match["exact_skills"][:4]]
    for s in top:
        tech.append(f"You list {s} on your resume. Describe the most complex problem you solved with it and "
                    "how you validated your solution.")
    for s in match["semantic_skills"][:2]:
        tech.append(f"Your experience (\"{s['evidence'][:80]}...\") suggests exposure to {s['skill']}. "
                    f"How would you describe your depth in {s['skill']}?")
    for s in match["missing_skills"][:3]:
        tech.append(f"This role requires {s}, which isn't on your resume. How have you worked with something "
                    f"similar, and how quickly could you become productive with {s}?")
    for p in profile.get("projects", [])[:3]:
        project.append(f"In your project \"{p['name'][:70]}\", what was your specific contribution, and what "
                       "would you change if you rebuilt it today?")
        project.append(f"What trade-offs or technical challenges came up in \"{p['name'][:70]}\", and how did you resolve them?")
    if not profile.get("projects"):
        project.append("Walk me through a project you are most proud of: the problem, your role, the stack and the outcome.")
    for e in profile.get("experience", [])[:3]:
        exp.append(f"In your role \"{e['title'][:80]}\", describe a situation where priorities or requirements changed. "
                   "How did you respond?")
    exp.append("Tell me about a time you disagreed with a teammate on a technical decision. How was it resolved?")
    title = job.get("title", "this role")
    prob.append(f"Design a small system or workflow relevant to {title}. What components would you use and why?")
    if match["exact_skills"]:
        prob.append(f"Given {match['exact_skills'][0]}, how would you debug a production issue where results are "
                    "intermittently wrong?")
    prob.append("You have two weeks to deliver a feature with unclear requirements. How do you plan, prioritise and communicate?")
    return {"technical": tech[:6], "projects": project[:5], "experience": exp[:4], "problem_solving": prob[:4],
            "generation": "Template-based questions personalised from the parsed profile and job requirements."}
