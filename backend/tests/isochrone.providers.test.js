const { MapboxIsochroneProvider } = require('../src/services/isochrone/mapbox.provider');
const { OpenRouteIsochroneProvider } = require('../src/services/isochrone/openroute.provider');
const { GoogleIsochroneProvider } = require('../src/services/isochrone/google.provider');
const { IsochroneService } = require('../src/services/isochrone/isochrone.service');

describe('Isochrone Providers', () => {
  describe('MapboxIsochroneProvider', () => {
    it('should be available with valid access token', () => {
      const provider = new MapboxIsochroneProvider('test-token');
      expect(provider.isAvailable()).toBe(true);
    });

    it('should not be available without access token', () => {
      const provider = new MapboxIsochroneProvider('');
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('OpenRouteIsochroneProvider', () => {
    it('should be available with valid API key', () => {
      const provider = new OpenRouteIsochroneProvider('test-key');
      expect(provider.isAvailable()).toBe(true);
    });

    it('should not be available without API key', () => {
      const provider = new OpenRouteIsochroneProvider('');
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('GoogleIsochroneProvider', () => {
    it('should be available with valid API key', () => {
      const provider = new GoogleIsochroneProvider('test-key');
      expect(provider.isAvailable()).toBe(true);
    });

    it('should not be available without API key', () => {
      const provider = new GoogleIsochroneProvider('');
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('IsochroneService', () => {
    it('should initialize with mapbox provider', () => {
      const config = {
        provider: 'mapbox',
        accessToken: 'test-token',
        baseUrl: 'https://api.mapbox.com/isochrone/v1'
      };
      
      const service = new IsochroneService(config);
      const availableProviders = service.getAvailableProviders();
      
      expect(availableProviders).toContain('mapbox');
      expect(service.getActiveProvider()).toBe('mapbox');
    });

    it('should initialize with openroute provider', () => {
      const config = {
        provider: 'openroute',
        apiKey: 'test-key',
        baseUrl: 'https://api.openrouteservice.org/v2'
      };
      
      const service = new IsochroneService(config);
      const availableProviders = service.getAvailableProviders();
      
      expect(availableProviders).toContain('openroute');
      expect(service.getActiveProvider()).toBe('openroute');
    });

    it('should initialize with google provider', () => {
      const config = {
        provider: 'google',
        apiKey: 'test-key',
        baseUrl: 'https://maps.googleapis.com/maps/api'
      };
      
      const service = new IsochroneService(config);
      const availableProviders = service.getAvailableProviders();
      
      expect(availableProviders).toContain('google');
      expect(service.getActiveProvider()).toBe('google');
    });

    it('should set active provider', () => {
      const config = {
        provider: 'mapbox',
        accessToken: 'test-token',
        baseUrl: 'https://api.mapbox.com/isochrone/v1'
      };
      
      const service = new IsochroneService(config);
      service.setActiveProvider('mapbox');
      expect(service.getActiveProvider()).toBe('mapbox');
    });

    it('should throw error for unavailable provider', () => {
      const config = {
        provider: 'mapbox',
        accessToken: 'test-token',
        baseUrl: 'https://api.mapbox.com/isochrone/v1'
      };
      
      const service = new IsochroneService(config);
      expect(() => {
        service.setActiveProvider('openroute');
      }).toThrow('Provider openroute is not available');
    });
  });
});
