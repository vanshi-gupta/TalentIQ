// Local interactive demo engine & fictional sample data for TalentIQ.
// Used automatically when signing in with "Demo recruiter" or "Demo candidate"
// so the full application works instantaneously with zero backend dependency.

const STORAGE_KEY = 'talentiq_demo_state_v1'

const ENGINE = {
  engine: 'local-demo',
  model: 'TalentIQ Explainable Engine (Local Demo)',
  contextual: true,
  note: 'Interactive demo mode running locally with fictional sample jobs, resumes, and live explainable scoring.',
}

const DEFAULT_WEIGHTS = { skills: 0.4, experience: 0.25, education: 0.15, semantic: 0.2 }
const LEVEL_NAME = { 0: 'Not specified', 1: 'High School', 2: 'Diploma', 3: "Bachelor's", 4: "Master's", 5: 'PhD' }

const SKILL_BANK = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'R', 'SQL', 'HTML', 'CSS',
  'FastAPI', 'React', 'Node.js', 'Spring Boot', 'Microservices', 'REST APIs',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Machine Learning', 'Deep Learning', 'NLP',
  'Scikit-learn', 'TensorFlow', 'PyTorch', 'spaCy', 'Pandas', 'NumPy',
  'Data Visualization', 'Tableau', 'Power BI', 'Excel', 'Statistics',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Terraform', 'CI/CD', 'Jenkins', 'Linux', 'Bash',
  'Git', 'Agile', 'JUnit', 'Kafka', 'Figma', 'UI/UX', 'Wireframing', 'Prototyping', 'User Research',
  'Communication', 'Teamwork', 'Leadership', 'Creativity',
]

const SEMANTIC_HINTS = {
  'Machine Learning': ['predictive model', 'classification model', 'regression', 'gradient boosting', 'churn'],
  'REST APIs': ['fastapi', 'spring boot', 'api', 'microservices', 'endpoint'],
  'SQL': ['postgresql', 'mysql', 'database', 'queries'],
  'Data Visualization': ['tableau', 'power bi', 'dashboard', 'charts'],
  'CI/CD': ['github actions', 'jenkins', 'pipeline', 'deploy'],
  'Testing': ['junit', 'unit test', 'pytest', 'coverage'],
  'NLP': ['text classification', 'spacy', 'transformers', 'embeddings'],
  'Docker': ['containeris', 'containeriz', 'kubernetes'],
}

const LEARN_TIPS = {
  Docker: 'Containerise a small project with Docker and push it to Docker Hub.',
  AWS: 'Deploy a service on AWS (EC2/S3/Lambda) and document the architecture.',
  Kubernetes: 'Deploy a multi-container app locally using minikube or kind.',
  'Machine Learning': 'Build an end-to-end classification or regression project with scikit-learn.',
  'Deep Learning': 'Train and evaluate a neural network model using PyTorch or TensorFlow.',
  NLP: 'Build a text classification or semantic search mini-project with spaCy or embeddings.',
  SQL: 'Practise joins, window functions, and query optimisation on a real dataset.',
  FastAPI: 'Build a typed REST API with FastAPI, Pydantic validation, and unit tests.',
  React: 'Create a responsive React + TypeScript dashboard connected to a JSON API.',
  'CI/CD': 'Add a GitHub Actions workflow that runs tests and builds on every push.',
  Testing: 'Add unit tests (pytest/JUnit/Vitest) to verify core business logic.',
  Terraform: 'Provision a sample cloud resource using Terraform configuration files.',
  'Data Visualization': 'Create an interactive dashboard in Tableau or Power BI from public data.',
  Communication: 'Document a project write-up or architecture decision clearly.',
  Leadership: 'Highlight mentoring, code reviews, or leading a feature delivery.',
}

function isoNoZ(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().replace('Z', '')
}

function normaliseWeights(w) {
  const merged = { ...DEFAULT_WEIGHTS, ...(w || {}) }
  const total = Object.values(merged).reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0) || 1
  return Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, Math.max(0, Number(v) || 0) / total]))
}

function categoryFor(score) {
  if (score >= 80) return 'Excellent Match'
  if (score >= 65) return 'Strong Match'
  if (score >= 45) return 'Moderate Match'
  return 'Low Match'
}

function learningTip(skill) {
  return LEARN_TIPS[skill] || `Learn ${skill} through a structured course and a small hands-on project.`
}

function extractSkillsFromText(text) {
  const low = (text || '').toLowerCase()
  return SKILL_BANK.filter((s) => {
    const escaped = s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(low)
  })
}

export function extractJobRequirements(title = '', description = '') {
  const lines = (description || '').split('\n')
  const required = []
  const preferred = []
  let mode = 'required'
  for (const line of lines) {
    const low = line.toLowerCase()
    if (/(nice to have|preferred|good to have|bonus|optional)/i.test(low) && line.length < 80) mode = 'preferred'
    else if (/(requirement|must have|required|qualifications)/i.test(low) && line.length < 80) mode = 'required'
    const found = extractSkillsFromText(line)
    const target = mode === 'preferred' || /(nice to have|preferred|bonus)/i.test(low) ? preferred : required
    for (const s of found) if (!target.includes(s)) target.push(s)
  }
  if (!required.length) {
    for (const s of extractSkillsFromText(`${title}\n${description}`)) {
      if (!required.includes(s)) required.push(s)
    }
  }
  const cleanPref = preferred.filter((s) => !required.includes(s))
  const expMatch = `${title}\n${description}`.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i)
  const minExp = expMatch ? Number(expMatch[1]) : 0
  const lowAll = `${title}\n${description}`.toLowerCase()
  let edu = 0
  if (/ph\.?d|doctorate/.test(lowAll)) edu = 5
  else if (/master|m\.?tech|m\.?sc|mba|mca/.test(lowAll)) edu = 4
  else if (/bachelor|b\.?tech|b\.?e\b|b\.?sc|bca|degree/.test(lowAll)) edu = 3
  else if (/diploma/.test(lowAll)) edu = 2
  return {
    required_skills: required,
    preferred_skills: cleanPref,
    min_experience: minExp,
    education_level: edu,
    education: LEVEL_NAME[edu],
  }
}

