const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    console.log("User is authenticated:", req.session.user); // In ra thông tin người dùng
    next(); // Người dùng đã đăng nhập
  } else {
    console.log("Unauthorized access attempt");
    res.status(401).send({ message: "Unauthorized" }); // Người dùng chưa đăng nhập
  }
};

module.exports = isAuthenticated;
