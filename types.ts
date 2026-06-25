export enum TransportType {
  TAXI = 'TAXI',
  WALK = 'WALK',
  TRAIN = 'TRAIN',
  BUS = 'BUS',
  SHIP = 'SHIP',
  FLIGHT = 'FLIGHT',
}

export interface ShoppingSpot {
  name: string;
  category: string; // e.g. "藥妝", "電器", "零食"
  description?: string; // e.g. "退稅方便", "款式多"
}

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  description: string;
  address_jp: string;
  address_en: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  transportType: TransportType;
  transportDetail: string;
  // imageUrl removed for clean text-based UI
  googleMapsQuery?: string;
  recommendedFood: string[];
  nearbySpots: string[];
  shoppingSideQuests?: ShoppingSpot[]; 
}

export interface DayItinerary {
  isoDate: string;
  date: string;
  dayTitle: string;
  theme: string;
  focus: string;
  items: ItineraryItem[];
}