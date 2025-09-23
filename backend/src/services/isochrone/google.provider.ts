import { IsochroneProvidable, IsochroneRequest, IsochroneResponse } from '../../types/isochrone.type';
import { CommuteMode } from '../../types/commute-profile.type';
import { Location } from '../../types/isochrone.type';

export class GoogleIsochroneProvider implements IsochroneProvidable {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateIsochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const features = [];

    for (const destination of request.destinations) {
      try {
        const polygon = await this.generateIsochroneFromRoutes(destination, request);
        features.push({
          type: 'Feature' as const,
          geometry: polygon,
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


  private async generateIsochroneFromRoutes(
    destination: Location,
    request: IsochroneRequest
  ): Promise<{ type: 'Polygon'; coordinates: Location[] }> {
    const { lat, lng } = destination;
    const { minutes, mode } = request;
    
    // Generate grid points around the destination
    const gridPoints = this.generateGridPoints(lat, lng, minutes, mode);
    
    // Filter points that are reachable within the time limit
    const reachablePoints = await this.filterReachablePoints(
      destination,
      gridPoints,
      mode,
      request.window
    );
    
    console.log(`Grid points: ${gridPoints.length}, Reachable points: ${reachablePoints.length}`);
    
    // If no reachable points, use grid points as fallback
    const pointsToUse = reachablePoints.length > 0 ? reachablePoints : gridPoints.slice(0, 10);
    
    return {
      type: 'Polygon',
      coordinates: pointsToUse,
    };
  }

  private estimateRadius(minutes: number, mode: CommuteMode): number {
    // More accurate estimates in km
    const speeds: Record<CommuteMode, number> = {
      drive: 1.0, // ~60 km/h average
      transit: 0.8, // ~48 km/h average (including waiting)
      bike: 0.5, // ~30 km/h average
      walk: 0.2, // ~12 km/h average
    };
    
    const speedKmPerMinute = speeds[mode] / 60; // Convert to km per minute
    const radiusKm = speedKmPerMinute * minutes;
    
    // Convert km to degrees (rough approximation: 1 degree ≈ 111 km)
    return radiusKm / 111;
  }

  private async filterReachablePoints(
    origin: Location,
    destinations: Location[],
    mode: CommuteMode,
    window: string
  ): Promise<Location[]> {
    const travelMode = this.mapModeToTravelMode(mode);
    const departureTime = this.parseTimeWindow(window);
    
    // Get travel times for all destinations
    const travelTimes = await this.getTravelTimes(origin, destinations, travelMode, departureTime);
    
    const reachablePoints: Location[] = [];
    
    for (let i = 0; i < destinations.length; i++) {
      const travelTime = travelTimes[i];
      if (travelTime > 0 && travelTime <= 60) { // Within 60 minutes (adjust as needed)
        reachablePoints.push(destinations[i]);
      }
    }
    
    return reachablePoints;
  }

  private async getTravelTimes(
    origin: Location,
    destinations: Location[],
    travelMode: string,
    departureTime: string | null
  ): Promise<number[]> {
    const results: number[] = [];
    
    // Process each destination individually for more accurate results
    for (const destination of destinations) {
      try {
        const duration = await this.getSingleTravelTime(origin, destination, travelMode, departureTime);
        results.push(duration);
      } catch (error) {
        console.warn('Failed to get travel time for destination:', destination, error);
        results.push(0);
      }
    }
    
    return results;
  }

  private async getSingleTravelTime(
    origin: Location,
    destination: Location,
    travelMode: string,
    departureTime: string | null
  ): Promise<number> {
    const url = new URL(`${this.baseUrl}/directions/json`);
    
    // Set origin and destination
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('mode', travelMode);
    url.searchParams.set('key', this.apiKey);
    
    // Add departure time if provided
    if (departureTime) {
      url.searchParams.set('departure_time', departureTime);
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Google Routes API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`Google Routes API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
    
    // Extract duration from the first route
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      if (route.legs && route.legs.length > 0) {
        const leg = route.legs[0];
        if (leg.duration) {
          return leg.duration.value / 60; // Convert seconds to minutes
        }
      }
    }
    
    return 0;
  }

  private mapModeToTravelMode(mode: CommuteMode): string {
    const modeMap: Record<CommuteMode, string> = {
      drive: 'driving',
      transit: 'transit',
      bike: 'bicycling',
      walk: 'walking',
    };
    
    return modeMap[mode];
  }

  private parseTimeWindow(window: string): string | null {
    // Parse HH:MM-HH:MM format and return RFC 3339 timestamp
    const [startTime] = window.split('-');
    const [hour, minute] = startTime.split(':').map(Number);
    
    // Use today's date with the specified time
    const today = new Date();
    today.setHours(hour, minute, 0, 0);
    
    return today.toISOString();
  }


  private generateGridPoints(
    centerLat: number,
    centerLng: number,
    minutes: number,
    mode: CommuteMode
  ): Location[] {
    const radius = this.estimateRadius(minutes, mode);
    const gridSize = Math.min(20, Math.max(8, Math.floor(radius * 1000 / 200))); // Smaller grid spacing for more points
    const points: Location[] = [];
    
    for (let i = -gridSize; i <= gridSize; i++) {
      for (let j = -gridSize; j <= gridSize; j++) {
        const lat = centerLat + (i * radius) / gridSize;
        const lng = centerLng + (j * radius) / gridSize;
        
        // Only include points within the estimated radius
        const distance = this.calculateDistance(centerLat, centerLng, lat, lng);
        if (distance <= radius) {
          points.push({ lat, lng });
        }
      }
    }
    
    return points;
  }


  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}