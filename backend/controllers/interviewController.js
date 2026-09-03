const Interview = require('../models/Interview');
const { isDbConnected } = require('../config/db');
const {
  generateInterviewQuestions,
  produceDiverseFallbackQuestions,
  buildGenerationConfig,
  randomSeed,
} = require('../services/gemini');

// In-memory storage fallback when MongoDB is offline
const inMemoryInterviews = new Map();

// ---------------------------------------------------------------------------
// Merge helper — unifies answers/feedback stored on the in-memory interview
// object with entries written to the separate answer & feedback in-memory maps.
// Returns a single, deterministic AnswerSchema[] array with feedback populated.
// ---------------------------------------------------------------------------
const mergeAnswersAndFeedback = (interviewObj, answerBucket, feedbackMap) => {
  const byQId = new Map();

  const pushAnswer = (a) => {
    if (!a || a.questionId === undefined || a.questionId === null) return;
    const qid = Number(a.questionId);
    if (!byQId.has(qid) || (a.answerText && a.answerText.length > (byQId.get(qid).answerText || '').length)) {
      byQId.set(qid, { ...(byQId.get(qid) || {}), ...a, questionId: qid });
    }
  };

  (answerBucket || []).forEach(pushAnswer);
  (interviewObj?.answers || []).forEach(pushAnswer);

  const merged = Array.from(byQId.values());

  const questions = interviewObj?.questions || [];
  questions.forEach((q) => {
    const qid = Number(q.id);
    if (!byQId.has(qid)) {
      merged.push({ questionId: qid, questionText: q.question, answerText: '', answeredAt: null, feedback: null });
    }
  });

  const fMap = (feedbackMap instanceof Map) ? feedbackMap : new Map();
  return merged
    .sort((a, b) => a.questionId - b.questionId)
    .map((a) => {
      const fdb = fMap.get(a.questionId);
      if (fdb) return { ...a, feedback: { ...(a.feedback || {}), ...fdb } };
      return a;
    });
};

// ---------------------------------------------------------------------------
// Collect ALL questions this user has seen previously (across BOTH role and
// resume interviews, both Mongo and in-memory stores) so the unified prompt
// builder can forbid repeats.
// ---------------------------------------------------------------------------
const collectUserPreviousQuestions = async (userId) => {
  const out = [];
  if (!userId) return out;

  // ── Mongo ────────────────────────────────────────────────────────────────
  if (isDbConnected()) {
    try {
      const prior = await Interview.find({ userId })
        .select('questions.question')
        .sort({ createdAt: -1 })
        .limit(25)
        .lean();
      prior.forEach((doc) => {
        (doc.questions || []).forEach((q) => { if (q?.question) out.push(q.question); });
      });
    } catch (_) { /* ignore Mongo errors during dedupe */ }
  }

  // ── In-memory role store ────────────────────────────────────────────────
  inMemoryInterviews.forEach((iv) => {
    if (iv.userId === userId) {
      (iv.questions || []).forEach((q) => { if (q?.question) out.push(q.question); });
    }
  });

  // ── In-memory resume store (if resumeController has been loaded) ─────────
  try {
    const { inMemoryResumeInterviews } = require('./resumeController');
    if (inMemoryResumeInterviews instanceof Map) {
      inMemoryResumeInterviews.forEach((iv) => {
        if (iv.userId === userId) {
          (iv.questions || []).forEach((q) => { if (q?.question) out.push(q.question); });
        }
      });
    }
  } catch (_) { /* resumeController not yet loaded — no problem */ }

  // ── In-memory HR store (if hrInterviewController has been loaded) ─────────
  try {
    const { inMemoryHrInterviews } = require('./hrInterviewController');
    if (inMemoryHrInterviews instanceof Map) {
      inMemoryHrInterviews.forEach((iv) => {
        if (iv.userId === userId) {
          (iv.questions || []).forEach((q) => { if (q?.question) out.push(q.question); });
        }
      });
    }
  } catch (_) { /* hrInterviewController not yet loaded — no problem */ }

  return Array.from(new Set(out));
};

