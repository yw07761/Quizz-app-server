const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema({
  questionId: { type: mongoose.Types.ObjectId, required: true },
  score: { type: Number, default: 0 }
});

const sectionSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  questions: [questionSchema] // Đảm bảo `questions` là một mảng các đối tượng `questionSchema`
});

const examSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  maxAttempts: Number,
  duration: Number,
  maxScore: Number,
  autoDistributeScore: Boolean,
  showStudentResult: Boolean,
  displayResults: String,
  questionOrder: String,
  questionsPerPage: Number,
  sections: [sectionSchema], // Đảm bảo `sections` là một mảng các đối tượng `sectionSchema`
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);
