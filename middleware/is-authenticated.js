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

module.exports = isAuthenticated;
