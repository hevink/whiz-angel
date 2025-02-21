const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const authRouter = require("./routers/authRouter");
const contactRouter = require("./routers/contactRouter");

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000", // Allow frontend domain
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true, // Allow cookies and authentication headers
  })
);

app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log(err);
  });

app.use("/api/auth", authRouter);
app.use("/api/contact", contactRouter);

app.get("/", (req, res) => {
  res.json({ message: "Hello from the server" });
});

app.listen(process.env.PORT, () => {
  console.log("listening...");
});
