import connectDB from "./db/index.js";
import dotenv from 'dotenv'
dotenv.config()


connectDB();







/*
require("dotenv").config();
import express from "express";
const app = express();

async function connectToDB() {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

    app.on("error", (error) => {
      console.error("ERROR: ", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log("server is running on ", process.env.PORT);
    });
  } catch (error) {
    console.error("ERROR: ", error);
  }
}

connectToDB();
*/
