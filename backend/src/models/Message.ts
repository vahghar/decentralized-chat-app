import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  roomId:    { type: String, required: true },
  sender:    { type: String, required: true },
  text:      { type: String, required: true },
  isP2P:     { type: Boolean, default: false },
  // Read receipts — list of usernames who have seen this message
  readBy:    [{ type: String }],
  reactions: { type: Map, of: [String], default: {} },
  // Ephemeral messages
  expiresAt: { type: Date }
}, { timestamps: true });

messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Message = mongoose.model('Message', messageSchema);
