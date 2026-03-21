import express from 'express';
import * as callController from '../../controllers/call.controller';
import { auth } from '../../middlewares/auth';

const router = express.Router();

router.use(auth);

router.post('/start', callController.startCall);
router.patch('/:callId/end', callController.finishCall);
router.get('/history', callController.getHistory);

export default router;
