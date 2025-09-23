// Mock the isochrone service
const mockGenerateIsochrone = jest.fn();
jest.mock('../src/services/isochrone/isochrone.service', () => {
  return {
    IsochroneService: jest.fn().mockImplementation(() => ({
      generateIsochrone: mockGenerateIsochrone
    }))
  };
});

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash-123')
  }))
}));

// Import after mocking
const { generateIsochrone } = require('../src/controllers/isochrone.controller');

describe('Isochrone Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request and response objects
    mockReq = {
      body: {},
      user: { id: 'test-user-id' }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('generateIsochrone', () => {
    const validRequest = {
      destinations: [{ lat: 35.9042, lng: -79.0469 }],
      mode: 'drive',
      window: '09:00-10:00',
      minutes: 30,
      provider: 'mapbox'
    };

    it('should generate isochrone with valid request', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[1, 2], [3, 4], [5, 6], [1, 2]]]
          },
          properties: {
            mode: 'drive',
            minutes: 30,
            window: '09:00-10:00',
            destination: { lat: 35.9042, lng: -79.0469 }
          }
        }]
      };

      mockGenerateIsochrone.mockResolvedValue(mockResponse);
      mockReq.body = validRequest;

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FeatureCollection',
          metadata: expect.objectContaining({
            requestHash: 'mock-hash-123',
            provider: 'mapbox'
          })
        })
      );
      expect(mockGenerateIsochrone).toHaveBeenCalledWith(validRequest);
    });

    it('should return 400 for missing destinations', async () => {
      mockReq.body = { mode: 'drive', window: '09:00-10:00', minutes: 30 };

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: expect.stringContaining('destinations')
        })
      );
    });

    it('should return 400 for invalid mode', async () => {
      mockReq.body = { ...validRequest, mode: 'invalid' };

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: expect.stringContaining('mode must be one of')
        })
      );
    });

    it('should return 400 for invalid destinations format', async () => {
      mockReq.body = {
        ...validRequest,
        destinations: [{ lat: 'invalid', lng: -79.0469 }]
      };

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: expect.stringContaining('lat and lng as numbers')
        })
      );
    });

    it('should return 400 for invalid minutes', async () => {
      mockReq.body = { ...validRequest, minutes: -5 };

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: expect.stringContaining('minutes must be a positive number')
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      mockGenerateIsochrone.mockRejectedValue(
        new Error('API error: 500 Internal Server Error')
      );
      mockReq.body = validRequest;

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Isochrone generation failed',
          message: expect.stringContaining('External mapping service temporarily unavailable')
        })
      );
    });

    it('should use specified provider when provided', async () => {
      const mockResponse = { type: 'FeatureCollection', features: [] };
      mockGenerateIsochrone.mockResolvedValue(mockResponse);
      
      mockReq.body = { ...validRequest, provider: 'openroute' };

      await generateIsochrone(mockReq, mockRes);

      expect(mockGenerateIsochrone).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'openroute' })
      );
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 400 for invalid provider in request', async () => {
      mockReq.body = { ...validRequest, provider: 'invalid' };

      await generateIsochrone(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
          message: expect.stringContaining('provider must be one of')
        })
      );
    });
  });


});
