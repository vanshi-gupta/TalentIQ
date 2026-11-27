"""Fictional demo resumes and job postings (no real people)."""

SAMPLE_RESUMES: dict[str, str] = {
"alex_johnson": """Alex Johnson
alex.johnson@example.com | +1 415 555 0134 | Location: San Francisco, CA
github.com/alexj-dev

Summary
Backend engineer with 5 years of experience building data-driven APIs in Python.

Skills
Python, FastAPI, SQL, PostgreSQL, Machine Learning, Scikit-learn, Pandas, Git, REST APIs, Teamwork

Experience
Software Engineer, DataBridge Inc. (Jan 2021 - Present)
- Built REST APIs with FastAPI serving 2 million requests per day
- Developed machine learning models with scikit-learn that reduced churn by 12%
- Optimised PostgreSQL queries, cutting report latency by 40%
Junior Developer, CodeNest (Jun 2019 - Dec 2020)
- Wrote Python automation scripts that saved 15 hours of manual work per week
- Collaborated with cross-functional teams in an Agile environment

Education
B.Tech in Computer Science, State Technical University, 2019

Projects
Churn Predictor
- Trained and deployed a classification model on 200k customer records with a FastAPI inference service and unit tests

Certifications
Coursera Machine Learning Specialization
""",
"priya_sharma": """Priya Sharma
priya.sharma@example.com | +91 98765 43210 | Location: Bengaluru, India

Profile
Data scientist passionate about turning data into decisions.

Technical Skills
Python, R, Machine Learning, Deep Learning, NLP, TensorFlow, PyTorch, spaCy, SQL, Pandas, NumPy, Data Visualization, Docker, AWS

Work Experience
Data Scientist, Insight Analytics (Mar 2020 - Present)
- Built NLP pipelines using spaCy and transformers to classify 500k support tickets with 91% accuracy
- Deployed models as Docker containers on AWS and monitored drift
- Mentored 3 junior analysts
Data Analyst, RetailCo (Jul 2018 - Feb 2020)
- Created Tableau dashboards used by 40 managers

Education
M.Tech in Data Science, Indian Institute of Technology, 2018
B.Tech in Computer Science, 2016

Projects
Resume Ranker
- Developed an NLP-based resume ranking tool using sentence embeddings and cosine similarity, evaluated on 1,000 resumes

Certifications
AWS Certified Machine Learning Specialty
TensorFlow Developer Certificate

Achievements
Winner, National AI Hackathon 2022
""",
"marcus_lee": """Marcus Lee
marcus.lee@example.com | 312-555-0188

Summary
Full stack developer focused on user-friendly web apps.

Skills
JavaScript, TypeScript, React, Node.js, HTML, CSS, MongoDB, Git, Docker, REST APIs, Communication

Experience
Full Stack Developer, PixelWorks (Feb 2022 - Present)
- Built responsive React dashboards used by 5,000 customers
- Developed Node.js REST APIs backed by MongoDB
- Set up GitHub Actions CI/CD pipelines
Frontend Intern, WebFlow Studio (Jun 2021 - Jan 2022)
- Implemented UI components in React

Education
B.Sc in Information Technology, Midwest University, 2021

Projects
Task Board
- Kanban-style web app with drag and drop, real-time updates and authentication

Certifications
Meta Front-End Developer Certificate (Coursera)
""",
"sofia_garcia": """Sofia Garcia
sofia.garcia@example.com | +34 600 123 456

Summary
Cloud and DevOps engineer, 7 years experience automating infrastructure.

Skills
AWS, Azure, Docker, Kubernetes, Terraform, CI/CD, Jenkins, Linux, Bash, Python, Git, Leadership

Experience
Senior DevOps Engineer, CloudNine (Jan 2019 - Present)
- Led a team of 4 migrating 60 services to Kubernetes on AWS
- Reduced deployment time from 45 minutes to 6 minutes with Jenkins and Terraform
DevOps Engineer, NetSolve (Jan 2016 - Dec 2018)
- Managed Linux servers and built monitoring dashboards

Education
B.E in Electronics Engineering, University of Valencia, 2015

Certifications
AWS Certified Solutions Architect Associate
Certified Kubernetes Administrator
""",
"david_chen": """David Chen
david.chen@example.com | 646-555-0102

Objective
Fresher seeking an opportunity in analytics.

Skills
Python, Excel, SQL, Statistics, Tableau

Education
B.Sc in Statistics, City University, 2024

Projects
Sales Analysis
- Analysed sales data of a retail store and built charts

Certifications
Google Data Analytics Certificate
""",
"neha_patel": """Neha Patel
neha.patel@example.com | +91 91234 56780 | Location: Pune, India

Summary
Software engineer with 3 years of experience in Java microservices.

Skills
Java, Spring Boot, Microservices, MySQL, SQL, Kafka, Docker, REST APIs, Git, JUnit, Agile

Experience
Software Engineer, FinServe Technologies (Aug 2022 - Present)
- Developed Spring Boot microservices handling 10k transactions per minute
- Wrote JUnit tests achieving 85% coverage
- Containerised services with Docker
Associate Engineer, FinServe Technologies (Jul 2021 - Jul 2022)
- Responsible for maintaining legacy modules

Education
B.Tech in Information Technology, Pune Institute of Technology, 2021
""",
"omar_hassan": """Omar Hassan
omar.hassan@example.com | +971 50 123 4567

Summary
Analytical engineer who enjoys working with data.

Experience
Software Developer, Gulf Analytics (Sep 2021 - Present)
- Built predictive models using Python to forecast demand for 300 retail products
- Created automated data pipelines that process 5 GB of daily sales records
- Presented findings to senior stakeholders each month
Intern, TechHub (Jun 2020 - Aug 2020)
- Cleaned and analysed survey datasets

Education
B.Tech in Computer Engineering, American University of Sharjah, 2021

Projects
Demand Forecast
- Trained regression and gradient boosting models on three years of sales history to predict weekly demand with a 9% error
""",
"emily_wilson": """Emily Wilson
emily.wilson@example.com | 206-555-0177

Skills
Figma, UI/UX, Wireframing, Prototyping, User Research, HTML, CSS, Communication, Creativity

Experience
Product Designer, Brightside Studio (Apr 2020 - Present)
- Designed mobile app screens used by 120k users
- Ran usability tests with 30 participants and improved task completion by 18%

Education
B.Des in Interaction Design, Pacific Design School, 2020

Certifications
Google UX Design Certificate
""",
}

