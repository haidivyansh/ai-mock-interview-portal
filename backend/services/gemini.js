const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
  console.warn(
    '[Gemini] Warning: GEMINI_API_KEY is not set. Question generation will fall back to templates.'
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Build the prompt sent to Gemini.
 * We ask explicitly for a JSON array so parsing is deterministic.
 */
const buildPrompt = (jobRole, skills, experienceLevel, difficulty, numberOfQuestions) => {
  const skillsList = Array.isArray(skills) ? skills.join(', ') : skills;
  return `
You are a senior technical interviewer. Generate exactly ${numberOfQuestions} interview questions for the following candidate profile.

Profile:
- Job Role: ${jobRole}
- Skills: ${skillsList}
- Experience Level: ${experienceLevel}
- Difficulty: ${difficulty}

Rules:
1. Questions must be specific to the skills and job role listed above.
2. Match the difficulty: Easy = conceptual/basic, Medium = practical/scenario-based, Hard = deep-dive/system-level.
3. Each question must have a concise "hints" field (1-2 sentences) that guides what a strong answer covers.
4. Assign a relevant "category" label per question (e.g. "React Internals", "System Design", "Behavioral", etc.).
5. Number each question starting from 1.
6. Return ONLY a valid JSON array — no markdown, no code fences, no extra text.

Required JSON format:
[
  {
    "id": 1,
    "question": "...",
    "category": "...",
    "hints": "..."
  }
]
`.trim();
};

/**
 * Strip markdown code fences that Gemini sometimes wraps around JSON.
 */
const stripCodeFences = (text) => {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
};

/**
 * Call Gemini and return a parsed array of question objects.
 * Throws an error if the API call fails or the response cannot be parsed.
 *
 * @param {string}   jobRole
 * @param {string[]} skills
 * @param {string}   experienceLevel
 * @param {string}   difficulty
 * @param {number}   numberOfQuestions
 * @returns {Promise<Array<{id:number, question:string, category:string, hints:string}>>}
 */
const generateQuestionsWithGemini = async (
  jobRole,
  skills,
  experienceLevel,
  difficulty,
  numberOfQuestions
) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = buildPrompt(jobRole, skills, experienceLevel, difficulty, numberOfQuestions);

  const result = await model.generateContent(prompt);
  const rawText = result.response.text();
  const cleaned = stripCodeFences(rawText);

  let questions;
  try {
    questions = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Gemini returned non-JSON output. Raw response:\n${rawText.slice(0, 300)}`
    );
  }

  if (!Array.isArray(questions)) {
    throw new Error('Gemini response parsed but is not a JSON array.');
  }

  // Normalise: ensure id, question, category, hints are all present
  return questions.slice(0, numberOfQuestions).map((q, idx) => ({
    id: typeof q.id === 'number' ? q.id : idx + 1,
    question: q.question || '',
    category: q.category || 'General',
    hints: q.hints || '',
  }));
};

// ---------------------------------------------------------------------------
// Evaluate a single answer with Gemini
// ---------------------------------------------------------------------------

const buildEvalPrompt = (question, userAnswer) => `
You are a strict but fair senior technical interviewer evaluating a candidate's answer.

Question:
"${question}"

Candidate's Answer:
"${userAnswer}"

Evaluate the answer and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

Required JSON format:
{
  "technicalScore": <integer 0–10>,
  "communicationScore": <integer 0–10>,
  "technicalAccuracy": "<2–3 sentence assessment of factual and technical correctness>",
  "communication": "<2–3 sentence assessment of clarity, structure, and depth of explanation>",
  "suggestions": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "correctAnswer": "<a concise model answer that would score 10/10>"
}

Scoring guide (apply to both technicalScore and communicationScore independently):
0–3: Incorrect / very unclear
4–5: Partially correct or unclear, missing key concepts
6–7: Mostly correct / mostly clear, minor gaps
8–9: Strong with good depth and clarity
10: Exceptional — comprehensive, precise, well-communicated
`.trim();

/**
 * Evaluate a candidate's answer using Gemini.
 * Returns { score, technicalAccuracy, communication, suggestions, correctAnswer }
 * Throws on API failure or unparseable response.
 *
 * @param {string} question
 * @param {string} userAnswer
 */
const evaluateAnswerWithGemini = async (question, userAnswer) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const prompt = buildEvalPrompt(question, userAnswer);

  const result  = await model.generateContent(prompt);
  const rawText = result.response.text();
  const cleaned = stripCodeFences(rawText);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Gemini evaluation returned non-JSON output. Raw:\n${rawText.slice(0, 300)}`
    );
  }

  const clamp = (v) => Math.min(10, Math.max(0, Math.round(Number(v) || 0)));

  const technicalScore    = clamp(parsed.technicalScore);
  const communicationScore = clamp(parsed.communicationScore);
  // overall = weighted average (tech 60%, communication 40%)
  const score = Math.round(technicalScore * 0.6 + communicationScore * 0.4);

  return {
    score,
    technicalScore,
    communicationScore,
    technicalAccuracy: parsed.technicalAccuracy || '',
    communication:     parsed.communication     || '',
    suggestions:       Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    correctAnswer:     parsed.correctAnswer      || '',
  };
};

