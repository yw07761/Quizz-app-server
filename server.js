require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const jwt = require("jsonwebtoken"); // Import JWT
const User = require("./models/User");

const app = express();

// Kết nối tới MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("Successfully connected to MongoDB!"));

// Middleware
app.use(express.json());
app.use(cors({
  origin: "http://localhost:4200", // URL của frontend
  credentials: true // Cho phép gửi cookie
}));

app.use(session({
  secret: process.env.SUPER_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { secure: "auto", httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

// Middleware kiểm tra xác thực bằng JWT
const isAuthenticated = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Lấy token từ header

  if (token) {
    jwt.verify(token, process.env.SUPER_SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      req.user = decoded; // Lưu thông tin người dùng đã giải mã vào req.user
      next();
    });
  } else {
    return res.status(403).send({ message: "No token provided" });
  }
};

// Đăng ký người dùng
app.post("/sign-up", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) return res.status(400).send({ message: "Username or email already taken." });

    const hashedPassword = await bcrypt.hash(password, 10); // Mã hóa mật khẩu
    const user = new User({ username, email, password: hashedPassword, role });
    await user.save();
    res.status(201).send({ message: "User registered successfully." });
  } catch (error) {
    res.status(400).send({ message: "User registration failed.", error: error.message || "Unknown error occurred" });
  }
});

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


// Đăng nhập người dùng
app.post("/sign-in", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send({ message: "Authentication failed" });
    }

    // Tạo token
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.SUPER_SECRET_KEY, { expiresIn: '1h' });

    res.status(200).send({
      message: "Logged in successfully",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token // Gửi token về phía client
    });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});

// Đăng xuất người dùng
app.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send({ message: "Could not log out, please try again" });
    res.send({ message: "Logout successful" });
  });
});

// Xóa người dùng (chỉ dành cho admin)
app.delete("/user/:id", isAuthenticated, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin || admin.role !== "admin") return res.status(401).send({ message: "Unauthorized" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send({ message: "User not found" });

    await user.remove();
    res.send({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});

// Kiểm tra nếu người dùng đã xác thực
app.get("/is-authenticated", isAuthenticated, (req, res) => {
  res.status(200).send({ message: "Authenticated", user: req.user });
});

// Khởi động máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
