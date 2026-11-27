"""Skill taxonomy.

Each canonical skill has: category, aliases (surface forms), and a short natural-language
`concept` used for semantic (embedding) matching, so that e.g. "built predictive models"
can be recognised as evidence of "Machine Learning".
"""
from __future__ import annotations
import re
from functools import lru_cache

# canonical: (category, [aliases], concept description)
TECH: dict[str, tuple[str, list[str], str]] = {
    "Python": ("Language", ["python", "python3"], "python programming scripts and applications"),
    "Java": ("Language", ["java"], "java programming object oriented backend development"),
    "JavaScript": ("Language", ["javascript", "js", "ecmascript", "es6"], "javascript web programming"),
    "TypeScript": ("Language", ["typescript"], "typescript typed javascript"),
    "C++": ("Language", ["c++", "cpp"], "c++ systems programming"),
    "C#": ("Language", ["c#", "csharp"], "c# dotnet programming"),
    "Go": ("Language", ["golang", "go lang"], "go golang backend services"),
    "R": ("Language", ["r programming", "rstudio"], "r statistical programming"),
    "SQL": ("Database", ["sql", "t-sql", "pl/sql", "sql queries"], "writing sql queries relational database"),
    "PostgreSQL": ("Database", ["postgresql", "postgres"], "postgresql relational database"),
    "MySQL": ("Database", ["mysql"], "mysql relational database"),
    "MongoDB": ("Database", ["mongodb", "mongo"], "mongodb nosql document database"),
    "Redis": ("Database", ["redis"], "redis caching in-memory store"),
    "React": ("Frontend", ["react", "react.js", "reactjs"], "react user interface components frontend"),
    "Angular": ("Frontend", ["angular", "angularjs"], "angular frontend framework"),
    "Vue.js": ("Frontend", ["vue", "vue.js", "vuejs"], "vue frontend framework"),
    "HTML/CSS": ("Frontend", ["html", "css", "html5", "css3", "tailwind", "bootstrap"], "html css web page styling"),
    "Node.js": ("Backend", ["node.js", "nodejs", "node", "express.js", "express"], "node.js server side javascript"),
    "FastAPI": ("Backend", ["fastapi"], "fastapi python rest api framework"),
    "Django": ("Backend", ["django"], "django python web framework"),
    "Flask": ("Backend", ["flask"], "flask python micro web framework"),
    "Spring Boot": ("Backend", ["spring boot", "spring", "springboot"], "spring boot java microservices"),
    "REST APIs": ("Backend", ["rest api", "rest apis", "restful", "rest", "api development", "web services"],
                  "designing and building rest api services endpoints"),
    "GraphQL": ("Backend", ["graphql"], "graphql api queries"),
    "Microservices": ("Backend", ["microservices", "microservice"], "microservices distributed architecture"),
    "Machine Learning": ("AI/ML", ["machine learning", "ml", "predictive modeling", "predictive models"],
                         "machine learning predictive models training classifiers regression scikit-learn"),
    "Deep Learning": ("AI/ML", ["deep learning", "neural network", "neural networks", "cnn", "rnn", "lstm"],
                      "deep learning neural networks training models"),
    "NLP": ("AI/ML", ["nlp", "natural language processing", "text mining", "spacy", "nltk", "transformers"],
            "natural language processing text analysis language models"),
    "Computer Vision": ("AI/ML", ["computer vision", "opencv", "image classification", "object detection"],
                        "computer vision image recognition object detection"),
    "TensorFlow": ("AI/ML", ["tensorflow", "keras"], "tensorflow keras deep learning framework"),
    "PyTorch": ("AI/ML", ["pytorch", "torch"], "pytorch deep learning framework"),
    "Scikit-learn": ("AI/ML", ["scikit-learn", "sklearn", "scikit learn"], "scikit-learn machine learning library"),
    "Pandas": ("Data", ["pandas"], "pandas dataframe data manipulation"),
    "NumPy": ("Data", ["numpy"], "numpy numerical computing arrays"),
    "Data Analysis": ("Data", ["data analysis", "data analytics", "exploratory data analysis", "eda", "statistics",
                               "statistical analysis"], "analyzing data statistics insights exploratory analysis"),
    "Data Visualization": ("Data", ["data visualization", "tableau", "power bi", "powerbi", "matplotlib", "seaborn"], "visualizing data charts dashboards reports"),
    "Data Engineering": ("Data", ["data engineering", "etl", "data pipelines", "data pipeline", "airflow", "spark",
                                  "pyspark", "kafka", "hadoop"], "building data pipelines etl processing large datasets"),
    "Excel": ("Data", ["excel", "advanced excel", "spreadsheets"], "excel spreadsheets analysis"),
    "AWS": ("Cloud", ["aws", "amazon web services", "ec2", "s3", "lambda"], "amazon web services cloud deployment"),
    "Azure": ("Cloud", ["azure", "microsoft azure"], "microsoft azure cloud platform"),
    "GCP": ("Cloud", ["gcp", "google cloud", "google cloud platform"], "google cloud platform"),
    "Docker": ("DevOps", ["docker", "containers", "containerization"], "docker containers packaging deployment"),
    "Kubernetes": ("DevOps", ["kubernetes", "k8s"], "kubernetes container orchestration"),
    "CI/CD": ("DevOps", ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci", "continuous integration"],
              "continuous integration delivery pipelines automated deployment"),
    "Terraform": ("DevOps", ["terraform", "infrastructure as code"], "terraform infrastructure as code"),
    "Linux": ("DevOps", ["linux", "unix", "bash", "shell scripting"], "linux command line administration"),
    "Git": ("Tools", ["git", "github", "gitlab", "version control"], "git version control collaboration"),
    "Testing": ("Engineering", ["unit testing", "pytest", "junit", "test automation", "selenium", "tdd"],
                "writing automated tests quality assurance"),
    "Agile": ("Practice", ["agile", "scrum", "kanban", "sprint"], "agile scrum software delivery"),
    "System Design": ("Engineering", ["system design", "software architecture", "scalable systems"],
                      "designing scalable system architecture"),
    "Cybersecurity": ("Security", ["cybersecurity", "cyber security", "penetration testing", "network security",
                                   "information security"], "security vulnerabilities protection"),
    "Android": ("Mobile", ["android", "kotlin"], "android mobile app development"),
    "iOS": ("Mobile", ["ios", "swift", "swiftui"], "ios mobile app development"),
    "React Native": ("Mobile", ["react native", "flutter"], "cross platform mobile apps"),
    "Project Management": ("Practice", ["project management", "pmp", "jira", "stakeholder management"],
                           "managing projects timelines stakeholders"),
    "SEO/Marketing": ("Marketing", ["seo", "digital marketing", "content marketing", "google analytics"],
                      "search engine optimization digital marketing campaigns"),
    "UI/UX Design": ("Design", ["ui/ux", "figma", "wireframing", "prototyping", "user research"],
                     "user interface user experience design prototyping"),
}

