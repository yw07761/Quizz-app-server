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
// API lấy danh sách người dùng
app.get("/users", isAuthenticated, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users); // Trả về danh sách người dùng
  } catch (error) {
    res.status(500).send({ message: "Lỗi khi tải danh sách người dùng", error });
  }
});
app.get("/user", isAuthenticated, async (req, res) => {
  try {
    // Retrieve the user from the database using the user ID from the token
    const user = await User.findById(req.user.id).select("-password"); // Exclude password field
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user); // Send user data as JSON
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Cập nhật thông tin 
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;  // Lấy _id từ params
    const { email, phoneNumber, gender, dateOfBirth, password } = req.body;

    // Tìm người dùng theo _id và cập nhật thông tin
    const updatedUser = await User.findByIdAndUpdate(
      id,  // Sử dụng _id thay vì username
      { $set: { email, phoneNumber, gender, dateOfBirth, password } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});



// Endpoint to Get a Question by _id or questionId
app.get('/questions/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();
    let question;

    if (mongoose.Types.ObjectId.isValid(id)) {
      question = await Question.findById(id); // Tìm theo _id
    }

    if (!question) {
      question = await Question.findOne({ questionID: id }); // Tìm theo questionID nếu _id không khớp
    }

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ message: "Error fetching question", error: error.message });
  }
});

app.get('/questions', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'User role is not defined' });
    }

    // Phân quyền hiển thị câu hỏi
    if (req.user.role === 'teacher') {
      filter.createdBy = req.user._id;  // Giáo viên chỉ có thể xem câu hỏi của mình
      filter.status = 'approved';  // Giáo viên chỉ xem câu hỏi đã duyệt
    } else if (req.user.role === 'admin') {
      filter.status = status || { $in: ['approved', 'pending'] };  // Admin có thể xem câu hỏi 'approved' và 'pending'
    } else {
      return res.status(403).json({ message: 'You do not have permission to view questions' });
    }

    const questions = await Question.find(filter); // Removed pagination logic

    if (!questions.length) {
      return res.status(404).json({ message: 'No questions found' });
    }

    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Error fetching questions', error: error.message });
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

    // Tạo câu hỏi mới với trạng thái 'pending'
    const question = new Question({
      text,
      answers,
      category,
      group,
      status: 'pending' // Trạng thái mặc định là "chờ duyệt"
    });

    await question.save();
    res.status(201).json({ message: "Question created successfully", question });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ message: "Failed to create question", error: error.message });
  }
});




// Update the route for approving questions to match the correct URL
app.patch('/questions/:id', isAuthenticated, async (req, res) => {
  try {
      const questionId = req.params.id;
      const userRole = req.user?.role; // Safely access the role property

      if (!userRole) {
          return res.status(403).json({ message: "User  role is not defined" });
      }

      if (userRole !== 'admin') {
          return res.status(403).json({ message: "Access denied: Admins only" });
      }

      // Proceed with updating the question status
      const updatedQuestion = await Question.findByIdAndUpdate(questionId, req.body, { new: true });
      return res.status(200).json(updatedQuestion);
  } catch (error) {
      return res.status(500).json({ message: "Error updating question status", error });
  }
});


// Existing route for updating a question
app.put("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent users from directly changing the status to 'approved'
    if (req.body.status && req.body.status === 'approved') {
      return res.status(403).json({ message: "You are not authorized to approve this question" });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedQuestion) return res.status(404).json({ message: "Question not found" });

    res.json(updatedQuestion);
  } catch (error) {
    res.status(500).json({ message: "Error updating question", error: error.message });
  }
});

// Existing route for deleting a question
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
// Up file
app.post('/questions/bulk-upload', async (req, res) => {
  try {
    const questions = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
    }

    // Thêm câu hỏi vào cơ sở dữ liệu
    const result = await Question.insertMany(questions);

    res.status(201).json({ message: "Thêm câu hỏi thành công!", questions: result });
  } catch (error) {
    console.error("Error uploading questions:", error);
    res.status(500).json({ message: "Lỗi khi thêm câu hỏi!", error: error.message });
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

// API endpoint để lấy kết quả của user
app.get('/exams/user/:userId/results', isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Lấy kết quả và populate examId
    const results = await ExamResult.find({ studentId: userId })
      .populate({
        path: 'examId',
        select: 'name maxScore duration' // Chỉ lấy các trường cần thiết
      })
      .sort({ endTime: -1 });

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "No results found" });
    }

    // Format kết quả và xử lý trường hợp examId null
    const formattedResults = results.map(result => {
      // Kiểm tra nếu examId là null hoặc undefined
      const examInfo = result.examId || {
        name: 'Bài thi đã bị xóa',
        maxScore: result.maxScore || 100, // Sử dụng maxScore từ result nếu có
        duration: 0
      };

      return {
        id: result._id,
        examId: result.examId ? result.examId._id : null,
        examName: examInfo.name,
        description: examInfo.description || 'Không có mô tả',
        score: result.score,
        maxScore: examInfo.maxScore,
        percentageScore: result.percentageScore,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: Math.round((new Date(result.endTime) - new Date(result.startTime)) / 1000 / 60),
        answers: result.answers || [],
        status: result.examId ? 'completed' : 'deleted'
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      message: "Error fetching results",
      error: error.message 
    });
  }
});

// Middleware để kiểm tra và xử lý kết quả thi trước khi lưu
const validateExamResult = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Lưu thông tin exam vào request để sử dụng ở middleware tiếp theo
    req.exam = exam;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ message: "Error validating exam result" });
  }
};

// Lấy thống kê cho bài kiểm tra
app.get('/exams/:examId/statistics', async (req, res) => {
  const { examId } = req.params;

  try {
    // Lấy thông tin bài kiểm tra từ cơ sở dữ liệu
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy bài kiểm tra.' });
    }

    // Tính điểm đậu mặc định nếu không có passScore
    const passScore = exam.passScore || (exam.maxScore * 0.6); // 60% của maxScore nếu không có passScore

    // Lấy kết quả bài kiểm tra và thông tin người dùng liên quan
    const results = await ExamResult.find({ examId }).populate('studentId', 'username email');
    if (results.length === 0) {
      return res.status(404).json({ message: 'Không có kết quả cho bài kiểm tra này.' });
    }

    // Tính toán các chỉ số thống kê
    const totalParticipants = results.length;
    const scores = results.map((r) => r.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    // Tính số thí sinh đạt điểm đậu
    const passCount = scores.filter((score) => score >= passScore).length;

    // Tính tỷ lệ đậu
    const passPercentage = totalParticipants > 0 ? (passCount / totalParticipants) * 100 : 0;

    // Chuẩn bị danh sách chi tiết người tham gia
    const participants = results.map((result) => ({
      username: result.studentId.username,
      email: result.studentId.email,
      score: result.score
    }));

    // Trả về dữ liệu JSON
    res.json({
      exam: { username: exam.username },
      totalParticipants,
      averageScore: averageScore.toFixed(2),
      highestScore,
      lowestScore,
      passPercentage: passPercentage.toFixed(2),
      participants
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Có lỗi xảy ra khi lấy thống kê.' });
  }
});









// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));