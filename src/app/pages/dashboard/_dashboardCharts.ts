// Inicializa los charts (ApexCharts) del dashboard demo46 sobre el HTML inyectado.
// Datos/series/colores tomados del JS original de demo46 (src/js/widgets/*).
import ApexCharts from 'apexcharts'
import {getCSSVariableValue} from '../../../_metronic/assets/ts/_utils'

type AnyOptions = Record<string, any>

/**
 * Monta un chart en el elemento con `id`. Si el contenedor esta oculto (dentro de un
 * tab-pane inactivo), difiere el render hasta que su pestaña se muestre.
 */
function mount(id: string, options: AnyOptions, store: ApexCharts[]): void {
  const el = document.getElementById(id)
  if (!el) {
    return
  }
  const chart = new ApexCharts(el, options)
  store.push(chart)

  const render = () => {
    try {
      chart.render()
    } catch (e) {
      /* noop */
    }
  }

  // offsetParent === null => elemento oculto (display:none en tab-pane inactivo)
  if (el.offsetParent !== null) {
    render()
  } else {
    const pane = el.closest('.tab-pane')
    if (pane && pane.id) {
      const toggles = document.querySelectorAll<HTMLElement>(`[href="#${pane.id}"]`)
      if (toggles.length) {
        toggles.forEach((t) => {
          const once = () => {
            render()
            t.removeEventListener('shown.bs.tab', once)
          }
          t.addEventListener('shown.bs.tab', once)
        })
      } else {
        render()
      }
    } else {
      render()
    }
  }
}

function fmtThousands(val: number): string {
  return Math.round(val).toLocaleString('en-US')
}

