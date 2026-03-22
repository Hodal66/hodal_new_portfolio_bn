import { Server } from 'socket.io';
import { httpServer } from '../app';
import logger from './logger';

let io: Server;

export const initSocket = () => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: '*', // In production, replace with specific origins
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected to socket: ${socket.id}`);

    // Join room based on user ID for targeted notifications
    socket.on('join', (userId: string) => {
      socket.join(userId);
      logger.info(`Socket ${socket.id} joined room ${userId}`);
    });

    // ═══════════════════════════════════════
    // ══════ MEETING ROOM EVENTS ═══════════
    // ═══════════════════════════════════════

    /**
     * Join meeting room — participant enters the WebRTC meeting
     */
    socket.on('meeting:join', (data: { meetingId: string; userId: string; userName: string }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.join(roomKey);
      // Store user info on socket for disconnect cleanup
      (socket as any)._meetingRoom = roomKey;
      (socket as any)._meetingUserId = data.userId;
      (socket as any)._meetingUserName = data.userName;

      // Notify all other participants in this meeting room
      socket.to(roomKey).emit('meeting:user-joined', {
        userId: data.userId,
        userName: data.userName,
        socketId: socket.id,
      });

      logger.info(`User ${data.userName} joined meeting room ${data.meetingId}`);
    });

    /**
     * Leave meeting room
     */
    socket.on('meeting:leave', (data: { meetingId: string; userId: string; userName: string }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.to(roomKey).emit('meeting:user-left', {
        userId: data.userId,
        userName: data.userName,
        socketId: socket.id,
      });
      socket.leave(roomKey);
      logger.info(`User ${data.userName} left meeting room ${data.meetingId}`);
    });

    // ═══════════════════════════════════════
    // ══════ WebRTC SIGNALING ═══════════════
    // ═══════════════════════════════════════

    /**
     * WebRTC Offer — forwarded to the target peer
     */
    socket.on('meeting:offer', (data: { targetSocketId: string; offer: any; userId: string; userName: string }) => {
      io.to(data.targetSocketId).emit('meeting:offer', {
        offer: data.offer,
        senderSocketId: socket.id,
        userId: data.userId,
        userName: data.userName,
      });
    });

    /**
     * WebRTC Answer — forwarded back to the caller
     */
    socket.on('meeting:answer', (data: { targetSocketId: string; answer: any; userId: string }) => {
      io.to(data.targetSocketId).emit('meeting:answer', {
        answer: data.answer,
        senderSocketId: socket.id,
        userId: data.userId,
      });
    });

    /**
     * WebRTC ICE candidate
     */
    socket.on('meeting:ice-candidate', (data: { targetSocketId: string; candidate: any; userId: string }) => {
      io.to(data.targetSocketId).emit('meeting:ice-candidate', {
        candidate: data.candidate,
        senderSocketId: socket.id,
        userId: data.userId,
      });
    });

    // ═══════════════════════════════════════
    // ══════ MEETING ACTIONS ═══════════════
    // ═══════════════════════════════════════

    /**
     * Toggle microphone status broadcast
     */
    socket.on('meeting:toggle-mic', (data: { meetingId: string; userId: string; isMuted: boolean }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.to(roomKey).emit('meeting:user-toggled-mic', {
        userId: data.userId,
        isMuted: data.isMuted,
      });
    });

    /**
     * Toggle camera status broadcast
     */
    socket.on('meeting:toggle-camera', (data: { meetingId: string; userId: string; isCameraOff: boolean }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.to(roomKey).emit('meeting:user-toggled-camera', {
        userId: data.userId,
        isCameraOff: data.isCameraOff,
      });
    });

    /**
     * Screen share start/stop
     */
    socket.on('meeting:screen-share', (data: { meetingId: string; userId: string; isSharing: boolean }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.to(roomKey).emit('meeting:user-screen-share', {
        userId: data.userId,
        isSharing: data.isSharing,
      });
    });

    /**
     * Raise hand
     */
    socket.on('meeting:raise-hand', (data: { meetingId: string; userId: string; userName: string; raised: boolean }) => {
      const roomKey = `meeting:${data.meetingId}`;
      socket.to(roomKey).emit('meeting:user-raised-hand', {
        userId: data.userId,
        userName: data.userName,
        raised: data.raised,
      });
    });

    /**
     * In-meeting chat message
     */
    socket.on('meeting:chat-message', (data: {
      meetingId: string;
      userId: string;
      userName: string;
      content: string;
      type?: 'text' | 'file';
      fileUrl?: string;
      fileName?: string;
    }) => {
      const roomKey = `meeting:${data.meetingId}`;
      // Broadcast to everyone in room including sender (for consistency)
      io.in(roomKey).emit('meeting:chat-message', {
        userId: data.userId,
        userName: data.userName,
        content: data.content,
        type: data.type || 'text',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Meeting ended by host
     */
    socket.on('meeting:end', (data: { meetingId: string }) => {
      const roomKey = `meeting:${data.meetingId}`;
      io.in(roomKey).emit('meeting:ended', { meetingId: data.meetingId });
    });

    // ═══════════════════════════════════════
    // ══════ DISCONNECT CLEANUP ════════════
    // ═══════════════════════════════════════

    socket.on('typing', (data: { conversationId: string; userId: string; recipientId: string }) => {
      if (data.recipientId) {
        io.to(data.recipientId).emit('typing', data);
      }
    });

    socket.on('stop-typing', (data: { conversationId: string; userId: string; recipientId: string }) => {
      if (data.recipientId) {
        io.to(data.recipientId).emit('stop-typing', data);
      }
    });

    socket.on('disconnect', () => {
      const roomKey = (socket as any)._meetingRoom;
      const userId = (socket as any)._meetingUserId;
      const userName = (socket as any)._meetingUserName;

      if (roomKey && userId) {
        socket.to(roomKey).emit('meeting:user-left', {
          userId,
          userName: userName || 'Unknown',
          socketId: socket.id,
        });
      }
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io must be initialized before use.');
  }
  return io;
};

/**
 * Emit a notification to a specific user
 */
export const emitNotification = (userId: string, data: any) => {
  if (io) {
    io.to(userId).emit('notification', data);
  }
};

/**
 * Emit a new message to a specific user
 */
export const emitMessage = (userId: string, data: any) => {
  if (io) {
    io.to(userId).emit('message', data);
  }
};

/**
 * Emit a call event to a specific user
 */
export const emitCall = (recipientId: string, data: any) => {
  if (io) {
    io.to(recipientId).emit('incoming-call', data);
  }
};

