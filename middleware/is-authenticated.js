const isAuthenticated = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
      return res.status(403).json({ message: "No token provided" });
  }

  try {
      const decoded = jwt.verify(token, process.env.SUPER_SECRET_KEY);
      req.user = decoded; // Ensure req.user is set with the decoded data
      next();
  } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = isAuthenticated;
