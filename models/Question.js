const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  isCorrect: {
    type: Boolean,
    required: true
  }
});

const questionSchema = new mongoose.Schema({
  questionID: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  text: { 
    type: String,
    required: true
  },
  answers: {  
    type: [optionSchema],
    validate: [arrayLimit, '{PATH} must have at least 2 options']
  },
  category: {
    type: String
  },
  group: {
    type: String
  }
}, { timestamps: true });

function arrayLimit(val) {
  return val.length >= 2;
}

// Đảm bảo rằng chỉ có một đáp án đúng
questionSchema.pre('save', function(next) {
  const correctAnswers = this.answers.filter(answer => answer.isCorrect);
  if (correctAnswers.length !== 1) {
    next(new Error('A question must have exactly one correct answer'));
  } else {
    next();
  }
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;