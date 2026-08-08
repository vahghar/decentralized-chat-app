import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name:      { type: String, required: true }, 
  creator:   { type: String, required: true },
  members:    [{ type: String }],
  
}, { timestamps: true });

export const Group = mongoose.model('Group', groupSchema);