// ---------------------------------------------------------------------------
// Public unified entry point for role-based question generation.
// Attempts Gemini first with a random seed + cross-interview dedupe, then
// falls back to the diverse (template-interpolated) in-proc generator.
// ---------------------------------------------------------------------------
const generateQuestions = async ({ jobRole, skills, experienceLevel, difficulty, numberOfQuestions, userId }) => {
  const seed = randomSeed();
  const previousQuestionSet = await collectUserPreviousQuestions(userId);

  const apiKeySet =
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  const baseOpts = {
    jobRole, skills, experienceLevel, difficulty, numberOfQuestions,
    seed, previousQuestionSet, interviewType: 'role',
  };

  if (!apiKeySet) {
    console.warn('[Interview] GEMINI_API_KEY not configured — using diverse fallback generator.');
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: 'GEMINI_API_KEY not set' },
    };
  }

  try {
    const { questions, seed: usedSeed } = await generateInterviewQuestions(baseOpts);
    console.log(`[Interview] Gemini generated ${questions.length} role questions (seed=${usedSeed})`);
    const gcfg = buildGenerationConfig(usedSeed);
    return {
      questions,
      generation: { ...gcfg, seed: usedSeed, promptMode: 'unified', usedFallback: false },
    };
  } catch (err) {
    if (err.message && err.message.includes('429')) {
      console.error('[Interview] Gemini 429 rate limit — using fallback.');
    } else {
      console.error('[Interview] Gemini generation failed, falling back:', err.message);
    }
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: String(err.message).slice(0, 200) },
    };
  }
};

// ---------------------------------------------------------------------------
// Shared: normalise the question array into the DB-ready shape and build a
// response object. This was previously duplicated between the role and
// resume paths.
// ---------------------------------------------------------------------------
const serializeQuestions = (questions) => questions.map((q) => ({
  id: q.id,
  question: q.question,
  category: q.category || 'General',
  hints:    q.hints || '',
  type:     q.type  || 'technical',
  followUps: Array.isArray(q.followUps) ? q.followUps : [],
}));

const serializeAnswerForResponse = (a) => ({
  questionId:   a.questionId,
  questionText: a.questionText || '',
  answerText:   a.answerText   || '',
  answeredAt:   a.answeredAt,
  feedback: a.feedback
    ? {
        score:              a.feedback.score,
        technicalScore:     a.feedback.technicalScore     ?? null,
        communicationScore: a.feedback.communicationScore ?? null,
        completenessScore:  a.feedback.completenessScore  ?? null,
        problemSolvingScore:a.feedback.problemSolvingScore?? null,
        confidenceScore:    a.feedback.confidenceScore    ?? null,
        overallScore:       a.feedback.overallScore       ?? null,
        confidenceFeedback: a.feedback.confidenceFeedback || '',
        technicalAccuracy:  a.feedback.technicalAccuracy  || '',
        communication:      a.feedback.communication      || '',
        suggestions:        a.feedback.suggestions        || [],
        correctAnswer:      a.feedback.correctAnswer      || '',
        idealAnswer:        a.feedback.idealAnswer        || '',
        strengths:          a.feedback.strengths          || [],
        weaknesses:         a.feedback.weaknesses         || [],
        improvementSuggestions: a.feedback.improvementSuggestions || [],
        followUpQuestions:  a.feedback.followUpQuestions  || [],
        evaluation:         a.feedback.evaluation         || '',
        evaluatedAt:        a.feedback.evaluatedAt,
      }
    : null,
});

