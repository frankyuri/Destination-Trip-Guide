import { TranslationKeys } from './zh-TW';

// en.ts — English locale
export const en: Record<TranslationKeys, string> = {
  // === Common ===
  loading: 'Loading...',
  loadingMap: 'Loading map...',
  error: 'Error occurred',
  close: 'Close',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  confirm: 'Confirm',
  copy: 'Copy',
  copied: 'Copied!',
  search: 'Search',
  share: 'Share',
  reset: 'Reset',
  edit: 'Edit',
  done: 'Done',
  export: 'Export',
  import: 'Import',

  // === App ===
  appTitle: 'Fukuoka Trip',
  appSubtitle: 'Complete Travel Guide',
  editMode: 'Edit Mode',
  exitEdit: 'Exit Edit',
  resetDefault: 'Reset to Default',
  addDay: 'Add Day',
  addItem: 'Add Item',
  plan1: 'Plan A',
  plan2: 'Plan B',
  listView: 'Itinerary',
  mapView: 'Map View',

  // === Confirmations ===
  confirmDeleteItem: 'Are you sure you want to delete this item?',
  confirmDeleteDay: 'Are you sure you want to delete this entire day? This cannot be undone.',
  confirmReset: 'Are you sure you want to reset to defaults? Your changes will be lost.',
  confirmImportOverwrite: 'Importing will overwrite your current itinerary. Continue?',

  // === TimelineItem ===
  newItem: 'New Item',
  aiTips: 'AI Travel Tips',
  aiLoading: 'AI is thinking...',
  aiThinking: 'Getting travel tips for you...',
  exportCalendar: 'Add to Calendar',
  copyAddress: 'Copy Address',
  addressCopied: 'Address copied!',
  recommendedFood: 'Recommended Food',
  nearbySpots: 'Nearby Spots',
  shoppingSideQuests: 'Shopping Quests',
  transport: 'Transport',
  searchLocation: 'Search Location',
  deleteItem: 'Delete Item',

  // === Transport ===
  transportTaxi: 'Taxi',
  transportTrain: 'Train/JR',
  transportBus: 'Bus',
  transportShip: 'Ferry',
  transportWalk: 'Walk',
  transportFlight: 'Flight',

  // === WeatherWidget ===
  weatherLive: 'Live Now',
  weatherForecast: 'Forecast',
  weatherOffline: 'Offline',
  weatherUpdating: 'Updating...',
  weatherCity: 'Fukuoka',

  // === Weather Conditions ===
  weatherClear: 'Clear',
  weatherPartlyCloudy: 'Partly Cloudy',
  weatherCloudy: 'Cloudy',
  weatherFoggy: 'Foggy',
  weatherDrizzle: 'Drizzle',
  weatherRain: 'Rain',
  weatherSnow: 'Snow',
  weatherThunder: 'Thunderstorm',

  // === CountdownWidget ===
  countdownTitle: 'Fukuoka Trip',
  countdownDeparture: 'Departure',
  countdownDays: 'days',
  countdownCountingDown: 'Countdown',
  countdownOngoing: 'Trip in Progress!',
  clothingSuggestion: 'What to Wear',
  clothingForecast: 'Forecast',
  clothingNote: '※ Adjust based on actual weather',
  clothingHeavyCoat: 'Heavy down jacket',
  clothingHeavyCoatReason: 'Extremely cold, stay warm',
  clothingThermal: 'Thermal + Sweater',
  clothingThermalReason: 'Layer up for the cold',
  clothingMediumCoat: 'Medium coat',
  clothingMediumCoatReason: 'Big temperature swings',
  clothingSweater: 'Light sweater / hoodie',
  clothingSweaterReason: 'Can remove indoors',
  clothingLightJacket: 'Light jacket / windbreaker',
  clothingLightJacketReason: 'Comfortable but bring a layer',
  clothingLongSleeve: 'Long sleeve shirt',
  clothingLongSleeveReason: 'Great for sightseeing walks',
  clothingShortSleeve: 'T-shirt + light jacket',
  clothingShortSleeveReason: 'Warm outside, AC inside',
  clothingLight: 'Light, breathable clothing',
  clothingLightReason: 'Hot weather',
  clothingUmbrella: 'Umbrella / raincoat',
  clothingUmbrellaLight: 'Foldable umbrella',
  clothingScarf: 'Scarf / gloves',
  clothingRainChance: 'Rain chance',
  clothingMayRain: 'May rain',
  clothingMinTemp: 'Low temp',

  // === CurrencyWidget ===
  currencyTitle: '💴 Exchange Rate',
  currencyRefresh: 'Refresh rate',
  currencyUpdatedAt: 'Updated at',

  // === ProgressTracker ===
  progressTitle: 'Progress',
  progressComplete: "Today's itinerary complete!",
  markComplete: 'Mark as complete',
  markIncomplete: 'Mark as incomplete',

  // === ShareButton ===
  shareTitle: 'Share Itinerary',
  shareCopyLink: 'Copy Link',
  shareLinkCopied: 'Copied!',
  shareToLine: 'Share on LINE',
  shareQrHint: 'Or let friends scan the QR code',

  // === Footer ===
  travelTips: 'Travel Pro Tips',
  tipGoogleMaps: 'Google Maps Tips',
  tipGoogleMapsDesc: 'Always use Japanese addresses for navigation. English addresses can cause location errors, especially when finding specific building entrances.',
  tipJapaneseAddress: 'Japanese address',
  tipHotelTitle: 'Hotel Location',
  tipHotelDesc: 'Hotel WBF Grande Hakata is within walking distance of Hakata Station Chikushi Exit. For taxis, show the Japanese address to the driver.',
  tripDateRange: '2/27 (Fri) - 3/2 (Mon) Fukuoka Trip',

  // === ErrorBoundary ===
  errorTitle: 'Something went wrong',
  errorMessage: 'Please reload the page or try again later.',
  errorReload: 'Reload',
  errorDetails: 'Technical details',

  // === EmergencyInfo ===
  emergencyTitle: 'Useful Contacts',
  emergencyCollapse: 'Collapse',
  emergencyExpand: 'Expand',
  hotelInfo: 'Hotel Info',
  hotelAddress: 'Address',
  hotelPhone: 'Phone',
  hotelCheckIn: 'Check-in',
  hotelCheckOut: 'Check-out',
  emergencyContacts: 'Emergency',
  flightInfo: 'Flight Info',

  // === DayMap ===
  mapLocateMe: 'Locate',
  mapFilter: 'Filter',
  mapAllItems: 'All',
  mapNearbyRestaurants: 'Nearby Restaurants',
  mapSearchingRestaurants: 'Searching nearby...',
  mapRestaurantsCount: '{count} nearby restaurants',
  mapDistanceFromYou: 'from you',
  mapOpen: 'Open',
  mapClosed: 'Closed',
  mapTodayHours: 'Today',

  // === NearbyRestaurants ===
  nearbyTitle: 'Nearby Restaurants',
  nearbyLoading: 'Searching nearby...',
  nearbyNoResults: 'No results found nearby',
  nearbyApiUnavailable: 'Search on Google Maps',
  nearbyViewAll: 'View all on Google Maps',

  // === Export/Import ===
  exportJSON: 'Export JSON',
  exportICS: 'Export Calendar',
  importJSON: 'Import JSON',
  importSuccess: 'Itinerary imported successfully!',
  importError: 'Import failed. Invalid file format.',

  // === DB Errors ===
  dbError: 'Database operation failed',
  dbDeleteError: 'Could not delete itinerary. Check your browser settings.',

  // === Language ===
  language: 'Language',
  langZhTW: '繁體中文',
  langEn: 'English',
  langJa: '日本語',
};
