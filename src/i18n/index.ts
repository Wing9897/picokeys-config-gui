import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale, Translations } from './types';
import zhTW from './zh-TW';
import en from './en';
import zhCN from './zh-CN';

const translations: Record<Locale, Translations> = {
  'zh-TW': zhTW,
  en,
  'zh-CN': zhCN,
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'zh-TW',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'pico-config-locale' }
  )
);

export function useI18n(): Translations {
  const locale = useI18nStore((s) => s.locale);
  return translations[locale];
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  return [locale, setLocale];
}

export const locales: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
];

export type { Locale, Translations };
