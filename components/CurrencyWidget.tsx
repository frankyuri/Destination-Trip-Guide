import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ExchangeRate {
  rate: number;
  timestamp: number;
  approximate?: boolean;
}

const CACHE_KEY = 'exchange_rate_twd_jpy';
const FALLBACK_RATE = 4.7;

const readCachedRate = (): ExchangeRate | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExchangeRate>;
    if (typeof parsed.rate !== 'number' || !Number.isFinite(parsed.rate) || typeof parsed.timestamp !== 'number') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed as ExchangeRate;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const fetchExchangeRate = async (signal?: AbortSignal): Promise<ExchangeRate> => {
  const response = await fetch('https://api.exchangerate-api.com/v4/latest/TWD', { signal });
  if (!response.ok) throw new Error(`Exchange API returned ${response.status}`);
  const data = (await response.json()) as { rates?: { JPY?: number } };
  const rate = data.rates?.JPY;
  if (typeof rate !== 'number' || !Number.isFinite(rate)) throw new Error('Exchange API response is invalid');
  const result = { rate, timestamp: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  return result;
};

const normalizeAmount = (value: string): string => value.replace(/[^\d.]/g, '');
const formatAmount = (value: number): string => Math.round(value).toLocaleString('zh-TW');

export const CurrencyWidget: React.FC = () => {
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [twdAmount, setTwdAmount] = useState('1000');
  const [jpyAmount, setJpyAmount] = useState('');
  const [error, setError] = useState(false);

  const applyRate = (nextRate: ExchangeRate, sourceAmount = twdAmount) => {
    setRate(nextRate);
    setJpyAmount(formatAmount((Number(sourceAmount.replace(/,/g, '')) || 0) * nextRate.rate));
  };

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedRate();
    if (cached && Date.now() - cached.timestamp < 60 * 60_000) {
      applyRate(cached);
      setLoading(false);
      return () => controller.abort();
    }

    fetchExchangeRate(controller.signal)
      .then(applyRate)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        console.error('Exchange rate fetch failed:', requestError);
        setError(true);
        applyRate({ rate: FALLBACK_RATE, timestamp: Date.now(), approximate: true });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const refreshRate = async () => {
    setLoading(true);
    setError(false);
    try {
      const nextRate = await fetchExchangeRate();
      applyRate(nextRate);
    } catch (requestError) {
      console.error('Exchange rate refresh failed:', requestError);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTwdChange = (value: string) => {
    const cleanValue = normalizeAmount(value);
    setTwdAmount(cleanValue);
    if (rate) setJpyAmount(formatAmount((Number(cleanValue) || 0) * rate.rate));
  };

  const handleJpyChange = (value: string) => {
    const cleanValue = normalizeAmount(value);
    setJpyAmount(cleanValue);
    if (rate) setTwdAmount(formatAmount((Number(cleanValue) || 0) / rate.rate));
  };

  if (loading && !rate) {
    return <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" role="status">匯率載入中…</div>;
  }

  return (
    <section className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm" aria-labelledby="currency-title">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="currency-title" className="flex items-center gap-2 text-sm font-bold text-emerald-800">💴 匯率換算</h3>
        <button type="button" onClick={refreshRate} disabled={loading} className="min-h-11 min-w-11 rounded-full text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50" aria-label="更新匯率">
          <RefreshCw size={14} className={`mx-auto ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white p-2">
          <span aria-hidden="true">🇹🇼</span>
          <span className="sr-only">新台幣金額</span>
          <input type="text" inputMode="decimal" value={twdAmount} onChange={(event) => handleTwdChange(event.target.value)} className="w-20 flex-1 bg-transparent text-right text-lg font-bold text-gray-800 outline-none" />
          <span className="text-sm font-medium text-gray-500">TWD</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white p-2">
          <span aria-hidden="true">🇯🇵</span>
          <span className="sr-only">日圓金額</span>
          <input type="text" inputMode="decimal" value={jpyAmount} onChange={(event) => handleJpyChange(event.target.value)} className="w-20 flex-1 bg-transparent text-right text-lg font-bold text-gray-800 outline-none" />
          <span className="text-sm font-medium text-gray-500">JPY</span>
        </label>
      </div>

      {rate && (
        <p className="mt-3 border-t border-emerald-100 pt-3 text-center text-xs text-emerald-700">
          1 TWD ≈ {rate.rate.toFixed(2)} JPY
          {rate.approximate && <span className="ml-2 font-bold text-amber-700">離線估算值</span>}
          {!rate.approximate && <span className="ml-2 text-emerald-500">（{new Date(rate.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} 更新）</span>}
        </p>
      )}
      {error && <p className="mt-2 text-center text-xs text-amber-700" role="status">即時匯率暫時無法更新</p>}
    </section>
  );
};