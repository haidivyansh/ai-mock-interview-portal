const path     = require('path');
const fs       = require('fs');
const mammoth  = require('mammoth');
const Interview = require('../models/Interview');
const { isDbConnected } = require('../config/db');
const {
  analyzeResumeWithGemini,
  generateInterviewQuestions,
  produceDiverseFallbackQuestions,
  buildGenerationConfig,
  randomSeed,
} = require('../services/gemini');
const { collectUserPreviousQuestions, serializeQuestions } = require('./interviewController');

// ---------------------------------------------------------------------------
// Unified file input helper — returns Buffer regardless of Multer storage.
// Works for both diskStorage (req.file.path) and memoryStorage (req.file.buffer).
// ---------------------------------------------------------------------------
const getFileBuffer = (file) => {
  if (Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    console.log(`[Resume] Reading from in-memory buffer — ${file.buffer.length} bytes`);
    return file.buffer;
  }
  if (file.path && fs.existsSync(file.path)) {
    const stats = fs.statSync(file.path);
    console.log(`[Resume] Reading from disk file path="${file.path}" — ${stats.size} bytes`);
    return fs.readFileSync(file.path);
  }
  throw new Error('No file content available. Neither buffer nor disk path was populated.');
};

const inMemoryResumeInterviews = new Map();

// ---------------------------------------------------------------------------
// PDF text extraction using pdfjs-dist v4+
// ---------------------------------------------------------------------------
let _pdfjsLibPromise = null;
const getPdfjsLib = async () => {
  if (!_pdfjsLibPromise) {
    _pdfjsLibPromise = (async () => {
      const lib = await import('pdfjs-dist');
      lib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';
      console.log(`[PDF] pdfjs-dist loaded — version ${lib.version ?? 'unknown'}`);
      return lib;
    })();
  }
  return _pdfjsLibPromise;
};

const extractPdfText = async (buffer) => {
  const pdfjsLib = await getPdfjsLib();
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data:            uint8Array,
    useWorkerFetch:  false,
    isEvalSupported: false,
    disableFontFace: true,
    disableRange:    true,
    disableStream:   true,
  });
  const pdf = await loadingTask.promise;
  console.log(`[PDF] Loaded — pages: ${pdf.numPages}`);

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => item.str && item.str.trim())
      .map((item) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  return fullText.trim();
};

const extractDocxText = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
};

const cleanText = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Fallback resume analysis. Gemini often catches more, but this lets the
// pipeline function when Gemini is down/rate-limited.
// ---------------------------------------------------------------------------
const fallbackAnalysis = (text) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    candidateName:   lines[0] || 'Candidate',
    summary:         'Resume uploaded and text extracted. AI analysis unavailable — Gemini quota may be exceeded.',
    education:       [],
    technicalSkills: [],
    languages:       [],
    frameworks:      [],
    databases:       [],
    projects:        [],
    certifications:  [],
    experience:      [],
    tools:           [],
  };
};

// ---------------------------------------------------------------------------
// Resume → question generation. Now uses the UNIFIED pipeline so question
// shapes are identical between role and resume modes.
// ---------------------------------------------------------------------------
const generateResumeQuestions = async ({
  resumeData, resumeRawText, jobRole, skills, experienceLevel, difficulty, numberOfQuestions, userId,
}) => {
  const seed = randomSeed();
  const previousQuestionSet = await collectUserPreviousQuestions(userId);

  const apiKeySet =
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

  const baseOpts = {
    jobRole, skills, experienceLevel, difficulty, numberOfQuestions,
    seed, previousQuestionSet,
    resumeData, resumeRawText,
    interviewType: 'resume',
  };

  if (!apiKeySet) {
    console.warn('[Resume] GEMINI_API_KEY not configured — using diverse fallback generator.');
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: 'GEMINI_API_KEY not set' },
    };
  }

  try {
    const { questions, seed: usedSeed } = await generateInterviewQuestions(baseOpts);
    console.log(`[Resume] Gemini generated ${questions.length} resume questions (seed=${usedSeed})`);
    return {
      questions,
      generation: { ...buildGenerationConfig(usedSeed), seed: usedSeed, promptMode: 'unified', usedFallback: false },
    };
  } catch (err) {
    if (err.message && err.message.includes('429')) {
      console.error('[Resume] Gemini 429 rate limit — using fallback.');
    } else {
      console.error('[Resume] Gemini question gen FAILED — using fallback:', err.message);
    }
    return {
      questions: produceDiverseFallbackQuestions(baseOpts),
      generation: { ...buildGenerationConfig(seed), seed, promptMode: 'unified', usedFallback: true, notes: String(err.message).slice(0, 200) },
    };
  }
};

