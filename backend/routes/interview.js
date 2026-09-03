const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const {
  createInterview,
  getInterviewById,
  getUserInterviews,
  getQuestions,
} = require('../controllers/interviewController');

const {
  saveAnswer,
  saveAnswersBulk,
  getAnswers,
} = require('../controllers/answerController');

const {
  evaluateAnswer,
  evaluateAllAnswers,
  getStoredFeedback,
  evaluateInline,
} = require('../controllers/evaluationController');

const { createResumeInterview } = require('../controllers/resumeController');
const { createHrInterview }     = require('../controllers/hrInterviewController');

const auth = require('../middleware/auth');

// Multer — store file on disk under backend/uploads/ (auto-create directory)
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`[Multer] Created uploads directory at: ${UPLOAD_DIR}`);
  } catch (mkdirErr) {
    console.error('[Multer] Failed to create uploads directory, falling back to memory storage:', mkdirErr.message);
  }
}

const storageFactory = fs.existsSync(UPLOAD_DIR)
  ? multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const ts = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        cb(null, `${ts}_${safeName}`);
      },
    })
  : multer.memoryStorage();

const upload = multer({
  storage: storageFactory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    console.log(`[Multer] Incoming file — name="${file.originalname}" mime="${file.mimetype}" sizeHint=${file.size ?? 'unknown'}`);
    const allowedMime = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // Windows sometimes reports DOCX with this
    ];
    const allowedExt = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      console.warn(`[Multer] Rejecting file — disallowed mime="${file.mimetype}" ext="${ext}"`);
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});
console.log(`[Multer] Storage mode: ${storageFactory.getDestination ? 'disk' : 'memory'} — dir=${UPLOAD_DIR}`);

// ── Resume-based interview ────────────────────────────────────────────────
router.post('/resume/create',  auth, upload.single('file'), createResumeInterview);

// ── HR-based interview ────────────────────────────────────────────────────
router.post('/hr/create', auth, createHrInterview);

// ── Standard interview CRUD ───────────────────────────────────────────────
router.post('/create',         auth, createInterview);
router.get('/user/all',        auth, getUserInterviews);
router.get('/detail/:id',      auth, getInterviewById);
router.get('/questions',            getQuestions);

// ── Answers ───────────────────────────────────────────────────────────────
router.post('/:id/answers',        auth, saveAnswer);
router.post('/:id/answers/bulk',   auth, saveAnswersBulk);
router.get('/:id/answers',         auth, getAnswers);

// ── Evaluation ────────────────────────────────────────────────────────────
router.post('/evaluate-inline',              auth, evaluateInline);
router.post('/:id/evaluate',                 auth, evaluateAllAnswers);
router.post('/:id/evaluate/:questionId',     auth, evaluateAnswer);
router.get('/:id/feedback',                  auth, getStoredFeedback);

// Multer error handler (4 args required for Express error middleware)
router.use((err, _req, res, next) => {  // eslint-disable-line no-unused-vars
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 5 MB.' });
  }
  return res.status(400).json({ message: err.message || 'File upload error' });
});

module.exports = router;
