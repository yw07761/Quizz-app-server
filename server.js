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
app.post('/exams', async (req, res) => {
  try {
    const { name, description, startDate, endDate, maxAttempts, duration, maxScore, autoDistributeScore, showStudentResult, displayResults, questionOrder, questionsPerPage, sections } = req.body;

    const transformedSections = sections.map(section => ({
      title: section.title,
      questions: section.questions.map(question => ({
        questionId: question._id, // Chỉ lưu `questionId` của câu hỏi
        score: question.score || 1
      }))
    }));

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
      sections: transformedSections
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
    const exams = await Exam.find();
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
