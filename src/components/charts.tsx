import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatShortDate } from '../lib/utils'

export interface Point {
  date: number
  value: number
}

/** Courbe d'évolution simple (accent dégradé), lisible sur mobile. */
export function TrendChart({ data, unit = '', height = 180, decimals = 1 }: { data: Point[]; unit?: string; height?: number; decimals?: number }) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-zinc-400">Pas encore assez de données pour tracer une courbe.</p>
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
              <stop offset="0%" stopColor="#a3e635" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => formatShortDate(v)}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]} tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 }}
            labelFormatter={(v) => formatShortDate(Number(v))}
            formatter={(v) => [`${formatNumber(Number(v), decimals)} ${unit}`, '']}
            separator=""
          />
          <Area type="monotone" dataKey="value" stroke="#a3e635" strokeWidth={2.5} fill="url(#trend-fill)" dot={{ r: 2.5, fill: '#a3e635' }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
