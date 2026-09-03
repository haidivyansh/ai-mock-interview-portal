const Interview = require('../models/Interview');
const { isDbConnected } = require('../config/db');

// In-memory fallback mirror — keyed by interviewId
// Structure: Map<interviewId, AnswerSchema[]>
const inMemoryAnswers = new Map();

// ---------------------------------------------------------------------------
// @desc    Save a single answer for a question in an interview
// @route   POST /api/interview/:id/answers
// @access  Private
//
// Body: { questionId: Number, questionText?: String, answerText: String }
// ---------------------------------------------------------------------------
const saveAnswer = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const { questionId, questionText = '', answerText } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    const errors = {};

    if (questionId === undefined || questionId === null) {
      errors.questionId = 'questionId is required';
    } else if (!Number.isInteger(Number(questionId)) || Number(questionId) < 1) {
      errors.questionId = 'questionId must be a positive integer';
    }

    if (!answerText || !answerText.trim()) {
      errors.answerText = 'answerText is required';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const parsedQuestionId = Number(questionId);
    const trimmedAnswer    = answerText.trim();
    const answeredAt       = new Date();

    const answerPayload = {
      questionId:   parsedQuestionId,
      questionText: questionText.trim(),
      answerText:   trimmedAnswer,
      answeredAt,
    };

    // ── MongoDB path ─────────────────────────────────────────────────────────
    if (isDbConnected()) {
      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      // Upsert: replace existing answer for this questionId, or push new one
      const existingIdx = interview.answers.findIndex(
        (a) => a.questionId === parsedQuestionId
      );

      if (existingIdx !== -1) {
        interview.answers[existingIdx].answerText  = trimmedAnswer;
        interview.answers[existingIdx].questionText = questionText.trim();
        interview.answers[existingIdx].answeredAt  = answeredAt;
        interview.markModified('answers');
      } else {
        interview.answers.push(answerPayload);
      }

      // Move status to in-progress once first answer arrives
      if (interview.status === 'created') {
        interview.status = 'in-progress';
      }

      await interview.save();

      const saved = interview.answers.find((a) => a.questionId === parsedQuestionId);

      return res.status(201).json({
        success: true,
        message: 'Answer saved',
        answer: {
          id:           saved._id.toString(),
          interviewId,
          questionId:   saved.questionId,
          questionText: saved.questionText,
          answerText:   saved.answerText,
          answeredAt:   saved.answeredAt,
        },
      });
    }

    // ── In-memory fallback ────────────────────────────────────────────────────
    if (!inMemoryAnswers.has(interviewId)) {
      inMemoryAnswers.set(interviewId, []);
    }
    const bucket = inMemoryAnswers.get(interviewId);
    const existingIdx = bucket.findIndex((a) => a.questionId === parsedQuestionId);

    const inMemRecord = {
      id:           `ans_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      interviewId,
      ...answerPayload,
    };

    if (existingIdx !== -1) {
      bucket[existingIdx] = inMemRecord;
    } else {
      bucket.push(inMemRecord);
    }

    return res.status(201).json({
      success: true,
      message: 'Answer saved (in-memory mode)',
      answer:  inMemRecord,
    });
  } catch (error) {
    console.error('Save Answer Error:', error);
    return res.status(500).json({ message: 'Server error saving answer: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Save all answers at once when the interview is finished
// @route   POST /api/interview/:id/answers/bulk
// @access  Private
//
// Body: { answers: [{ questionId, questionText?, answerText }] }
// ---------------------------------------------------------------------------
const saveAnswersBulk = async (req, res) => {
  try {
    const { id: interviewId } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'answers must be a non-empty array' });
    }

    // Validate each entry
    const errors = [];
    answers.forEach((a, idx) => {
      if (a.questionId === undefined || a.questionId === null) {
        errors.push(`answers[${idx}]: questionId is required`);
      }
      if (!a.answerText || !a.answerText.trim()) {
        errors.push(`answers[${idx}]: answerText is required`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const now = new Date();
    const normalised = answers.map((a) => ({
      questionId:   Number(a.questionId),
      questionText: (a.questionText || '').trim(),
      answerText:   a.answerText.trim(),
      answeredAt:   a.answeredAt ? new Date(a.answeredAt) : now,
    }));

    // ── MongoDB path ─────────────────────────────────────────────────────────
    if (isDbConnected()) {
      const interview = await Interview.findById(interviewId);
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      // Upsert each answer
      normalised.forEach((incoming) => {
        const idx = interview.answers.findIndex(
          (a) => a.questionId === incoming.questionId
        );
        if (idx !== -1) {
          interview.answers[idx] = { ...interview.answers[idx].toObject(), ...incoming };
        } else {
          interview.answers.push(incoming);
        }
      });

      interview.status = 'completed';
      interview.markModified('answers');
      await interview.save();

      return res.status(200).json({
        success:     true,
        message:     `${normalised.length} answer(s) saved, interview marked as completed`,
        interviewId,
        savedCount:  normalised.length,
        status:      interview.status,
        answers:     interview.answers.map((a) => ({
          id:           a._id.toString(),
          questionId:   a.questionId,
          questionText: a.questionText,
          answerText:   a.answerText,
          answeredAt:   a.answeredAt,
        })),
      });
    }

    // ── In-memory fallback ────────────────────────────────────────────────────
    if (!inMemoryAnswers.has(interviewId)) {
      inMemoryAnswers.set(interviewId, []);
    }
    const bucket = inMemoryAnswers.get(interviewId);

    normalised.forEach((incoming) => {
      const idx = bucket.findIndex((a) => a.questionId === incoming.questionId);
      const record = {
        id: `ans_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        interviewId,
        ...incoming,
      };
      if (idx !== -1) {
        bucket[idx] = record;
      } else {
        bucket.push(record);
      }
    });

    return res.status(200).json({
      success:    true,
      message:    `${normalised.length} answer(s) saved (in-memory mode)`,
      interviewId,
      savedCount: normalised.length,
      status:     'completed',
      answers:    bucket,
    });
  } catch (error) {
    console.error('Bulk Save Answers Error:', error);
    return res.status(500).json({ message: 'Server error saving answers: ' + error.message });
  }
};

// ---------------------------------------------------------------------------
// @desc    Get all saved answers for an interview
// @route   GET /api/interview/:id/answers
// @access  Private
// ---------------------------------------------------------------------------
const getAnswers = async (req, res) => {
  try {
    const { id: interviewId } = req.params;

    // ── MongoDB path ─────────────────────────────────────────────────────────
    if (isDbConnected()) {
      let interview;
      try {
        interview = await Interview.findById(interviewId);
      } catch {
        // invalid ObjectId — fall through
      }

      if (interview) {
        return res.json({
          interviewId,
          count:   interview.answers.length,
          answers: interview.answers.map((a) => ({
            id:           a._id.toString(),
            questionId:   a.questionId,
            questionText: a.questionText,
            answerText:   a.answerText,
            answeredAt:   a.answeredAt,
          })),
        });
      }
    }

    // ── In-memory fallback ────────────────────────────────────────────────────
    const bucket = inMemoryAnswers.get(interviewId) || [];
    return res.json({
      interviewId,
      count:   bucket.length,
      answers: bucket,
    });
  } catch (error) {
    console.error('Get Answers Error:', error);
    return res.status(500).json({ message: 'Server error fetching answers: ' + error.message });
  }
};

module.exports = { saveAnswer, saveAnswersBulk, getAnswers, inMemoryAnswers };
