const transport = require("../middlewares/sendMail");
const Contact = require("../models/contactModel"); // Import the Contact model

exports.contact = async (req, res) => {
  try {
    // Get form data from request body
    const { firstName, lastName, email, phone, reason, company } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !reason || !company) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Save contact form data in MongoDB
    const newContact = new Contact({
      firstName,
      lastName,
      email,
      phone,
      company,
      reason,
    });
    await newContact.save();

    // Send email notification
    try {
      let info = await transport.sendMail({
        from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        to: "hevinkalathiya123@gmail.com",
        subject: "New Contact Form Submission",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #333; text-align: center;">New Contact Request</h2>
            <p style="font-size: 16px;"><strong>FirstName:</strong> ${firstName}</p>
            <p style="font-size: 16px;"><strong>LastName:</strong> ${lastName}</p>
            <p style="font-size: 16px;"><strong>Email:</strong> ${email}</p>
            <p style="font-size: 16px;"><strong>Phone:</strong> ${phone}</p>
            <p style="font-size: 16px;"><strong>Company:</strong> ${company}</p>
            <p style="font-size: 16px;"><strong>Reason for Contact:</strong></p>
            <p style="background: #f4f4f4; padding: 10px; border-radius: 5px;">${reason}</p>
            <hr />
            <p style="font-size: 14px; color: #888; text-align: center;">This is an automated message. Please do not reply.</p>
          </div>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "Form submitted successfully & email sent.",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "Form saved but email failed to send.",
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