// ---------------------------------------------------------------------------
// Unified interview-generation helpers
// ---------------------------------------------------------------------------
// The controllers use this richer interface for both role and resume based
// interviews.  Keep the original `generateQuestionsWithGemini` export above
// for backwards compatibility with any older clients.

const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

const buildGenerationConfig = (seed) => ({
  seed,
  temperature: 0.8,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 4096,
});

const questionTypes = ['technical', 'scenario', 'debugging', 'coding', 'behavioral', 'system_design', 'hr'];

const normaliseQuestions = (questions, numberOfQuestions) => {
  if (!Array.isArray(questions)) throw new Error('Gemini response parsed but is not a JSON array.');

  const clean = questions
    .filter((q) => q && typeof q.question === 'string' && q.question.trim())
    .slice(0, numberOfQuestions)
    .map((q, index) => ({
      id: index + 1,
      question: q.question.trim(),
      category: String(q.category || 'General').trim(),
      hints: String(q.hints || 'Explain your approach, trade-offs, and a practical example.').trim(),
      type: questionTypes.includes(q.type) ? q.type : 'technical',
      followUps: Array.isArray(q.followUps)
        ? q.followUps.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
        : [],
    }));

  // Instead of throwing on a count mismatch (which silently triggers the generic fallback),
  // only throw if Gemini returned NO usable questions at all.
  // A partial result is still far better than generic template questions.
  if (clean.length === 0) {
    throw new Error('Gemini returned 0 valid questions.');
  }
  if (clean.length !== numberOfQuestions) {
    console.warn(`[Gemini] normaliseQuestions: expected ${numberOfQuestions}, got ${clean.length} — using partial result.`);
  }
  return clean;
};

