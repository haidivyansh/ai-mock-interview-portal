const Interview  = require('../models/Interview');
const { isDbConnected } = require('../config/db');
const {
  generateInterviewQuestions,
  produceDiverseFallbackQuestions,
  buildGenerationConfig,
  randomSeed,
} = require('../services/gemini');
const { collectUserPreviousQuestions, serializeQuestions } = require('./interviewController');

// In-memory storage for HR interviews (parallel to inMemoryInterviews in interviewController)
const inMemoryHrInterviews = new Map();

// ---------------------------------------------------------------------------
// Generate HR questions — calls the unified Gemini pipeline with interviewType
// set to 'hr', then falls back to the HR-specific template generator.
// ---------------------------------------------------------------------------
const generateHrQuestions = async ({
  jobRole, experienceLevel, targetCompany, numberOfQuestions, userId,
}) => {
  const seed = randomSeed();
  const previousQuestionSet = await collectUserPreviousQuestions(userId);

  const apiKeySet =
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  const baseOpts = {
    jobRole: jobRole || 'Professional Role',
    skills:  [],               // HR interviews are skill-agnostic
    experienceLevel: experienceLevel || 'Mid Level (2-5 yrs)',
    difficulty: 'Medium',      // HR interviews don't have technical difficulty
    numberOfQuestions,
    seed,
    previousQuestionSet,
    interviewType: 'hr',
    targetCompany: targetCompany || '',
  };

  if (!apiKeySet) {
    console.warn('[HR] GEMINI_API_KEY not configured — using diverse fallback generator.');
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: 'GEMINI_API_KEY not set' },
    };
  }

  try {
    const { questions, seed: usedSeed } = await generateInterviewQuestions(baseOpts);
    console.log(`[HR] Gemini generated ${questions.length} HR questions (seed=${usedSeed})`);
    return {
      questions,
      generation: { ...buildGenerationConfig(usedSeed), seed: usedSeed, promptMode: 'unified', usedFallback: false },
    };
  } catch (err) {
    if (err.message && err.message.includes('429')) {
      console.error('[HR] Gemini 429 rate limit — using fallback.');
    } else {
      console.error('[HR] Gemini generation failed, falling back:', err.message);
    }
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: String(err.message).slice(0, 200) },
    };
  }
};

// ---------------------------------------------------------------------------
// @desc    Create a new HR-based mock interview
// @route   POST /api/interview/hr/create
// @access  Private
// ---------------------------------------------------------------------------
const createHrInterview = async (req, res) => {
  try {
    const { jobRole, experienceLevel, targetCompany, numberOfQuestions } = req.body;
    const userId = req.user ? req.user.id : 'demo_user';

    // Validation
    const errors = {};
    if (!jobRole || !jobRole.trim()) errors.jobRole = 'Job role is required.';

    const numQ = parseInt(numberOfQuestions, 10);
    if (isNaN(numQ) || numQ < 1 || numQ > 10) {
      errors.numberOfQuestions = 'Number of questions must be between 1 and 10.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    console.log(`[HR] Creating interview — role="${jobRole.trim()}", exp="${experienceLevel}", company="${targetCompany || ''}", numQ=${numQ}, userId=${userId}`);

    const { questions: generatedQuestions, generation } = await generateHrQuestions({
      jobRole: jobRole.trim(),
      experienceLevel: experienceLevel || 'Mid Level (2-5 yrs)',
      targetCompany:   (targetCompany || '').trim(),
      numberOfQuestions: numQ,
      userId,
    });

    const normalizedQuestions = serializeQuestions(generatedQuestions);

    const interviewPayload = {
      userId,
      interviewType:     'hr',
      jobRole:           jobRole.trim(),
      skills:            [],
      experienceLevel:   experienceLevel || 'Mid Level (2-5 yrs)',
      difficulty:        'Medium',
      numberOfQuestions: numQ,
      questions:         normalizedQuestions,
      status:            'created',
      generation,
    };

    // MongoDB path
    if (isDbConnected()) {
      const interview = await Interview.create(interviewPayload);
      return res.status(201).json({
        success: true,
        message: 'HR interview created successfully',
        interview: {
          id:               interview._id.toString(),
          interviewType:    interview.interviewType,
          jobRole:          interview.jobRole,
          experienceLevel:  interview.experienceLevel,
          difficulty:       interview.difficulty,
          numberOfQuestions:interview.numberOfQuestions,
          questions:        interview.questions.map((q) => ({
            id: q.id, question: q.question, category: q.category,
            hints: q.hints, type: q.type || 'hr',
            followUps: Array.isArray(q.followUps) ? q.followUps : [],
          })),
          status:    interview.status,
          createdAt: interview.createdAt,
          generation: interview.generation || null,
        },
      });
    }

    // In-memory path
    const id = 'hr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const interviewData = { id, ...interviewPayload, createdAt: new Date().toISOString() };
    inMemoryHrInterviews.set(id, interviewData);

    console.log(`[HR] Interview created in-memory — id=${id}`);

    return res.status(201).json({
      success: true,
      message: 'HR interview created successfully (in-memory mode)',
      interview: {
        id:               interviewData.id,
        interviewType:    interviewData.interviewType,
        jobRole:          interviewData.jobRole,
        experienceLevel:  interviewData.experienceLevel,
        difficulty:       interviewData.difficulty,
        numberOfQuestions:interviewData.numberOfQuestions,
        questions:        interviewData.questions,
        status:           interviewData.status,
        createdAt:        interviewData.createdAt,
        generation:       interviewData.generation || null,
      },
    });
  } catch (error) {
    console.error('[HR] Create Interview Error:', error);
    return res.status(500).json({ message: 'Server error creating HR interview: ' + error.message });
  }
};

module.exports = { createHrInterview, inMemoryHrInterviews };
