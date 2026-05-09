import express from 'express';
import { Message } from '../models/Message';

const router = express.Router();

router.get('/history/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    // Fetch last 50 non-P2P messages for the room
    const messages = await Message.find({ roomId, isP2P: false })
      .sort({ createdAt: 1 })
      .limit(50);
      
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
