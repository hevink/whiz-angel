const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/usersModel");
const transport = require("../middlewares/sendMail");
const jwt = require("jsonwebtoken");
const { doHash } = require("../utils/hashing");

router.post("/create-checkout-session", async (req, res) => {
  const { quantity, price, plan } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan,
            },
            unit_amount: price,
          },
          quantity,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    });
    res.status(200).json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/complete-payment", async (req, res) => {
  const { sessionId, userId } = req.query;

  console.log("Session ID: ", sessionId);

  try {
    const [session, lineItems] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      stripe.checkout.sessions.listLineItems(sessionId),
    ]);

    if (session.payment_status === "paid") {
      // Update user details in the database
      await User.findByIdAndUpdate(userId, {
        $set: {
          subscriptionStatus: "active",
          lastPaymentDate: new Date(session.payment_intent.created * 1000),
          subscriptionPlan: lineItems.data[0].description,
          stripeSessionId: session.id,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          paymentIntentId: session.payment_intent,
          paymentMethodTypes: session.payment_method_types,
          paymentDate: new Date(session.payment_intent.created * 1000),
          lineItems: lineItems.data.map((item) => ({
            id: item.id,
            description: item.description,
            amountTotal: item.amount_total,
            quantity: item.quantity,
            currency: item.currency,
          })),
          paymentData: { session, lineItems },
        },
      });
    }
    res.status(200).json({ session, lineItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Function to generate a random 8-digit password
const generateRandomPassword = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

// Function to send email using Nodemailer
const sendEmail = async (email, password) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Guest Login Details",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #333333;
          }
          .content {
            margin-bottom: 20px;
          }
          .content p {
            color: #555555;
            line-height: 1.6;
          }
          .password {
            background-color: #e9e9e9;
            padding: 10px;
            border-radius: 4px;
            display: inline-block;
            margin-top: 10px;
          }
          .footer {
            text-align: center;
            color: #999999;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Service!</h1>
          </div>
          <div class="content">
            <p>Thank you for registering as a guest user. Below are your login details:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <span class="password">${password}</span></p>
            <p>Please use these credentials to log in to your account. You can change your password after logging in.</p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transport.sendMail(mailOptions);
};

// Route to create a guest user and confirm order
router.post("/create-guest-user", async (req, res) => {
  const { emailAddress, firstName, lastName, plan, price, quantity, ...rest } =
    req.body;

  try {
    let existingUser = await User.findOne({ email: emailAddress });

    if (existingUser) {
      // If the user exists, generate a JWT token for them
      const token = jwt.sign(
        {
          userId: existingUser._id,
          email: existingUser.email,
          verified: existingUser.verified,
        },
        process.env.TOKEN_SECRET,
        { expiresIn: "30d" }
      );

      return res
        .cookie("Authorization", "Bearer " + token, {
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          httpOnly: process.env.NODE_ENV === "production",
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        })
        .status(200)
        .json({
          success: true,
          message: "User already exists, logged in successfully",
          token,
        });
    }

    const password = generateRandomPassword();

    const hashedPassword = await doHash(password, 12);

    const newUser = new User({
      email: emailAddress,
      password: hashedPassword,
      firstName,
      lastName,
      ...rest,
    });

    await newUser.save();

    await sendEmail(emailAddress, password);

    // Generate JWT token for the guest user
    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
        verified: newUser.verified,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "30d" } // Token will be valid for 30 days
    );

    res
      .cookie("Authorization", "Bearer " + token, {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Cookie expires in 30 days
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      })
      .status(200)
      .json({
        success: true,
        message: "Guest user created successfully and order confirmed",
        token,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; // Ensure router is properly exported
