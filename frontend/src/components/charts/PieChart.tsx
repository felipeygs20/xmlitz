'use client'

import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PieChartProps {
  data: any[]
  title: string
  description?: string
  dataKey: string
  nameKey: string
  colors?: string[]
  height?: number
  formatValue?: (value: any) => string
  showLegend?: boolean
}

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
]

export function PieChart({
  data,
  title,
  description,
  dataKey,
  nameKey,
  colors = DEFAULT_COLORS,
  height = 300,
  formatValue,
  showLegend = true
}: PieChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data[nameKey]}</p>
          <p className="text-sm text-muted-foreground">
            Valor: {formatValue ? formatValue(data[dataKey]) : data[dataKey]}
          </p>
          <p className="text-sm text-muted-foreground">
            Percentual: {((data[dataKey] / data.total) * 100).toFixed(1)}%
          </p>
        </div>
      )
    }
    return null
  }

  // Calcular total para percentuais
  const total = data.reduce((sum, item) => sum + item[dataKey], 0)
  const dataWithTotal = data.map(item => ({ ...item, total }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsPieChart>
            <Pie
              data={dataWithTotal}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={dataKey}
            >
              {dataWithTotal.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
