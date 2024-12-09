// validateUser.js
const User = require('../models/User');  // Import model User nếu bạn cần truy vấn cơ sở dữ liệu

async function validateUser(username, email) {
  // Kiểm tra nếu username hoặc email đã tồn tại
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new Error('Username hoặc email đã tồn tại');
  }
  return true;
}

module.exports = validateUser;
