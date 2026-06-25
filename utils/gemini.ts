const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const isAiConfigured = (): boolean => API_BASE_URL.length > 0;

export const getPlaceInsight = async (placeName: string): Promise<string> => {
  if (!isAiConfigured()) {
    return 'AI 嚮導尚未連接後端服務。';
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/place-insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_name: placeName }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`);
    }

    const data: unknown = await response.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'insight' in data &&
      typeof data.insight === 'string'
    ) {
      return data.insight;
    }

    throw new Error('AI API returned an invalid response');
  } catch (error) {
    console.error('AI guide request failed:', error);
    return error instanceof DOMException && error.name === 'AbortError'
      ? 'AI 回應逾時，請稍後再試。'
      : 'AI 連線發生錯誤，請稍後再試。';
  } finally {
    window.clearTimeout(timeout);
  }
};