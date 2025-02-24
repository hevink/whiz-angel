const jwt = require("jsonwebtoken");
const {
  signupSchema,
  signinSchema,
  acceptCodeSchema,
  changePasswordSchema,
  acceptFPCodeSchema,
} = require("../middlewares/validator");
const User = require("../models/usersModel");
const { doHash, doHashValidation, hmacProcess } = require("../utils/hashing");
const transport = require("../middlewares/sendMail");

exports.signup = async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  try {
    const { error, value } = signupSchema.validate({
      email,
      password,
      firstName,
      lastName,
    });

    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(401)
        .json({ success: false, message: "User already exists!" });
    }

    const hashedPassword = await doHash(password, 12);

    const newUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    const result = await newUser.save();
    result.password = undefined;

    const token = jwt.sign(
      {
        userId: result._id,
        email: result.email,
        verified: result.verified,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "30d" }
    );

    // Set token as an HTTP-only cookie
    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Cookie expires in 30 days
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        // sameSite: "none",
      })
      .status(201)
      .json({
        success: true,
        message: "Your account has been created successfully",
        token,
        result,
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const { error, value } = signinSchema.validate({ email, password });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    const existingUser = await User.findOne({ email }).select("+password");
    if (!existingUser) {
      return res
        .status(401)
        .json({ success: false, message: "User does not exists!" });
    }
    const result = await doHashValidation(password, existingUser.password);
    if (!result) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }
    const token = jwt.sign(
      {
        userId: existingUser._id,
        email: existingUser.email,
        verified: existingUser.verified,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "30d" } // Token will be valid for 30 days
    );

    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Cookie expires in 30 days
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        // sameSite: "none",
      })
      .json({
        success: true,
        token,
        message: "logged in successfully",
      });
  } catch (error) {
    console.log(error);
  }
};

exports.signout = async (req, res) => {
  res
    .clearCookie("Authorization", {
      sameSite: "none",
      secure: process.env.NODE_ENV === "production", // Must be true if using HTTPS
      httpOnly: process.env.NODE_ENV === "production",
    })
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
};

