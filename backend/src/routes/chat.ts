import express from 'express';
import { Message } from '../models/Message';

const router = express.Router();

router.get('/history/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    // Fetch last 50 messages for the room (both P2P and relayed)
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(50);
      
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
