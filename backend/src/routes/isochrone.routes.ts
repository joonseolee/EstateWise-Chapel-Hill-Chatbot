import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { 
  generateIsochrone
} from '../controllers/isochrone.controller';

const router = Router();

// All isochrone routes require authentication
router.use(authMiddleware);

/**
 * @route POST /api/commute/isochrone
 * @desc Generate travel-time polygons (isochrones)
 * @access Private
 * @body { destinations: Array<{lat: number, lng: number}>, mode: string, window: string, minutes: number, provider?: string }
 */
router.post('/isochrone', generateIsochrone);

export default router;