const buildUnifiedPrompt = (options) => {
  const {
    jobRole, skills = [], experienceLevel, difficulty, numberOfQuestions,
    interviewType = 'role', previousQuestionSet = [], resumeData, resumeRawText,
    // HR-specific context
    candidateName, targetCompany, hrContext,
  } = options;
  const previous = previousQuestionSet.slice(0, 30).map((q) => `- ${q}`).join('\n') || 'None';

  // ── HR interview mode ────────────────────────────────────────────────────
  if (interviewType === 'hr') {
    const hrProfile = [];
    if (candidateName) hrProfile.push(`Candidate Name: ${candidateName}`);
    if (jobRole)       hrProfile.push(`Applied Role: ${jobRole}`);
    if (experienceLevel) hrProfile.push(`Experience Level: ${experienceLevel}`);
    if (targetCompany) hrProfile.push(`Target Company: ${targetCompany}`);
    if (skills?.length) hrProfile.push(`Skills / Background: ${Array.isArray(skills) ? skills.join(', ') : skills}`);
    if (hrContext)     hrProfile.push(`Additional context: ${hrContext}`);

    return `You are a senior HR interviewer conducting a behavioral and situational interview. Generate exactly ${numberOfQuestions} unique HR/behavioral interview questions.

Candidate profile:
${hrProfile.join('\n') || '(No profile provided — generate general HR questions)'}

Cover a diverse mix of these HR topics (do NOT ask multiple questions on the same topic):
- Self-introduction / background summary
- Key strengths and areas for improvement
- Short-term and long-term career goals
- Motivation for applying to this role / company
- Why the company should hire this candidate
- Teamwork, collaboration, and communication style
- Leadership experience or potential
- Conflict resolution and handling disagreements
- Problem-solving approach under pressure or ambiguity
- Adaptability to change, new environments, or feedback
- Work ethic, time management, and accountability
- Situational / STAR-format scenarios ("Tell me about a time when…")

Rules:
- Every question must be open-ended and conversational — never yes/no.
- Use STAR-format framing for situational questions ("Tell me about a time…", "Describe a situation where…").
- Do NOT ask technical coding or system-design questions.
- Personalize questions using the candidate profile where possible.
- Vary question style: direct, situational, reflective, and hypothetical.

Questions already received — do NOT repeat or closely paraphrase:
${previous}

Return ONLY a valid JSON array — no markdown, no code fences, no extra text.
Required item format (all fields required):
{"question":"...","category":"...","hints":"...","type":"hr","followUps":["...", "..."]}`;
  }

  let resumeContext = '';
  if (interviewType === 'resume') {
    // Build a rich, human-readable resume context block instead of raw JSON.
    // This makes it much easier for Gemini to anchor questions to specific resume details.
    const rd = resumeData || {};
    const lines = [];

    lines.push('=== RESUME DETAILS (use these to generate ALL questions) ===');

    if (rd.candidateName) lines.push(`Candidate: ${rd.candidateName}`);
    if (rd.summary)       lines.push(`Summary: ${rd.summary}`);

    if (rd.education?.length)      lines.push(`Education:\n${rd.education.map(e => `  - ${e}`).join('\n')}`);
    if (rd.experience?.length)     lines.push(`Work Experience:\n${rd.experience.map(e => `  - ${e}`).join('\n')}`);
    if (rd.projects?.length)       lines.push(`Projects:\n${rd.projects.map(p => `  - ${p}`).join('\n')}`);
    if (rd.certifications?.length) lines.push(`Certifications:\n${rd.certifications.map(c => `  - ${c}`).join('\n')}`);
    if (rd.technicalSkills?.length) lines.push(`Technical Skills: ${rd.technicalSkills.join(', ')}`);
    if (rd.languages?.length)      lines.push(`Languages: ${rd.languages.join(', ')}`);
    if (rd.frameworks?.length)     lines.push(`Frameworks: ${rd.frameworks.join(', ')}`);
    if (rd.databases?.length)      lines.push(`Databases: ${rd.databases.join(', ')}`);
    if (rd.tools?.length)          lines.push(`Tools & Platforms: ${rd.tools.join(', ')}`);

    // Append the raw extracted text as a fallback source of detail, trimmed to fit.
    const structuredBlock = lines.join('\n');
    // Reserve 4000 chars for the raw text so Gemini has both structured and unstructured context.
    const structuredTrimmed = structuredBlock.slice(0, 6000);
    const rawTrimmed = String(resumeRawText || '').slice(0, 4000);

    resumeContext = `\n\n${structuredTrimmed}\n\nFull resume text (for additional context):\n${rawTrimmed}\n=== END RESUME DETAILS ===`;
  }

  const roleSection = interviewType === 'resume'
    ? `You are conducting a RESUME-BASED interview. You MUST base every single question on the candidate's actual resume above.
- Reference specific projects, job titles, companies, technologies, and experiences from the resume.
- Do NOT ask generic questions unrelated to the resume content.
- Each question should name or clearly relate to something the candidate actually listed.`
    : `You are conducting a role-based interview. Generate questions relevant to the target role and skills listed.`;

  return `You are a senior technical interviewer. Generate exactly ${numberOfQuestions} unique interview questions.

${roleSection}

Candidate profile:
- Target role: ${jobRole}
- Skills: ${Array.isArray(skills) ? skills.join(', ') : skills}
- Experience level: ${experienceLevel}
- Difficulty: ${difficulty}${resumeContext}

Questions the candidate has already received — do NOT repeat or closely paraphrase any of these:
${previous}

Variation instruction: Introduce fresh angles — ask about trade-offs, failure cases, design decisions, or "what would you do differently" scenarios to ensure variety even across repeat sessions.

Return ONLY a valid JSON array — no markdown, no code fences, no extra text.
Required item format (all fields required):
{"question":"...","category":"...","hints":"...","type":"technical|scenario|debugging|coding|behavioral|system_design","followUps":["...", "..."]}`;
};

