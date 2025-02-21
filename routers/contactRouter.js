const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");

router.post("/", contactController.contact);

module.exports = router; // Ensure router is properly exported