SAMPLE_JOBS = [
    {
        "title": "Python Backend Developer",
        "description": ("We are looking for a Python Backend Developer to build and scale REST APIs.\n\n"
                        "Requirements:\n- 3+ years of experience with Python and FastAPI\n- Strong SQL and PostgreSQL skills\n"
                        "- Experience building REST APIs and writing unit tests\n- Git and Agile ways of working\n\n"
                        "Nice to have:\n- Docker and AWS\n- Machine learning exposure\n\n"
                        "Bachelor's degree in Computer Science or related field."),
        "location": "Remote", "employment_type": "Full-time"},
    {
        "title": "Machine Learning Engineer",
        "description": ("Join us to develop machine learning models for production use.\n\nRequirements:\n"
                        "- 2+ years building machine learning systems\n- Python, Scikit-learn and Pandas\n- Deep Learning with PyTorch or TensorFlow\n"
                        "- SQL and data analysis\n\nPreferred:\n- NLP experience\n- Docker and AWS deployment\n\n"
                        "Master's or Bachelor's degree in a quantitative field."),
        "location": "Bengaluru, India", "employment_type": "Full-time"},
    {
        "title": "Full Stack Web Developer",
        "description": ("Build modern web applications end to end.\n\nRequirements:\n- 2+ years of experience\n"
                        "- React and TypeScript\n- Node.js and REST APIs\n- MongoDB or SQL databases\n- Git\n\n"
                        "Nice to have:\n- CI/CD and Docker\n\nBachelor's degree preferred."),
        "location": "Chicago, IL", "employment_type": "Full-time"},
    {
        "title": "DevOps Engineer",
        "description": ("Own our cloud infrastructure and delivery pipelines.\n\nRequirements:\n- 4+ years of experience\n"
                        "- AWS, Docker and Kubernetes\n- Terraform and CI/CD\n- Linux administration\n\n"
                        "Preferred:\n- Python scripting\n- Leadership of small teams\n\nBachelor's degree in engineering."),
        "location": "Hybrid - Madrid", "employment_type": "Full-time"},
    {
        "title": "Data Analyst",
        "description": ("Turn business data into insight.\n\nRequirements:\n- 1+ years experience\n- SQL and Excel\n"
                        "- Data analysis and Data Visualization (Tableau or Power BI)\n- Communication skills\n\n"
                        "Nice to have:\n- Python and Pandas\n\nBachelor's degree."),
        "location": "Remote", "employment_type": "Full-time"},
]