exports.sendVerificationCode = async (req, res) => {
  const { email } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exists!" });
    }
    if (existingUser.verified) {
      return res
        .status(400)
        .json({ success: false, message: "You are already verified!" });
    }

    const codeValue = Math.floor(Math.random() * 1000000).toString();

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2 style="color: #333;">Your Verification Code</h2>
        <p style="font-size: 18px; color: #555;">Use the code below to verify your account:</p>
        <h1 style="background: #f3f3f3; padding: 10px; display: inline-block; border-radius: 5px; font-size: 24px;">
          ${codeValue}
        </h1>
        <p style="color: #777; font-size: 14px;">This code expires in 10 minutes.</p>
      </div>
    `;

    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Your Verification Code",
      html: emailHtml,
    });

    if (info.accepted[0] === existingUser.email) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingUser.verificationCode = hashedCodeValue;
      existingUser.verificationCodeValidation = Date.now();
      await existingUser.save();
      return res.status(200).json({ success: true, message: "Code sent!" });
    }
    res.status(400).json({ success: false, message: "Code sent failed!" });
  } catch (error) {
    console.log(error);
  }
};

exports.verifyVerificationCode = async (req, res) => {
  const { email, providedCode } = req.body;
  try {
    const { error, value } = acceptCodeSchema.validate({ email, providedCode });
    if (error) {
      return res
        .status(401)
        .json({ success: false, message: error.details[0].message });
    }

    const codeValue = providedCode.toString();
    const existingUser = await User.findOne({ email }).select(
      "+verificationCode +verificationCodeValidation"
    );

    if (!existingUser) {
      return res
        .status(401)
        .json({ success: false, message: "User does not exists!" });
    }
    if (existingUser.verified) {
      return res
        .status(400)
        .json({ success: false, message: "you are already verified!" });
    }

    if (
      !existingUser.verificationCode ||
      !existingUser.verificationCodeValidation
    ) {
      return res
        .status(400)
        .json({ success: false, message: "something is wrong with the code!" });
    }

    // Check if the code has been expired or not (10 minutes)
    if (Date.now() - existingUser.verificationCodeValidation > 10 * 60 * 1000) {
      return res
        .status(400)
        .json({ success: false, message: "code has been expired!" });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );

    if (hashedCodeValue === existingUser.verificationCode) {
      existingUser.verified = true;
      existingUser.verificationCode = undefined;
      existingUser.verificationCodeValidation = undefined;
      await existingUser.save();
      return res
        .status(200)
        .json({ success: true, message: "your account has been verified!" });
    }
    return res
      .status(400)
      .json({ success: false, message: "unexpected occured!!" });
  } catch (error) {
    console.log(error);
  }
};

exports.changePassword = async (req, res) => {
  const { userId, verified } = req.user;
  const { oldPassword, newPassword } = req.body;
  try {
    // const { error, value } = changePasswordSchema.validate({
    //   oldPassword,
    //   newPassword,
    // });
    // if (error) {
    //   return res
    //     .status(401)
    //     .json({ success: false, message: error.details[0].message });
    // }
    // if (!verified) {
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "You are not verified user!" });
    // }
    const existingUser = await User.findOne({ _id: userId }).select(
      "+password"
    );
    if (!existingUser) {
      return res
        .status(401)
        .json({ success: false, message: "User does not exists!" });
    }
    const result = await doHashValidation(oldPassword, existingUser.password);
    if (!result) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }
    const hashedPassword = await doHash(newPassword, 12);
    existingUser.password = hashedPassword;
    await existingUser.save();
    return res
      .status(200)
      .json({ success: true, message: "Password updated!!" });
  } catch (error) {
    console.log(error);
  }
};

exports.sendForgotPasswordCode = async (req, res) => {
  const { email } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist!" });
    }

    const codeValue = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const resetLink = `${process.env.FRONTEND_URL}/sponser-reset-password-verification?code=${codeValue}&email=${email}`;

    let info = await transport.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: existingUser.email,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 500px; margin: auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666;">click the button below:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px; font-size: 16px;">Reset Password</a>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    });

    if (info.accepted.includes(existingUser.email)) {
      const hashedCodeValue = hmacProcess(
        codeValue,
        process.env.HMAC_VERIFICATION_CODE_SECRET
      );
      existingUser.forgotPasswordCode = hashedCodeValue;
      existingUser.forgotPasswordCodeValidation = Date.now();
      await existingUser.save();
      return res.status(200).json({ success: true, message: "Code sent!" });
    }

    res.status(400).json({ success: false, message: "Code send failed!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update own profile (user route)
exports.updateProfile = async (req, res) => {
  const { firstName, lastName } = req.body;
  const userId = req.user.userId; // Get user ID from auth token

  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Validate input data
    if (firstName && firstName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "First name must have at least 2 characters",
      });
    }

    if (lastName && lastName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Last name must have at least 2 characters",
      });
    }

    // Prepare update data
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((val) => val.message)[0],
      });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyForgotPasswordCode = async (req, res) => {
  const { email, providedCode, newPassword } = req.body;
  try {
    const codeValue = providedCode.toString();
    const existingUser = await User.findOne({ email }).select(
      "+forgotPasswordCode +forgotPasswordCodeValidation"
    );

    if (!existingUser) {
      return res.status(401).json({
        success: false,
        message: "User does not exist!",
      });
    }

    if (
      !existingUser.forgotPasswordCode ||
      !existingUser.forgotPasswordCodeValidation
    ) {
      return res.status(400).json({
        success: false,
        message: "Something is wrong with the code!",
      });
    }

    if (
      Date.now() - existingUser.forgotPasswordCodeValidation >
      5 * 60 * 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Code has expired!",
      });
    }

    const hashedCodeValue = hmacProcess(
      codeValue,
      process.env.HMAC_VERIFICATION_CODE_SECRET
    );

    if (hashedCodeValue === existingUser.forgotPasswordCode) {
      // Hash the new password
      const hashedPassword = await doHash(newPassword, 12);
      existingUser.password = hashedPassword;

      // Clear forgot password fields
      existingUser.forgotPasswordCode = undefined;
      existingUser.forgotPasswordCodeValidation = undefined;
      await existingUser.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: existingUser._id,
          email: existingUser.email,
          verified: existingUser.verified,
        },
        process.env.TOKEN_SECRET,
        { expiresIn: "30d" }
      );

      // Set token in HTTP-only cookie
      res
        .cookie("Authorization", "Bearer " + token, {
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Cookie expires in 30 days
          httpOnly: process.env.NODE_ENV === "production", // Prevent XSS
          secure: process.env.NODE_ENV === "production", // Secure in production
        })
        .json({
          success: true,
          token,
          message: "Password updated successfully, logged in!",
        });

      return;
    }

    return res.status(400).json({
      success: false,
      message: "Unexpected error occurred!",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
