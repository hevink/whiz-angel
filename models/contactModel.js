const mongoose = require("mongoose");

const contactSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Contact", contactSchema);
