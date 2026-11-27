"""Engine tests (no web framework or DB needed):  python -m pytest -q   or   python tests/test_engine.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app.engine import parser, matcher
from app.sample_data import SAMPLE_RESUMES, SAMPLE_JOBS

def job(i):
    jd = SAMPLE_JOBS[i]
    return {**jd, **parser.extract_job_requirements(jd["title"], jd["description"])}

def score(key, i, w=None):
    t = SAMPLE_RESUMES[key]
    return matcher.score_candidate(parser.parse_resume(t), t, job(i), w)

def test_profile_extraction():
    p = parser.parse_resume(SAMPLE_RESUMES["alex_johnson"])
    assert p["name"] == "Alex Johnson" and p["email"] == "alex.johnson@example.com"
    assert {"Python", "FastAPI", "SQL"} <= set(p["technical_skills"])
    assert p["highest_education"] == "Bachelor's" and p["experience_years"] > 5

def test_job_requirement_extraction():
    j = job(0)
    assert "Python" in j["required_skills"] and "Docker" in j["preferred_skills"]
    assert j["min_experience"] == 3 and j["education_level"] == 3

def test_best_candidate_ranks_first():
    expected = {0: "alex_johnson", 1: "priya_sharma", 2: "marcus_lee", 3: "sofia_garcia"}
    for i, key in expected.items():
        ranked = sorted(SAMPLE_RESUMES, key=lambda k: -score(k, i)["total"])
        assert ranked[0] == key, (i, ranked[:3])

def test_semantic_style_inference():  # "built predictive models using Python" => Machine Learning
    r = score("omar_hassan", 1)
    assert "Machine Learning" in r["matched_skills"]

def test_unrelated_candidate_not_inflated():
    assert score("emily_wilson", 0)["total"] < 30

def test_explanation_always_present_and_consistent():
    r = score("priya_sharma", 1)
    assert r["explanation"]["summary"] and r["explanation"]["strengths"]
    assert abs(sum(v["contribution"] for v in r["breakdown"].values()) - r["total"]) < 0.2

def test_weights_configurable():
    r = score("alex_johnson", 0, {"skills": 1, "experience": 0, "education": 0, "semantic": 0})
    assert abs(r["total"] - r["breakdown"]["skills"]["score"]) < 0.2

def test_sparse_resume_does_not_crash():
    p = parser.parse_resume("Just some text with almost nothing useful in it at all, really nothing.")
    assert p["highest_education_level"] == 0
    assert 0 <= matcher.score_candidate(p, "x", job(0))["total"] <= 100

def test_file_validation():
    import pytest
    for name, data in [("a.exe", b"x" * 100), ("a.docx", b"garbage"), ("a.txt", b"short")]:
        with pytest.raises(parser.ResumeParseError):
            parser.extract_text(name, data)

if __name__ == "__main__":
    import types
    sys.modules.setdefault("pytest", types.SimpleNamespace(raises=None))
    fns = [v for k, v in dict(globals()).items() if k.startswith("test_") and k != "test_file_validation"]
    for f in fns: f(); print("PASS", f.__name__)
