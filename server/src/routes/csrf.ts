import { Router } from 'express';

import { issueCsrfTokenCookie } from '../middleware/csrf.js';

const router = Router();

router.get('/', (req, res) => {
  issueCsrfTokenCookie(req, res, 'lax');
  res.status(204).end();
});

export default router;
