'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const WASTE_TYPES = [
  { id: 'mixed', label: '혼합 폐기물', desc: '여러 종류가 섞인 폐기물' },
  { id: 'wood', label: '나무', desc: '목재, 합판, 파레트 등' },
  { id: 'concrete', label: '폐콘크리트', desc: '콘크리트, 벽돌, 블록 등' },
  { id: 'metal', label: '고철', desc: '철근, 파이프, 철판 등' },
]

const VEHICLE_TYPES = [
  { id: '2.5ton', label: '2.5톤' },
  { id: 'grab', label: '집게차' },
]

interface WasteItem {
  wasteType: string
  vehicleType: string
  vehicleCount: number
}

export default function WasteSelectPage() {
  const router = useRouter()
  const [selectedWastes, setSelectedWastes] = useState<string[]>([])
  const [wasteDetails, setWasteDetails] = useState<Record<string, { vehicleType: string; vehicleCount: number }>>({})

  // 폐기물 종류 토글
  const toggleWaste = (wasteId: string) => {
    if (selectedWastes.includes(wasteId)) {
      // 선택 해제
      setSelectedWastes(selectedWastes.filter((id) => id !== wasteId))
      const newDetails = { ...wasteDetails }
      delete newDetails[wasteId]
      setWasteDetails(newDetails)
    } else {
      // 새로 선택 — 기본값 세팅
      setSelectedWastes([...selectedWastes, wasteId])
      setWasteDetails({
        ...wasteDetails,
        [wasteId]: { vehicleType: '2.5ton', vehicleCount: 1 },
      })
    }
  }

  // 차량 유형 변경
  const setVehicleType = (wasteId: string, vehicleType: string) => {
    setWasteDetails({
      ...wasteDetails,
      [wasteId]: { ...wasteDetails[wasteId], vehicleType },
    })
  }

  // 차량 대수 변경
  const setVehicleCount = (wasteId: string, count: number) => {
    if (count < 1) count = 1
    if (count > 10) count = 10
    setWasteDetails({
      ...wasteDetails,
      [wasteId]: { ...wasteDetails[wasteId], vehicleCount: count },
    })
  }

  // 다음 단계
  const handleNext = () => {
    if (selectedWastes.length === 0) return

    // 주문 항목 배열로 저장
    const items: WasteItem[] = selectedWastes.map((wasteId) => ({
      wasteType: wasteId,
      vehicleType: wasteDetails[wasteId].vehicleType,
      vehicleCount: wasteDetails[wasteId].vehicleCount,
    }))

    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}')
    orderData.items = items
    // 기존 단일 값도 유지 (confirm 화면 호환)
    orderData.wasteType = items.map((i) => i.wasteType).join(',')
    orderData.vehicleType = items.map((i) => i.vehicleType).join(',')
    orderData.vehicleCount = items.reduce((sum, i) => sum + i.vehicleCount, 0)
    localStorage.setItem('orderData', JSON.stringify(orderData))

    // C04 차량 선택을 건너뛰고 바로 주소 입력으로
    router.push('/order/address')
  }

  // 폐기물 라벨 찾기
  const getWasteLabel = (id: string) => WASTE_TYPES.find((w) => w.id === id)?.label || id

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 */}
      <div className="bg-white px-4 py-4 shadow-sm flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-semibold">폐기물 · 차량 선택</h1>
      </div>

      {/* 진행 표시 */}
      <div className="px-4 mt-4">
        <div className="flex gap-1">
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-amber-500 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-200 rounded" />
        </div>
        <p className="text-xs text-gray-400 mt-2">1/4 단계 — 복수 선택 가능</p>
      </div>

      {/* 폐기물 종류 선택 */}
      <div className="px-4 mt-6 space-y-3">
        {WASTE_TYPES.map((type) => {
          const isSelected = selectedWastes.includes(type.id)
          const detail = wasteDetails[type.id]

          return (
            <div key={type.id} className="space-y-0">
              {/* 폐기물 종류 버튼 */}
              <button
                onClick={() => toggleWaste(type.id)}
                className={`w-full text-left p-4 border-2 transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 rounded-t-xl'
                    : 'border-gray-200 bg-white rounded-xl'
                } ${isSelected ? '' : 'rounded-xl'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{type.label}</p>
                    <p className="text-sm text-gray-500 mt-1">{type.desc}</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                      isSelected
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && '✓'}
                  </div>
                </div>
              </button>

              {/* 선택 시: 차량 유형 + 대수 */}
              {isSelected && detail && (
                <div className="border-2 border-t-0 border-amber-500 bg-white rounded-b-xl p-4 space-y-3">
                  {/* 차량 유형 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">차량 유형</p>
                    <div className="flex gap-2">
                      {VEHICLE_TYPES.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setVehicleType(type.id, v.id)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition ${
                            detail.vehicleType === v.id
                              ? 'border-amber-500 bg-amber-50 text-amber-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 차량 대수 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">차량 대수</p>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => setVehicleCount(type.id, detail.vehicleCount - 1)}
                        disabled={detail.vehicleCount <= 1}
                        className={`w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center ${
                          detail.vehicleCount <= 1
                            ? 'bg-gray-100 text-gray-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        −
                      </button>
                      <span className="mx-6 text-2xl font-bold text-gray-800">
                        {detail.vehicleCount}
                      </span>
                      <button
                        onClick={() => setVehicleCount(type.id, detail.vehicleCount + 1)}
                        disabled={detail.vehicleCount >= 10}
                        className={`w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center ${
                          detail.vehicleCount >= 10
                            ? 'bg-gray-100 text-gray-300'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 선택 요약 */}
      {selectedWastes.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm text-amber-800 font-medium">
              선택: {selectedWastes.map((id) => {
                const detail = wasteDetails[id]
                const vLabel = VEHICLE_TYPES.find((v) => v.id === detail.vehicleType)?.label
                return `${getWasteLabel(id)} ${vLabel} ${detail.vehicleCount}대`
              }).join(' / ')}
            </p>
          </div>
        </div>
      )}

      {/* 다음 버튼 */}
      <div className="px-4 mt-6 pb-8">
        <button
          onClick={handleNext}
          disabled={selectedWastes.length === 0}
          className="w-full py-4 bg-amber-500 text-white rounded-xl text-lg font-semibold disabled:opacity-40"
        >
          다음: 주소 입력
        </button>
      </div>
    </div>
  )
}