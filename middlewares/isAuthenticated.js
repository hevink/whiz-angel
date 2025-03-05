const jwt = require("jsonwebtoken");

// Middleware to verify token
const authenticateUser = async (req, res, next) => {

  const token = req.cookies.Authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    console.log(error);

    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = { authenticateUser };