// ---------------------------------------------------------------------------
// @desc    Create new role-based mock interview
// @route   POST /api/interview/create
// @access  Private
// ---------------------------------------------------------------------------
const createInterview = async (req, res) => {
  try {
    const { jobRole, skills, experienceLevel, difficulty, numberOfQuestions } = req.body;
    const userId = req.user ? req.user.id : 'demo_user';

    // Server-side validation
    const errors = {};

    if (!jobRole || !jobRole.trim()) {
      errors.jobRole = 'Job role is required';
    }

    let skillsArray = [];
    if (Array.isArray(skills)) {
      skillsArray = skills.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof skills === 'string') {
      skillsArray = skills.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (skillsArray.length === 0) {
      errors.skills = 'Please provide at least one skill';
    }

    if (!experienceLevel) {
      errors.experienceLevel = 'Experience level is required';
    }

    if (!difficulty) {
      errors.difficulty = 'Difficulty is required';
    }

    const numQ = parseInt(numberOfQuestions, 10);
    if (isNaN(numQ) || numQ < 1 || numQ > 10) {
      errors.numberOfQuestions = 'Number of questions must be between 1 and 10';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    // Generate questions via the unified pipeline + cross-interview dedupe
    const { questions: generatedQuestions, generation } = await generateQuestions({
      jobRole: jobRole.trim(),
      skills: skillsArray,
      experienceLevel,
      difficulty,
      numberOfQuestions: numQ,
      userId,
    });

    const normalizedQuestions = serializeQuestions(generatedQuestions);

    const interviewPayload = {
      userId,
      interviewType: 'role',
      jobRole: jobRole.trim(),
      skills: skillsArray,
      experienceLevel,
      difficulty,
      numberOfQuestions: numQ,
      questions: normalizedQuestions,
      status: 'created',
      generation,
    };

    if (isDbConnected()) {
      const interview = await Interview.create(interviewPayload);
      return res.status(201).json({
        success: true,
        message: 'Interview created successfully',
        interview: {
          id: interview._id.toString(),
          interviewType: interview.interviewType,
          jobRole: interview.jobRole,
          skills: interview.skills,
          experienceLevel: interview.experienceLevel,
          difficulty: interview.difficulty,
          numberOfQuestions: interview.numberOfQuestions,
          questions: interview.questions.map((q) => ({
            id: q.id, question: q.question, category: q.category, hints: q.hints,
            type: q.type || 'technical', followUps: Array.isArray(q.followUps) ? q.followUps : [],
          })),
          status: interview.status,
          createdAt: interview.createdAt,
          generation: interview.generation || null,
        },
      });
    }

    const id = 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const interviewData = { id, ...interviewPayload, createdAt: new Date().toISOString() };
    inMemoryInterviews.set(id, interviewData);

    return res.status(201).json({
      success: true,
      message: 'Interview created successfully (in-memory mode)',
      interview: {
        id: interviewData.id,
        interviewType: interviewData.interviewType,
        jobRole: interviewData.jobRole,
        skills: interviewData.skills,
        experienceLevel: interviewData.experienceLevel,
        difficulty: interviewData.difficulty,
        numberOfQuestions: interviewData.numberOfQuestions,
        questions: interviewData.questions,
        status: interviewData.status,
        createdAt: interviewData.createdAt,
        generation: interviewData.generation || null,
      },
    });
  } catch (error) {
    console.error('Create Interview Error:', error);
    return res.status(500).json({ message: 'Server error creating interview: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Get interview by ID (full document including answers + feedback)
// @route   GET /api/interview/detail/:id
// @access  Private
// ---------------------------------------------------------------------------
const getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      try {
        const interview = await Interview.findById(id).lean();
        if (interview) {
          const evaluatedAnswers = (interview.answers || []).filter(
            (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) !== null
          );
          const scoreKey = evaluatedAnswers.length > 0 && evaluatedAnswers[0].feedback?.overallScore != null
            ? 'overallScore' : 'score';
          const overallScore = evaluatedAnswers.length > 0
            ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback[scoreKey] ?? 0), 0) / evaluatedAnswers.length)
            : null;

          const resumeData = interview.resumeData;
          return res.json({
            id: interview._id.toString(),
            userId: interview.userId,
            interviewType: interview.interviewType || 'role',
            jobRole: interview.jobRole,
            skills: interview.skills,
            experienceLevel: interview.experienceLevel,
            difficulty: interview.difficulty,
            numberOfQuestions: interview.numberOfQuestions,
            status: interview.status,
            createdAt: interview.createdAt,
            updatedAt: interview.updatedAt,
            overallScore,
            generation: interview.generation || null,
            resumeData: resumeData
              ? {
                  originalFileName: resumeData.originalFileName || '',
                  filePath:         resumeData.filePath || '',
                  uploadDate:       resumeData.uploadDate || null,
                  extractedText:    resumeData.extractedText || '',
                  candidateName:    resumeData.candidateName || '',
                  summary:          resumeData.summary || '',
                  education:        resumeData.education || [],
                  technicalSkills:  resumeData.technicalSkills || [],
                  languages:        resumeData.languages || [],
                  frameworks:       resumeData.frameworks || [],
                  databases:        resumeData.databases || [],
                  projects:         resumeData.projects || [],
                  certifications:   resumeData.certifications || [],
                  experience:       resumeData.experience || [],
                  tools:            resumeData.tools || [],
                }
              : null,
            questions: (interview.questions || []).map((q) => ({
              id: q.id,
              question: q.question,
              category: q.category || 'General',
              hints: q.hints || '',
              type: q.type || 'technical',
              followUps: Array.isArray(q.followUps) ? q.followUps : [],
            })),
            answers: (interview.answers || []).map(serializeAnswerForResponse),
          });
        }
      } catch {
        // Not a valid ObjectId — fall through to in-memory check
      }
    }

    if (inMemoryInterviews.has(id)) {
      const data = inMemoryInterviews.get(id);
      const { inMemoryAnswers }  = require('./answerController');
      const { inMemoryFeedback } = require('./evaluationController');
      const mergedAnswers = mergeAnswersAndFeedback(data, inMemoryAnswers.get(id), inMemoryFeedback.get(id));
      const evaluatedAnswers = mergedAnswers.filter(
        (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) != null
      );
      const overallScore = evaluatedAnswers.length > 0
        ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback.overallScore ?? a.feedback.score ?? 0), 0) / evaluatedAnswers.length)
        : null;
      return res.json({
        ...data,
        questions: (data.questions || []).map((q) => ({
          id: q.id, question: q.question, category: q.category || 'General', hints: q.hints || '',
          type: q.type || 'technical', followUps: Array.isArray(q.followUps) ? q.followUps : [],
        })),
        answers: mergedAnswers.map(serializeAnswerForResponse),
        overallScore,
        generation: data.generation || null,
      });
    }

    // Also check resume in-memory store
    const { inMemoryResumeInterviews } = require('./resumeController');
    if (inMemoryResumeInterviews instanceof Map && inMemoryResumeInterviews.has(id)) {
      const data = inMemoryResumeInterviews.get(id);
      const { inMemoryAnswers }  = require('./answerController');
      const { inMemoryFeedback } = require('./evaluationController');
      const mergedAnswers = mergeAnswersAndFeedback(data, inMemoryAnswers.get(id), inMemoryFeedback.get(id));
      const evaluatedAnswers = mergedAnswers.filter(
        (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) != null
      );
      const overallScore = evaluatedAnswers.length > 0
        ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback.overallScore ?? a.feedback.score ?? 0), 0) / evaluatedAnswers.length)
        : null;
      const rd = data.resumeData || {};
      return res.json({
        ...data,
        questions: (data.questions || []).map((q) => ({
          id: q.id, question: q.question, category: q.category || 'General', hints: q.hints || '',
          type: q.type || 'technical', followUps: Array.isArray(q.followUps) ? q.followUps : [],
        })),
        answers: mergedAnswers.map(serializeAnswerForResponse),
        overallScore,
        generation: data.generation || null,
        resumeData: rd ? {
          originalFileName: rd.originalFileName || '',
          filePath:         rd.filePath         || '',
          uploadDate:       rd.uploadDate       || null,
          extractedText:    rd.extractedText    || '',
          candidateName:    rd.candidateName    || '',
          summary:          rd.summary          || '',
          education:        rd.education        || [],
          technicalSkills:  rd.technicalSkills  || [],
          languages:        rd.languages        || [],
          frameworks:       rd.frameworks       || [],
          databases:        rd.databases        || [],
          projects:         rd.projects         || [],
          certifications:   rd.certifications   || [],
          experience:       rd.experience       || [],
          tools:            rd.tools            || [],
        } : null,
      });
    }

    // Also check HR in-memory store
    try {
      const { inMemoryHrInterviews } = require('./hrInterviewController');
      if (inMemoryHrInterviews instanceof Map && inMemoryHrInterviews.has(id)) {
        const data = inMemoryHrInterviews.get(id);
        const { inMemoryAnswers }  = require('./answerController');
        const { inMemoryFeedback } = require('./evaluationController');
        const mergedAnswers = mergeAnswersAndFeedback(data, inMemoryAnswers.get(id), inMemoryFeedback.get(id));
        const evaluatedAnswers = mergedAnswers.filter(
          (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) != null
        );
        const overallScore = evaluatedAnswers.length > 0
          ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback.overallScore ?? a.feedback.score ?? 0), 0) / evaluatedAnswers.length)
          : null;
        return res.json({
          ...data,
          questions: (data.questions || []).map((q) => ({
            id: q.id, question: q.question, category: q.category || 'General', hints: q.hints || '',
            type: q.type || 'hr', followUps: Array.isArray(q.followUps) ? q.followUps : [],
          })),
          answers: mergedAnswers.map(serializeAnswerForResponse),
          overallScore,
          generation: data.generation || null,
        });
      }
    } catch (_) { /* hrInterviewController not yet loaded */ }

    return res.status(404).json({ message: 'Interview not found' });
  } catch (error) {
    console.error('Get Interview Error:', error);
    return res.status(500).json({ message: 'Server error fetching interview details' });
  }
};

