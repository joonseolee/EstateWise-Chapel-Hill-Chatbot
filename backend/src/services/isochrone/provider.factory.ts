import { IsochroneProvidable, IsochroneConfig, IsochroneProvider, SUPPORTED_ISOCHRONE_PROVIDERS } from '../../types/isochrone.type';
import { MapboxIsochroneProvider } from './mapbox.provider';
import { OpenRouteIsochroneProvider } from './openroute.provider';
import { GoogleIsochroneProvider } from './google.provider';

/**
 * Factory class for creating isochrone providers
 * Implements Factory Pattern for clean provider instantiation
 */
export class IsochroneProviderFactory {
  /**
   * Creates an isochrone provider based on the configuration
   * @param config - Provider configuration
   * @returns Configured provider instance
   */
  create(config: IsochroneConfig): IsochroneProvidable {
    switch (config.provider) {
      case 'mapbox':
        if (!config.accessToken || !config.baseUrl) {
          throw new Error('Mapbox provider requires accessToken and baseUrl');
        }
        return new MapboxIsochroneProvider(
          config.accessToken,
          config.baseUrl
        );
        
      case 'openroute':
        if (!config.apiKey || !config.baseUrl) {
          throw new Error('OpenRoute provider requires apiKey and baseUrl');
        }
        return new OpenRouteIsochroneProvider(
          config.apiKey,
          config.baseUrl
        );
        
      case 'google':
        if (!config.apiKey || !config.baseUrl) {
          throw new Error('Google provider requires apiKey and baseUrl');
        }
        return new GoogleIsochroneProvider(
          config.apiKey,
          config.baseUrl
        );
        
      default:
        throw new Error(`Unsupported provider: ${(config as any).provider}`);
    }
  }

  /**
   * Creates multiple providers from an array of configurations
   * @param configs - Array of provider configurations
   * @returns Map of provider name to provider instance
   */
  createMultiple(configs: IsochroneConfig[]): Map<IsochroneProvider, IsochroneProvidable> {
    const providers = new Map<IsochroneProvider, IsochroneProvidable>();
    
    for (const config of configs) {
      try {
        const provider = this.create(config);
        providers.set(config.provider, provider);
      } catch (error) {
        console.warn(`Failed to initialize ${config.provider} provider:`, error);
        // Continue with other providers even if one fails
      }
    }
    
    return providers;
  }

  /**
   * Gets list of supported provider types
   * @returns Array of supported provider names
   */
  getSupportedProviders(): IsochroneProvider[] {
    return [...SUPPORTED_ISOCHRONE_PROVIDERS];
  }
}
