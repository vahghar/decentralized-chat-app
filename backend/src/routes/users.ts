import express from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { Group } from '../models/Group';

const router = express.Router();

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userGroups = await Group.find({ members: user.username });
    
    res.json({ 
      contacts: user.contacts || [],
      invites: user.invites || [],
      groups: userGroups.map(g => ({ id: g._id, name: g.name, creator: g.creator }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

router.get('/online', requireAuth, async (req, res) => {
  try {
    // Users active in the last 60 seconds are considered online
    const threshold = new Date(Date.now() - 60 * 1000);
    const onlineUsers = await User.find({
      lastSeen: { $gt: threshold }
    });
    res.json(onlineUsers.map(u => u.username));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

router.post('/update-key', requireAuth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = (req as any).user.id;
    await User.findByIdAndUpdate(userId, { publicKey });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update key' });
  }
});

router.get('/public-key/:username', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ publicKey: user.publicKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const senderUsername = (req as any).user.username;

    if (!targetUsername) return res.status(400).json({ error: 'Username required' });
    if (targetUsername === senderUsername) return res.status(400).json({ error: 'Cannot invite yourself' });

    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Check if already contacts
    if (targetUser.contacts.includes(senderUsername)) {
      return res.status(400).json({ error: 'Already contacts' });
    }

    // Add to target user's invites if not already there
    if (!targetUser.invites.includes(senderUsername)) {
      await User.findByIdAndUpdate(targetUser._id, { $addToSet: { invites: senderUsername } });
    }

    res.json({ message: 'Invite sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

router.post('/create-group', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const creatorUsername = (req as any).user.username;

    if (!name) return res.status(400).json({ error: 'Group name required' });

    const newGroup = await Group.create({
      name: name,
      creator: creatorUsername,
      members: [creatorUsername]
    });
    
    const inviteToken = jwt.sign({ groupId: newGroup._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    
    res.json({ message: 'Group created', group: { id: newGroup._id, name: newGroup.name, creator: newGroup.creator }, inviteLink: `/group/${inviteToken}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.post('/join-group', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.body;
    const currentUsername = (req as any).user.username;

    if (!groupId) return res.status(400).json({ error: 'Invite link required' });

    let decodedGroupId;
    try {
      const decoded = jwt.verify(groupId, process.env.JWT_SECRET || 'secret') as any;
      decodedGroupId = decoded.groupId;
    } catch (err) {
      return res.status(400).json({ error: 'Invite link expired or invalid' });
    }

    const group = await Group.findById(decodedGroupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.members.includes(currentUsername)) {
      await Group.findByIdAndUpdate(groupId, { $addToSet: { members: currentUsername } });
    }

    res.json({ message: 'Joined group', group: { id: group._id, name: group.name, creator: group.creator } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

router.post('/leave-group', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.body;
    const currentUsername = (req as any).user.username;

    if (!groupId) return res.status(400).json({ error: 'Group ID required' });

    await Group.findByIdAndUpdate(groupId, { $pull: { members: currentUsername } });
    res.json({ message: 'Left group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

router.delete('/delete-group/:id', requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const currentUsername = (req as any).user.username;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.creator !== currentUsername) {
      return res.status(403).json({ error: 'Only the creator can delete the group' });
    }

    await Group.findByIdAndDelete(groupId);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

router.post('/accept', requireAuth, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const currentUsername = (req as any).user.username;
    const userId = (req as any).user.id;

    const user = await User.findById(userId);
    const targetUser = await User.findOne({ username: targetUsername });

    if (!user || !targetUser) return res.status(404).json({ error: 'User not found' });

    // Remove from invites, add to both contacts — atomic, no version conflict
    await User.findByIdAndUpdate(user._id, {
      $pull:    { invites:  targetUsername },
      $addToSet:{ contacts: targetUsername },
    });
    await User.findByIdAndUpdate(targetUser._id, {
      $addToSet:{ contacts: currentUsername },
    });

    res.json({ message: 'Invite accepted', contacts: user.contacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

router.post('/reject', requireAuth, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const userId = (req as any).user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.findByIdAndUpdate(user._id, { $pull: { invites: targetUsername } });

    res.json({ message: 'Invite rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject invite' });
  }
});

router.post('/remove', requireAuth, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    const currentUsername = (req as any).user.username;
    const userId = (req as any).user.id;

    const user = await User.findById(userId);
    const targetUser = await User.findOne({ username: targetUsername });

    if (!user || !targetUser) return res.status(404).json({ error: 'User not found' });

    // Remove from both contacts lists — atomic, no version conflict
    await User.findByIdAndUpdate(user._id,       { $pull: { contacts: targetUsername } });
    await User.findByIdAndUpdate(targetUser._id, { $pull: { contacts: currentUsername } });

    res.json({ message: 'Contact removed', contacts: user.contacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove contact' });
  }
});
 
router.post('/status', requireAuth, async (req, res) => {
  try {
    const { lat, lng, isDiscoverable } = req.body;
    const userId = (req as any).user.id;
    // findByIdAndUpdate with $set bypasses __v version checking entirely —
    // safe for legacy documents that predate these fields.
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.type':        'Point',
          'location.coordinates': [Number(lng), Number(lat)],
          lastActive:             new Date(),
          isDiscoverable:         Boolean(isDiscoverable),
        },
      },
      { upsert: false }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[status]', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
})


router.get('/nearby', requireAuth, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const userId = (req as any).user.id;
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 1000,
        },
      },
      isDiscoverable: true,
      lastActive:     { $gt: new Date(Date.now() - 2 * 60 * 1000) },
      _id:            { $ne: userId },
    });
    const proximityRoomId = `proximity_${lat}_${lng}`;
    res.json({ roomId: proximityRoomId, users: nearbyUsers.map(u => u.username) });
  } catch (err) {
    console.error('[nearby]', err);
    res.status(500).json({ error: 'Failed to fetch nearby users' });
  }
})

export default router;
