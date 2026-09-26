import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getArchivedEmails,
  searchEmails,
  deleteEmailJob,
  archiveEmailJob,
  unarchiveEmailJob,
} from '../controllers/emailController';

const router = Router();

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/archived', getArchivedEmails);
router.get('/search', searchEmails);
router.delete('/:id', deleteEmailJob);
router.patch('/:id/archive', archiveEmailJob);
router.patch('/:id/unarchive', unarchiveEmailJob);

export default router;
