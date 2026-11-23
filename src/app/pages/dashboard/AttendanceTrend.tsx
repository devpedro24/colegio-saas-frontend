import {useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip} from 'chart.js'
import {useThemeMode} from '@/_metronic/partials/layout/theme-mode/ThemeModeProvider'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip)

const weekdays = [9, 10, 11, 12, 13].map((day) => new Date(Date.UTC(2026, 10, day)))

type AttendanceWeek = {label: string; days: number[]; average: number}

export function AttendanceTrend({weeks}: {weeks: AttendanceWeek[]}) {
  const intl = useIntl()
  const {mode} = useThemeMode()
  const [selectedWeek, setSelectedWeek] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {days, average} = weeks[selectedWeek]
  const percent = (value: number) => intl.formatNumber(value / 100, {style: 'percent', maximumFractionDigits: 1})
  const description = days.map((value, index) =>
    intl.formatDate(weekdays[index], {weekday: 'long', timeZone: 'UTC'}) + ' ' + percent(value)).join(', ')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Read the surrounding theme so the chart stays legible after a theme change.
    const theme = getComputedStyle(canvas)
    const color = (variable: string) => theme.getPropertyValue(variable).trim()
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: weekdays.map((date) => intl.formatDate(date, {weekday: 'short', timeZone: 'UTC'})),
        datasets: [{
          data: days,
          borderColor: color('--dash-chart-line'),
          backgroundColor: color('--dash-chart-fill'),
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color('--dash-surface'),
          pointBorderWidth: 2,
          tension: 0.32,
          fill: 'start',
        }],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        interaction: {mode: 'index', intersect: false},
        locale: intl.locale,
        layout: {padding: {right: 10}},
        plugins: {tooltip: {displayColors: false, callbacks: {
          label: ({parsed}) => intl.formatNumber((parsed.y ?? 0) / 100, {style: 'percent', maximumFractionDigits: 1}),
        }}},
        scales: {
          x: {grid: {display: false}, ticks: {color: color('--dash-muted')}, border: {display: false}},
          y: {
            min: 90, max: 100,
            border: {display: false, dash: [4, 4]},
            grid: {color: color('--dash-line'), drawTicks: false},
            ticks: {
              color: color('--dash-muted'),
              stepSize: 5,
              padding: 8,
              callback: (value) => intl.formatNumber(Number(value) / 100, {style: 'percent'}),
            },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [days, intl, mode])

  return (
    <>
      <div className='school-dashboard__trend-summary'>
        <div className='school-dashboard__trend-value' aria-live='polite'>
          <strong>{percent(average)}</strong>
          {selectedWeek === 0 && (
            <span className='school-dashboard__completion'>
              <i className='bi bi-arrow-up-right' aria-hidden='true' />
              {intl.formatMessage({id: 'schoolDashboard.attendanceImprovement'}, {
                points: intl.formatNumber(average - weeks[1].average, {maximumFractionDigits: 1}),
              })}
            </span>
          )}
        </div>
        <div className='school-dashboard__week-switch' role='group'
          aria-label={intl.formatMessage({id: 'schoolDashboard.attendanceRange'})}>
          {weeks.map(({label}, index) => (
            <button key={label} type='button' aria-pressed={selectedWeek === index} onClick={() => setSelectedWeek(index)}>
              {intl.formatMessage({id: 'schoolDashboard.' + label})}
            </button>
          ))}
        </div>
      </div>
      <div className='school-dashboard__plot'>
        <canvas ref={canvasRef} role='img' aria-label={description} />
      </div>
    </>
  )
}
