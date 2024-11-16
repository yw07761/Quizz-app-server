require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Question = require("./models/Question");
const Exam = require("./models/Exam");
const Class = require("./models/Class"); 
const ExamResult = require('./models/ExamResult');


const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("Successfully connected to MongoDB!"));

// Middleware
app.use(express.json());
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true
}));

app.use(session({
  secret: process.env.SUPER_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { secure: "auto", httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

// Đăng ký người dùng
app.post("/sign-up", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Kiểm tra user đã tồn tại
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "Email hoặc username đã được sử dụng." });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = new User({ 
      username, 
      email, 
      password: hashedPassword,
      role: 'user'  // role mặc định
    });

    await user.save();

    res.status(201).json({ 
      message: "Đăng ký thành công.",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ message: "Đăng ký thất bại.", error: error.message });
  }
});

// Đăng nhập người dùng
app.post("/sign-in", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Thông tin đăng nhập:', { email, password });

    // Tìm user theo email
    const user = await User.findOne({ email });
    console.log('User found:', user);

    if (!user) {
      return res.status(401).json({ message: "Email không tồn tại" });
    }

    // So sánh mật khẩu
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Mật khẩu không đúng" });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      }, 
      process.env.SUPER_SECRET_KEY,
      { expiresIn: '1h' }
    );

    // Trả về thông tin đăng nhập thành công
    res.status(200).json({ 
      token, 
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
});

// Middleware xác thực JWT
const isAuthenticated = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ message: "Không có token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.SUPER_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
};
// Lấy thông tin vai trò người dùng
app.get("/users/:userId/role", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ tham số đường dẫn
    const user = await User.findById(userId); // Tìm người dùng theo userId

    if (!user) return res.status(404).send({ message: "User not found" }); // Nếu không tìm thấy người dùng

    res.status(200).send({ role: user.role }); // Trả về vai trò của người dùng
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});

// Cập nhật vai trò người dùng (dành cho tất cả người dùng đã xác thực)
app.put("/users/:userId/role", isAuthenticated, async (req, res) => {
  try {
    const { role } = req.body; // Nhận vai trò từ body
    const { userId } = req.params; // userId ở đây là _id của người dùng

    // Tiếp tục xử lý cập nhật vai trò
    const user = await User.findById(userId);
    if (!user) return res.status(404).send({ message: "User not found" });

    // Kiểm tra vai trò có hợp lệ hay không
    const validRoles = ['user', 'student', 'teacher'];
    if (!validRoles.includes(role)) {
      return res.status(400).send({ message: `Current role is: ${user.role}` });
    }

    // Cập nhật vai trò người dùng
    user.role = role;
    user.updatedAt = Date.now();
    await user.save();

    res.status(200).send({ message: "Role updated successfully", user });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});
// API kiểm tra xác thực
app.get("/check-auth", isAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

// Đăng xuất
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: "Lỗi khi đăng xuất" });
    }
    res.json({ message: "Đăng xuất thành công" });
  });
});



// Endpoint to Get a Question by _id or questionId
app.get('/questions/:id', async (req, res) => {
  try {
    const id = req.params.id.trim(); // Loại bỏ khoảng trắng và ký tự xuống dòng

    // Kiểm tra tính hợp lệ của ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid question ID format" });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    console.error("Error fetching question:", error); // Log lỗi chi tiết nếu có
    res.status(500).json({ message: "Error fetching question", error: error.message });
  }
});



// Other Question Endpoints
app.post("/questions", async (req, res) => {
  try {
    const { text, answers, category, group } = req.body;
    if (!text || !answers || answers.length < 2) {
      return res.status(400).json({ message: "Insufficient data" });
    }
    const correctAnswers = answers.filter(answer => answer.isCorrect);
    if (correctAnswers.length !== 1) {
      return res.status(400).json({ message: "There must be exactly one correct answer" });
    }

    const question = new Question({ text, answers, category, group });
    await question.save();

    res.status(201).json({ message: "Question created successfully", question });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ message: "Failed to create question", error: error.message });
  }
});

app.get("/questions", async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions", error: error.message });
  }
});

