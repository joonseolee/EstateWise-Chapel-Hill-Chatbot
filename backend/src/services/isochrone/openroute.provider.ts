import { IsochroneProvidable, IsochroneRequest, IsochroneResponse } from '../../types/isochrone.type';
import { CommuteMode } from '../../types/commute-profile.type';

export class OpenRouteIsochroneProvider implements IsochroneProvidable {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.openrouteservice.org/v2') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const features = [];

    for (const destination of request.destinations) {
      try {
        const polygon = await this.fetchIsochroneFromOpenRoute(destination, request);
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


  private async fetchIsochroneFromOpenRoute(
    destination: { lat: number; lng: number },
    request: IsochroneRequest
  ): Promise<{ type: 'Polygon'; coordinates: Array<{lat: number, lng: number}> }> {
    const { lat, lng } = destination;
    const { mode, minutes } = request;

    // Map mode to OpenRoute profile
    const profile = this.mapModeToProfile(mode);
    
    // Parse time window to get departure time
    const departureTime = this.parseTimeWindow(request.window);

    const url = `${this.baseUrl}/isochrones/${profile}`;
    
    const requestBody: any = {
      locations: [[lng, lat]], // OpenRoute uses [lng, lat] format
      range: [minutes * 60], // Convert minutes to seconds
      range_type: 'time',
      units: 'm',
      location_type: 'start',
      options: {
        avoid_features: [],
        avoid_borders: 'none',
        avoid_countries: [],
        avoid_polygons: [],
      },
    };

    // TODO: Add departure time if available
    if (departureTime) {
      requestBody.options['departure_time'] = departureTime;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRoute API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      throw new Error('No isochrone polygon returned from OpenRoute');
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
      drive: 'driving-car',
      transit: 'driving-hgv', // OpenRoute doesn't have pure transit, use closest alternative
      bike: 'cycling-regular',
      walk: 'foot-walking',
    };
    
    return modeMap[mode];
  }

  private parseTimeWindow(window: string): number | null {
    // Parse HH:MM-HH:MM format and return Unix timestamp
    const [startTime] = window.split('-');
    const [hour, minute] = startTime.split(':').map(Number);
    
    // Use today's date with the specified time
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    
    return Math.floor(today.getTime() / 1000); // Unix timestamp
  }
}