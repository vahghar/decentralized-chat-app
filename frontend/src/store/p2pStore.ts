import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KeyPair, generateKeyPair } from '../lib/p2p/crypto';

interface P2PState {
  keyPair: KeyPair | null;
  initializeIdentity: () => Promise<void>;
  clearIdentity: () => void;
  activePeers: string[]; // List of connected peer pubKeys
  setActivePeers: (peers: string[]) => void;
  addPeer: (pubKey: string) => void;
  removePeer: (pubKey: string) => void;
}

export const useP2PStore = create<P2PState>()(
  persist(
    (set, get) => ({
      keyPair: null,
      activePeers: [],
      
      initializeIdentity: async () => {
        if (!get().keyPair) {
          const newKeyPair = await generateKeyPair();
          set({ keyPair: newKeyPair });
        }
      },
      
      clearIdentity: () => set({ keyPair: null }),
      
      setActivePeers: (activePeers) => set({ activePeers }),
      addPeer: (pubKey) => set((state) => ({ 
        activePeers: state.activePeers.includes(pubKey) ? state.activePeers : [...state.activePeers, pubKey] 
      })),
      removePeer: (pubKey) => set((state) => ({ 
        activePeers: state.activePeers.filter(p => p !== pubKey) 
      })),
    }),
    {
      name: 'p2p-reddit-identity',
      partialize: (state) => ({ keyPair: state.keyPair }), // Persist only the identity
    }
  )
);
