const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema cho Class
const classSchema = new Schema({
  classId: { type: String, unique: true, required: true },
  className: { type: String, required: true },
  schedule: { 
    type: String, 
    default: "Chưa có lịch trình" 
  },
  teacher: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // Tham chiếu đến User với role là 'teacher'
  students: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }], // Tham chiếu đến User với role là 'student'
  startDate: { 
    type: Date  
    }, // Ngày bắt đầu của lớp học
  endDate: { 
    type: Date 
  }, // Ngày kết thúc của lớp học, không bắt buộc
  maxStudents: { 
    type: Number, 
    default: 30 
  }, // Số lượng sinh viên tối đa trong lớp
  currentStudents: { 
    type: Number, 
    default: 0 
  }, // Số lượng sinh viên hiện tại
  location: { 
    type: String, 
    default: "Chưa có địa điểm" 
  }, // Địa điểm học của lớp
  status: { 
    type: String, 
    enum: ['open', 'closed', 'in-progress'], 
    default: 'open' 
  }, // Trạng thái của lớp (mở, đóng, đang diễn ra)
  createdAt: { 
    type: Date, 
    default: Date.now 
  }, // Ngày tạo lớp học
  updatedAt: { 
    type: Date, 
    default: Date.now 
  } // Ngày cập nhật lớp học
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

module.exports = mongoose.model('Class', classSchema);