export function initDashboardCharts(): ApexCharts[] {
  const charts: ApexCharts[] = []

  const primary = getCSSVariableValue('--bs-primary')
  const success = getCSSVariableValue('--bs-success')
  const warning = getCSSVariableValue('--bs-warning')
  const danger = getCSSVariableValue('--bs-danger')
  const info = getCSSVariableValue('--bs-info')
  const gray300 = getCSSVariableValue('--bs-gray-300')
  const gray500 = getCSSVariableValue('--bs-gray-500')
  const gray800 = getCSSVariableValue('--bs-gray-800')
  const borderColor =
    getCSSVariableValue('--bs-border-dashed-color') || getCSSVariableValue('--bs-gray-200')

  // ===== Widget 27: Organic Sessions (bar horizontal) =====
  mount(
    'kt_charts_widget_27',
    {
      series: [{name: 'Sessions', data: [12.478, 7.546, 6.083, 5.041, 4.42]}],
      chart: {fontFamily: 'inherit', type: 'bar', height: 350, toolbar: {show: false}},
      plotOptions: {
        bar: {
          borderRadius: 8,
          horizontal: true,
          distributed: true,
          barHeight: 50,
          dataLabels: {position: 'bottom'},
        },
      },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        offsetX: 0,
        formatter: (val: number) => fmtThousands(val * 1000),
        style: {fontSize: '14px', fontWeight: '600'},
      },
      legend: {show: false},
      colors: ['#3E97FF', '#F1416C', '#50CD89', '#FFC700', '#7239EA'],
      xaxis: {
        categories: ['USA', 'India', 'Canada', 'Brasil', 'France'],
        labels: {
          formatter: (val: string) => val + 'K',
          style: {colors: gray800, fontSize: '14px', fontWeight: '600'},
        },
        axisBorder: {show: false},
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            Number.isInteger(val) ? `${val} - ${Math.round((val * 100) / 18)}%` : `${val}`,
          style: {colors: gray800, fontSize: '14px', fontWeight: '600'},
          offsetY: 2,
        },
      },
      grid: {
        borderColor: borderColor,
        xaxis: {lines: {show: true}},
        yaxis: {lines: {show: false}},
        strokeDashArray: 4,
      },
      tooltip: {style: {fontSize: '12px'}},
    },
    charts
  )

  // ===== Widget 28: Domain External Links (area) =====
  mount(
    'kt_charts_widget_28',
    {
      series: [
        {name: 'Links', data: [190, 230, 230, 200, 200, 190, 190, 200, 200, 220, 220, 200, 200, 210, 210]},
      ],
      chart: {fontFamily: 'inherit', type: 'area', height: 300, toolbar: {show: false}},
      legend: {show: false},
      dataLabels: {enabled: false},
      fill: {
        type: 'gradient',
        gradient: {shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 80, 100]},
      },
      stroke: {curve: 'smooth', show: true, width: 3, colors: [info]},
      colors: [info],
      xaxis: {
        categories: [
          'May 04', 'May 05', 'May 06', 'May 09', 'May 10', 'May 12', 'May 14', 'May 17',
          'May 18', 'May 20', 'May 22', 'May 24', 'May 26', 'May 28', 'May 30',
        ],
        axisBorder: {show: false},
        offsetX: 20,
        axisTicks: {show: false},
        tickAmount: 3,
        labels: {rotate: 0, rotateAlways: false, style: {colors: gray500, fontSize: '12px'}},
      },
      yaxis: {labels: {style: {colors: gray500, fontSize: '12px'}}},
      grid: {borderColor: borderColor, strokeDashArray: 4},
    },
    charts
  )

  // ===== Widget 8: Performance Overview (bubble) x2 (Week / Month) =====
  const bubbleSeriesNames = [
    'Social Campaigns', 'Email Newsletter', 'TV Campaign', 'Google Ads', 'Courses', 'Radio',
  ]
  const bubbleColors = [primary, success, warning, danger, info, '#43CED7']
  const bubbleData1 = [
    [[100, 250, 30]], [[225, 300, 35]], [[300, 350, 25]], [[350, 350, 20]], [[450, 400, 25]], [[550, 350, 35]],
  ]
  const bubbleData2 = [
    [[125, 300, 40]], [[250, 350, 35]], [[350, 450, 30]], [[450, 250, 25]], [[500, 500, 30]], [[600, 250, 28]],
  ]
  const bubbleOptions = (data: number[][][], height: number): AnyOptions => ({
    series: bubbleSeriesNames.map((name, i) => ({name, data: data[i]})),
    chart: {fontFamily: 'inherit', type: 'bubble', height, toolbar: {show: false}},
    stroke: {show: false, width: 0},
    dataLabels: {enabled: false},
    xaxis: {
      type: 'numeric',
      tickAmount: 6,
      axisBorder: {show: false},
      axisTicks: {show: false},
      labels: {style: {colors: gray500, fontSize: '13px'}},
    },
    yaxis: {labels: {style: {colors: gray500, fontSize: '13px'}}},
    colors: bubbleColors,
    fill: {opacity: 1},
    markers: {strokeWidth: 0},
    grid: {borderColor: borderColor, strokeDashArray: 4, padding: {right: 20}},
  })
  mount('kt_chart_widget_8_week_chart', bubbleOptions(bubbleData1, 275), charts)
  mount('kt_chart_widget_8_month_chart', bubbleOptions(bubbleData2, 275), charts)

  // ===== Cards 8 & 9: small area charts =====
  const cardAreaOptions = (name: string, data: number[]): AnyOptions => ({
    series: [{name, data}],
    chart: {fontFamily: 'inherit', type: 'area', height: 125, toolbar: {show: false}, sparkline: {enabled: true}},
    stroke: {curve: 'smooth', show: true, width: 2, colors: [gray800]},
    fill: {type: 'gradient', gradient: {opacityFrom: 0.4, opacityTo: 0, stops: [0, 80, 100]}},
    colors: [success],
    dataLabels: {enabled: false},
    tooltip: {enabled: false},
    xaxis: {labels: {show: false}, axisBorder: {show: false}, axisTicks: {show: false}},
    yaxis: {labels: {show: false}},
    grid: {show: false, padding: {top: 0, bottom: 0, left: 0, right: 0}},
  })
  mount('kt_card_widget_8_chart', cardAreaOptions('Sales', [4.5, 5.7, 2.8, 5.9, 4.2, 5.6, 5.2, 4.5, 5.9, 4.5, 5.7, 4.8, 5.7]), charts)
  mount('kt_card_widget_9_chart', cardAreaOptions('Visitors', [1.5, 2.5, 2, 3, 2, 4, 2.5, 2, 2.5, 4, 2.5, 4.5, 2.5]), charts)

  // ===== Table 16: 20 sparklines (Authors Achievements) =====
  const sparkData: number[][] = [
    [16, 10, 15, 21, 6, 11, 5, 23, 5, 11, 18, 7, 21, 13],
    [8, 5, 16, 3, 23, 16, 11, 15, 3, 11, 15, 7, 17, 9],
    [8, 6, 16, 3, 23, 16, 11, 14, 3, 11, 15, 8, 17, 9],
    [12, 5, 23, 12, 21, 9, 17, 20, 4, 24, 9, 13, 18, 9],
    [13, 10, 15, 21, 6, 11, 5, 21, 5, 12, 18, 7, 21, 13],
    [13, 5, 21, 12, 21, 9, 17, 20, 4, 23, 9, 17, 21, 7],
    [8, 10, 14, 21, 6, 31, 5, 21, 5, 11, 15, 7, 23, 13],
    [6, 10, 12, 21, 6, 11, 7, 23, 5, 12, 18, 7, 21, 15],
    [7, 10, 5, 21, 6, 11, 5, 23, 5, 11, 18, 7, 21, 13],
    [8, 5, 16, 2, 19, 9, 17, 21, 4, 24, 4, 13, 21, 5],
    [15, 10, 12, 21, 6, 11, 23, 11, 5, 12, 18, 7, 21, 15],
    [3, 9, 12, 23, 6, 11, 7, 23, 5, 12, 14, 7, 21, 8],
    [9, 14, 15, 21, 8, 11, 5, 23, 5, 11, 18, 5, 23, 8],
    [7, 5, 23, 12, 21, 9, 17, 15, 4, 24, 9, 17, 21, 7],
    [8, 10, 14, 21, 6, 31, 8, 23, 5, 3, 14, 7, 21, 12],
    [6, 12, 12, 19, 6, 11, 7, 23, 5, 12, 18, 7, 21, 15],
    [5, 10, 15, 21, 6, 11, 5, 23, 5, 11, 17, 7, 21, 13],
    [4, 5, 23, 12, 21, 9, 17, 15, 4, 24, 9, 17, 21, 7],
    [7, 10, 14, 21, 6, 31, 5, 23, 5, 11, 15, 7, 21, 17],
    [3, 10, 12, 23, 6, 11, 7, 22, 5, 12, 18, 7, 21, 14],
  ]
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 4; c++) {
      const idx = (r - 1) * 4 + (c - 1)
      mount(
        `kt_table_widget_16_chart_${r}_${c}`,
        {
          series: [{name: 'value', data: sparkData[idx]}],
          chart: {fontFamily: 'inherit', type: 'area', height: 50, sparkline: {enabled: true}},
          stroke: {curve: 'smooth', show: true, width: 2, colors: [gray800]},
          fill: {type: 'gradient', gradient: {opacityFrom: 0.4, opacityTo: 0, stops: [0, 100]}},
          colors: [success],
          markers: {colors: [success], strokeColor: [gray800], strokeWidth: 3},
          tooltip: {enabled: false},
          grid: {show: false, padding: {top: 0, bottom: 0, left: 0, right: 0}},
        },
        charts
      )
    }
  }

  // ===== Widget 14: Departments (amCharts radar) -> aproximacion radialBar =====
  mount(
    'kt_charts_widget_14_chart',
    {
      series: [80, 35, 92, 68],
      chart: {fontFamily: 'inherit', type: 'radialBar', height: 350},
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 180,
          hollow: {size: '20%'},
          track: {background: borderColor, strokeWidth: '100%'},
          dataLabels: {
            name: {fontSize: '14px'},
            value: {fontSize: '14px', formatter: (v: number) => `${v}%`},
            total: {show: true, label: 'Departments', formatter: () => ''},
          },
        },
      },
      labels: ['Research', 'Marketing', 'Distribution', 'Human Resources'],
      colors: [info, danger, primary, success],
    },
    charts
  )

  // ===== Maps widget 1: World Sales (amCharts geo map) -> placeholder visual =====
  const mapEl = document.getElementById('kt_maps_widget_1_map')
  if (mapEl && !mapEl.querySelector('.dashboard-map-placeholder')) {
    mapEl.innerHTML =
      '<div class="dashboard-map-placeholder d-flex flex-center flex-column w-100 h-100 rounded" ' +
      'style="min-height:300px;background:var(--bs-gray-100);color:var(--bs-gray-500)">' +
      '<i class="ki-duotone ki-geolocation fs-3x mb-3"><span class="path1"></span><span class="path2"></span></i>' +
      '<span class="fw-semibold fs-6">World Sales map</span>' +
      '</div>'
  }
  // Silenciar uso de gray300 si no se usa en otro lado
  void gray300

  return charts
}
