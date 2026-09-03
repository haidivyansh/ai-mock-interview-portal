const Interview = require('../models/Interview');
const { isDbConnected } = require('../config/db');
const { evaluateAnswerWithGemini } = require('../services/gemini');

// In-memory feedback store: Map<interviewId, Map<questionId, feedbackObject>>
const inMemoryFeedback = new Map();

// ---------------------------------------------------------------------------
// Internal helper — call Gemini with full interview context, fall back to rule-based scoring
// ---------------------------------------------------------------------------
const callGeminiEval = async (question, userAnswer, context) => {
  const apiKeySet =
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  if (!apiKeySet) return fallbackEvaluate(question, userAnswer, context);

  try {
    return await evaluateAnswerWithGemini(question, userAnswer, context);
  } catch (err) {
    if (err.message && err.message.includes('429')) {
      console.error('[Gemini] Rate limit / quota exceeded. Using fallback scorer. Reset your quota at https://ai.google.dev/gemini-api/docs/rate-limits');
    } else {
      console.error('[Gemini] Evaluation failed, using fallback:', err.message);
    }
    return fallbackEvaluate(question, userAnswer, context);
  }
};

// ---------------------------------------------------------------------------
// Fallback rule-based scorer — produces ALL required schema fields so the UI
// never has empty sections even when the Gemini API is unavailable.
// ---------------------------------------------------------------------------
const fallbackEvaluate = (question, userAnswer, context) => {
  const trimmed = (userAnswer || '').trim();
  const words   = trimmed ? trimmed.split(/\s+/).length : 0;
  const sentenceCount = trimmed ? (trimmed.match(/[.!?]+/g) || []).length || 1 : 0;

  // Scores derived from length + sentence structure
  const technicalScore     = Math.min(10, Math.max(1, Math.round(2 + words / 25)));
  const communicationScore = Math.min(10, Math.max(1, Math.round(1 + words / 30)));
  const completenessScore  = Math.min(10, Math.max(1, Math.round(1 + words / 35)));
  const problemSolvingScore = Math.min(10, Math.max(1, Math.round(1 + (words > 100 ? words / 45 : words / 20))));
  const confidenceScore    = Math.min(10, Math.max(1,
    Math.round(sentenceCount >= 3 ? 5 + words / 60 : 1 + words / 50)));

  // Weighted overall (matches the rubric in gemini.js)
  const overallScore = Math.round(
    technicalScore     * 0.35 +
    completenessScore  * 0.20 +
    problemSolvingScore* 0.20 +
    communicationScore * 0.15 +
    confidenceScore    * 0.10
  );
  const score = overallScore; // legacy alias

  const role              = context?.jobRole || 'this role';
  const experienceLevel   = context?.experienceLevel || 'current';
  const skillsList        = Array.isArray(context?.skills) && context.skills.length
    ? context.skills.slice(0, 4).join(', ')
    : 'the relevant technologies';

  // Constructed ideal answer
  const idealAnswer = buildFallbackIdealAnswer(question, role, experienceLevel, skillsList);

  // Strengths / weaknesses
  const strengths = buildStrengths(words, sentenceCount, technicalScore);
  const weaknesses = buildWeaknesses(words, technicalScore, completenessScore);
  const improvementSuggestions = buildSuggestions(words, sentenceCount, technicalScore);
  const followUpQuestions = buildFollowUps(question, role, skillsList);

  // Evaluation narrative
  const evaluation = buildEvaluationNarrative(
    trimmed, words, technicalScore, communicationScore, role, experienceLevel, skillsList
  );

  return {
    question,
    userAnswer: trimmed,
    idealAnswer,
    evaluation,

    technicalScore,
    communicationScore,
    completenessScore,
    problemSolvingScore,
    confidenceScore,
    overallScore,
    score,

    strengths,
    weaknesses,
    improvementSuggestions,
    followUpQuestions,

    // Legacy aliases for backward compatibility
    correctAnswer:     idealAnswer,
    suggestions:       improvementSuggestions,
    technicalAccuracy: evaluation,
    communication:
      communicationScore >= 7
        ? 'The response was well structured and easy to follow.'
        : 'The response was somewhat disjointed — a clearer intro/explanation/conclusion structure would help.',
  };
};

