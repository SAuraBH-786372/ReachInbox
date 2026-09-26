import { Router, Request, Response, NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queues/emailQueue';
import { config } from '../config';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow if user is authenticated via session (e.g. Google OAuth or dev-login)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Redirect to login if not authenticated
  return res.redirect(`${config.corsOrigin}/login`);
}

const router = Router();
router.use('/queues', adminAuthMiddleware, serverAdapter.getRouter());

export default router;
