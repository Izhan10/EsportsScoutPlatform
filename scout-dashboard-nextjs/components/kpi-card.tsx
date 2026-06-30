'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'

interface KpiCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  trend?: 'up' | 'down' | 'none'
}

export function KpiCard({ icon: Icon, label, value, change, changeLabel, trend }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-card border-border p-6 transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <motion.p
              className="mt-2 text-3xl font-bold"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {value}
            </motion.p>
            {(change !== undefined || changeLabel) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {change !== undefined && (
                  <span className={`font-medium ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {trend === 'up' && '+'}{change}
                  </span>
                )}{' '}
                {changeLabel}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}