const buildFallbackIdealAnswer = (question, role, experienceLevel, skillsList) => {
  const roleLower = role.toLowerCase();
  const isSenior = /senior|staff|lead|sr\.?\s|5\+|6\+|experience|advanced/i.test(experienceLevel + ' ' + role);

  let tailored = '';
  if (isSenior) {
    tailored = `A strong answer for a ${experienceLevel} ${role} candidate would frame the solution around production realities. Start by clearly defining the problem and restating the question. Provide a structured approach with multiple possible solutions, explicitly weigh trade-offs (complexity vs maintainability, latency vs throughput, consistency vs availability, cost vs performance), and cite concrete ${skillsList} examples. Include a code snippet or architectural diagram description, then cover edge cases, failure modes, testing strategies, and how you'd communicate this solution to cross-functional stakeholders. Close with a reflection on what you'd do differently with more time.`;
  } else {
    tailored = `A solid answer for a ${experienceLevel} ${role} candidate begins by defining the core concept in your own words. Explain the mechanism step-by-step, mention why it matters in the context of ${skillsList}, and provide a short, correct example (a code snippet, a diagram description, or a real-world analogy). Mention 1–2 common pitfalls or edge cases and wrap up with practical application — where you would use this technique in a real project.`;
  }

  return (
    `Ideal answer for "${question}"\n\n` +
    tailored + `\n\n` +
    `Checklist this answer should satisfy:\n` +
    `  1. Clear definition of the concept.\n` +
    `  2. Explanation of how or why it works.\n` +
    `  3. A concrete, correct example using ${skillsList}.\n` +
    `  4. Trade-offs / alternatives / edge cases.${isSenior ? '\n  5. Scalability, observability, and production concerns.' : ''}\n\n` +
    `Tailoring: Calibrated for ${experienceLevel} ${role}.`
  );
};

const buildStrengths = (words, sentences, tech) => {
  const list = [];
  if (words >= 40)  list.push('Provided a reasonably detailed answer with enough content to evaluate.');
  if (words >= 120) list.push('Response length suggests a thoughtful explanation rather than a superficial one.');
  if (sentences >= 3) list.push('Answer contains multiple sentences, indicating some structure and flow.');
  if (tech >= 7)   list.push('Apparent grasp of the core technical concepts being assessed.');
  if (tech >= 5 && tech < 7) list.push('Partially correct technical understanding demonstrated.');
  if (list.length === 0) list.push('Attempted the question rather than skipping it.');
  if (list.length === 1) list.push('Answer is direct and on-topic.');
  return list;
};

const buildWeaknesses = (words, tech, completeness) => {
  const list = [];
  if (words < 50)     list.push('Answer is very brief — lacks supporting details and depth required for a strong interview response.');
  if (words >= 50 && words < 100) list.push('Some detail is present but the answer would benefit from expanding on key points.');
  if (tech < 5)       list.push('Several technical claims are missing, inaccurate, or vague — needs factual correction.');
  if (completeness < 5) list.push('Important subtopics the question asks for are not addressed.');
  if (list.length === 0) list.push('Minor gaps only — no major weaknesses.');
  if (list.length === 1) list.push('Could include more concrete examples or references to real-world usage.');
  return list;
};

const buildSuggestions = (words, sentences, tech) => {
  const tips = [];
  if (words < 80) tips.push('Use the STAR / CEA method: Situation / Concept → Explanation → Application / Example. This naturally adds the right amount of detail.');
  if (sentences < 3) tips.push('Structure answers into a clear opening, body explanation, and closing summary instead of a single run-on thought.');
  if (tech < 6) tips.push('Review the core technical definitions first — write them in your own words then verify against authoritative docs before practicing aloud.');
  tips.push('Add a concrete, runnable-looking code snippet or a short real-world example relevant to the role.');
  tips.push('Explicitly call out 1–2 edge cases or trade-offs — even a single sentence shows depth of thought.');
  tips.push('Practice delivering the answer out loud with confidence, avoiding hedging words like "umm", "I think", "maybe".');
  return tips.slice(0, 4);
};

