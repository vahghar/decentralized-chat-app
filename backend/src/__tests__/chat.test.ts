import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import chatRoutes from '../routes/chat';
import { Message } from '../models/Message';

// Create a standalone Express app for testing to avoid triggering server.listen() in server.ts
const app = express();
app.use(express.json());
// Mock the requireAuth middleware since we just want to test the DB logic in the route
app.use((req, res, next) => {
  (req as any).user = { id: new mongoose.Types.ObjectId().toHexString(), username: 'testuser' };
  next();
});
app.use('/api/chat', chatRoutes);

describe('Chat API', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Spin up a fake MongoDB in memory
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await Message.deleteMany({});
  });

  it('should fetch all messages (both P2P and relayed) for a specific room', async () => {
    const roomId = 'dm_alice_bob';

    // Insert mock messages directly into the DB
    await Message.create([
      { roomId, sender: 'alice', text: 'EncryptedRelayedData...', isP2P: false },
      { roomId, sender: 'bob', text: 'EncryptedP2PData...', isP2P: true },
      { roomId: 'other_room', sender: 'charlie', text: 'Secret', isP2P: false }
    ]);

    // Make the API request
    const response = await request(app).get(`/api/chat/history/${roomId}`);

    // Assertions
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2); // Should only get messages for dm_alice_bob

    const senders = response.body.map((m: any) => m.sender);
    expect(senders).toContain('alice');
    expect(senders).toContain('bob');
    
    // Ensure both P2P and relayed messages are fetched
    const p2pStatus = response.body.map((m: any) => m.isP2P);
    expect(p2pStatus).toContain(true);
    expect(p2pStatus).toContain(false);
  });

  it('should return an empty array if no messages exist for a room', async () => {
    const response = await request(app).get('/api/chat/history/empty_room');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
