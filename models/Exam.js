const mongoose = require('mongoose');
const { Schema } = mongoose;

const sectionSchema = new Schema({
  title: { type: String, required: true },
  questions: [
    {
      questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
      score: { type: Number, default: 1 }
    }
  ]
});

const examSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'draft' }, // New status field with default as "draft"
  maxAttempts: Number,
  duration: Number,
  maxScore: Number,
  autoDistributeScore: Boolean,
  showStudentResult: Boolean,
  displayResults: String,
  questionOrder: String,
  questionsPerPage: Number,
  sections: [sectionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // New field to reference the teacher who created the exam
  createdBy: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true }
});

module.exports = mongoose.model('Exam', examSchema);
