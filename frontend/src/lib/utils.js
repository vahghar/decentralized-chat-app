// utils/formatTime.js

export const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    // Check if the message is from today
    const isToday = date.toDateString() === now.toDateString();

    // Check if the message is from yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    // Format time
    const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
    const formattedTime = date.toLocaleTimeString('en-US', timeOptions);

    if (isToday) {
        return formattedTime; // Returns: "8:28 AM"
    } else if (isYesterday) {
        return `Yesterday at ${formattedTime}`; // Returns: "Yesterday at 8:28 AM"
    } else {
        // Format date for older messages
        const dateOptions = { month: 'short', day: 'numeric' };
        const formattedDate = date.toLocaleDateString('en-US', dateOptions);
        return `${formattedDate} at ${formattedTime}`; // Returns: "Dec 28 at 8:28 AM"
    }
};
export async function decryptMessage(encryptedMessage, key) {
    // Import the private key from JWK format using the Web Crypto API
    const privKey = await crypto.subtle.importKey(
        "jwk",
        key,
        {
            name: "RSA-OAEP",
            hash: { name: "SHA-256" }, // Ensure hash is correctly specified
        },
        true,
        ["decrypt"]
    );

    // Decode the base64-encoded encrypted message into a byte array
    const encryptedBuffer = Uint8Array.from(atob(encryptedMessage), c => c.charCodeAt(0));

    // Decrypt the encrypted message using the private key
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privKey,
        encryptedBuffer
    );

    // Decode the decrypted buffer into a string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}
