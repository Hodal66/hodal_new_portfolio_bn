import express from 'express';
import * as dashboardController from '../../controllers/dashboard.controller';
import { auth, authorize } from '../../middlewares/auth';

const router = express.Router();

// All dashboard routes require authentication
router.use(auth);

router.get('/stats', authorize('admin'), dashboardController.getStats);
router.get('/activity-logs', authorize('admin'), dashboardController.getActivityLogs);

// Notifications — accessible by all authenticated users
router.get('/notifications', dashboardController.getNotifications);
router.patch('/notifications/:id/read', dashboardController.markNotificationRead);
router.patch('/notifications/read-all', dashboardController.markAllNotificationsRead);

export default router;
