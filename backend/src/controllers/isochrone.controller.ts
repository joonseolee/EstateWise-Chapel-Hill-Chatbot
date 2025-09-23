import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { IsochroneService } from "../services/isochrone/isochrone.service";
import { IsochroneRequest, SUPPORTED_ISOCHRONE_PROVIDERS } from "../types/isochrone.type";
import { COMMUTE_MODES } from "../types/commute-profile.type";
import crypto from "crypto";

// Create service instance with default provider
const isochroneService = new IsochroneService([{
  provider: 'google',
  apiKey: process.env.GOOGLE_AI_API_KEY || '',
  baseUrl: process.env.GOOGLE_BASE_URL || ''
}]);

/**
 * Generate travel-time polygons (isochrones)
 * POST /api/commute/isochrone
 */
export const generateIsochrone = async (req: AuthRequest, res: Response) => {
  try {
    const { destinations, mode, window, minutes } = req.body;

    // Validate required fields
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'destinations array is required and must not be empty'
      });
    }

    if (!mode || !COMMUTE_MODES.includes(mode as any)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `mode must be one of: ${COMMUTE_MODES.join(', ')}`
      });
    }

    if (!window || typeof window !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'window is required and must be a string (HH:MM-HH:MM format)'
      });
    }

    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'minutes must be a positive number'
      });
    }

    // Validate destinations format
    for (const dest of destinations) {
      if (!dest.lat || !dest.lng || typeof dest.lat !== 'number' || typeof dest.lng !== 'number') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Each destination must have lat and lng as numbers'
        });
      }
    }

    // Create request object
    const isochroneRequest: IsochroneRequest = {
      destinations,
      mode,
      window,
      minutes,
      provider: req.body.provider
    };

    // Validate provider (required)
    if (!req.body.provider) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'provider is required'
      });
    }
    
    if (!SUPPORTED_ISOCHRONE_PROVIDERS.includes(req.body.provider)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `provider must be one of: ${SUPPORTED_ISOCHRONE_PROVIDERS.join(', ')}`
      });
    }

    // Generate request hash for caching (normalized)
    const normalizedRequest = {
      destinations: destinations.map(d => ({
        lat: Math.round(d.lat * 1000000) / 1000000, // Round to 6 decimal places
        lng: Math.round(d.lng * 1000000) / 1000000
      })).sort((a, b) => a.lat - b.lat || a.lng - b.lng), // Sort for consistency
      mode,
      window,
      minutes,
      provider: req.body.provider || 'mapbox' // Include provider in hash
    };

    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(normalizedRequest))
      .digest('hex');

    // Generate isochrone with specified provider
    const result = await isochroneService.generateIsochrone(isochroneRequest);

    // Add metadata
    const response = {
      ...result,
      metadata: {
        requestHash,
        provider: req.body.provider || 'mapbox',
        generatedAt: new Date().toISOString(),
        request: {
          destinationCount: destinations.length,
          mode,
          window,
          minutes
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Isochrone generation error:', error);
    
    // Map provider errors to user-friendly messages
    let message = 'Failed to generate isochrone';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API error')) {
        message = 'External mapping service temporarily unavailable';
        statusCode = 503;
      } else if (error.message.includes('not available')) {
        message = 'Isochrone service temporarily unavailable';
        statusCode = 503;
      } else if (error.message.includes('No isochrone polygon')) {
        message = 'No accessible areas found for the given parameters';
        statusCode = 422;
      }
    }

    res.status(statusCode).json({
      error: 'Isochrone generation failed',
      message,
      requestHash: req.body ? crypto
        .createHash('sha256')
        .update(JSON.stringify(req.body))
        .digest('hex') : null
    });
  }
};

