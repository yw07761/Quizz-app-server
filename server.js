require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const app = express();

// Kết nối MongoDB
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

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));