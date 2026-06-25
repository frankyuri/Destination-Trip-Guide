/**
 * i18n/index.ts — Lightweight i18n system
 *
 * Provides I18nProvider context and useI18n hook for translations.
 * Language preference is persisted in localStorage.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { zhTW, TranslationKeys } from './locales/zh-TW';
import { en } from './locales/en';
import { ja } from './locales/ja';

// === Types ===
export type Locale = 'zh-TW' | 'en' | 'ja';

type Translations = Record<TranslationKeys, string>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

// === Locale Map ===
const locales: Record<Locale, Translations> = {
  'zh-TW': zhTW,
  en,
  ja,
};

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
};

const STORAGE_KEY = 'fukuoka_trip_locale';

// === Context ===
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Get the initial locale from localStorage or browser settings.
 */
const getInitialLocale = (): Locale => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in locales) return stored as Locale;
  } catch {}

  // Try browser language detection
  const browserLang = navigator.language;
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('en')) return 'en';
  return 'zh-TW';
};

/**
 * I18nProvider — wrap your app with this to enable translations.
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  }, []);

  const t = useCallback((key: TranslationKeys, params?: Record<string, string | number>): string => {
    let value = locales[locale]?.[key] ?? locales['zh-TW'][key] ?? key;

    // Simple template interpolation: {count} → actual value
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(`{${paramKey}}`, String(paramValue));
      });
    }

    return value;
  }, [locale]);

  const contextValue = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return React.createElement(I18nContext.Provider, { value: contextValue }, children);
};

/**
 * useI18n — hook to access translations and locale controls.
 *
 * @example
 * const { t, locale, setLocale } = useI18n();
 * <span>{t('appTitle')}</span>
 * <span>{t('mapRestaurantsCount', { count: 5 })}</span>
 */
export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
