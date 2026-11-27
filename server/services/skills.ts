export interface SkillDefinition {
  name: string;
  aliases: string[];
}

export const SKILL_CATALOG: SkillDefinition[] = [
  { name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
  { name: 'Next.js', aliases: ['next.js', 'nextjs', 'next js'] },
  { name: 'TypeScript', aliases: ['typescript', 'ts'] },
  { name: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript'] },
  { name: 'Vue.js', aliases: ['vue', 'vue.js', 'vuejs'] },
  { name: 'Angular', aliases: ['angular', 'angularjs'] },
  { name: 'HTML5', aliases: ['html5', 'html'] },
  { name: 'CSS3', aliases: ['css3', 'css'] },
  { name: 'Tailwind CSS', aliases: ['tailwind', 'tailwind css', 'tailwindcss'] },
  { name: 'SASS', aliases: ['sass', 'scss'] },
  { name: 'Redux', aliases: ['redux', 'redux toolkit'] },
  { name: 'GraphQL', aliases: ['graphql'] },
  { name: 'REST APIs', aliases: ['rest api', 'rest apis', 'restful services', 'restful api'] },
  { name: 'Webpack', aliases: ['webpack'] },
  { name: 'Vite', aliases: ['vite'] },
  { name: 'Jest', aliases: ['jest'] },
  { name: 'Cypress', aliases: ['cypress'] },
  { name: 'Playwright', aliases: ['playwright'] },
  { name: 'Node.js', aliases: ['node.js', 'nodejs', 'node js', 'node'] },
  { name: 'Express', aliases: ['express.js', 'expressjs', 'express'] },
  { name: 'NestJS', aliases: ['nestjs', 'nest.js'] },
  { name: 'Python', aliases: ['python'] },
  { name: 'Django', aliases: ['django'] },
  { name: 'Flask', aliases: ['flask'] },
  { name: 'FastAPI', aliases: ['fastapi'] },
  { name: 'Java', aliases: ['java'] },
  { name: 'Spring Boot', aliases: ['spring boot', 'springboot'] },
  { name: 'Go', aliases: ['golang'] },
  { name: 'C#', aliases: ['c#', 'c sharp'] },
  { name: '.NET', aliases: ['.net', 'dotnet', 'asp.net'] },
  { name: 'Ruby', aliases: ['ruby'] },
  { name: 'Ruby on Rails', aliases: ['ruby on rails', 'rails'] },
  { name: 'PHP', aliases: ['php'] },
  { name: 'Laravel', aliases: ['laravel'] },
  { name: 'SQL', aliases: ['sql'] },
  { name: 'PostgreSQL', aliases: ['postgresql', 'postgres'] },
  { name: 'MySQL', aliases: ['mysql'] },
  { name: 'SQLite', aliases: ['sqlite'] },
  { name: 'MongoDB', aliases: ['mongodb', 'mongo'] },
  { name: 'Redis', aliases: ['redis'] },
  { name: 'Elasticsearch', aliases: ['elasticsearch', 'elastic search'] },
  { name: 'Kafka', aliases: ['kafka', 'apache kafka'] },
  { name: 'RabbitMQ', aliases: ['rabbitmq'] },
  { name: 'AWS', aliases: ['aws', 'amazon web services'] },
  { name: 'Azure', aliases: ['azure', 'microsoft azure'] },
  { name: 'GCP', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
  { name: 'Docker', aliases: ['docker'] },
  { name: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { name: 'Terraform', aliases: ['terraform'] },
  { name: 'CI/CD', aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery'] },
  { name: 'GitHub Actions', aliases: ['github actions'] },
  { name: 'Linux', aliases: ['linux', 'unix'] },
  { name: 'Git', aliases: ['git', 'github', 'gitlab'] },
  { name: 'Microservices', aliases: ['microservices', 'micro-services'] },
  { name: 'System Design', aliases: ['system design', 'distributed systems'] },
  { name: 'Machine Learning', aliases: ['machine learning', 'ml models'] },
  { name: 'Deep Learning', aliases: ['deep learning'] },
  { name: 'PyTorch', aliases: ['pytorch', 'torch'] },
  { name: 'TensorFlow', aliases: ['tensorflow'] },
  { name: 'scikit-learn', aliases: ['scikit-learn', 'sklearn', 'scikit learn'] },
  { name: 'Pandas', aliases: ['pandas'] },
  { name: 'NumPy', aliases: ['numpy'] },
  { name: 'Spark', aliases: ['spark', 'apache spark', 'pyspark'] },
  { name: 'Airflow', aliases: ['airflow', 'apache airflow'] },
  { name: 'dbt', aliases: ['dbt'] },
  { name: 'Snowflake', aliases: ['snowflake'] },
  { name: 'BigQuery', aliases: ['bigquery', 'big query'] },
  { name: 'Tableau', aliases: ['tableau'] },
  { name: 'Power BI', aliases: ['power bi', 'powerbi'] },
  { name: 'NLP', aliases: ['nlp', 'natural language processing'] },
  { name: 'LLM', aliases: ['llm', 'large language model', 'large language models', 'generative ai'] },
  { name: 'Data Visualization', aliases: ['data visualization', 'data visualisation'] },
  { name: 'Product Management', aliases: ['product management', 'product manager'] },
  { name: 'Product Design', aliases: ['product design', 'product designer'] },
  { name: 'UI/UX Design', aliases: ['ui/ux', 'ui ux', 'ux design', 'ui design', 'user experience design'] },
  { name: 'Figma', aliases: ['figma'] },
  { name: 'User Research', aliases: ['user research', 'usability research'] },
  { name: 'Prototyping', aliases: ['prototyping', 'prototype'] },
  { name: 'Wireframing', aliases: ['wireframing', 'wireframe'] },
  { name: 'Accessibility', aliases: ['accessibility', 'a11y', 'wcag'] },
  { name: 'Agile', aliases: ['agile'] },
  { name: 'Scrum', aliases: ['scrum'] },
  { name: 'Jira', aliases: ['jira'] },
  { name: 'Leadership', aliases: ['leadership', 'team lead', 'mentoring'] },
  { name: 'Communication', aliases: ['communication'] },
  { name: 'Cybersecurity', aliases: ['cybersecurity', 'cyber security', 'security engineering'] },
  { name: 'Salesforce', aliases: ['salesforce'] },
  { name: 'SAP', aliases: ['sap'] },
  { name: 'Excel', aliases: ['excel', 'microsoft excel'] },
];

const aliasIndex = new Map<string, string>();
for (const skill of SKILL_CATALOG) {
  aliasIndex.set(normalizeSkillToken(skill.name), skill.name);
  for (const alias of skill.aliases) aliasIndex.set(normalizeSkillToken(alias), skill.name);
}

export function normalizeSkillToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalSkill(value: string): string {
  const token = normalizeSkillToken(value);
  if (!token) return '';
  return aliasIndex.get(token) ?? value.trim().replace(/\s+/g, ' ');
}

export function dedupeSkills(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const canonical = canonicalSkill(String(value));
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
}

export function extractSkillsFromText(text: string): string[] {
  const haystack = ' ' + text.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ') + ' ';
  const hits: { name: string; index: number }[] = [];
  for (const skill of SKILL_CATALOG) {
    let best = Number.POSITIVE_INFINITY;
    for (const alias of skill.aliases) {
      const normalized = alias.toLowerCase();
      if (!normalized) continue;
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp('(?<![a-z0-9+#.])' + escaped + '(?![a-z0-9+#.])', 'g');
      const index = haystack.search(pattern);
      if (index >= 0) best = Math.min(best, index);
    }
    if (Number.isFinite(best)) hits.push({ name: skill.name, index: best });
  }
  return hits.sort((a, b) => a.index - b.index).map((hit) => hit.name).slice(0, 35);
}
