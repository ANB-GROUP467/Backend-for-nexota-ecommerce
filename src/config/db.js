import mongoose from "mongoose";

let cachedConnection = null;

const connectDB = async () => {
  try {
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log("Using existing MongoDB connection");
      return cachedConnection;
    }

    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI environment variable is missing");
    }

    const connection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });

    cachedConnection = connection;

    console.log(`MongoDB Connected: ${connection.connection.host}`);

    return connection;
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    throw error;
  }
};

export default connectDB;
