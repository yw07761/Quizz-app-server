const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String, 
    required: false
  },
  gender: {
    type: String,  
    enum: ['male', 'female', 'other'],  
    required: false
  },
  dateOfBirth: {
    type: Date,  // Thêm trường ngày sinh
    required: false
  },
  role: {
    type: String,
    enum: ['user', 'student', 'teacher', 'admin'],
    default: 'user'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
