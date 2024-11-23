const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const examResultSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: [{
    questionId: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  startTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return !isNaN(new Date(v).getTime());
      },
      message: 'Invalid startTime date format'
    }
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return !isNaN(new Date(v).getTime());
      },
      message: 'Invalid endTime date format'
    }
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  percentageScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExamResult', examResultSchema);