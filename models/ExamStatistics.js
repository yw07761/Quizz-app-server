const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Reference ExamResult model to include exam statistics
const examStatisticsSchema = new Schema({
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  totalParticipants: {
    type: Number,
    required: true,
    min: 0
  },
  averageScore: {
    type: Number,
    required: true,
    min: 0
  },
  highestScore: {
    type: Number,
    required: true,
    min: 0
  },
  lowestScore: {
    type: Number,
    required: true,
    min: 0
  },
  passPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  participants: [{
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('ExamStatistics', examStatisticsSchema);
