'use client'

import dynamic from 'next/dynamic'

const ReportsContent = dynamic(() => import('./reports-content'), { ssr: false })

export default function ReportsPage() {
  return <ReportsContent />
}
