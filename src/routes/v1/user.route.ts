import express from 'express';
import * as userController from '../../controllers/user.controller';
import { auth, authorize } from '../../middlewares/auth';

const router = express.Router();

// Self-service routes
router.get('/me', auth, userController.getMe);
router.patch('/me', auth, userController.updateMe);

// Admin-only user management
router.get('/', auth, authorize('admin'), userController.getUsers);
router.get('/:userId', auth, authorize('admin'), userController.getUser);
router.patch('/:userId', auth, authorize('admin'), userController.updateUser);
router.delete('/:userId', auth, authorize('admin'), userController.deleteUser);

export default router;
