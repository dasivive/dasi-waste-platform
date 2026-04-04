'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const WASTE_TYPES = [
  { id: 'mixed', label: '혼합 폐기물', desc: '여러 종류가 섞인 폐기물' },
  { id: 'wood', label: '나무', desc: '목재, 합판, 파레트 등' },
  { id: 'concrete', label: '폐콘크리트', desc: '콘크리트, 벽돌, 블록 등' },
  { id: 'metal', label: '고철', desc: '철근, 파이프, 철판 등' },
]

export default function WasteSelectPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  const handleNext = () => {
    if (!selected) return
    router.push(`/order/vehicle?waste=${selected}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 */}
      <div className="bg-white px-4 py-4 shadow-sm flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-semibold">폐기물 종류 선택</h1>
      </div>

      {/* 진행 표시 */}
      <div className="px-4 mt-4">
        <div className="flex gap-1">
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
        </div>
        <p className="text-xs text-gray-400 mt-2">1/4 단계</p>
      </div>

      {/* 폐기물 종류 선택 */}
      <div className="px-4 mt-6 space-y-3">
        {WASTE_TYPES.map((type) => (
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