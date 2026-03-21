import express from 'express';
import * as meetingController from '../../controllers/meeting.controller';
import { auth, authorize } from '../../middlewares/auth';

const router = express.Router();

router.use(auth);

// Core meeting CRUD
router.post('/schedule', meetingController.scheduleMeeting);
router.get('/my-meetings', meetingController.getMyMeetings);
router.get('/history', meetingController.getMeetingHistory);
router.patch('/:meetingId/status', meetingController.updateStatus);

// Meeting room endpoints
router.get('/:meetingId', meetingController.getMeeting);
router.post('/:meetingId/join', meetingController.joinMeeting);
router.post('/:meetingId/leave', meetingController.leaveMeeting);
router.post('/:meetingId/end', meetingController.endMeeting);
router.get('/:meetingId/participants', meetingController.getParticipants);

// In-meeting chat
router.get('/:meetingId/messages', meetingController.getMeetingMessages);
router.post('/:meetingId/messages', meetingController.sendMeetingMessage);

// Admin
router.get('/admin/active', authorize('admin'), meetingController.getActiveMeetings);

export default router;