app.put("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedQuestion) return res.status(404).json({ message: "Question not found" });
    res.json(updatedQuestion);
  } catch (error) {
    res.status(500).json({ message: "Error updating question", error: error.message });
  }
});

app.delete("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedQuestion = await Question.findByIdAndDelete(id);
    if (!deletedQuestion) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting question", error: error.message });
  }
});

// Exam Endpoints
app.post('/exams', isAuthenticated, async (req, res) => {
  try {
    console.log('Exam data received:', req.body);

    const {
      name,
      description,
      startDate,
      endDate,
      maxAttempts,
      duration,
      maxScore,
      autoDistributeScore,
      showStudentResult,
      displayResults,
      questionOrder,
      questionsPerPage,
      sections
    } = req.body;

    const transformedSections = sections.map(section => ({
      title: section.title,
      questions: section.questions.map(question => ({
        questionId: question.questionId,
        score: question.score || 1
      }))
    }));

    // Set createdBy to the logged-in user's ID (from req.user)
    const exam = new Exam({
      name,
      description,
      startDate,
      endDate,
      maxAttempts,
      duration,
      maxScore,
      autoDistributeScore,
      showStudentResult,
      displayResults,
      questionOrder,
      questionsPerPage,
      sections: transformedSections,
      createdBy: req.user.id // Set createdBy to the authenticated user's ID
    });

    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    console.error("Error saving exam:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/exams', async (req, res) => {
  try {
    const status = req.query.status; // Get status from query parameter
    const filter = status ? { status } : {}; // Set filter only if status is provided
    const exams = await Exam.find(filter); // Query with filter
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: "Error fetching exams", error: error.message });
  }
});

app.get('/exams/:id', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('sections.questions.questionId');
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    res.json(exam);
  } catch (error) {
    console.error("Error fetching exam:", error);
    res.status(500).json({ message: "Error fetching exam", error: error.message });
  }
});


app.put('/exams/:id', async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: "Error updating exam", error: error.message });
  }
});

app.delete('/exams/:id', async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    res.json({ message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting exam", error: error.message });
  }
});
// API nộp bài thi
// API route for submitting exam
// examController.js
app.post('/exams/:id/submit', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, startTime, endTime } = req.body;

    // Validate input data
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        message: 'Answers must be a non-empty array'
      });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({
        message: 'Start time and end time are required'
      });
    }

    // Validate date formats
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format for start time or end time'
      });
    }

    // Fetch exam with populated questions
    const exam = await Exam.findById(id).populate('sections.questions.questionId');
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Validate if exam is still active
    const now = new Date();
    if (now > new Date(exam.endDate)) {
      return res.status(400).json({
        message: "Exam has expired"
      });
    }

    let totalScore = 0;
    let maxScore = 0;

    // Create answers map for easier lookup
    const answersMap = new Map(answers.map(a => [a.questionId, a]));

    // Validate all answers and calculate scores
    const formattedAnswers = [];

    exam.sections.forEach(section => {
      section.questions.forEach(question => {
        const studentAnswer = answersMap.get(question._id.toString());
        const correctAnswer = question.questionId.answers.find(a => a.isCorrect);
        
        // Add to formatted answers even if not answered
        formattedAnswers.push({
          questionId: question._id.toString(),
          answer: studentAnswer?.answer || '',
          timestamp: studentAnswer ? new Date(studentAnswer.timestamp) : new Date()
        });

        if (correctAnswer && studentAnswer && studentAnswer.answer === correctAnswer.text) {
          totalScore += question.score || 1;
        }
        maxScore += question.score || 1;
      });
    });

    const percentageScore = (totalScore / maxScore) * 100;

    // Create exam result
    const examResult = await ExamResult.create({
      studentId: req.user.id,
      examId: id,
      answers: formattedAnswers,
      startTime: startTimeDate,
      endTime: endTimeDate,
      score: totalScore,
      percentageScore
    });

    // Prepare result response
    const result = {
      id: examResult._id,
      score: totalScore,
      maxScore,
      percentageScore,
      startTime: examResult.startTime,
      endTime: examResult.endTime,
      duration: Math.round((endTimeDate - startTimeDate) / 1000 / 60),
      sections: exam.sections.map(section => ({
        sectionId: section._id,
        title: section.title,
        questions: section.questions.map(question => {
          const studentAnswer = answersMap.get(question._id.toString());
          const correctAnswer = question.questionId.answers.find(a => a.isCorrect);
          return {
            questionId: question._id,
            questionText: question.questionId.text,
            studentAnswer: studentAnswer?.answer || '',
            isCorrect: correctAnswer?.text === studentAnswer?.answer,
            score: (correctAnswer?.text === studentAnswer?.answer) ? (question.score || 1) : 0
          };
        })
      }))
    };

    res.json(result);

  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      message: "Error submitting exam",
      error: error.message
    });
  }
});

