"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useLocale } from "@/i18n/locale";
import { formatMoney, formatNumber } from "@/lib/format";
import type { KlineBar } from "@/types/market";

function sma(items: KlineBar[], n: number): (number | null)[] {
  return items.map((_, i) => {
    if (i + 1 < n) return null;
    const slice = items.slice(i + 1 - n, i + 1);
    return slice.reduce((sum, bar) => sum + bar.close, 0) / n;
  });
}

export function QuantChart({ items, showMa }: { items: KlineBar[]; showMa: boolean }) {
  const { locale } = useLocale();
  const ma5 = sma(items, 5);
  const ma10 = sma(items, 10);
  const ma20 = sma(items, 20);
  const data = items.map((bar, i) => ({
    date: bar.date.slice(5),
    close: bar.close,
    volume: bar.volume,
    ma5: ma5[i],
    ma10: ma10[i],
    ma20: ma20[i],
  }));

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#f4f4f5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="price"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            width={72}
            tickFormatter={(value) => formatMoney(Number(value), locale)}
          />
          <YAxis
            yAxisId="vol"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) => formatNumber(Number(value), locale, 0)}
          />
          <Tooltip
            formatter={(value, name) => {
              const amount = Number(value);
              if (!Number.isFinite(amount)) return ["—", name];
              if (name === "volume") return [formatNumber(amount, locale, 0), name];
              return [formatMoney(amount, locale), name];
            }}
          />
          <Bar yAxisId="vol" dataKey="volume" fill="#d4d4d8" />
          <Line yAxisId="price" type="monotone" dataKey="close" stroke="#18181b" dot={false} />
          {showMa ? (
            <>
              <Line yAxisId="price" type="monotone" dataKey="ma5" stroke="#ef4444" dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} />
              <Line yAxisId="price" type="monotone" dataKey="ma20" stroke="#2563eb" dot={false} />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
