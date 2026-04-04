'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VehicleSelectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const waste = searchParams.get('waste')
  const [selected, setSelected] = useState<string | null>(null)

  const VEHICLE_TYPES = [
    { id: '2.5ton', label: '2.5톤', desc: '소규모 현장, 좁은 골목 진입 가능' },
    { id: 'grabber', label: '집게차', desc: '대량 폐기물, 집게로 상차' },
  ]

  const handleNext = () => {
    if (!selected) return
    router.push(`/order/address?waste=${waste}&vehicle=${selected}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 shadow-sm flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-semibold">차량 선택</h1>
      </div>

      <div className="px-4 mt-4">
        <div className="flex gap-1">
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
        </div>
        <p className="text-xs text-gray-400 mt-2">2/4 단계</p>
      </div>

      <div className="px-4 mt-6 space-y-3">
        {VEHICLE_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelected(type.id)}
            className={`w-full text-left p-4 rounded-xl border-2 transition ${
              selected === type.id
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <p className="font-semibold text-gray-800">{type.label}</p>
            <p className="text-sm text-gray-500 mt-1">{type.desc}</p>
          </button>
        ))}
      </div>

      <div className="px-4 mt-8">
        <button
          onClick={handleNext}
          disabled={!selected}
          className="w-full py-4 bg-amber-500 text-white rounded-xl text-lg font-semibold disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default function VehicleSelectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>로딩중...</p></div>}>
      <VehicleSelectContent />
    </Suspense>
  )
}