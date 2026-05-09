import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const AddFriend = ({ onClose, onFriendAdded }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { addFriend } = useAuthStore();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email.trim()) {
            return;
        }

        setIsLoading(true);
        try {
            const newFriend = await addFriend(email.trim());
            setEmail('');

            // Call the callback to refresh friends list
            if (onFriendAdded) {
                onFriendAdded();
            }

            onClose(); // Close modal after successful addition
        } catch (error) {
            // Error is handled by toast in the store
            console.error('Failed to add friend:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-base-100 p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Add Friend</h2>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Friend's Email</span>
                        </label>
                        <input
                            type="email"
                            placeholder="Enter email address"
                            className="input input-bordered w-full"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn flex-1"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary flex-1"
                            disabled={isLoading || !email.trim()}
                        >
                            {isLoading ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Adding...
                                </>
                            ) : (
                                'Add Friend'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddFriend;
