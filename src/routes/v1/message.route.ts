import express from 'express';
import * as messageController from '../../controllers/message.controller';
import { auth, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { upload } from '../../middlewares/upload';
// Add validation schemas here if needed

const router = express.Router();

/**
 * Public Routes
 */
router.post('/contact', messageController.submitContact);

/**
 * Authenticated User/Admin Routes
 */
router.use(auth);

// Inbox/Conversations
router.get('/conversations', messageController.getInboxes);
router.post('/conversations', messageController.startConversation);
router.get('/conversations/:conversationId', messageController.getConversationDetails);
router.patch('/conversations/:conversationId/read', messageController.markAsRead);
router.post('/send', messageController.sendNewMessage);
router.post('/upload', upload.single('file'), messageController.uploadFile);

/**
 * Admin Dedicated Routes
 */
router.get('/admin/contact-messages', authorize('admin'), messageController.getAdminContactMessages);
router.patch('/admin/contact-messages/:id', authorize('admin'), messageController.updateContactStatus);

export default router;
