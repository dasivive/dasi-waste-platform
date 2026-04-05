'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VEHICLE_TYPES = [
  { id: '2.5ton', label: '2.5톤', desc: '일반 폐기물 수거용' },
  { id: 'grab', label: '집게차', desc: '대형 폐기물, 고철 등' },
]

export default function VehicleSelectPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [count, setCount] = useState(1)

  const handleNext = () => {
    if (!selected) return
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}')
    orderData.vehicleType = selected
    orderData.vehicleCount = count
    localStorage.setItem('orderData', JSON.stringify(orderData))
    router.push('/order/address')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 */}
      <div className="bg-white px-4 py-4 shadow-sm flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-semibold">차량 선택</h1>
      </div>

      {/* 진행 표시 */}
      <div className="px-4 mt-4">
        <div className="flex gap-1">
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
        </div>
        <p className="text-xs text-gray-400 mt-2">2/4 단계</p>
      </div>

      {/* 차량 선택 */}
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

      {/* 차량 대수 선택 */}
      {selected && (
        <div className="px-4 mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            차량 대수
          </label>
          <div className="flex items-center justify-center bg-white rounded-xl border-2 border-gray-200 p-4">
            <button
              onClick={() => setCount(Math.max(1, count - 1))}
              className={`w-12 h-12 rounded-full text-2xl font-bold flex items-center justify-center ${
                count <= 1
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={count <= 1}
            >
              −
            </button>
            <span className="mx-8 text-3xl font-bold text-gray-800">
              {count}
            </span>
            <button
              onClick={() => setCount(Math.min(10, count + 1))}
              className={`w-12 h-12 rounded-full text-2xl font-bold flex items-center justify-center ${
                count >= 10
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
              disabled={count >= 10}
            >
              +
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            최대 10대까지 선택 가능
          </p>
        </div>
      )}

      {/* 다음 버튼 */}
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