const generateInterviewQuestions = async (options) => {
  const numberOfQuestions = Number(options.numberOfQuestions);
  if (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 10) {
    throw new Error('numberOfQuestions must be an integer between 1 and 10.');
  }

  // Pass generation config to the API so temperature/topP/topK actually take effect
  // and so different sessions get genuinely different outputs.
  const seed = options.seed ?? randomSeed();
  const model = genAI.getGenerativeModel(
    { model: 'gemini-3.6-flash' },
    { generationConfig: buildGenerationConfig(seed) }
  );
  const result = await model.generateContent(buildUnifiedPrompt(options));
  const rawText = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences(rawText));
  } catch {
    throw new Error(`Gemini returned non-JSON output. Raw response:\n${rawText.slice(0, 300)}`);
  }
  return { questions: normaliseQuestions(parsed, numberOfQuestions), seed };
};

const produceDiverseFallbackQuestions = (options) => {
  const count = Number(options.numberOfQuestions) || 5;
  const role = String(options.jobRole || 'Software Engineer').trim();
  const level = String(options.experienceLevel || 'Mid Level').trim();
  const seed = Number(options.seed) || randomSeed();

  // ── HR mode: dedicated behavioral/situational fallback ───────────────────
  if (options.interviewType === 'hr') {
    const hrTemplates = [
      { question: `Tell me about yourself and what drew you to a career as a ${role}.`, category: 'Introduction', type: 'hr' },
      { question: `What do you consider your greatest professional strength, and can you give a specific example of when it made a difference?`, category: 'Strengths', type: 'hr' },
      { question: `Describe an area where you're actively working to improve yourself. What steps have you taken?`, category: 'Self-Improvement', type: 'hr' },
      { question: `Where do you see yourself professionally in the next 3–5 years?`, category: 'Career Goals', type: 'hr' },
      { question: `Why are you interested in this role, and why should we choose you over other candidates?`, category: 'Motivation', type: 'hr' },
      { question: `Tell me about a time you had a conflict with a teammate or manager. How did you handle it and what was the outcome?`, category: 'Conflict Handling', type: 'hr' },
      { question: `Describe a situation where you had to work under significant pressure or a tight deadline. How did you manage it?`, category: 'Work Under Pressure', type: 'hr' },
      { question: `Give an example of a time you took the lead on a project or initiative. What challenges did you face?`, category: 'Leadership', type: 'hr' },
      { question: `Tell me about a time you had to quickly adapt to a major change at work. How did you approach it?`, category: 'Adaptability', type: 'hr' },
      { question: `How do you prioritize your tasks when you have multiple competing deadlines?`, category: 'Work Ethic', type: 'hr' },
      { question: `Describe a situation where you went above and beyond what was expected of you.`, category: 'Work Ethic', type: 'hr' },
      { question: `Tell me about a time you disagreed with a decision made by your team or manager. What did you do?`, category: 'Communication', type: 'hr' },
    ];
    // Use seed to pick a non-repeating subset
    const offset = seed % hrTemplates.length;
    const seenBefore = new Set((options.previousQuestionSet || [])
      .map((q) => String(q).trim().toLowerCase().replace(/\s+/g, ' ')));

    return Array.from({ length: count }, (_, index) => {
      const t = hrTemplates[(index + offset) % hrTemplates.length];
      let question = t.question;
      if (seenBefore.has(question.toLowerCase().replace(/\s+/g, ' '))) {
        question += ` Relate your answer specifically to your experience as a ${role}.`;
      }
      return {
        id: index + 1,
        question,
        category: t.category,
        type: t.type,
        hints: `Use the STAR format (Situation → Task → Action → Result) to structure your answer. Be specific and concise at ${level} level.`,
        followUps: [
          'What would you do differently if you faced this situation again?',
          'How did that experience shape how you work today?',
        ],
      };
    });
  }

  // For resume-based fallback, extract specific anchors from resumeData so
  // even template questions reference the candidate's actual resume content.
  const rd = options.resumeData;
  const hasResumeData = rd && (
    (rd.projects?.length > 0) ||
    (rd.experience?.length > 0) ||
    (rd.technicalSkills?.length > 0)
  );

  let skills;
  if (Array.isArray(options.skills) && options.skills.length) {
    skills = options.skills.map((s) => String(s).trim()).filter(Boolean);
  } else {
    skills = ['problem solving'];
  }

  const offset = seed % skills.length;
  const focus = (index) => skills[(index + offset) % skills.length];

  // Resume-aware templates: if we have project/experience data, generate questions
  // that explicitly reference something from the candidate's actual background.
  const resumeProjects = hasResumeData ? (rd.projects || []).slice(0, 3) : [];
  const resumeExperience = hasResumeData ? (rd.experience || []).slice(0, 2) : [];

  const genericTemplates = [
    (skill) => ({ question: `Explain how you would use ${skill} to solve a realistic problem in a ${role} project.`, category: skill, type: 'technical' }),
    (skill) => ({ question: `A production feature using ${skill} is slow or unreliable. How would you investigate, fix, and verify the issue?`, category: 'Debugging', type: 'debugging' }),
    (skill) => ({ question: `Design a scalable ${role} solution that uses ${skill}. What trade-offs would you make?`, category: 'System Design', type: 'system_design' }),
    (skill) => ({ question: `Walk through a small implementation or pseudocode approach for a ${skill} requirement in this role.`, category: 'Coding', type: 'coding' }),
    (skill) => ({ question: `Tell me about a time you had to learn or improve ${skill} while delivering a project. What was the outcome?`, category: 'Behavioral', type: 'behavioral' }),
    (skill) => ({ question: `How would you review a teammate's ${skill} solution for correctness, maintainability, and security?`, category: 'Scenario', type: 'scenario' }),
  ];

  const resumeTemplates = [
    (skill, project) => ({ question: `You listed "${project}" as a project. What was the most technically challenging part, and how did you use ${skill} to solve it?`, category: 'Projects', type: 'scenario' }),
    (skill, project) => ({ question: `In "${project}", how would you improve the architecture or performance if you had to rebuild it today using ${skill}?`, category: 'Projects', type: 'system_design' }),
    (skill, exp) => ({ question: `During your experience at "${exp.split(':')[0] || exp}", how did you apply ${skill} in a real-world scenario? What were the outcomes?`, category: 'Experience', type: 'behavioral' }),
    (skill, exp) => ({ question: `Based on your role at "${exp.split(':')[0] || exp}", describe a time ${skill} helped you debug or resolve a critical issue.`, category: 'Experience', type: 'debugging' }),
  ];

  const seenBefore = new Set((options.previousQuestionSet || [])
    .map((q) => String(q).trim().toLowerCase().replace(/\s+/g, ' ')));

  return Array.from({ length: count }, (_, index) => {
    const skill = focus(index);

    let template;
    // Alternate between resume-specific and generic templates when resume data is available
    if (hasResumeData && index % 2 === 0 && (resumeProjects.length > 0 || resumeExperience.length > 0)) {
      const rtIdx = Math.floor(seed / 7 + index) % resumeTemplates.length;
      if (rtIdx < 2 && resumeProjects.length > 0) {
        const project = resumeProjects[index % resumeProjects.length];
        template = resumeTemplates[rtIdx](skill, project);
      } else if (resumeExperience.length > 0) {
        const exp = resumeExperience[index % resumeExperience.length];
        template = resumeTemplates[Math.min(rtIdx, 3)](skill, exp);
      } else {
        template = genericTemplates[(index + Math.floor(seed / 7)) % genericTemplates.length](skill);
      }
    } else {
      template = genericTemplates[(index + Math.floor(seed / 7)) % genericTemplates.length](skill);
    }

    let question = template.question;
    if (seenBefore.has(question.toLowerCase().replace(/\s+/g, ' '))) {
      const dailyUsers = 100 + ((seed + index * 7919) % 9900);
      question += ` Frame your answer for a product serving about ${dailyUsers.toLocaleString()} daily users.`;
    }
    return {
      id: index + 1,
      ...template,
      question,
      hints: `Answer at a ${level} level: state your approach, give a practical ${skill} example, and discuss trade-offs or testing.`,
      followUps: [
        `What edge case would you consider when using ${skill}?`,
        `How would you test and monitor this in production?`,
      ],
    };
  });
};

