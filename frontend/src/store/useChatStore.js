import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { decryptMessage } from "../lib/utils";

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [], // This will now be friends
    selectedUser: null,
    isUserLoading: false,
    isMessagesLoading: false,

    getUsers: async () => {
        set({ isUserLoading: true });
        try {
            // Get friends from auth store instead of separate API call
            const friends = useAuthStore.getState().friends;
            set({ users: friends });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch users");
        } finally {
            set({ isUserLoading: false });
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/message/${userId}`);
            set({ messages: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch messages");
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser } = get();
        const { authUser } = useAuthStore.getState();

        const tempId = `temp_${Date.now()}`;
        const optimisticMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: messageData.text,
            image: messageData.image ? URL.createObjectURL(new Blob([messageData.image])) : null,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };
        console.log("Creating optimistic message:", optimisticMessage); // <-- ADD THIS LINE

        set(state => ({ messages: [...state.messages, optimisticMessage] }));

        try {
            const res = await axiosInstance.post(`/message/send/${selectedUser._id}`, messageData);
            const savedMessage = res.data;

            set(state => ({
                messages: state.messages.map(msg =>
                    msg._id === tempId ? { ...savedMessage, text: messageData.text } : msg
                ),
            }));
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send message");
            set(state => ({ messages: state.messages.filter(msg => msg._id !== tempId) }));
        }
    },

    subscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;
        const { authUser } = useAuthStore.getState();

        console.log("🔧 subscribeToMessages called");
        console.log("🔧 Socket exists:", !!socket);
        console.log("🔧 Socket connected:", socket?.connected);
        console.log("🔧 AuthUser exists:", !!authUser);

        if (!socket) {
            console.log("❌ No socket available");
            return;
        }

        if (!authUser) {
            console.log("❌ No authUser available");
            return;
        }

        console.log("✅ Setting up newMessage listener for user:", authUser._id);
        console.log("🔌 Socket ID:", socket.id);

        // Test event listener to verify socket is working
        socket.on("testEvent", (data) => {
            console.log("🧪 Test event received:", data);
        });

        socket.on("newMessage", async (newMessage) => {
            console.log("📨 RECEIVED newMessage event:", {
                messageId: newMessage._id,
                senderId: newMessage.senderId,
                receiverId: newMessage.receiverId,
                text: newMessage.text,
                hasEncryptedText: !!newMessage.encryptedText,
                hasEncryptedTextForSender: !!newMessage.encryptedTextForSender
            });
            console.log("👤 Current user ID:", authUser._id);
            console.log("🔌 Current socket ID:", socket.id);
            console.log("✅ Is receiver match?", newMessage.receiverId.toString() === authUser._id.toString());

            if (newMessage.receiverId.toString() === authUser._id.toString()) {
                console.log("🎯 Message is for current user, processing...");

                try {
                    let decryptedText = "";

                    if (newMessage.receiverId.toString() === authUser._id.toString() && newMessage.encryptedText) {
                        console.log("🔓 Decrypting as receiver with encryptedText");
                        decryptedText = await decryptMessage(newMessage.encryptedText, JSON.parse(localStorage.getItem('privateKey')));
                    } else if (newMessage.senderId === authUser._id && newMessage.encryptedTextForSender) {
                        console.log("🔓 Decrypting as sender with encryptedTextForSender");
                        decryptedText = await decryptMessage(newMessage.encryptedTextForSender, JSON.parse(localStorage.getItem('privateKey')));
                    } else {
                        console.log("⚠️ No appropriate encrypted field found");
                        decryptedText = newMessage.text || "[No text available]";
                    }

                    console.log("✅ Decrypted text:", decryptedText);
                    const decryptedMessage = { ...newMessage, text: decryptedText };
                    set(state => ({
                        messages: [...state.messages, decryptedMessage]
                    }));
                    console.log("✅ Message added to state");
                } catch (error) {
                    console.error('❌ Failed to decrypt incoming message:', error);
                    set(state => ({
                        messages: [...state.messages, { ...newMessage, text: "[Decryption Failed]" }]
                    }));
                }
            } else {
                console.log("❌ Message not for current user, ignoring");
            }
        });

        // Return cleanup function
        return () => {
            console.log("🧹 Cleaning up newMessage listener");
            socket.off("newMessage");
        };
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
            socket.off("newMessage");
        }
    },

    setSelectedUser: (selectedUser) => set({ selectedUser, messages: [] }),
}));