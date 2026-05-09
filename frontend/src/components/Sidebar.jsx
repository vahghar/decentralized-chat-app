import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, UserPlus, Trash} from "lucide-react";
import AddFriend from "./AddFriend";
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUserLoading } = useChatStore();
  const { onlineUsers, getFriends, friends, removeFriend } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Get friends when component mounts
    getFriends();
  }, [getFriends]);

  useEffect(() => {
    // Update users when friends change
    getUsers();
  }, [friends, getUsers]);

  const handleFriendAdded = () => {
    // Refresh friends list after adding a friend
    getFriends();
  };

  const filteredUsers = showOnlineOnly ? users.filter((user) => onlineUsers.includes(user._id)) : users;

  const handleRemoveFriend = async (friendId) =>{
    await removeFriend(friendId);
  }

  if (isUserLoading) return <SidebarSkeleton />;

  return (
    <>
      <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
        <div className="border-b border-base-300 w-full p-5">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Friends</span>
          </div>

          {/* Add Friend Button */}
          <div className="mt-3 hidden lg:flex items-center justify-between">
            <button
              onClick={() => setShowAddFriend(true)}
              className="btn btn-sm btn-outline gap-2"
            >
              <UserPlus className="size-4" />
              Add Friend
            </button>
          </div>

          <div className="mt-3 hidden lg:flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm">Show online only</span>
            </label>
            <span className="text-xs text-zinc-500">({Math.max(onlineUsers.length - 1, 0)} online)</span>
          </div>
        </div>

        <div className="overflow-y-auto w-full py-3">
          {filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => setSelectedUser(user)}
              className={`w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}`}>
              <div className="relative mx-auto lg:mx-0">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.name}
                  className="size-12 object-cover rounded-full"
                />
                {onlineUsers.includes(user._id) && (
                  <span
                    className="absolute bottom-0 right-0 size-3 bg-green-500
                    rounded-full ring-2 ring-zinc-900"
                  />
                )}
              </div>

              {/* User info - only visible on larger screens */}
              <div className="hidden lg:block text-left min-w-0">
                <div className="font-medium truncate">{user.username}</div>
                <div className="text-sm text-zinc-400">
                  {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                </div>
              </div>
              <button onClick={(e)=>{
                e.stopPropagation();
                handleRemoveFriend(user._id);
              }}>
                <Trash className="ml-10 size-4" />
              </button>
            </button>
          ))}

          {filteredUsers.length === 0 && !isUserLoading && (
            <div className="text-center text-zinc-500 py-4">
              {friends.length === 0 ? (
                <div>
                  No friends yet. Add some friends!
                  <br />
                  {/*<button
                    onClick={() => navigate('/graffiti')}
                    className="text-primary hover:text-primary-focus underline mt-2 text-sm"
                  >
                    need new friends??
                  </button>*/}
                </div>
              ) : (
                "No friends online"
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <AddFriend
          onClose={() => setShowAddFriend(false)}
          onFriendAdded={handleFriendAdded}
        />
      )}
    </>
  );
};

export default Sidebar;