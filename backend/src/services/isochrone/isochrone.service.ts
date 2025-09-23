import { IsochroneProvidable, IsochroneRequest, IsochroneResponse, IsochroneConfig, IsochroneProvider } from '../../types/isochrone.type';
import { IsochroneProviderFactory } from './provider.factory';

export class IsochroneService {
  private providers: Map<string, IsochroneProvidable> = new Map();

  constructor(configs: IsochroneConfig[]) {
    this.initializeProviders(configs);
  }

  private initializeProviders(configs: IsochroneConfig[]): void {
    const factory = new IsochroneProviderFactory();
    this.providers = factory.createMultiple(configs);
  }

  async generateIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    // Use specified provider (required)
    const targetProvider = request.provider;
    
    if (!targetProvider) {
      throw new Error('Provider is required');
    }
    
    const provider = this.providers.get(targetProvider);
    
    if (!provider) {
      throw new Error(`Provider ${targetProvider} is not available`);
    }

    // Generate isochrone
    return await provider.generateIsochrone(request);
  }

  getAvailableProviders(): IsochroneProvider[] {
    return Array.from(this.providers.keys()) as IsochroneProvider[];
  }
}