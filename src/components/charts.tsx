import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatShortDate } from '../lib/utils'

export interface Point {
  date: number
  value: number
}

/** Couleurs des graphiques (reprennent les jetons du thème) */
export const CHART = {
  gold: '#D6B56E',
  grid: '#22252D',
  tick: '#9398A5',
  tooltip: { background: '#161920', border: '1px solid #2D313A', borderRadius: 12, fontSize: 12, color: '#EEEAE2' },
}

/** Courbe d'évolution : trait doré fin, grille discrète. */
export function TrendChart({ data, unit = '', height = 180, decimals = 1 }: { data: Point[]; unit?: string; height?: number; decimals?: number }) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-silver">Pas encore assez de données pour tracer une courbe.</p>
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.15 || 1
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.gold} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => formatShortDate(v)}
            tick={{ fill: CHART.tick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]} tick={{ fill: CHART.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={CHART.tooltip}
            cursor={{ stroke: CHART.gold, strokeOpacity: 0.3 }}
            labelFormatter={(v) => formatShortDate(Number(v))}
            formatter={(v) => [`${formatNumber(Number(v), decimals)} ${unit}`, '']}
            separator=""
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART.gold}
            strokeWidth={1.75}
            fill="url(#trend-fill)"
            dot={data.length <= 40 ? { r: 2, fill: CHART.gold, strokeWidth: 0 } : false}
            activeDot={{ r: 4.5, fill: CHART.gold, stroke: '#0B0D12', strokeWidth: 2 }}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Histogramme sobre (barres dorées). */
export function BarsChart({
  data,
  dataKey,
  labelKey,
  format,
  height = 160,
}: {
  data: object[]
  dataKey: string
  labelKey: string
  format: (v: number) => string
  height?: number
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fill: CHART.tick, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
          <Tooltip cursor={{ fill: CHART.grid }} contentStyle={CHART.tooltip} formatter={(v) => [format(Number(v)), '']} separator="" />
          <Bar dataKey={dataKey} radius={[5, 5, 0, 0]} fill={CHART.gold} maxBarSize={22} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
