// In your routes file (e.g., userRoutes.js)
const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { authenticateUser } = require("../middlewares/isAuthenticated");

// User management routes
router.get("/users", authenticateUser, usersController.getAllUsers);
router.get("/users/:id", authenticateUser, usersController.getUserById);
router.put("/users/:id", authenticateUser, usersController.updateUser);
router.delete("/users/:id", authenticateUser, usersController.deleteUser);
router.put(
  "/admin/users/:id",
  authenticateUser,
  usersController.adminUpdateUser
);
router.put("/users/update-user/:id", usersController.updateUserDetails);

module.exports = router;
