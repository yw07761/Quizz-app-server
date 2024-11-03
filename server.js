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

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.SUPER_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Endpoint to Get a Question by _id or questionId
app.get('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    const searchCriteria = isValidObjectId
      ? { $or: [{ _id: id }, { questionId: id }] }
      : { questionId: id };

    const question = await Question.findOne(searchCriteria);

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    console.error("Error fetching question:", error);
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
    const {
      name, description, startDate, endDate, maxAttempts, duration,
      maxScore, autoDistributeScore, showStudentResult, displayResults,
      questionOrder, questionsPerPage, sections
    } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid startDate or endDate');
    }

    const transformedSections = sections.map((section) => ({
      title: section.title,
      description: section.description,
      questions: section.questions.map((question) => {
        if (!mongoose.Types.ObjectId.isValid(question.questionId)) {
          throw new Error(`Invalid questionId: ${question.questionId}`);
        }
        return { questionId: new mongoose.Types.ObjectId(question.questionId), score: question.score };
      })
    }));

    const exam = new Exam({
      name, description, startDate: start, endDate: end, maxAttempts, duration,
      maxScore, autoDistributeScore, showStudentResult, displayResults,
      questionOrder, questionsPerPage, sections: transformedSections
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
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    res.json(exam);
  } catch (error) {
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