// ---------------------------------------------------------------------------
// @desc    Upload, parse, analyze resume, create resume-based interview
// @route   POST /api/interview/resume/create
// @access  Private
// ---------------------------------------------------------------------------
const createResumeInterview = async (req, res) => {
  const t0 = Date.now();
  console.log(`[Resume] ====== NEW UPLOAD REQUEST @ ${new Date().toISOString()} ======`);
  console.log(`[Resume] POST /api/interview/resume/create`);
  console.log(`[Resume] Auth userId = ${req.user?.id ?? 'UNAUTHENTICATED (middleware should have blocked!)'}`);
  if (req.file) {
    console.log(`[Resume] req.file = { originalname: "${req.file.originalname}", mimetype: "${req.file.mimetype}", size: ${req.file.size}, hasBuffer: ${!!req.file.buffer}, hasPath: ${!!req.file.path} }`);
  } else {
    console.error('[Resume] req.file is FALSY — Multer did not attach a file.');
  }
  console.log(`[Resume] req.body fields: ${Object.keys(req.body || {}).join(', ')}`);

  try {
    const userId = req.user?.id || 'demo_user';

    // ── 1. Verify file received ──────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        message: 'No file received. Please select a PDF or DOCX file and try again.',
      });
    }

    const ext  = path.extname(req.file.originalname).toLowerCase();
    const size = req.file.size;

    // ── 2. Validate file type & size ─────────────────────────────────────────
    if (!['.pdf', '.docx'].includes(ext)) {
      return res.status(400).json({
        message: `Invalid file type "${ext}". Only PDF and DOCX files are supported.`,
      });
    }
    if (size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
    }
    if (size === 0) {
      return res.status(400).json({ message: 'The uploaded file is empty.' });
    }

    // ── 3. Read optional calibration params (NEW for v2: user can optionally
    //         supply a target role + experience + difficulty + extra skills) ──
    const numQ = Math.min(Math.max(parseInt(req.body.numberOfQuestions, 10) || 5, 1), 10);
    const targetRole = (req.body.jobRole || req.body.targetRole || '').toString().trim() || null;
    const targetExperience = (req.body.experienceLevel || '').toString().trim() || '';
    const targetDifficulty = (req.body.difficulty || '').toString().trim() || '';
    const extraSkills = Array.isArray(req.body.skills)
      ? req.body.skills.map(s => String(s).trim()).filter(Boolean)
      : typeof req.body.skills === 'string'
        ? req.body.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    console.log(`[Resume] numberOfQuestions = ${numQ}`);
    console.log(`[Resume] optional calibration → jobRole="${targetRole || ''}", experience="${targetExperience}", difficulty="${targetDifficulty}", extraSkills=${extraSkills.join(', ')}`);

    // ── 4. Extract text ──────────────────────────────────────────────────────
    let rawText = '';
    try {
      console.log(`[Resume] Step 4/8: Get file buffer (storage type=${req.file.path ? 'DISK' : 'MEMORY'})...`);
      const buffer = getFileBuffer(req.file);
      console.log(`[Resume] Step 4/8: Extract text from ${ext} file — buffer length=${buffer.length} bytes...`);
      rawText = ext === '.pdf' ? await extractPdfText(buffer) : await extractDocxText(buffer);
      console.log(`[Resume] Step 4/8: Raw text extracted — length=${rawText.length} chars`);
    } catch (parseErr) {
      console.error('[Resume] Step 4/8: TEXT EXTRACTION FAILED:', parseErr.name, parseErr.message);
      return res.status(422).json({
        message: `Text extraction failed: ${parseErr.message}. Please ensure the file is a text-based PDF (not a scanned image) or a valid DOCX.`,
      });
    }

    const extractedText = cleanText(rawText);
    if (extractedText.length < 50) {
      return res.status(422).json({
        message: 'The resume appears to contain no selectable text. This usually means it is a scanned image PDF. Please upload a text-based PDF or a DOCX file.',
      });
    }

    // ── 5. Gemini structured resume analysis ─────────────────────────────────
    const apiKeySet =
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';

    let analysis = fallbackAnalysis(extractedText);

    if (apiKeySet) {
      try {
        console.log('[Resume] Step 5/8: Sending to Gemini for structured analysis...');
        analysis = await analyzeResumeWithGemini(extractedText);
        console.log('[Resume] Step 5/8: Gemini analysis complete.');
        console.log(`[Resume]   — candidateName: "${analysis.candidateName}"`);
        console.log(`[Resume]   — skills: ${(analysis.technicalSkills || []).slice(0, 5).join(', ')}${analysis.technicalSkills?.length > 5 ? '…' : ''}`);
        console.log(`[Resume]   — projects count: ${(analysis.projects || []).length}`);
      } catch (err) {
        console.error('[Resume] Step 5/8: Gemini analysis FAILED — using fallback.', err.message);
      }
    } else {
      console.log('[Resume] Step 5/8: GEMINI_API_KEY not set — using FALLBACK analysis');
    }

    // ── 6. Decide calibration inputs ─────────────────────────────────────────
    // Combine: extracted resume skills + user-supplied extras + inferred target.
    const derivedSkills = Array.from(new Set([
      ...(analysis.technicalSkills || []),
      ...(analysis.languages || []),
      ...(analysis.frameworks || []),
      ...(analysis.databases || []),
      ...(analysis.tools || []),
      ...extraSkills,
    ]));

    // If user provided NO target role, derive a sensible one from the resume.
    // Guard: if candidateName is the fallback placeholder or empty, use a clean default.
    const candidateName = analysis.candidateName && analysis.candidateName !== 'Candidate'
      ? analysis.candidateName
      : null;
    const finalJobRole = targetRole || (candidateName ? `${candidateName}'s Resume Interview` : 'Resume-Based Interview');
    const finalExperience = targetExperience || (analysis.experience?.[0] ? 'Mid Level (2-5 yrs)' : 'Entry Level (0-2 yrs)');
    const finalDifficulty = targetDifficulty || (analysis.experience?.length >= 2 ? 'Medium' : 'Easy');

    console.log(`[Resume] Step 6/8: Final calibration → role="${finalJobRole}", exp="${finalExperience}", diff="${finalDifficulty}", total skills=${derivedSkills.length}`);

    // ── 7. Generate questions using the UNIFIED pipeline ─────────────────────
    console.log(`[Resume] Step 7/8: Generate ${numQ} personalized resume questions...`);
    const { questions: generated, generation } = await generateResumeQuestions({
      resumeData: analysis,
      resumeRawText: extractedText,
      jobRole: finalJobRole,
      skills: derivedSkills,
      experienceLevel: finalExperience,
      difficulty: finalDifficulty,
      numberOfQuestions: numQ,
      userId,
    });
    const normalizedQuestions = serializeQuestions(generated);
    console.log(`[Resume] Step 7/8: ${normalizedQuestions.length} questions ready. Generation usedFallback=${generation.usedFallback} seed=${generation.seed}`);

    // ── 8. Persist interview ─────────────────────────────────────────────────
    console.log('[Resume] Step 8/8: Persist interview to storage...');
    const uploadDate = new Date();
    const resumeData = {
      originalFileName: req.file.originalname,
      filePath:         req.file.path || '',
      uploadDate,
      extractedText,
      ...analysis,
    };

    const interviewPayload = {
      userId,
      interviewType: 'resume',
      jobRole:         finalJobRole,
      skills:          derivedSkills.slice(0, 20),
      experienceLevel: finalExperience,
      difficulty:      finalDifficulty,
      numberOfQuestions: numQ,
      resumeData,
      questions: normalizedQuestions,
      answers: [],
      status: 'created',
      generation,
    };

    let responseInterview;
    if (isDbConnected()) {
      console.log('[Resume]   Storage = MongoDB');
      const interview = await Interview.create(interviewPayload);
      console.log(`[Resume]   MongoDB _id = ${interview._id.toString()}`);
      responseInterview = {
        id:               interview._id.toString(),
        interviewType:    interview.interviewType,
        jobRole:          interview.jobRole,
        skills:           interview.skills,
        experienceLevel:  interview.experienceLevel,
        difficulty:       interview.difficulty,
        numberOfQuestions:interview.numberOfQuestions,
        status:           interview.status,
        createdAt:        interview.createdAt,
        answers:          [],
        generation:       interview.generation || null,
        resumeData: interview.resumeData ? {
          originalFileName: interview.resumeData.originalFileName,
          filePath:         interview.resumeData.filePath || '',
          uploadDate:       interview.resumeData.uploadDate || null,
          extractedText:    interview.resumeData.extractedText || '',
          candidateName:    interview.resumeData.candidateName || '',
          summary:          interview.resumeData.summary || '',
          education:        interview.resumeData.education || [],
          technicalSkills:  interview.resumeData.technicalSkills || [],
          languages:        interview.resumeData.languages || [],
          frameworks:       interview.resumeData.frameworks || [],
          databases:        interview.resumeData.databases || [],
          projects:         interview.resumeData.projects || [],
          certifications:   interview.resumeData.certifications || [],
          experience:       interview.resumeData.experience || [],
          tools:            interview.resumeData.tools || [],
        } : null,
        questions: interview.questions.map(q => ({
          id: q.id, question: q.question, category: q.category, hints: q.hints,
          type: q.type || 'technical', followUps: Array.isArray(q.followUps) ? q.followUps : [],
        })),
      };
    } else {
      console.log('[Resume]   Storage = IN-MEMORY MAP');
      const id = 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const interviewData = {
        id, _id: id, ...interviewPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        answers: [],
      };
      inMemoryResumeInterviews.set(id, interviewData);
      console.log(`[Resume]   In-Memory id = ${id}`);
      responseInterview = {
        id: interviewData.id,
        interviewType:    interviewData.interviewType,
        jobRole:          interviewData.jobRole,
        skills:           interviewData.skills,
        experienceLevel:  interviewData.experienceLevel,
        difficulty:       interviewData.difficulty,
        numberOfQuestions:interviewData.numberOfQuestions,
        status:           interviewData.status,
        createdAt:        interviewData.createdAt,
        answers:          [],
        generation:       interviewData.generation || null,
        resumeData:       interviewData.resumeData,
        questions:        interviewData.questions.map(q => ({
          id: q.id, question: q.question, category: q.category, hints: q.hints,
          type: q.type || 'technical', followUps: Array.isArray(q.followUps) ? q.followUps : [],
        })),
      };
    }

    const elapsed = Date.now() - t0;
    console.log(`[Resume] ====== SUCCESS — total ${elapsed}ms — returning interview id="${responseInterview.id}" (${responseInterview.questions.length} questions, seed=${generation.seed}) ======`);

    return res.status(201).json({
      success: true,
      message: isDbConnected()
        ? 'Resume interview created successfully'
        : 'Resume interview created (in-memory mode — will not persist after server restart)',
      interview: responseInterview,
    });

  } catch (error) {
    console.error('[Resume] !!!!!!!!!!!!!!!!! UNEXPECTED ERROR !!!!!!!!!!!!!!!!!');
    console.error('[Resume]   name:   ', error.name);
    console.error('[Resume]   message:', error.message);
    console.error('[Resume]   stack:\n', error.stack);
    return res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

module.exports = { createResumeInterview, inMemoryResumeInterviews };
