const Admin = require("../models/adminModel");

exports.signin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the admin by email
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        status: 401,
        message: "Admin not found!",
      });
    }

    // Directly compare plain-text passwords
    if (admin.password != password) {
      return res
        .status(401)
        .json({ status: 401, message: "Invalid credentials!" });
    }

    return res
      .status(200)
      .json({ role: "admin", status: 200, message: "Login successful!" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