const buildFollowUps = (question, role, skillsList) => {
  const qTrimmed = (question || '').trim().replace(/\?\s*$/, '');
  const base = [
    `Explain how you would test the answer you just gave for "${qTrimmed}".`,
    `What are the most common pitfalls or anti-patterns when implementing ${qTrimmed} in a real ${role} codebase?`,
    `Can you compare ${qTrimmed ? qTrimmed + ' to an alternative approach' : 'two different approaches'} using ${skillsList} — when would you choose each?`,
    `Walk through how you'd debug a production issue caused by a misuse of the concept above.`,
    `How would you explain "${qTrimmed || 'this concept'}" to a junior engineer on your team in under 2 minutes?`,
  ];
  return base.slice(0, 4);
};

const buildEvaluationNarrative = (trimmed, words, techScore, commScore, role, experienceLevel, skillsList) => {
  const opening = !trimmed
    ? 'The candidate provided no answer for this question.'
    : words < 25
    ? 'The candidate gave only a very brief / superficial answer.'
    : words < 80
    ? 'The candidate provided a short answer covering the basics but lacking depth.'
    : words < 160
    ? 'The candidate gave a moderately detailed response with room for more depth.'
    : 'The candidate produced a lengthy, substantive answer.';

  const tech = techScore >= 8
    ? 'Technically, the response is strong — concepts are correct and show depth appropriate for the level.'
    : techScore >= 5
    ? 'Technically, the answer is partially correct — some key points are there but important details or distinctions are missing.'
    : 'Technically, the answer has significant gaps or factual inaccuracies that a candidate for this level should avoid.';

  const comm = commScore >= 7
    ? 'The explanation is reasonably well structured and easy to follow.'
    : 'The explanation would benefit from a clearer flow (definition → explanation → example → takeaway).';

  const closing =
    `Overall, for a ${experienceLevel} ${role} being assessed on ${skillsList}, ` +
    (techScore >= 7 && commScore >= 7
      ? 'this is a solid interview response with only minor room for improvement.'
      : techScore >= 5
      ? 'this is a borderline answer — additional study and structured practice would bring it to a pass.'
      : 'this answer does not meet the expected bar for the role and level — see the ideal answer below for the correct content and structure.');

  return `${opening} ${tech} ${comm} ${closing}`;
};

// ---------------------------------------------------------------------------
// Extract interview context (role/skills/exp/difficulty) from either MongoDB
// or the in-memory registry. Handles both role-based AND resume-based interviews.
// ---------------------------------------------------------------------------
const fetchInterviewContext = async (interviewId) => {
  const fallback = { jobRole: '', skills: [], experienceLevel: '', difficulty: '' };
  if (!interviewId) return fallback;

  // MongoDB path
  if (isDbConnected()) {
    try {
      const interview = await Interview.findById(interviewId).select(
        'jobRole skills experienceLevel difficulty interviewType resumeData'
      );
      if (interview) return buildContextFromInterview(interview);
    } catch { /* invalid ObjectId — fall through to in-memory lookup */ }
  }

  // In-memory lookup: try the resume interviews registry and interview controller inMem map
  try {
    const resumeRegistry = getInMemoryResumeInterviews();
    if (resumeRegistry && resumeRegistry.has(interviewId)) {
      return buildContextFromInterview(resumeRegistry.get(interviewId));
    }
    const intRegistry = getInMemoryInterviews();
    if (intRegistry && intRegistry.has(interviewId)) {
      return buildContextFromInterview(intRegistry.get(interviewId));
    }
    const hrRegistry = getInMemoryHrInterviews();
    if (hrRegistry && hrRegistry.has(interviewId)) {
      return buildContextFromInterview(hrRegistry.get(interviewId));
    }
  } catch { /* ignore */ }

  return fallback;
};

// Accessors that peer into another module's in-memory registry safely via eval-free require cache lookup.
// We look up the cached module's exports to grab the in-memory Maps.
const getInMemoryResumeInterviews = () => {
  try {
    const mod = require('./resumeController');
    return mod.inMemoryResumeInterviews || null;
  } catch { return null; }
};
const getInMemoryInterviews = () => {
  try {
    const mod = require('./interviewController');
    return mod.inMemoryInterviews || null;
  } catch { return null; }
};
const getInMemoryHrInterviews = () => {
  try {
    const mod = require('./hrInterviewController');
    return mod.inMemoryHrInterviews || null;
  } catch { return null; }
};

