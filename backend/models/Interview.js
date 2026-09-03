const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Question Schema — now includes `type` (technical/scenario/debugging/coding/
// behavioral/system_design/project_discussion/experience_based) and `followUps`
// so the interview session can surface 0–2 short follow-up questions per
// question when the candidate performs well.
// ---------------------------------------------------------------------------
const QuestionSchema = new mongoose.Schema({
  id:       { type: Number },
  question: { type: String, required: true },
  category: { type: String, default: 'General' },
  hints:    { type: String, default: '' },
  type:     {
    type: String,
    enum: [
      'technical',
      'scenario',
      'debugging',
      'coding',
      'behavioral',
      'system_design',
      'project_discussion',
      'experience_based',
      'hr',
    ],
    default: 'technical',
  },
  followUps: { type: [String], default: [] },
});

const AnswerSchema = new mongoose.Schema({
  questionId:   { type: Number, required: [true, 'questionId is required'] },
  questionText: { type: String, default: '' },
  answerText:   { type: String, required: [true, 'answerText is required'], trim: true },
  answeredAt:   { type: Date, default: Date.now },
  feedback: {
    // Identification
    question:           { type: String, default: '' },
    userAnswer:         { type: String, default: '' },
    idealAnswer:        { type: String, default: '' },
    evaluation:         { type: String, default: '' },

    // Scores (0–10 integers)
    score:              { type: Number, min: 0, max: 10, default: null }, // legacy overall alias
    overallScore:       { type: Number, min: 0, max: 10, default: null },
    technicalScore:     { type: Number, min: 0, max: 10, default: null },
    communicationScore: { type: Number, min: 0, max: 10, default: null },
    completenessScore:  { type: Number, min: 0, max: 10, default: null },
    problemSolvingScore:{ type: Number, min: 0, max: 10, default: null },
    confidenceScore:    { type: Number, min: 0, max: 10, default: null },

    // Lists
    strengths:              { type: [String], default: [] },
    weaknesses:             { type: [String], default: [] },
    improvementSuggestions: { type: [String], default: [] },
    followUpQuestions:      { type: [String], default: [] },

    // Legacy aliases for backward compatibility
    correctAnswer:      { type: String, default: '' }, // alias of idealAnswer
    suggestions:        { type: [String], default: [] }, // alias of improvementSuggestions
    confidenceFeedback: { type: String, default: '' },
    technicalAccuracy:  { type: String, default: '' },
    communication:      { type: String, default: '' },

    evaluatedAt:        { type: Date, default: null },
  },
});

const ResumeDataSchema = new mongoose.Schema({
  originalFileName: { type: String, default: '' },
  filePath:         { type: String, default: '' },
  uploadDate:       { type: Date,   default: null },
  extractedText:    { type: String, default: '' },
  candidateName:    { type: String, default: '' },
  summary:          { type: String, default: '' },
  education:        { type: [String], default: [] },
  technicalSkills:  { type: [String], default: [] },
  languages:        { type: [String], default: [] },
  frameworks:       { type: [String], default: [] },
  databases:      { type: [String], default: [] },
  projects:         { type: [String], default: [] },
  certifications:   { type: [String], default: [] },
  experience:       { type: [String], default: [] },
  tools:            { type: [String], default: [] },
});

// ---------------------------------------------------------------------------
// Added generationMetadata block (seed, temperature, topP, etc.) + question count
// so interviews are auditable and reproducible.
// ---------------------------------------------------------------------------
const GenerationMetadataSchema = new mongoose.Schema({
  seed:              { type: Number, default: null },
  temperature:       { type: Number, default: null },
  topP:              { type: Number, default: null },
  topK:              { type: Number, default: null },
  maxOutputTokens: { type: Number, default: null },
  promptMode:        { type: String, enum: ['role', 'resume', 'unified'], default: 'unified' },
  usedFallback:    { type: Boolean, default: false },
  notes:           { type: String, default: '' },
});

const InterviewSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },

  interviewType: {
    type: String,
    enum: ['role', 'resume', 'hr'],
    default: 'role',
  },

  jobRole:          { type: String, trim: true, default: '' },
  skills:           { type: [String], default: [] },
  experienceLevel:  { type: String, default: '' },
  difficulty:       { type: String, default: '' },
  numberOfQuestions:{ type: Number, min: 1, max: 15, default: 5 },

  resumeData: { type: ResumeDataSchema, default: null },

  questions: [QuestionSchema],
  answers:   [AnswerSchema],

  status: {
    type: String,
    enum: ['created', 'in-progress', 'completed'],
    default: 'created',
  },

  generation: { type: GenerationMetadataSchema, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Interview', InterviewSchema);
