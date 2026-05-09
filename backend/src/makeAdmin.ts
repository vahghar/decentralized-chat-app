import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "";

async function makeAdmin(username: string) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const userSchema = new mongoose.Schema({
      username: String,
      isAdmin: Boolean
    });
    const User = mongoose.model('User', userSchema);

    const result = await User.findOneAndUpdate(
      { username: username },
      { isAdmin: true },
      { new: true }
    );

    if (result) {
      console.log(`Success! User '${username}' is now an Admin.`);
    } else {
      console.log(`User '${username}' not found.`);
    }
  } catch (err) {
    console.error("Error updating user:", err);
  } finally {
    await mongoose.disconnect();
  }
}

makeAdmin('rubiqs');
