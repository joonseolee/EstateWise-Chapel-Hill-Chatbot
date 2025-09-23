/**
 * Types for isochrone (travel time polygon) functionality
 */

import { CommuteMode } from './commute-profile.type';

export const SUPPORTED_ISOCHRONE_PROVIDERS = ['mapbox', 'openroute', 'google'] as const;
export type IsochroneProvider = typeof SUPPORTED_ISOCHRONE_PROVIDERS[number];

export interface Location {
  lat: number;
  lng: number;
}

export interface IsochroneRequest {
  destinations: Array<Location>;
  mode: CommuteMode;
  window: string; // HH:MM-HH:MM format
  minutes: number;
  provider: IsochroneProvider; // Required provider selection
}

export interface IsochroneResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: Location[];
    };
  }>;
}

export interface IsochroneProvidable {
  generateIsochrone(request: IsochroneRequest): Promise<IsochroneResponse>;
}

// Generic provider configuration type
export interface IsochroneProviderConfig<T extends IsochroneProvider> {
  provider: T;
}

// Provider-specific configuration types
export interface MapboxConfig extends IsochroneProviderConfig<'mapbox'> {
  accessToken?: string;
  baseUrl?: string;
}

export interface OpenRouteConfig extends IsochroneProviderConfig<'openroute'> {
  apiKey?: string;
  baseUrl?: string;
}

export interface GoogleConfig extends IsochroneProviderConfig<'google'> {
  apiKey?: string;
  baseUrl?: string;
}

// Discriminated union for type-safe configuration
export type IsochroneConfig = MapboxConfig | OpenRouteConfig | GoogleConfig;