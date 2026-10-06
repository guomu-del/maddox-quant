"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dictionaries, type Locale, type MessageKey } from "@/i18n/messages";

const STORAGE_KEY = "maddox-quant-locale";

type Vars = Record<string, string | number>;

export type Translate = (key: MessageKey, vars?: Vars) => string;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Translate;
  joinList: (items: string[]) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  return interpolate(dictionaries[locale][key] ?? dictionaries.zh[key] ?? key, vars);
}

const ERROR_KEY_BY_TEXT: Record<string, MessageKey> = {
  "仅支持 PDF 文件": "error.invalidFileType",
  "PDF files only": "error.invalidFileType",
  "文件为空": "error.emptyFile",
  "The file is empty": "error.emptyFile",
  "该 PDF 已导入": "error.duplicateReport",
  "This PDF has already been imported": "error.duplicateReport",
  "Internal server error": "error.internal",
  "服务器内部错误": "error.internal",
  "行情源响应较慢，请稍后重试": "error.marketSlow",
  "The market source is slow. Please retry shortly.": "error.marketSlow",
  "已在关注列表中": "error.alreadyWatching",
  "Already on the watchlist": "error.alreadyWatching",
  "LLM API 未配置，请在环境变量中设置 LLM_API_KEY": "error.llmMissing",
  "Unable to load the PDF": "error.pdfMissing",
  "无法加载 PDF 文件": "error.pdfMissing",
  "导入失败": "error.importFailed",
  "Import failed": "error.importFailed",
  "请选择 PDF 文件": "error.choosePdf",
  "Please choose a PDF file": "error.choosePdf",
  "加载失败": "common.loadFailed",
  "Failed to load": "common.loadFailed",
  "未知回测策略": "error.invalidStrategy",
  "Unknown backtest strategy": "error.invalidStrategy",
  "该 PDF 已存在": "error.duplicateReport",
};

export function localizeError(locale: Locale, raw: string | null | undefined, fallback: MessageKey): string {
  if (!raw) return translate(locale, fallback);
  const mapped = ERROR_KEY_BY_TEXT[raw];
  if (mapped) return translate(locale, mapped);
  if (raw.includes("文件超过") || /file (is too large|exceeds)/i.test(raw)) {
    return translate(locale, "error.fileTooLarge");
  }
  if (raw.includes("该 PDF 已导入") || raw.includes("already been imported")) {
    const id = raw.match(/(\d+)/)?.[1];
    return id
      ? translate(locale, "error.duplicateReportId", { id })
      : translate(locale, "error.duplicateReport");
  }
  if (raw === "Failed to fetch" || raw === "Load failed" || raw.includes("NetworkError")) {
    return translate(locale, "error.network", { mb: 4 });
  }
  const statusMatch = raw.match(/请求失败 \((\d+)\)/) ?? raw.match(/Request failed \((\d+)\)/);
  if (statusMatch) {
    return translate(locale, "error.requestFailed", { status: statusMatch[1] });
  }
  return raw;
}

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "zh" ? stored : "zh";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => translate(locale, key, vars),
    [locale],
  );
  const joinList = useCallback(
    (items: string[]) => items.join(locale === "en" ? ", " : "、"),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, joinList }),
    [locale, setLocale, t, joinList],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
