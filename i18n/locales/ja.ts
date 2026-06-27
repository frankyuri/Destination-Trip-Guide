import { TranslationKeys } from './zh-TW';

// ja.ts — 日本語ロケール
export const ja: Record<TranslationKeys, string> = {
  // === 共通 ===
  loading: '読み込み中...',
  loadingMap: '地図を読み込み中...',
  error: 'エラーが発生しました',
  close: '閉じる',
  save: '保存',
  cancel: 'キャンセル',
  delete: '削除',
  confirm: '確認',
  copy: 'コピー',
  copied: 'コピーしました！',
  search: '検索',
  share: '共有',
  reset: 'リセット',
  edit: '編集',
  done: '完了',
  export: 'エクスポート',
  import: 'インポート',

  // === App ===
  appTitle: '目的地旅行',
  appSubtitle: '旅行ガイド',
  editMode: '編集モード',
  exitEdit: '編集終了',
  resetDefault: 'デフォルトに戻す',
  addDay: '日を追加',
  addItem: '予定を追加',
  plan1: 'プランA',
  plan2: 'プランB',
  listView: 'リスト',
  mapView: 'マップ',

  // === 確認ダイアログ ===
  confirmDeleteItem: 'この予定を削除しますか？',
  confirmDeleteDay: 'この日を削除しますか？元に戻せません。',
  confirmReset: 'デフォルトに戻しますか？変更は失われます。',
  confirmImportOverwrite: 'インポートすると現在の旅程が上書きされます。続けますか？',

  // === TimelineItem ===
  newItem: '新しい予定',
  aiTips: 'AI旅行ヘルパー',
  aiLoading: 'AI考え中...',
  aiThinking: '旅行のヒントを検索中...',
  exportCalendar: 'カレンダーに追加',
  copyAddress: '住所をコピー',
  addressCopied: '住所をコピーしました！',
  recommendedFood: 'おすすめグルメ',
  nearbySpots: '周辺スポット',
  shoppingSideQuests: 'ショッピング',
  transport: '交通',
  searchLocation: '場所を検索',
  deleteItem: 'この予定を削除',

  // === 交通手段 ===
  transportTaxi: 'タクシー',
  transportTrain: '電車/JR',
  transportBus: 'バス',
  transportShip: 'フェリー',
  transportWalk: '徒歩',
  transportFlight: '飛行機',

  // === WeatherWidget ===
  weatherLive: 'リアルタイム',
  weatherForecast: '予報',
  weatherOffline: 'オフライン',
  weatherUpdating: '更新中...',
  weatherCity: '目的地',

  // === 天気 ===
  weatherClear: '晴れ',
  weatherPartlyCloudy: '晴れ時々曇り',
  weatherCloudy: '曇り',
  weatherFoggy: '霧',
  weatherDrizzle: '小雨',
  weatherRain: '雨',
  weatherSnow: '雪',
  weatherThunder: '雷雨',

  // === CountdownWidget ===
  countdownTitle: '目的地旅行',
  countdownDeparture: '出発',
  countdownDays: '日',
  countdownCountingDown: 'カウントダウン',
  countdownOngoing: '旅行中！',
  clothingSuggestion: '服装アドバイス',
  clothingForecast: '予報',
  clothingNote: '※ 実際の天気に合わせて調整してください',
  clothingHeavyCoat: '厚手ダウンジャケット',
  clothingHeavyCoatReason: '極寒、防寒必須',
  clothingThermal: 'ヒートテック + セーター',
  clothingThermalReason: '重ね着で防寒',
  clothingMediumCoat: '中厚コート',
  clothingMediumCoatReason: '寒暖差が大きい',
  clothingSweater: '薄手セーター / パーカー',
  clothingSweaterReason: '室内で脱げる',
  clothingLightJacket: '薄手ジャケット',
  clothingLightJacketReason: '快適だが上着は必要',
  clothingLongSleeve: '長袖シャツ',
  clothingLongSleeveReason: '観光散歩に最適',
  clothingShortSleeve: 'Tシャツ + 薄手上着',
  clothingShortSleeveReason: '外は暑いが冷房対策に',
  clothingLight: '軽くて通気性のある服',
  clothingLightReason: '暑い天気',
  clothingUmbrella: '傘 / レインコート',
  clothingUmbrellaLight: '折りたたみ傘',
  clothingScarf: 'マフラー / 手袋',
  clothingRainChance: '降水確率',
  clothingMayRain: '雨の可能性あり',
  clothingMinTemp: '最低気温',

  // === CurrencyWidget ===
  currencyTitle: '💴 為替レート',
  currencyRefresh: 'レート更新',
  currencyUpdatedAt: '更新時刻',

  // === ProgressTracker ===
  progressTitle: '進捗',
  progressComplete: '本日の予定完了！',
  markComplete: '完了にする',
  markIncomplete: '未完了に戻す',

  // === ShareButton ===
  shareTitle: '旅程を共有',
  shareCopyLink: 'リンクをコピー',
  shareLinkCopied: 'コピーしました！',
  shareToLine: 'LINEで共有',
  shareQrHint: 'QRコードをスキャンしてもらう',

  // === Footer ===
  travelTips: '旅行のコツ',
  tipGoogleMaps: 'Google Maps のコツ',
  tipGoogleMapsDesc: 'ナビゲーションには必ず日本語の住所を使用してください。英語の住所は位置がずれることがあります。',
  tipJapaneseAddress: '日本語住所',
  tipHotelTitle: 'ホテルの場所',
  tipHotelDesc: 'Hotel WBF Grande Hakataは博多駅筑紫口から徒歩圏内です。タクシーの場合は日本語の住所を運転手に見せてください。',
  tripDateRange: '2/27 (金) - 3/2 (月) 目的地旅行',

  // === ErrorBoundary ===
  errorTitle: '問題が発生しました',
  errorMessage: 'ページを再読み込みするか、後でもう一度お試しください。',
  errorReload: '再読み込み',
  errorDetails: '技術的詳細',

  // === EmergencyInfo ===
  emergencyTitle: '連絡先情報',
  emergencyCollapse: '閉じる',
  emergencyExpand: '開く',
  hotelInfo: 'ホテル情報',
  hotelAddress: '住所',
  hotelPhone: '電話',
  hotelCheckIn: 'チェックイン',
  hotelCheckOut: 'チェックアウト',
  emergencyContacts: '緊急連絡先',
  flightInfo: 'フライト情報',

  // === DayMap ===
  mapLocateMe: '現在地',
  mapFilter: 'フィルター',
  mapAllItems: 'すべて',
  mapNearbyRestaurants: '周辺レストラン',
  mapSearchingRestaurants: '周辺を検索中...',
  mapRestaurantsCount: '周辺 {count} 件のレストラン',
  mapDistanceFromYou: 'あなたから',
  mapOpen: '営業中',
  mapClosed: '休業中',
  mapTodayHours: '本日',

  // === NearbyRestaurants ===
  nearbyTitle: '周辺レストラン',
  nearbyLoading: '周辺を検索中...',
  nearbyNoResults: '周辺に結果がありません',
  nearbyApiUnavailable: 'Google Mapsで検索',
  nearbyViewAll: 'Google Mapsで全て表示',

  // === エクスポート/インポート ===
  exportJSON: 'JSONエクスポート',
  exportICS: 'カレンダーエクスポート',
  importJSON: 'JSONインポート',
  importSuccess: '旅程をインポートしました！',
  importError: 'インポートに失敗しました。ファイル形式が正しくありません。',

  // === DBエラー ===
  dbError: 'データベース操作に失敗しました',
  dbDeleteError: '旅程を削除できませんでした。ブラウザの設定を確認してください。',

  // === 言語 ===
  language: '言語',
  langZhTW: '繁體中文',
  langEn: 'English',
  langJa: '日本語',
};
