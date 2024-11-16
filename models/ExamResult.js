const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  score: { type: Number, required: true },
  percentageScore: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamResult', examResultSchema);