// API lấy kết quả của user
app.get('/exams/user/:userId/results', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const results = await ExamResult.find({ studentId: userId })
      .populate('examId')
      .sort({ endTime: -1 });

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "No results found" });
    }

    // Format kết quả trả về
    const formattedResults = results.map(result => ({
      id: result._id,
      examName: result.examId.name,
      score: result.score,
      percentageScore: result.percentageScore,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: Math.round((result.endTime - result.startTime) / 1000 / 60)
    }));

    res.json(formattedResults);

  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ 
      message: "Error fetching results", 
      error: error.message 
    });
  }
});







// CLASS
// Tạo mới một lớp học
app.post("/classes", isAuthenticated, async (req, res) => {
  try {
    const { classId, className, schedule, teacherId, startDate, endDate, maxStudents, location } = req.body;

    // Tạo lớp học mới
    const newClass = new Class({
      classId,
      className,
      schedule,
      teacher: teacherId, 
      startDate,
      endDate,
      maxStudents,
      location
    });

    await newClass.save();

    res.status(201).json({ message: "Class created successfully", class: newClass });
  } catch (error) {
    console.error("Error creating class:", error);
    res.status(500).json({ message: "Error creating class", error: error.message });
  }
});

// Lấy danh sách các lớp học
app.get("/classes", isAuthenticated, async (req, res) => {
  try {
    const classes = await Class.find().populate('teacher', 'username email'); // Populate để lấy thông tin giáo viên
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: "Error fetching classes", error: error.message });
  }
});

// Lấy thông tin chi tiết của một lớp học theo ID
app.get("/classes/:id", isAuthenticated, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id).populate('teacher', 'username email').populate('students', 'username email');
    if (!classData) return res.status(404).json({ message: "Class not found" });
    res.json(classData);
  } catch (error) {
    res.status(500).json({ message: "Error fetching class", error: error.message });
  }
});

// Cập nhật thông tin lớp học
app.put("/classes/:id", isAuthenticated, async (req, res) => {
  try {
    const updatedClass = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('teacher', 'username email').populate('students', 'username email');
    if (!updatedClass) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class updated successfully", class: updatedClass });
  } catch (error) {
    res.status(500).json({ message: "Error updating class", error: error.message });
  }
});

// Xóa một lớp học
app.delete("/classes/:id", isAuthenticated, async (req, res) => {
  try {
    const deletedClass = await Class.findByIdAndDelete(req.params.id);
    if (!deletedClass) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting class", error: error.message });
  }
});

// Thêm sinh viên vào lớp
app.post("/classes/:id/add-student", isAuthenticated, async (req, res) => {
  try {
    const { email } = req.body; // Lấy email từ request body
    const classData = await Class.findById(req.params.id);
    
    if (!classData) return res.status(404).json({ message: "Class not found" });

    // Tìm sinh viên bằng email
    const studentData = await Student.findOne({ email: email }); // Giả sử bạn có một model Student

    if (!studentData) return res.status(404).json({ message: "Student not found" });

    // Kiểm tra nếu sinh viên đã có trong lớp
    if (classData.students.includes(studentData._id)) {
      return res.status(400).json({ message: "Student already enrolled in class" });
    }

    // Thêm sinh viên vào lớp
    classData.students.push(studentData._id); // Thêm ID của sinh viên vào mảng students
    classData.currentStudents = classData.students.length;
    await classData.save();

    res.json({ message: "Student added successfully", class: classData });
  } catch (error) {
    res.status(500).json({ message: "Error adding student", error: error.message });
  }
});





// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
