import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username:       { type: String, required: true, unique: true },
  password:       { type: String, required: true },
  contacts:       [{ type: String }],
  invites:        [{ type: String }],
  isAdmin:        { type: Boolean, default: false },
  location: {
    type:         { type: String, enum: ['Point'], default: 'Point' },
    coordinates:  { type: [Number], default: [0, 0] }
  },
  lastActive:     { type: Date, default: Date.now },
  isDiscoverable: { type: Boolean, default: false },
  // Presence — updated on socket connect/disconnect
  lastSeen:       { type: Date, default: Date.now },
  publicKey:      { type: String }, // Exported ECDH public key
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

export const User = mongoose.model('User', userSchema);