const analyzeResumeWithGemini = async (resumeText) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  // Ask for richer structured data: project descriptions and detailed experience entries
  // so question generation can anchor to specific, real items from the candidate's resume.
  const prompt = `You are a resume parser. Analyze the resume below and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

Required JSON keys:
- candidateName: string (full name)
- summary: string (2–3 sentence professional summary)
- education: array of strings — each entry like "B.Tech Computer Science, XYZ University, 2022"
- technicalSkills: array of specific skill names (e.g. "React", "Node.js", "PostgreSQL")
- languages: array of programming/scripting language names (e.g. "Python", "JavaScript", "Go")
- frameworks: array of framework/library names (e.g. "Express", "Django", "Spring Boot")
- databases: array of database names (e.g. "MongoDB", "MySQL", "Redis")
- tools: array of tool/platform names (e.g. "Docker", "AWS", "Git", "Jenkins")
- projects: array of strings — each entry must describe what the project does, the tech stack used, and the candidate's specific contribution. Format: "ProjectName: <description> | Stack: <tech> | Role: <contribution>"
- certifications: array of strings (e.g. "AWS Certified Developer, 2023")
- experience: array of strings — each entry must include company, role, duration, and 1–2 key responsibilities. Format: "Role at Company (Duration): <key responsibilities>"

Rules:
- Be specific and extract REAL values from the resume — do not invent or hallucinate.
- If a field has no data, return an empty array or empty string.
- projects and experience entries must be descriptive, not just a name.

Resume:
${String(resumeText).slice(0, 14000)}`;

  const result = await model.generateContent(prompt);
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences(result.response.text()));
  } catch {
    throw new Error('Gemini returned invalid JSON while analyzing the resume.');
  }
  const arrayFields = ['education', 'technicalSkills', 'languages', 'frameworks', 'databases', 'projects', 'certifications', 'experience', 'tools'];
  const analysis = {
    candidateName: String(parsed.candidateName || 'Candidate').trim(),
    summary: String(parsed.summary || '').trim(),
  };
  arrayFields.forEach((field) => {
    analysis[field] = Array.isArray(parsed[field])
      ? parsed[field].filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
      : [];
  });
  return analysis;
};

module.exports = {
  generateQuestionsWithGemini,
  evaluateAnswerWithGemini,
  generateInterviewQuestions,
  produceDiverseFallbackQuestions,
  buildGenerationConfig,
  randomSeed,
  analyzeResumeWithGemini,
};
