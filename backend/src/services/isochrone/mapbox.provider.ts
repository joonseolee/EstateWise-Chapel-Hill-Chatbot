import { IsochroneProvidable, IsochroneRequest, IsochroneResponse } from '../../types/isochrone.type';
import { CommuteMode } from '../../types/commute-profile.type';

export class MapboxIsochroneProvider implements IsochroneProvidable {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl = 'https://api.mapbox.com/isochrone/v1') {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  async generateIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const features = [];

    for (const destination of request.destinations) {
      try {
        const polygon = await this.fetchIsochroneFromMapbox(destination, request);
        features.push({
          type: 'Feature' as const,
          geometry: polygon,
          properties: {
            mode: request.mode,
            minutes: request.minutes,
            window: request.window,
            destination: {
              lat: destination.lat,
              lng: destination.lng,
            },
          },
        });
      } catch (error) {
        console.error(`Failed to generate isochrone for destination ${destination.lat},${destination.lng}:`, error);
        // Continue with other destinations even if one fails
      }
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }


  private async fetchIsochroneFromMapbox(
    destination: { lat: number; lng: number },
    request: IsochroneRequest
  ): Promise<{ type: 'Polygon'; coordinates: Array<{lat: number, lng: number}> }> {
    const { lat, lng } = destination;
    const { mode, minutes } = request;

    // Map mode to Mapbox profile
    const profile = this.mapModeToProfile(mode);
    
    // Parse time window to get departure time
    const departureTime = this.parseTimeWindow(request.window);

    const url = new URL(`${this.baseUrl}/mapbox/${profile}/${lng},${lat}`);
    url.searchParams.set('contours_minutes', minutes.toString());
    url.searchParams.set('polygons', 'true');
    url.searchParams.set('access_token', this.accessToken);
    
    if (departureTime) {
      url.searchParams.set('depart_at', departureTime);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No isochrone polygon returned from Mapbox');
    }

    // Return the first (and typically only) polygon with converted coordinates
    const geometry = data.features[0].geometry;
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates[0].map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      }))
    };
  }

  private mapModeToProfile(mode: CommuteMode): string {
    const modeMap: Record<CommuteMode, string> = {
      drive: 'driving',
      transit: 'driving-transit', // Mapbox doesn't have pure transit, use driving-transit
      bike: 'cycling',
      walk: 'walking',
    };
    
    return modeMap[mode];
  }

  private parseTimeWindow(window: string): string | null {
    // Parse HH:MM-HH:MM format and return ISO string for departure time
    // For now, use the start time as departure time
    const [startTime] = window.split('-');
    const [hour, minute] = startTime.split(':').map(Number);
    
    // Use today's date with the specified time
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    
    return today.toISOString();
  }
}