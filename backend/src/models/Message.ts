import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId:    { type: String, required: true },
  sender:    { type: String, required: true },
  text:      { type: String, required: true },
  isP2P:     { type: Boolean, default: false },
  // Read receipts — list of usernames who have seen this message
  readBy:    [{ type: String }],
  // Reactions — emoji → [username, ...]  e.g. { '👍': ['alice', 'bob'] }
  reactions: { type: Map, of: [String], default: {} },
}, { timestamps: true });

export const Message = mongoose.model('Message', messageSchema);