const buildContextFromInterview = (interview) => {
  if (!interview) return { jobRole: '', skills: [], experienceLevel: '', difficulty: '' };
  const skills = [];
  if (Array.isArray(interview.skills)) skills.push(...interview.skills);
  if (interview.interviewType === 'resume' && interview.resumeData) {
    const r = interview.resumeData;
    const pushUnique = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((s) => { if (typeof s === 'string' && !skills.includes(s)) skills.push(s); });
    };
    pushUnique(r.technicalSkills);
    pushUnique(r.languages);
    pushUnique(r.frameworks);
    pushUnique(r.databases);
    pushUnique(r.tools);
  }
  // Max 10 skills to keep prompt tidy
  const limitedSkills = skills.slice(0, 10);
  return {
    jobRole:         (interview.jobRole || (interview.interviewType === 'resume' ? 'Resume-Based Interview' : 'General Software Engineering')),
    skills:          limitedSkills,
    experienceLevel: (interview.experienceLevel || ''),
    difficulty:      (interview.difficulty || ''),
  };
};

// ---------------------------------------------------------------------------
// @desc    Evaluate a Q+A pair passed directly in request body (inline mode).
//          Works in both MongoDB and in-memory mode.
//          Optionally persists to DB when interviewId + questionId are supplied.
// @route   POST /api/interview/evaluate-inline
// @access  Private
// ---------------------------------------------------------------------------
const evaluateInline = async (req, res) => {
  try {
    const { question, answerText, interviewId, questionId, context } = req.body;

    if (!question || !question.trim())
      return res.status(400).json({ message: 'question is required' });
    if (!answerText || !answerText.trim())
      return res.status(400).json({ message: 'answerText is required' });

    // Prefer explicit context body param, else fetch it from the interview record
    let evalContext = context;
    if (!evalContext || !evalContext.jobRole) {
      evalContext = await fetchInterviewContext(interviewId);
    }

    const feedback    = await callGeminiEval(question.trim(), answerText.trim(), evalContext);
    const evaluatedAt = new Date();
    const result      = { ...feedback, evaluatedAt };

    // Best-effort MongoDB persist when IDs are provided
    if (interviewId && questionId && isDbConnected()) {
      try {
        const interview = await Interview.findById(interviewId);
        if (interview) {
          const parsedQId = Number(questionId);
          const ansIdx    = interview.answers.findIndex((a) => a.questionId === parsedQId);
          if (ansIdx !== -1) {
            interview.answers[ansIdx].feedback = result;
            interview.markModified('answers');
            await interview.save();
          }
        }
      } catch (err) {
        console.error('[Eval Inline] Best-effort persist failed:', err.message);
      }
    }

    // Best-effort in-memory persist too (so ResumeInterviewDetail finds it)
    if (interviewId && questionId) {
      if (!inMemoryFeedback.has(interviewId)) inMemoryFeedback.set(interviewId, new Map());
      inMemoryFeedback.get(interviewId).set(Number(questionId), result);
    }

    return res.json({ success: true, question, answerText, feedback: result });
  } catch (error) {
    console.error('Evaluate Inline Error:', error);
    return res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Evaluate a single saved answer by questionId
// @route   POST /api/interview/:id/evaluate/:questionId
// @access  Private
// ---------------------------------------------------------------------------
const evaluateAnswer = async (req, res) => {
  try {
    const { id: interviewId, questionId } = req.params;
    const parsedQId = Number(questionId);

    if (!Number.isInteger(parsedQId) || parsedQId < 1)
      return res.status(400).json({ message: 'questionId must be a positive integer' });

    const context = await fetchInterviewContext(interviewId);

    if (isDbConnected()) {
      const interview = await Interview.findById(interviewId);
      if (!interview)
        return res.status(404).json({ message: 'Interview not found' });

      const answerDoc = interview.answers.find((a) => a.questionId === parsedQId);
      if (!answerDoc)
        return res.status(404).json({
          message: `No saved answer found for questionId ${parsedQId}. Save the answer first.`,
        });

      const questionText =
        answerDoc.questionText ||
        interview.questions.find((q) => q.id === parsedQId)?.question || '';

      if (!questionText)
        return res.status(400).json({ message: 'Cannot evaluate — question text not found.' });

      const feedback    = await callGeminiEval(questionText, answerDoc.answerText, context);
      const evaluatedAt = new Date();

      const ansIdx = interview.answers.findIndex((a) => a.questionId === parsedQId);
      interview.answers[ansIdx].feedback = { ...feedback, evaluatedAt };
      interview.markModified('answers');
      await interview.save();

      return res.json({
        success: true, interviewId, questionId: parsedQId,
        answerText: answerDoc.answerText,
        feedback: { ...feedback, evaluatedAt },
      });
    }

    // In-memory fallback
    const { question, answerText } = req.body;
    if (!question || !answerText)
      return res.status(400).json({
        message: 'In-memory mode: provide { question, answerText } in the request body.',
      });

    const feedback    = await callGeminiEval(question, answerText, context);
    const evaluatedAt = new Date();

    if (!inMemoryFeedback.has(interviewId)) inMemoryFeedback.set(interviewId, new Map());
    inMemoryFeedback.get(interviewId).set(parsedQId, { ...feedback, evaluatedAt });

    return res.json({
      success: true, interviewId, questionId: parsedQId, answerText,
      feedback: { ...feedback, evaluatedAt },
    });
  } catch (error) {
    console.error('Evaluate Answer Error:', error);
    return res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Evaluate ALL saved answers for an interview in one shot
// @route   POST /api/interview/:id/evaluate
// @access  Private
// ---------------------------------------------------------------------------
const evaluateAllAnswers = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const context = await fetchInterviewContext(interviewId);

    if (isDbConnected()) {
      const interview = await Interview.findById(interviewId);
      if (!interview)
        return res.status(404).json({ message: 'Interview not found' });
      if (!interview.answers || interview.answers.length === 0)
        return res.status(400).json({ message: 'No answers saved for this interview yet.' });

      const results = [];

      for (const answerDoc of interview.answers) {
        const questionText =
          answerDoc.questionText ||
          interview.questions.find((q) => q.id === answerDoc.questionId)?.question || '';

        if (!questionText || !answerDoc.answerText?.trim()) {
          results.push({
            questionId: answerDoc.questionId, skipped: true,
            reason: !questionText ? 'Question text missing' : 'Empty answer',
          });
          continue;
        }

        const feedback    = await callGeminiEval(questionText, answerDoc.answerText, context);
        const evaluatedAt = new Date();
        const ansIdx      = interview.answers.findIndex((a) => a.questionId === answerDoc.questionId);
        interview.answers[ansIdx].feedback = { ...feedback, evaluatedAt };

        results.push({
          questionId: answerDoc.questionId, questionText,
          answerText: answerDoc.answerText,
          feedback:   { ...feedback, evaluatedAt },
        });
      }

      interview.markModified('answers');
      await interview.save();

      const evaluated    = results.filter((r) => !r.skipped);
      const overallScore = evaluated.length > 0
        ? Math.round(evaluated.reduce((sum, r) => sum + (r.feedback?.overallScore ?? r.feedback?.score ?? 0), 0) / evaluated.length)
        : null;

      return res.json({
        success: true, interviewId,
        evaluatedCount: evaluated.length,
        skippedCount:   results.length - evaluated.length,
        overallScore, results,
      });
    }

    // In-memory fallback
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0)
      return res.status(400).json({
        message: 'In-memory mode: provide { answers: [{ questionId, question, answerText }] }.',
      });

    if (!inMemoryFeedback.has(interviewId)) inMemoryFeedback.set(interviewId, new Map());
    const feedbackMap = inMemoryFeedback.get(interviewId);
    const results     = [];

    for (const item of answers) {
      if (!item.question || !item.answerText?.trim()) {
        results.push({ questionId: item.questionId, skipped: true, reason: 'Missing data' });
        continue;
      }
      const feedback    = await callGeminiEval(item.question, item.answerText, context);
      const evaluatedAt = new Date();
      feedbackMap.set(Number(item.questionId), { ...feedback, evaluatedAt });
      results.push({ questionId: item.questionId, answerText: item.answerText, feedback: { ...feedback, evaluatedAt } });
    }

    const evaluated    = results.filter((r) => !r.skipped);
    const overallScore = evaluated.length > 0
      ? Math.round(evaluated.reduce((sum, r) => sum + (r.feedback?.overallScore ?? r.feedback?.score ?? 0), 0) / evaluated.length)
      : null;

    return res.json({
      success: true, interviewId,
      evaluatedCount: evaluated.length,
      skippedCount:   results.length - evaluated.length,
      overallScore, results,
    });
  } catch (error) {
    console.error('Evaluate All Answers Error:', error);
    return res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Get stored feedback for all evaluated answers (returns ALL fields)
// @route   GET /api/interview/:id/feedback
// @access  Private
// ---------------------------------------------------------------------------
const getStoredFeedback = async (req, res) => {
  try {
    const { id: interviewId } = req.params;

    if (isDbConnected()) {
      let interview;
      try { interview = await Interview.findById(interviewId); } catch { /* invalid id */ }

      if (interview) {
        const feedbackList = interview.answers
          .filter((a) => a.feedback && (a.feedback.score !== null || a.feedback.overallScore !== null))
          .map((a) => {
            const f = a.feedback || {};
            return {
              // Identification
              questionId:         a.questionId,
              questionText:       f.question || a.questionText,
              question:           f.question || a.questionText,
              userAnswer:         f.userAnswer || a.answerText,
              answerText:         a.answerText,

              // Scores — expose BOTH legacy (score) and new (overallScore)
              score:              f.overallScore ?? f.score,
              overallScore:       f.overallScore ?? f.score,
              technicalScore:     f.technicalScore     ?? null,
              communicationScore: f.communicationScore ?? null,
              completenessScore:  f.completenessScore  ?? null,
              problemSolvingScore: f.problemSolvingScore ?? null,
              confidenceScore:    f.confidenceScore    ?? null,

              // Narrative
              evaluation:         f.evaluation || f.technicalAccuracy || '',
              technicalAccuracy:  f.technicalAccuracy  || f.evaluation || '',
              communication:      f.communication      || '',

              // Lists
              strengths:              f.strengths              || [],
              weaknesses:             f.weaknesses             || [],
              improvementSuggestions: f.improvementSuggestions || f.suggestions || [],
              suggestions:            f.suggestions            || f.improvementSuggestions || [],
              followUpQuestions:      f.followUpQuestions      || [],

              // Ideal answer (both names)
              idealAnswer:        f.idealAnswer   || f.correctAnswer || '',
              correctAnswer:      f.correctAnswer || f.idealAnswer   || '',

              evaluatedAt:        f.evaluatedAt,
            };
          });

        const overallScore = feedbackList.length > 0
          ? Math.round(feedbackList.reduce((sum, f) => sum + (f.overallScore ?? 0), 0) / feedbackList.length)
          : null;

        return res.json({ interviewId, overallScore, evaluatedCount: feedbackList.length, feedback: feedbackList });
      }
    }

    const feedbackMap  = inMemoryFeedback.get(interviewId) || new Map();
    const feedbackList = Array.from(feedbackMap.entries()).map(([qId, f]) => ({
      questionId: qId,
      question:           f.question || '',
      questionText:       f.question || '',
      userAnswer:         f.userAnswer || '',
      answerText:         f.userAnswer || '',
      score:              f.overallScore ?? f.score,
      overallScore:       f.overallScore ?? f.score,
      technicalScore:     f.technicalScore     ?? null,
      communicationScore: f.communicationScore ?? null,
      completenessScore:  f.completenessScore  ?? null,
      problemSolvingScore: f.problemSolvingScore ?? null,
      confidenceScore:    f.confidenceScore    ?? null,
      evaluation:         f.evaluation         || '',
      technicalAccuracy:  f.technicalAccuracy  || f.evaluation || '',
      communication:      f.communication      || '',
      strengths:              f.strengths              || [],
      weaknesses:             f.weaknesses             || [],
      improvementSuggestions: f.improvementSuggestions || f.suggestions || [],
      suggestions:            f.suggestions            || f.improvementSuggestions || [],
      followUpQuestions:      f.followUpQuestions      || [],
      idealAnswer:        f.idealAnswer   || f.correctAnswer || '',
      correctAnswer:      f.correctAnswer || f.idealAnswer   || '',
      evaluatedAt:        f.evaluatedAt,
    }));

    const overallScore = feedbackList.length > 0
      ? Math.round(feedbackList.reduce((sum, f) => sum + (f.overallScore ?? 0), 0) / feedbackList.length)
      : null;

    return res.json({ interviewId, overallScore, evaluatedCount: feedbackList.length, feedback: feedbackList });
  } catch (error) {
    console.error('Get Feedback Error:', error);
    return res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

module.exports = { evaluateAnswer, evaluateAllAnswers, getStoredFeedback, evaluateInline, inMemoryFeedback };