function makeInitialState() {
  const jobs = [
    {
      id: 1,
      title: 'Python Backend Developer',
      description:
        'We are looking for a Python Backend Developer to build and scale REST APIs.\n\nRequirements:\n- 3+ years of experience with Python and FastAPI\n- Strong SQL and PostgreSQL skills\n- Experience building REST APIs and writing unit tests\n- Git and Agile ways of working\n\nNice to have:\n- Docker and AWS\n- Machine Learning exposure\n\nBachelor\'s degree in Computer Science or related field.',
      required_skills: ['Python', 'FastAPI', 'SQL', 'PostgreSQL', 'REST APIs', 'Git', 'Agile'],
      preferred_skills: ['Docker', 'AWS', 'Machine Learning'],
      min_experience: 3,
      education_level: 3,
      education: "Bachelor's",
      location: 'Remote',
      employment_type: 'Full-time',
      is_open: true,
      created_at: isoNoZ(5),
    },
    {
      id: 2,
      title: 'Machine Learning Engineer',
      description:
        'Join us to develop machine learning models for production use.\n\nRequirements:\n- 2+ years building Machine Learning systems\n- Python, Scikit-learn and Pandas\n- Deep Learning with PyTorch or TensorFlow\n- SQL and data analysis\n\nPreferred:\n- NLP experience\n- Docker and AWS deployment\n\nMaster\'s or Bachelor\'s degree in a quantitative field.',
      required_skills: ['Machine Learning', 'Python', 'Scikit-learn', 'Pandas', 'Deep Learning', 'PyTorch', 'TensorFlow', 'SQL'],
      preferred_skills: ['NLP', 'Docker', 'AWS'],
      min_experience: 2,
      education_level: 4,
      education: "Master's",
      location: 'Bengaluru, India',
      employment_type: 'Full-time',
      is_open: true,
      created_at: isoNoZ(4),
    },
    {
      id: 3,
      title: 'Full Stack Web Developer',
      description:
        'Build modern web applications end to end.\n\nRequirements:\n- 2+ years of experience\n- React and TypeScript\n- Node.js and REST APIs\n- MongoDB or SQL databases\n- Git\n\nNice to have:\n- CI/CD and Docker\n\nBachelor\'s degree preferred.',
      required_skills: ['React', 'TypeScript', 'Node.js', 'REST APIs', 'MongoDB', 'SQL', 'Git'],
      preferred_skills: ['CI/CD', 'Docker'],
      min_experience: 2,
      education_level: 3,
      education: "Bachelor's",
      location: 'Chicago, IL',
      employment_type: 'Full-time',
      is_open: true,
      created_at: isoNoZ(3),
    },
    {
      id: 4,
      title: 'DevOps Engineer',
      description:
        'Own our cloud infrastructure and delivery pipelines.\n\nRequirements:\n- 4+ years of experience\n- AWS, Docker and Kubernetes\n- Terraform and CI/CD\n- Linux administration\n\nPreferred:\n- Python scripting\n- Leadership of small teams\n\nBachelor\'s degree in engineering.',
      required_skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
      preferred_skills: ['Python', 'Leadership'],
      min_experience: 4,
      education_level: 3,
      education: "Bachelor's",
      location: 'Hybrid - Madrid',
      employment_type: 'Full-time',
      is_open: true,
      created_at: isoNoZ(2),
    },
    {
      id: 5,
      title: 'Data Analyst',
      description:
        'Turn business data into insight.\n\nRequirements:\n- 1+ years experience\n- SQL and Excel\n- Data Visualization (Tableau or Power BI)\n- Communication skills\n\nNice to have:\n- Python and Pandas\n\nBachelor\'s degree.',
      required_skills: ['SQL', 'Excel', 'Data Visualization', 'Tableau', 'Power BI', 'Communication'],
      preferred_skills: ['Python', 'Pandas'],
      min_experience: 1,
      education_level: 3,
      education: "Bachelor's",
      location: 'Remote',
      employment_type: 'Full-time',
      is_open: true,
      created_at: isoNoZ(1),
    },
  ]

  const recruiterResumes = [
    {
      resume_id: 101,
      filename: 'alex_johnson.docx',
      uploaded_at: isoNoZ(4),
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      phone: '+1 415 555 0134',
      location: 'San Francisco, CA',
      links: ['github.com/alexj-dev'],
      summary: 'Backend engineer with 5+ years of experience building data-driven APIs in Python and FastAPI.',
      technical_skills: ['Python', 'FastAPI', 'SQL', 'PostgreSQL', 'Machine Learning', 'Scikit-learn', 'Pandas', 'Git', 'REST APIs'],
      soft_skills: ['Teamwork'],
      education: [{ degree: 'B.Tech in Computer Science, State Technical University, 2019', level: 3, level_name: "Bachelor's", field: 'Computer Science', year: '2019' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: ['Coursera Machine Learning Specialization'],
      experience: [
        {
          title: 'Software Engineer, DataBridge Inc. (Jan 2021 - Present)',
          bullets: [
            'Built REST APIs with FastAPI serving 2 million requests per day',
            'Developed machine learning models with scikit-learn that reduced churn by 12%',
            'Optimised PostgreSQL queries, cutting report latency by 40%',
          ],
        },
        {
          title: 'Junior Developer, CodeNest (Jun 2019 - Dec 2020)',
          bullets: [
            'Wrote Python automation scripts that saved 15 hours of manual work per week',
            'Collaborated with cross-functional teams in an Agile environment',
          ],
        },
      ],
      experience_years: 5.5,
      projects: [{ name: 'Churn Predictor', description: 'Trained and deployed a classification model on 200k customer records with a FastAPI inference service and unit tests.' }],
      achievements: ['Reduced churn by 12% using scikit-learn pipelines'],
      sections_found: ['summary', 'skills', 'experience', 'education', 'projects', 'certifications'],
    },
    {
      resume_id: 102,
      filename: 'priya_sharma.docx',
      uploaded_at: isoNoZ(3),
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, India',
      links: [],
      summary: 'Data scientist passionate about turning data into production NLP and ML decisions.',
      technical_skills: ['Python', 'R', 'Machine Learning', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch', 'spaCy', 'SQL', 'Pandas', 'NumPy', 'Data Visualization', 'Docker', 'AWS', 'Scikit-learn'],
      soft_skills: ['Leadership'],
      education: [
        { degree: 'M.Tech in Data Science, Indian Institute of Technology, 2018', level: 4, level_name: "Master's", field: 'Data Science', year: '2018' },
        { degree: 'B.Tech in Computer Science, 2016', level: 3, level_name: "Bachelor's", field: 'Computer Science', year: '2016' },
      ],
      highest_education_level: 4,
      highest_education: "Master's",
      certifications: ['AWS Certified Machine Learning Specialty', 'TensorFlow Developer Certificate'],
      experience: [
        {
          title: 'Data Scientist, Insight Analytics (Mar 2020 - Present)',
          bullets: [
            'Built NLP pipelines using spaCy and transformers to classify 500k support tickets with 91% accuracy',
            'Deployed models as Docker containers on AWS and monitored drift',
            'Mentored 3 junior analysts',
          ],
        },
        {
          title: 'Data Analyst, RetailCo (Jul 2018 - Feb 2020)',
          bullets: ['Created Tableau dashboards used by 40 managers'],
        },
      ],
      experience_years: 6.5,
      projects: [{ name: 'Resume Ranker', description: 'Developed an NLP-based resume ranking tool using sentence embeddings and cosine similarity, evaluated on 1,000 resumes.' }],
      achievements: ['Winner, National AI Hackathon 2022'],
      sections_found: ['summary', 'skills', 'experience', 'education', 'projects', 'certifications', 'achievements'],
    },
    {
      resume_id: 103,
      filename: 'marcus_lee.docx',
      uploaded_at: isoNoZ(3),
      name: 'Marcus Lee',
      email: 'marcus.lee@example.com',
      phone: '312-555-0188',
      location: 'Chicago, IL',
      links: [],
      summary: 'Full stack developer focused on fast, user-friendly React and Node.js web apps.',
      technical_skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'HTML', 'CSS', 'MongoDB', 'Git', 'Docker', 'REST APIs', 'CI/CD'],
      soft_skills: ['Communication'],
      education: [{ degree: 'B.Sc in Information Technology, Midwest University, 2021', level: 3, level_name: "Bachelor's", field: 'Information Technology', year: '2021' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: ['Meta Front-End Developer Certificate (Coursera)'],
      experience: [
        {
          title: 'Full Stack Developer, PixelWorks (Feb 2022 - Present)',
          bullets: [
            'Built responsive React dashboards used by 5,000 customers',
            'Developed Node.js REST APIs backed by MongoDB',
            'Set up GitHub Actions CI/CD pipelines',
          ],
        },
        {
          title: 'Frontend Intern, WebFlow Studio (Jun 2021 - Jan 2022)',
          bullets: ['Implemented reusable UI components in React'],
        },
      ],
      experience_years: 3.5,
      projects: [{ name: 'Task Board', description: 'Kanban-style web app with drag and drop, real-time updates and authentication.' }],
      achievements: [],
      sections_found: ['summary', 'skills', 'experience', 'education', 'projects', 'certifications'],
    },
    {
      resume_id: 104,
      filename: 'sofia_garcia.docx',
      uploaded_at: isoNoZ(2),
      name: 'Sofia Garcia',
      email: 'sofia.garcia@example.com',
      phone: '+34 600 123 456',
      location: 'Madrid, Spain',
      links: [],
      summary: 'Cloud and DevOps engineer with 7 years of experience automating AWS and Kubernetes infrastructure.',
      technical_skills: ['AWS', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'Linux', 'Bash', 'Python', 'Git'],
      soft_skills: ['Leadership'],
      education: [{ degree: 'B.E in Electronics Engineering, University of Valencia, 2015', level: 3, level_name: "Bachelor's", field: 'Electronics Engineering', year: '2015' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: ['AWS Certified Solutions Architect Associate', 'Certified Kubernetes Administrator'],
      experience: [
        {
          title: 'Senior DevOps Engineer, CloudNine (Jan 2019 - Present)',
          bullets: [
            'Led a team of 4 migrating 60 services to Kubernetes on AWS',
            'Reduced deployment time from 45 minutes to 6 minutes with Jenkins and Terraform',
          ],
        },
        {
          title: 'DevOps Engineer, NetSolve (Jan 2016 - Dec 2018)',
          bullets: ['Managed Linux servers and built monitoring dashboards'],
        },
      ],
      experience_years: 7.0,
      projects: [],
      achievements: ['Reduced deployment time from 45 minutes to 6 minutes across 60 microservices'],
      sections_found: ['summary', 'skills', 'experience', 'education', 'certifications'],
    },
    {
      resume_id: 105,
      filename: 'neha_patel.docx',
      uploaded_at: isoNoZ(2),
      name: 'Neha Patel',
      email: 'neha.patel@example.com',
      phone: '+91 91234 56780',
      location: 'Pune, India',
      links: [],
      summary: 'Software engineer with 3.5 years of experience building resilient Java microservices and APIs.',
      technical_skills: ['Java', 'Spring Boot', 'Microservices', 'MySQL', 'SQL', 'Kafka', 'Docker', 'REST APIs', 'Git', 'JUnit', 'Agile'],
      soft_skills: [],
      education: [{ degree: 'B.Tech in Information Technology, Pune Institute of Technology, 2021', level: 3, level_name: "Bachelor's", field: 'Information Technology', year: '2021' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: [],
      experience: [
        {
          title: 'Software Engineer, FinServe Technologies (Aug 2022 - Present)',
          bullets: [
            'Developed Spring Boot microservices handling 10k transactions per minute',
            'Wrote JUnit tests achieving 85% coverage',
            'Containerised services with Docker',
          ],
        },
        {
          title: 'Associate Engineer, FinServe Technologies (Jul 2021 - Jul 2022)',
          bullets: ['Maintained legacy modules and optimised SQL stored procedures'],
        },
      ],
      experience_years: 3.5,
      projects: [],
      achievements: [],
      sections_found: ['summary', 'skills', 'experience', 'education'],
    },
    {
      resume_id: 106,
      filename: 'david_chen.docx',
      uploaded_at: isoNoZ(1),
      name: 'David Chen',
      email: 'david.chen@example.com',
      phone: '646-555-0102',
      location: 'New York, NY',
      links: [],
      summary: 'Analytics graduate seeking a data analyst role with strong foundations in SQL, Excel, and Tableau.',
      technical_skills: ['Python', 'Excel', 'SQL', 'Statistics', 'Tableau', 'Data Visualization'],
      soft_skills: ['Communication'],
      education: [{ degree: 'B.Sc in Statistics, City University, 2024', level: 3, level_name: "Bachelor's", field: 'Statistics', year: '2024' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: ['Google Data Analytics Certificate'],
      experience: [],
      experience_years: 1.0,
      projects: [{ name: 'Sales Analysis', description: 'Analysed sales data of a retail store in SQL and Excel and built interactive Tableau charts.' }],
      achievements: [],
      sections_found: ['summary', 'skills', 'education', 'projects', 'certifications'],
    },
    {
      resume_id: 107,
      filename: 'emily_wilson.docx',
      uploaded_at: isoNoZ(1),
      name: 'Emily Wilson',
      email: 'emily.wilson@example.com',
      phone: '206-555-0177',
      location: 'Seattle, WA',
      links: [],
      summary: 'Product designer focused on user research, prototyping, and accessible web interfaces.',
      technical_skills: ['Figma', 'UI/UX', 'Wireframing', 'Prototyping', 'User Research', 'HTML', 'CSS'],
      soft_skills: ['Communication', 'Creativity'],
      education: [{ degree: 'B.Des in Interaction Design, Pacific Design School, 2020', level: 3, level_name: "Bachelor's", field: 'Interaction Design', year: '2020' }],
      highest_education_level: 3,
      highest_education: "Bachelor's",
      certifications: ['Google UX Design Certificate'],
      experience: [
        {
          title: 'Product Designer, Brightside Studio (Apr 2020 - Present)',
          bullets: [
            'Designed mobile app screens used by 120k users',
            'Ran usability tests with 30 participants and improved task completion by 18%',
          ],
        },
      ],
      experience_years: 4.5,
      projects: [],
      achievements: ['Improved user task completion by 18% via usability testing'],
      sections_found: ['skills', 'experience', 'education', 'certifications'],
    },
  ]

  const candidateProfile = {
    resume_id: 201,
    filename: 'omar_hassan.docx',
    uploaded_at: isoNoZ(1),
    name: 'Omar Hassan',
    email: 'omar.hassan@example.com',
    phone: '+971 50 123 4567',
    location: 'Dubai, UAE',
    links: ['github.com/omar-hassan'],
    summary: 'Analytical engineer who enjoys building predictive models, data pipelines, and clean APIs with Python and SQL.',
    technical_skills: ['Python', 'SQL', 'Pandas', 'Scikit-learn', 'Data Visualization', 'Git'],
    soft_skills: ['Communication'],
    education: [{ degree: 'B.Tech in Computer Engineering, American University of Sharjah, 2021', level: 3, level_name: "Bachelor's", field: 'Computer Engineering', year: '2021' }],
    highest_education_level: 3,
    highest_education: "Bachelor's",
    certifications: [],
    experience: [
      {
        title: 'Software Developer, Gulf Analytics (Sep 2021 - Present)',
        bullets: [
          'Built predictive models using Python to forecast demand for 300 retail products',
          'Created automated data pipelines that process 5 GB of daily sales records',
          'Presented findings to senior stakeholders each month',
        ],
      },
      {
        title: 'Intern, TechHub (Jun 2020 - Aug 2020)',
        bullets: ['Cleaned and analysed survey datasets using Python and SQL'],
      },
    ],
    experience_years: 3.5,
    projects: [{ name: 'Demand Forecast', description: 'Trained regression and gradient boosting models on three years of sales history to predict weekly demand with 9% error.' }],
    achievements: ['Forecasted demand for 300 retail products with 9% error'],
    sections_found: ['summary', 'experience', 'education', 'projects'],
  }

  return {
    users: {
      recruiter: {
        id: 9001,
        name: 'Demo Recruiter',
        email: 'recruiter@demo.talentiq.ai',
        role: 'recruiter',
        settings: { blind_mode: false, weights: { ...DEFAULT_WEIGHTS } },
      },
      candidate: {
        id: 9002,
        name: 'Omar Hassan',
        email: 'candidate@demo.talentiq.ai',
        role: 'candidate',
        settings: { blind_mode: false, weights: { ...DEFAULT_WEIGHTS } },
      },
    },
    jobs,
    resumes: recruiterResumes,
    candidateProfile,
    nextJobId: 10,
    nextResumeId: 120,
    activities: [
      { text: 'Demo data loaded: 5 jobs and 7 resumes screened automatically', at: isoNoZ(0) },
      { text: "Matched Alex Johnson (91%) and Priya Sharma (88%) against top openings", at: isoNoZ(1) },
      { text: "Posted job 'Python Backend Developer' and screened 7 resume(s)", at: isoNoZ(2) },
    ],
  }
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  const fresh = makeInitialState()
  saveState(fresh)
  return fresh
}

function saveState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function evidenceLines(profile) {
  const lines = []
  for (const e of profile.experience || []) {
    lines.push(e.title)
    lines.push(...(e.bullets || []))
  }
  for (const p of profile.projects || []) lines.push(`${p.name}. ${p.description}`)
  if (profile.summary) lines.push(profile.summary)
  return lines.filter(Boolean)
}

function matchSkillList(skills, candSet, evidence) {
  const exact = []
  const semantic = []
  const missing = []
  for (const s of skills) {
    if (candSet.has(s)) {
      exact.push(s)
      continue
    }
    const hints = SEMANTIC_HINTS[s] || [s.toLowerCase()]
    const hit = evidence.find((line) => hints.some((h) => line.toLowerCase().includes(h)))
    if (hit) {
      semantic.push({ skill: s, evidence: hit.slice(0, 180), similarity: 0.78 })
    } else {
      missing.push(s)
    }
  }
  return { exact, semantic, missing }
}

function tokenSet(str) {
  return new Set((str || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').split(/\s+/).filter((w) => w.length > 2))
}

export function scoreCandidate(profile, job, weights) {
  const w = normaliseWeights(weights)
  const candSet = new Set([...(profile.technical_skills || []), ...(profile.soft_skills || [])])
  const evidence = evidenceLines(profile)
  const req = job.required_skills || []
  const pref = job.preferred_skills || []

  const rm = matchSkillList(req, candSet, evidence)
  const pm = matchSkillList(pref, candSet, evidence)
  const ratio = (m, n) => (n ? (m.exact.length + 0.7 * m.semantic.length) / n : null)
  const rRatio = ratio(rm, req.length)
  const pRatio = ratio(pm, pref.length)

  let skillsScore = 0.5
  if (rRatio !== null && pRatio !== null) skillsScore = 0.8 * rRatio + 0.2 * pRatio
  else if (rRatio !== null) skillsScore = rRatio
  else if (pRatio !== null) skillsScore = pRatio

  const years = Number(profile.experience_years) || 0
  const minExp = Number(job.min_experience) || 0
  const expRaw = minExp <= 0 ? 1 : Math.min(1, years / minExp)
  const hasSkillReq = Boolean(req.length || pref.length)
  const relevance = hasSkillReq ? 0.3 + 0.7 * Math.min(1, skillsScore / 0.5) : 1
  const expScore = expRaw * relevance

  const haveEdu = Number(profile.highest_education_level) || 0
  const needEdu = Number(job.education_level) || 0
  let eduScore = needEdu <= 0 ? 1 : Math.max(0, 1 - 0.4 * Math.max(0, needEdu - haveEdu))
  if (needEdu > 0 && haveEdu === 0) eduScore = 0.3

  const jobTokens = tokenSet(`${job.title} ${job.description} ${req.join(' ')} ${pref.join(' ')}`)
  const candTokens = tokenSet(`${[...candSet].join(' ')} ${evidence.join(' ')}`)
  let overlap = 0
  for (const t of jobTokens) if (candTokens.has(t)) overlap++
  const rawCos = jobTokens.size ? Math.min(0.95, (overlap / Math.sqrt(jobTokens.size * Math.max(1, candTokens.size))) * 1.45) : 0.4
  const semScore = Math.min(1, Math.max(0, (rawCos - 0.08) / 0.42))

  const comps = { skills: skillsScore, experience: expScore, education: eduScore, semantic: semScore }
  const breakdown = Object.fromEntries(
    Object.entries(comps).map(([k, v]) => [
      k,
      {
        score: Math.round(v * 1000) / 10,
        weight: Math.round(w[k] * 1000) / 10,
        contribution: Math.round(v * w[k] * 1000) / 10,
      },
    ]),
  )
  const total = Math.round(Object.entries(comps).reduce((acc, [k, v]) => acc + v * w[k], 0) * 1000) / 10

  const result = {
    total,
    category: categoryFor(total),
    breakdown,
    matched_skills: [...rm.exact, ...rm.semantic.map((s) => s.skill)],
    exact_skills: rm.exact,
    semantic_skills: rm.semantic,
    missing_skills: rm.missing,
    preferred_matched: [...pm.exact, ...pm.semantic.map((s) => s.skill)],
    preferred_missing: pm.missing,
    experience_years: years,
    required_experience: minExp,
    experience_relevance: Math.round(relevance * 100) / 100,
    education: profile.highest_education || 'Not specified',
    semantic_raw_cosine: Math.round(rawCos * 1000) / 1000,
    engine: ENGINE.engine,
  }
  result.explanation = explainMatch(profile, job, result)
  return result
}

function explainMatch(profile, job, r) {
  const strengths = []
  const concerns = []
  const suggestions = []
  const req = job.required_skills || []

  if (r.exact_skills.length) {
    strengths.push(`Explicitly lists ${r.exact_skills.length} of ${req.length} required skills: ${r.exact_skills.slice(0, 6).join(', ')}.`)
  }
  for (const s of r.semantic_skills) {
    strengths.push(`Likely has ${s.skill} experience (semantic match, ${Math.round(s.similarity * 100)}% similarity): "${s.evidence.slice(0, 110)}"`)
  }
  if (r.required_experience && r.experience_years >= r.required_experience) {
    strengths.push(`Meets the experience requirement (${r.experience_years} yrs vs ${r.required_experience} yrs required).`)
  } else if (r.required_experience) {
    concerns.push(`Experience below requirement (${r.experience_years} yrs vs ${r.required_experience} yrs required).`)
    suggestions.push('Build more hands-on experience through internships or production-style projects.')
  }
  if (r.experience_relevance < 0.99 && r.experience_years) {
    concerns.push(`Experience credit adjusted to ${Math.round(r.experience_relevance * 100)}% because fewer required skills are evidenced.`)
  }
  const needLvl = Number(job.education_level) || 0
  const haveLvl = Number(profile.highest_education_level) || 0
  if (needLvl && haveLvl >= needLvl) strengths.push(`Education (${r.education}) meets the required level.`)
  else if (needLvl) concerns.push(`Education requirement (${LEVEL_NAME[needLvl]}) not clearly met (detected: ${r.education}).`)
  if (profile.projects?.length) strengths.push(`${profile.projects.length} project(s) listed that demonstrate practical delivery.`)
  if (profile.certifications?.length) strengths.push(`${profile.certifications.length} certification(s) listed.`)

  for (const s of r.missing_skills) {
    concerns.push(`No evidence of required skill: ${s}.`)
    suggestions.push(learningTip(s))
  }
  for (const s of r.preferred_missing.slice(0, 3)) suggestions.push(`Optional: ${learningTip(s)}`)

  const b = r.breakdown
  return {
    summary: `Score ${r.total}% = skills ${b.skills.contribution} + experience ${b.experience.contribution} + education ${b.education.contribution} + semantic ${b.semantic.contribution} (weighted points out of 100).`,
    strengths,
    concerns,
    improvement_suggestions: [...new Set(suggestions)],
  }
}

function buildSkillGap(job, match) {
  const rows = []
  const semSet = new Set(match.semantic_skills.map((s) => s.skill))
  for (const s of job.required_skills || []) {
    const status = match.exact_skills.includes(s) ? 'Matched' : semSet.has(s) ? 'Implied' : 'Missing'
    rows.push({ skill: s, status, required: true })
  }
  for (const s of job.preferred_skills || []) {
    rows.push({ skill: s, status: match.preferred_matched.includes(s) ? 'Matched' : 'Missing', required: false })
  }
  const missing = rows.filter((r) => r.status === 'Missing').map((r) => r.skill)
  const covered = rows.filter((r) => r.status !== 'Missing').length
  return {
    rows,
    coverage: rows.length ? Math.round((1000 * covered) / rows.length) / 10 : 0,
    missing,
    recommendations: missing.map((s) => ({ skill: s, action: learningTip(s) })),
  }
}

function buildImprovements(profile, job = null, match = null) {
  const out = []
  const add = (severity, area, message) => out.push({ severity, area, message })
  if (!profile.email) add('high', 'Contact', 'No email address detected. Recruiters need a way to reach you.')
  if (!profile.phone) add('medium', 'Contact', 'No phone number detected.')
  const found = new Set(profile.sections_found || ['summary', 'skills', 'experience', 'education'])
  if (!found.has('skills')) add('high', 'Structure', "No clearly labelled 'Skills' section found. Add a dedicated Skills section.")
  if (!found.has('projects') && (profile.experience_years || 0) < 4) add('medium', 'Projects', 'Add 2–3 key projects to strengthen practical evidence.')
  if ((profile.technical_skills || []).length < 5) add('medium', 'Skills', 'Few technical skills listed. Add tools and frameworks you have used.')
  if (!(profile.certifications || []).length) add('low', 'Certifications', 'Consider adding relevant certifications or verified coursework.')
  if (job && match) {
    for (const s of (match.missing_skills || []).slice(0, 5)) {
      add('info', 'Target role', `'${job.title}' asks for ${s}. ${learningTip(s)}`)
    }
  }
  if (!out.length) add('info', 'Overall', 'Strong, well-structured resume with clear quantified impact.')
  return out
}

function redactText(str, name) {
  if (!str) return str
  let out = String(str)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted]')
    .replace(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com)\/\S+/gi, '[redacted]')
    .replace(/\+?\d[\d\s().-]{8,17}\d/g, '[redacted]')
  if (name) {
    for (const part of name.split(/\s+/).filter((p) => p.length > 1)) {
      out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[redacted]')
    }
  }
  return out
}

function redactDeep(obj, name) {
  if (typeof obj === 'string') return redactText(obj, name)
  if (Array.isArray(obj)) return obj.map((x) => redactDeep(x, name))
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, redactDeep(v, name)]))
  }
  return obj
}

function publicResume(r, blind) {
  if (!blind) return { ...r, blind: false }
  return {
    ...r,
    name: `Candidate #${r.resume_id}`,
    filename: `resume_${r.resume_id}`,
    email: null,
    phone: null,
    location: null,
    links: [],
    blind: true,
    summary: redactText(r.summary, r.name),
    experience: redactDeep(r.experience, r.name),
    projects: redactDeep(r.projects, r.name),
    achievements: redactDeep(r.achievements, r.name),
    education: redactDeep(r.education, r.name),
    certifications: redactDeep(r.certifications, r.name),
  }
}

function parseQueryParams(queryStr) {
  const p = new URLSearchParams((queryStr || '').replace(/^\?/, ''))
  return {
    min_score: p.get('min_score') ? Number(p.get('min_score')) : null,
    min_exp: p.get('min_exp') ? Number(p.get('min_exp')) : null,
    min_edu: p.get('min_edu') ? Number(p.get('min_edu')) : null,
    skills: p.get('skills') ? p.get('skills').split(',').map((s) => s.trim()).filter(Boolean) : [],
  }
}

export const demoApi = {
  demoLogin(role) {
    const state = loadState()
    const user = state.users[role === 'candidate' ? 'candidate' : 'recruiter']
    return { token: `talentiq_demo_${user.role}`, user }
  },

  me(token) {
    const state = loadState()
    const role = token?.includes('candidate') ? 'candidate' : 'recruiter'
    return state.users[role]
  },

  saveSettings(body) {
    const state = loadState()
    const u = state.users.recruiter
    if (body.blind_mode !== undefined) u.settings.blind_mode = Boolean(body.blind_mode)
    if (body.weights) u.settings.weights = normaliseWeights(body.weights)
    state.activities.unshift({ text: 'Updated screening settings and re-scored all candidates', at: isoNoZ(0) })
    saveState(state)
    return u
  },

  analytics() {
    const state = loadState()
    const user = state.users.recruiter
    const blind = user.settings.blind_mode
    const weights = user.settings.weights
    const { jobs, resumes } = state

    const matches = []
    for (const j of jobs) {
      for (const r of resumes) {
        const m = scoreCandidate(r, j, weights)
        matches.push({ job: j, resume: r, ...m })
      }
    }

    const best = new Map()
    for (const m of matches) {
      const prev = best.get(m.resume.resume_id)
      if (!prev || m.total > prev.total) best.set(m.resume.resume_id, m)
    }

    const top = [...best.values()].sort((a, b) => b.total - a.total).slice(0, 5)
    const buckets = Array(10).fill(0)
    for (const m of matches) buckets[Math.min(9, Math.floor(m.total / 10))]++

    const cats = { 'Excellent Match': 0, 'Strong Match': 0, 'Moderate Match': 0, 'Low Match': 0 }
    for (const m of matches) cats[m.category] = (cats[m.category] || 0) + 1

    const demand = new Map()
    for (const j of jobs) {
      for (const s of [...j.required_skills, ...j.preferred_skills]) demand.set(s, (demand.get(s) || 0) + 1)
    }
    const have = new Map()
    for (const r of resumes) {
      for (const s of r.technical_skills) have.set(s, (have.get(s) || 0) + 1)
    }
    const edu = new Map()
    for (const r of resumes) edu.set(r.highest_education, (edu.get(r.highest_education) || 0) + 1)

    const per_job = jobs.map((j) => {
      const ms = matches.filter((m) => m.job.id === j.id).sort((a, b) => b.total - a.total)
      const avg = ms.length ? Math.round((ms.reduce((s, m) => s + m.total, 0) / ms.length) * 10) / 10 : 0
      return {
        job_id: j.id,
        title: j.title,
        candidates: ms.length,
        avg,
        top: ms.slice(0, 5).map((m) => ({ name: publicResume(m.resume, blind).name, score: m.total })),
      }
    })

    const avgScore = matches.length ? Math.round((matches.reduce((s, m) => s + m.total, 0) / matches.length) * 10) / 10 : 0

    return {
      totals: { resumes: resumes.length, jobs: jobs.length, screened: best.size, avg_score: avgScore },
      top_candidates: top.map((m) => ({
        resume_id: m.resume.resume_id,
        name: publicResume(m.resume, blind).name,
        score: m.total,
        category: m.category,
        job: m.job.title,
      })),
      recent_activity: state.activities.slice(0, 8),
      category_distribution: Object.entries(cats).map(([name, value]) => ({ name, value })),
      score_distribution: buckets.map((count, i) => ({ range: `${i * 10}-${i * 10 + 10}`, count })),
      skill_demand: [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([skill, count]) => ({ skill, count })),
      candidate_skills: [...have.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([skill, count]) => ({ skill, count })),
      qualifications: [...edu.entries()].map(([name, value]) => ({ name, value })),
      pipeline: [
        { stage: 'Uploaded', count: resumes.length },
        { stage: 'Screened', count: best.size },
        { stage: 'Shortlist (best >= 65%)', count: [...best.values()].filter((m) => m.total >= 65).length },
        { stage: 'Excellent (best >= 80%)', count: [...best.values()].filter((m) => m.total >= 80).length },
      ],
      per_job,
      engine: ENGINE,
    }
  },

  jobs() {
    const state = loadState()
    const weights = state.users.recruiter.settings.weights
    return state.jobs.slice().reverse().map((j) => {
      const scores = state.resumes.map((r) => scoreCandidate(r, j, weights).total)
      return {
        ...j,
        candidates_screened: scores.length,
        top_score: scores.length ? Math.max(...scores) : null,
      }
    })
  },

  extractJob(body) {
    return extractJobRequirements(body.title, body.description)
  },

  createJob(body) {
    const state = loadState()
    const ext = extractJobRequirements(body.title, body.description)
    const job = {
      id: state.nextJobId++,
      title: body.title.trim(),
      description: body.description.trim(),
      required_skills: body.required_skills?.length ? body.required_skills : ext.required_skills,
      preferred_skills: body.preferred_skills?.length ? body.preferred_skills : ext.preferred_skills,
      min_experience: body.min_experience ?? ext.min_experience,
      education_level: body.education_level ?? ext.education_level,
      education: LEVEL_NAME[body.education_level ?? ext.education_level] || 'Not specified',
      location: body.location || '',
      employment_type: body.employment_type || 'Full-time',
      is_open: true,
      created_at: isoNoZ(0),
    }
    state.jobs.push(job)
    state.activities.unshift({ text: `Posted job '${job.title}' and screened ${state.resumes.length} resume(s)`, at: isoNoZ(0) })
    saveState(state)
    return job
  },

  updateJob(id, body) {
    const state = loadState()
    const idx = state.jobs.findIndex((j) => String(j.id) === String(id))
    if (idx === -1) throw new Error('Job not found.')
    const eduLvl = Number(body.education_level ?? state.jobs[idx].education_level) || 0
    state.jobs[idx] = {
      ...state.jobs[idx],
      ...body,
      education_level: eduLvl,
      education: LEVEL_NAME[eduLvl] || 'Not specified',
    }
    state.activities.unshift({ text: `Updated job '${state.jobs[idx].title}' and re-ranked candidates`, at: isoNoZ(0) })
    saveState(state)
    return state.jobs[idx]
  },

  deleteJob(id) {
    const state = loadState()
    state.jobs = state.jobs.filter((j) => String(j.id) !== String(id))
    saveState(state)
    return { ok: true }
  },

  resumes() {
    const state = loadState()
    const blind = state.users.recruiter.settings.blind_mode
    return {
      blind_mode: blind,
      resumes: state.resumes.slice().reverse().map((r) => publicResume(r, blind)),
    }
  },

  uploadResumes(files) {
    const state = loadState()
    const blind = state.users.recruiter.settings.blind_mode
    const results = []
    for (const f of files) {
      const ext = f.name.toLowerCase().split('.').pop()
      if (!['pdf', 'docx'].includes(ext)) {
        results.push({ filename: f.name, status: 'failed', error: 'Unsupported file type. Please upload PDF or DOCX.' })
        continue
      }
      const baseName = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Uploaded Candidate'
      const newResume = {
        resume_id: state.nextResumeId++,
        filename: f.name,
        uploaded_at: isoNoZ(0),
        name: baseName,
        email: `${baseName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        phone: '+91 98111 22334',
        location: 'Bengaluru, India',
        links: [],
        summary: `Uploaded candidate resume (${f.name}) parsed in local demo mode.`,
        technical_skills: ['Python', 'SQL', 'React', 'TypeScript', 'Git', 'REST APIs'],
        soft_skills: ['Communication', 'Teamwork'],
        education: [{ degree: 'B.Tech in Computer Science, 2021', level: 3, level_name: "Bachelor's", field: 'Computer Science', year: '2021' }],
        highest_education_level: 3,
        highest_education: "Bachelor's",
        certifications: ['Cloud Fundamentals'],
        experience: [{ title: 'Software Engineer (2021 - Present)', bullets: ['Built scalable web APIs and dashboards'] }],
        experience_years: 3.0,
        projects: [{ name: 'Portfolio Analytics App', description: 'Built full-stack dashboard with REST APIs and automated tests.' }],
        achievements: [],
        sections_found: ['summary', 'skills', 'experience', 'education', 'projects'],
      }
      state.resumes.push(newResume)
      results.push({
        filename: f.name,
        status: 'processed',
        resume_id: newResume.resume_id,
        name: publicResume(newResume, blind).name,
        skills_found: newResume.technical_skills.length,
      })
    }
    const processed = results.filter((r) => r.status === 'processed').length
    if (processed) state.activities.unshift({ text: `Uploaded and screened ${processed} resume(s)`, at: isoNoZ(0) })
    saveState(state)
    return { processed, failed: results.length - processed, results }
  },

  deleteResume(id) {
    const state = loadState()
    state.resumes = state.resumes.filter((r) => String(r.resume_id) !== String(id))
    saveState(state)
    return { ok: true }
  },

  downloadResumeBlob(id) {
    const state = loadState()
    const r = state.resumes.find((x) => String(x.resume_id) === String(id))
    if (!r) throw new Error('Resume not found.')
    const text = [
      r.name,
      [r.email, r.phone, r.location].filter(Boolean).join(' | '),
      '',
      'SUMMARY',
      r.summary,
      '',
      'TECHNICAL SKILLS',
      r.technical_skills.join(', '),
      '',
      'EXPERIENCE',
      ...r.experience.flatMap((e) => [e.title, ...e.bullets.map((b) => `- ${b}`)]),
      '',
      'EDUCATION',
      ...r.education.map((e) => e.degree),
    ].join('\n')
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: r.filename.replace(/\.[^.]+$/, '.txt') }
  },

  ranking(jobId, q = '') {
    const state = loadState()
    const job = state.jobs.find((j) => String(j.id) === String(jobId))
    if (!job) throw new Error('Job not found.')
    const blind = state.users.recruiter.settings.blind_mode
    const weights = state.users.recruiter.settings.weights
    const filters = parseQueryParams(q)

    let rows = state.resumes.map((r) => {
      const m = scoreCandidate(r, job, weights)
      const pub = publicResume(r, blind)
      return {
        resume_id: r.resume_id,
        name: pub.name,
        filename: pub.filename,
        total: m.total,
        category: m.category,
        matched_skills: m.matched_skills,
        missing_skills: m.missing_skills,
        experience_years: r.experience_years,
        education: r.highest_education,
        education_level: r.highest_education_level,
        skills: r.technical_skills,
        breakdown: m.breakdown,
      }
    })

    if (filters.min_score !== null) rows = rows.filter((x) => x.total >= filters.min_score)
    if (filters.min_exp !== null) rows = rows.filter((x) => x.experience_years >= filters.min_exp)
    if (filters.min_edu) rows = rows.filter((x) => x.education_level >= filters.min_edu)
    if (filters.skills.length) {
      const want = filters.skills.map((s) => s.toLowerCase())
      rows = rows.filter((x) => want.every((w) => x.skills.some((s) => s.toLowerCase() === w)))
    }

    rows.sort((a, b) => b.total - a.total)
    rows.forEach((x, i) => { x.rank = i + 1 })

    return {
      job,
      weights,
      blind_mode: blind,
      engine: ENGINE,
      total_candidates: state.resumes.length,
      candidates: rows,
    }
  },

  report(jobId, resumeId) {
    const state = loadState()
    const job = state.jobs.find((j) => String(j.id) === String(jobId))
    const r = state.resumes.find((x) => String(x.resume_id) === String(resumeId))
    if (!job || !r) throw new Error('Report data not found.')
    const blind = state.users.recruiter.settings.blind_mode
    const weights = state.users.recruiter.settings.weights
    const rawMatch = scoreCandidate(r, job, weights)
    const match = blind ? redactDeep(rawMatch, r.name) : rawMatch
    return {
      candidate: publicResume(r, blind),
      job,
      match,
      skill_gap: buildSkillGap(job, rawMatch),
      weights,
      engine: ENGINE,
      fairness_note: 'Name, age, gender, religion, caste, photo and location are never used in scoring.',
    }
  },

  interview(jobId, resumeId) {
    const state = loadState()
    const job = state.jobs.find((j) => String(j.id) === String(jobId))
    const r = state.resumes.find((x) => String(x.resume_id) === String(resumeId))
    if (!job || !r) throw new Error('Interview data not found.')
    const blind = state.users.recruiter.settings.blind_mode
    const m = scoreCandidate(r, job, state.users.recruiter.settings.weights)
    const qs = {
      technical: [
        ...m.exact_skills.slice(0, 3).map((s) => `You list ${s} on your resume. Describe the most complex system or problem you solved with it.`),
        ...m.missing_skills.slice(0, 2).map((s) => `This role uses ${s}, which is not listed on your resume. How quickly could you ramp up on ${s}?`),
      ],
      projects: (r.projects?.length
        ? r.projects.slice(0, 2).map((p) => `In "${p.name}", what was your direct contribution and what trade-offs did you make?`)
        : ['Walk me through a technical project you are proud of: goals, stack, and measurable outcome.']),
      experience: [
        ...(r.experience?.slice(0, 2).map((e) => `In "${e.title}", how did you handle shifting priorities or tight deadlines?`) || []),
        'Tell me about a time you resolved a technical disagreement with a teammate.',
      ],
      problem_solving: [
        `Design a scalable workflow relevant to ${job.title}. What components and failure handling would you include?`,
        'If a production endpoint suddenly slows down by 10x, how do you diagnose and fix it?',
      ],
      generation: 'Tailored questions generated from the parsed candidate profile and job requirements.',
    }
    return blind ? redactDeep(qs, r.name) : qs
  },

  compare(jobId, ids) {
    const state = loadState()
    const job = state.jobs.find((j) => String(j.id) === String(jobId))
    if (!job) throw new Error('Job not found.')
    const blind = state.users.recruiter.settings.blind_mode
    const weights = state.users.recruiter.settings.weights
    const candidates = ids.map((id) => {
      const r = state.resumes.find((x) => String(x.resume_id) === String(id))
      if (!r) throw new Error('Candidate not found.')
      const m = scoreCandidate(r, job, weights)
      return {
        profile: publicResume(r, blind),
        total: m.total,
        category: m.category,
        breakdown: m.breakdown,
        matched_skills: m.matched_skills,
        missing_skills: m.missing_skills,
        skill_gap: buildSkillGap(job, m),
      }
    })
    return { job, candidates }
  },

  exportFile(jobId, format) {
    const ranked = this.ranking(jobId)
    if (format === 'csv') {
      const header = ['Rank', 'Candidate', 'Score %', 'Category', 'Matched skills', 'Missing skills', 'Experience (yrs)', 'Education']
      const lines = [
        header.join(','),
        ...ranked.candidates.map((c) =>
          [
            c.rank,
            `"${c.name}"`,
            c.total,
            `"${c.category}"`,
            `"${c.matched_skills.join('; ')}"`,
            `"${c.missing_skills.join('; ')}"`,
            c.experience_years,
            `"${c.education}"`,
          ].join(','),
        ),
      ]
      return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    }
    const text = [
      `TalentIQ Screening Report: ${ranked.job.title}`,
      '',
      ...ranked.candidates.map((c) => `#${c.rank} ${c.name} — ${c.total}% (${c.category}) | Matched: ${c.matched_skills.join(', ')}`),
    ].join('\n')
    return new Blob([text], { type: 'text/plain;charset=utf-8' })
  },

  myProfile() {
    const state = loadState()
    const r = state.candidateProfile
    return {
      resume_id: r.resume_id,
      filename: r.filename,
      uploaded_at: r.uploaded_at,
      profile: r,
      improvements: buildImprovements(r),
      parser: {
        entity_extraction: 'Local Demo NLP Extractor',
        pdf_reader: 'Active',
        docx_reader: 'Active',
      },
    }
  },

  uploadMyResume(file) {
    const state = loadState()
    const ext = file.name.toLowerCase().split('.').pop()
    if (!['pdf', 'docx'].includes(ext)) throw new Error('Unsupported file type. Please upload a PDF or DOCX file.')
    state.candidateProfile = {
      ...state.candidateProfile,
      filename: file.name,
      uploaded_at: isoNoZ(0),
    }
    saveState(state)
    return this.myProfile()
  },

  saveProfile(body) {
    const state = loadState()
    const lvl = Number(body.highest_education_level ?? state.candidateProfile.highest_education_level) || 0
    state.candidateProfile = {
      ...state.candidateProfile,
      ...body,
      highest_education_level: lvl,
      highest_education: LEVEL_NAME[lvl] || 'Not specified',
    }
    if (body.name) state.users.candidate.name = body.name
    if (body.email) state.users.candidate.email = body.email
    saveState(state)
    return this.myProfile()
  },

  recommendations() {
    const state = loadState()
    const r = state.candidateProfile
    const recs = state.jobs
      .filter((j) => j.is_open)
      .map((j) => {
        const m = scoreCandidate(r, j, DEFAULT_WEIGHTS)
        return {
          job: j,
          total: m.total,
          category: m.category,
          matched_skills: m.matched_skills,
          missing_skills: m.missing_skills,
          breakdown: m.breakdown,
          explanation: m.explanation,
        }
      })
      .sort((a, b) => b.total - a.total)
    return { engine: ENGINE, recommendations: recs }
  },

  gap(jobId) {
    const state = loadState()
    const r = state.candidateProfile
    const job = state.jobs.find((j) => String(j.id) === String(jobId))
    if (!job) throw new Error('Job not found.')
    const m = scoreCandidate(r, job, DEFAULT_WEIGHTS)
    return {
      job,
      match: m,
      skill_gap: buildSkillGap(job, m),
      improvements: buildImprovements(r, job, m),
      engine: ENGINE,
    }
  },
}
