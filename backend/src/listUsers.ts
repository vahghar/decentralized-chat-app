import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "";

async function listUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({ username: String }));
    const users = await User.find({});
    console.log("Users in DB:", users.map(u => u.username));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();
