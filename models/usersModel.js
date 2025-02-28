const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required!"],
      trim: true,
      unique: [true, "Email must be unique!"],
      minLength: [5, "Email must have 5 characters!"],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password must be provided!"],
      trim: true,
      select: false,
    },
    firstName: {
      type: String,
      required: [true, "First name is required!"],
      trim: true,
      minLength: [2, "First name must have 2 characters!"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required!"],
      trim: true,
      minLength: [2, "Last name must have 2 characters!"],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeValidation: {
      type: Number,
      select: false,
    },
    forgotPasswordCode: {
      type: String,
      select: false,
    },
    forgotPasswordCodeValidation: {
      type: Number,
      select: false,
    },
    // Company Registration Fields
    companyName: {
      type: String,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    division: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    companyWebsite: {
      type: String,
      trim: true,
    },
    howDidYouHear: {
      type: String,
      trim: true,
    },
    // Payment details
    stripeSessionId: {
      type: String,
      trim: true,
    },
    subscriptionPlan: {
      type: String,
      trim: true,
    },
    lastPaymentDate: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "pending"],
      default: "unpaid",
    },
    amountTotal: {
      type: Number,
      min: [0, "Amount must be non-negative"],
    },
    currency: {
      type: String,
      trim: true,
    },
    paymentIntentId: {
      type: String,
      trim: true,
    },
    paymentMethodTypes: {
      type: [String],
      default: [],
    },
    paymentDate: {
      type: String,
    },
    lineItems: [
      {
        id: { type: String, trim: true },
        description: { type: String, trim: true },
        amountTotal: { type: Number, min: [0, "Amount must be non-negative"] },
        quantity: { type: Number },
        currency: { type: String, trim: true },
      },
    ],
    paymentData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
