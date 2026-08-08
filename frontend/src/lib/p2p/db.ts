import Dexie, { type Table } from 'dexie';

export interface P2PPost {
  id: string; // Hash of the post content
  authorPubKey: string; // Base58 public key
  content: string;
  title: string;
  community: string; // e.g., 'general'
  timestamp: number;
  signature: string; // Signature of the id (which is a hash of content+title+community+timestamp)
}

export interface P2PComment {
  id: string; // Hash of the comment
  postId: string; // Parent post ID
  authorPubKey: string;
  content: string;
  timestamp: number;
  signature: string;
}

export interface P2PVote {
  id: string; // Hash of authorPubKey + targetId
  targetId: string; // Post ID or Comment ID
  authorPubKey: string;
  value: number; // 1 for upvote, -1 for downvote
  timestamp: number;
  signature: string;
}

export interface PeerProfile {
  pubKey: string;
  displayName: string;
  lastSeen: number;
}

export class P2PRedditDatabase extends Dexie {
  posts!: Table<P2PPost, string>;
  comments!: Table<P2PComment, string>;
  votes!: Table<P2PVote, string>;
  peers!: Table<PeerProfile, string>;

  constructor() {
    super('P2PRedditDB');
    this.version(1).stores({
      posts: 'id, community, authorPubKey, timestamp',
      comments: 'id, postId, authorPubKey, timestamp',
      votes: 'id, targetId, authorPubKey', // targetId is indexed for fast lookups of upvotes
      peers: 'pubKey, displayName, lastSeen'
    });
  }
}

export const db = new P2PRedditDatabase();