// ---------------------------------------------------------------------------
// @desc    List the current user's interviews (summary cards)
// @route   GET /api/interview/user/all
// @access  Private
// ---------------------------------------------------------------------------
const getUserInterviews = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (isDbConnected()) {
      const interviews = await Interview.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      const formatted = interviews.map((iv) => {
        const evaluatedAnswers = (iv.answers || []).filter(
          (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) != null
        );
        const scoreKey = evaluatedAnswers.length > 0 && evaluatedAnswers[0].feedback?.overallScore != null
          ? 'overallScore' : 'score';
        const overallScore = evaluatedAnswers.length > 0
          ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback[scoreKey] ?? 0), 0) / evaluatedAnswers.length)
          : null;

        return {
          id: iv._id.toString(),
          interviewType: iv.interviewType || 'role',
          jobRole: iv.jobRole,
          skills: iv.skills,
          experienceLevel: iv.experienceLevel,
          difficulty: iv.difficulty,
          numberOfQuestions: iv.numberOfQuestions,
          status: iv.status,
          createdAt: iv.createdAt,
          answeredCount: (iv.answers || []).length,
          overallScore,
          generation: iv.generation
            ? { seed: iv.generation.seed, usedFallback: iv.generation.usedFallback, promptMode: iv.generation.promptMode }
            : null,
        };
      });

      return res.json({ interviews: formatted, total: formatted.length });
    }

    // In-memory fallback — merge role + resume + HR stores
    const { inMemoryResumeInterviews } = require('./resumeController');
    const allMaps = [inMemoryInterviews];
    if (inMemoryResumeInterviews instanceof Map) allMaps.push(inMemoryResumeInterviews);
    try {
      const { inMemoryHrInterviews } = require('./hrInterviewController');
      if (inMemoryHrInterviews instanceof Map) allMaps.push(inMemoryHrInterviews);
    } catch (_) { /* not loaded yet */ }
    const all = [];
    allMaps.forEach(map => {
      map.forEach(iv => { if (iv.userId === userId) all.push(iv); });
    });
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const formatted = all.map((iv) => {
      const evaluatedAnswers = (iv.answers || []).filter(
        (a) => a.feedback && (a.feedback.overallScore ?? a.feedback.score) != null
      );
      const overallScore = evaluatedAnswers.length > 0
        ? Math.round(evaluatedAnswers.reduce((s, a) => s + (a.feedback.overallScore ?? a.feedback.score ?? 0), 0) / evaluatedAnswers.length)
        : null;
      return {
        id: iv.id || iv._id?.toString(),
        interviewType: iv.interviewType || 'role',
        jobRole: iv.jobRole,
        skills: iv.skills,
        experienceLevel: iv.experienceLevel,
        difficulty: iv.difficulty,
        numberOfQuestions: iv.numberOfQuestions,
        status: iv.status,
        createdAt: iv.createdAt,
        answeredCount: (iv.answers || []).length,
        overallScore,
        generation: iv.generation
          ? { seed: iv.generation.seed, usedFallback: iv.generation.usedFallback, promptMode: iv.generation.promptMode }
          : null,
      };
    });

    return res.json({ interviews: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get User Interviews Error:', error);
    return res.status(500).json({ message: 'Server error fetching interviews' });
  }
};

// ---------------------------------------------------------------------------
// @desc    Legacy route: generate 3 quick questions without creating an
// interview. Used by demo screens and the landing page.
// @route   GET /api/interview/questions
// @access  Private (enforced at route-level by auth middleware)
// ---------------------------------------------------------------------------
const getQuestions = async (req, res) => {
  const { type = 'Full-Stack Developer' } = req.query;
  const userId = req.user?.id || 'demo_user';
  const { questions } = await generateQuestions({
    jobRole: type,
    skills: ['General Engineering', 'Problem Solving'],
    experienceLevel: 'Mid Level (2-5 yrs)',
    difficulty: 'Medium',
    numberOfQuestions: 3,
    userId,
  });
  res.json({ type, questions: serializeQuestions(questions) });
};

module.exports = {
  createInterview,
  getInterviewById,
  getUserInterviews,
  getQuestions,
  inMemoryInterviews,
  serializeQuestions,
  collectUserPreviousQuestions,
};
