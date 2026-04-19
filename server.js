/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (
  process.env.ALLOWED_SOCKET_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Use undefined hostname for Next custom server in dev
const app = next({ dev, port });
const handler = app.getRequestHandler();

// userId -> Set of socketIds
const onlineUsers = new Map();

function addUserSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeUserSocket(socketId) {
  let disconnectedUserId = null;

  for (const [userId, socketIds] of onlineUsers.entries()) {
    if (socketIds.has(socketId)) {
      socketIds.delete(socketId);
      disconnectedUserId = userId;

      if (socketIds.size === 0) {
        onlineUsers.delete(userId);
      }
      break;
    }
  }

  return disconnectedUserId;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handler(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", (userId) => {
      if (!userId) return;

      socket.data.userId = userId;

      addUserSocket(userId, socket.id);

      // join room named by userId so all user's devices join same room
      socket.join(userId);

      io.emit("online-users", getOnlineUserIds());
      console.log(
        `User ${userId} joined room ${userId} with socket ${socket.id}`,
      );
    });

    socket.on("send-message", (payload) => {
      console.log("send-message payload:", payload);

      const { receiverId, senderId } = payload || {};
      if (!receiverId) return;

      // send to receiver's all devices
      socket.to(receiverId).emit("receive-message", payload);

      // optional: sync sender's other devices too
      if (senderId) {
        socket.to(senderId).emit("message-sent-sync", payload);
      }

      console.log(`Forwarded message to room ${receiverId}`);
    });

    socket.on(
      "typing-start",
      ({ receiverId, senderId, senderName, conversationId }) => {
        if (!receiverId || !conversationId) return;

        // show typing to receiver's devices
        socket.to(receiverId).emit("typing-start", {
          senderId,
          senderName,
          conversationId,
        });

        // optional: sync sender's other devices
        if (senderId) {
          socket.to(senderId).emit("typing-start-self-sync", {
            senderId,
            senderName,
            conversationId,
          });
        }
      },
    );

    socket.on("typing-stop", ({ receiverId, senderId, conversationId }) => {
      if (!receiverId || !conversationId) return;

      socket.to(receiverId).emit("typing-stop", {
        senderId,
        conversationId,
      });

      if (senderId) {
        socket.to(senderId).emit("typing-stop-self-sync", {
          senderId,
          conversationId,
        });
      }
    });

    socket.on(
      "message-delivered",
      ({ senderId, messageId, conversationId }) => {
        if (!senderId || !messageId || !conversationId) return;

        socket.to(senderId).emit("message-delivered", {
          messageId,
          conversationId,
        });
      },
    );

    socket.on("message-seen", ({ senderId, messageId, conversationId }) => {
      if (!senderId || !messageId || !conversationId) return;

      socket.to(senderId).emit("message-seen", {
        messageId,
        conversationId,
      });
    });

    socket.on(
      "message-updated",
      ({ receiverId, senderId, conversationId, message }) => {
        if (!receiverId || !conversationId || !message) return;

        socket.to(receiverId).emit("message-updated", {
          conversationId,
          message,
        });

        if (senderId) {
          socket.to(senderId).emit("message-updated", {
            conversationId,
            message,
          });
        }
      },
    );

    socket.on("disconnect", () => {
      const disconnectedUserId = removeUserSocket(socket.id);

      io.emit("online-users", getOnlineUserIds());

      console.log(
        "Socket disconnected:",
        socket.id,
        "user:",
        disconnectedUserId,
      );
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
    console.log(`> Local:   http://localhost:${port}`);
    console.log(`> Allowed origins: ${allowedOrigins.join(", ")}`);
  });
});
