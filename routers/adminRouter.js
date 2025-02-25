const express = require("express");
const adminController = require("../controllers/adminController");
const router = express.Router();

router.post("/signin", adminController.signin);

module.exports = router;