SOFT: dict[str, tuple[str, list[str], str]] = {
    "Communication": ("Soft", ["communication", "presentation skills", "public speaking", "written communication"],
                      "communicating clearly presenting to stakeholders"),
    "Leadership": ("Soft", ["leadership", "led a team", "team lead", "mentored", "mentoring", "managed a team"],
                   "leading and mentoring teams"),
    "Teamwork": ("Soft", ["teamwork", "collaboration", "collaborated", "cross-functional", "team player"],
                 "collaborating with teammates"),
    "Problem Solving": ("Soft", ["problem solving", "problem-solving", "analytical thinking", "critical thinking"],
                        "solving complex problems analytically"),
    "Time Management": ("Soft", ["time management", "prioritization", "meeting deadlines"], "managing time and deadlines"),
    "Adaptability": ("Soft", ["adaptability", "quick learner", "fast learner", "adaptable"], "learning quickly"),
    "Creativity": ("Soft", ["creativity", "innovative", "innovation"], "creative thinking"),
}

ALL_SKILLS = {**TECH, **SOFT}


def _alias_pattern(alias: str) -> re.Pattern:
    esc = re.escape(alias.lower())
    # allow trailing/leading symbols for c++, c#, .net etc.
    return re.compile(rf"(?<![A-Za-z0-9+#]){esc}(?![A-Za-z0-9+#])", re.I)


@lru_cache(maxsize=1)
def _compiled() -> list[tuple[str, re.Pattern]]:
    out = []
    for canon, (_, aliases, _) in ALL_SKILLS.items():
        for a in set(aliases + [canon]):
            # short ambiguous aliases only match when written in the original case style
            out.append((canon, _alias_pattern(a)))
    return out


AMBIGUOUS_CASE_SENSITIVE = {"go", "r", "js", "ml", "node", "rest", "spring", "swift", "express", "torch", "eda"}


def find_skills(text: str) -> list[str]:
    """Return canonical skills explicitly present in the text (exact / alias match)."""
    found: dict[str, int] = {}
    for canon, pat in _compiled():
        for m in pat.finditer(text):
            tok = m.group(0)
            if tok.lower() in AMBIGUOUS_CASE_SENSITIVE and tok.lower() not in ("js", "ml"):
                # ambiguous english words: require capitalised or technical casing to avoid noise
                if tok.islower():
                    continue
            found[canon] = found.get(canon, 0) + 1
            break
    return list(found)


def is_soft(skill: str) -> bool:
    return skill in SOFT


def category(skill: str) -> str:
    return ALL_SKILLS.get(skill, ("Other", [], ""))[0]


def concept(skill: str) -> str:
    if skill in ALL_SKILLS:
        return ALL_SKILLS[skill][2]
    return skill.lower()


def normalise(skill: str) -> str:
    """Map a user-typed skill to the canonical name when known."""
    s = skill.strip()
    low = s.lower()
    for canon, (_, aliases, _) in ALL_SKILLS.items():
        if low == canon.lower() or low in [a.lower() for a in aliases]:
            return canon
    return s
