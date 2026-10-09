import { useState } from 'react'
import { token } from '@/styled-system/tokens'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { css } from '@/styled-system/css'
import type { SeriesRange, SeriesPoint } from '../../api/types'
import { formatBucket } from '@/components/console/utils'

// The toggle names the window you are looking at; the chart title names the
// bucket inside it. Saying both removes the old ambiguity of a control labelled
// "Jour" that actually drew one bar per hour.
const RANGE_LABEL: Record<SeriesRange, string> = {
  h24: '24 h',
  d7: '7 jours',
  d30: '1 mois',
  m12: '12 mois',
}
// The bucket the title names. d7 and d30 share it: both are counted per day,
// they differ only in how far back they reach.
const RANGE_BUCKET: Record<SeriesRange, string> = {
  h24: 'heure',
  d7: 'jour',
  d30: 'jour',
  m12: 'mois',
}
const RANGES: SeriesRange[] = ['h24', 'd7', 'd30', 'm12']

export const TrendChart = ({
  title,
  series,
  color,
  valueLabel,
}: {
  title: string
  series: Record<SeriesRange, SeriesPoint[]>
  color: string
  valueLabel: string
}) => {
  const [range, setRange] = useState<SeriesRange>('d7')
  const data = series[range].map((p) => ({
    label: formatBucket(p.bucket, range),
    count: p.count,
  }))
  const total = data.reduce((n, p) => n + p.count, 0)

  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        padding: '1.2rem',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.8rem',
          gap: '0.5rem',
          flexWrap: 'wrap',
        })}
      >
        <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
          {title} par {RANGE_BUCKET[range]}
        </h3>
        <div
          className={css({
            display: 'flex',
            gap: '0.15rem',
            backgroundColor: 'greyscale.100',
            borderRadius: '8px',
            padding: '0.15rem',
          })}
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={css({
                // Tighter than before: four options have to sit on one row.
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: range === r ? 'white' : 'transparent',
                color: range === r ? 'primary.800' : 'greyscale.600',
                boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              })}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      {/* The SVG carries no text a screen reader can use, so the region states
          the shape of the series; the tooltip stays for pointer users. */}
      <div
        role="img"
        aria-label={`${title} par ${RANGE_BUCKET[range]} sur ${RANGE_LABEL[range]} — ${total} ${valueLabel} au total`}
        className={css({ width: '100%', height: '230px' })}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 8, left: -22, bottom: 0 }}
            barCategoryGap="30%"
          >
            {/* Solid hairline: dashed rules read as data next to bars. */}
            <CartesianGrid
              stroke={token('colors.console.chart-grid')}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: token('colors.console.chart-tick') }}
              axisLine={false}
              tickLine={false}
              // Over 30 buckets every label cannot fit; let recharts drop the
              // ones that would collide rather than overlap them.
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: token('colors.console.chart-tick') }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              content={<ChartTooltip valueLabel={valueLabel} />}
              cursor={{ fill: 'rgba(15,23,42,0.04)' }}
            />
            {/* Square caps: a rounded top eats into the bar's height, which
                makes short bars read lower than they are. */}
            <Bar dataKey="count" fill={color} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export interface TooltipProps {
  active?: boolean
  payload?: { value: number; payload: { label: string } }[]
  valueLabel: string
}
export const ChartTooltip = ({ active, payload, valueLabel }: TooltipProps) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '10px',
        padding: '0.5rem 0.75rem',
        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        fontSize: '0.82rem',
      })}
    >
      <div className={css({ fontWeight: 700, textTransform: 'capitalize' })}>
        {p.payload.label}
      </div>
      <div className={css({ color: 'greyscale.600' })}>
        {p.value} {valueLabel}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- activity feed -- */
