'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface WasteItem {
  wasteType: string;
  vehicleType: string;
  vehicleCount: number;
}

const wasteLabels: Record<string, string> = {
  mixed: '혼합 폐기물',
  wood: '나무',
  concrete: '폐콘크리트',
  metal: '고철',
};

const vehicleLabels: Record<string, string> = {
  '2.5ton': '2.5톤',
  grab: '집게차',
};

export default function ConfirmPage() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<{
    items?: WasteItem[];
    address?: string;
    detailAddress?: string;
    date?: string;
    time?: string;
    dateLabel?: string;
    timeLabel?: string;
    latitude?: number;
    longitude?: number;
  }>({});
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('orderData') || '{}');
    setOrderData(data);

    // 가격은 일단 기본값 (나중에 prices 테이블에서 조회)
    if (data.items) {
      const total = data.items.reduce((sum: number, item: WasteItem) => {
        return sum + 600000 * item.vehicleCount;
      }, 0);
      setTotalPrice(total);
    }
  }, []);

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  // 총 차량 대수
  const totalVehicles = orderData.items?.reduce((sum, item) => sum + item.vehicleCount, 0) || 0;

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      // 각 폐기물 종류별로 배차 요청 생성
      const items = orderData.items || [];
      for (const item of items) {
        const { error } = await supabase.from('dispatch_requests').insert({
          requester_id: user.id,
          site_address: orderData.address,
          site_detail: orderData.detailAddress || '',
          latitude: orderData.latitude || 0,
          longitude: orderData.longitude || 0,
          waste_type: item.wasteType,
          vehicle_type: item.vehicleType,
          requested_date: orderData.date,
          requested_time: orderData.timeLabel || orderData.time,
          status: 'requested',
          payment_status: 'pending',
          payment_amount: 600000 * item.vehicleCount,
        });

        if (error) {
          console.error('배차 요청 에러:', error);
          alert('배차 요청에 실패했습니다. 다시 시도해주세요.');
          return;
        }
      }

      localStorage.removeItem('orderData');
      alert('배차 요청이 완료되었습니다!');
      router.push('/');
    } catch (err) {
      console.error('에러:', err);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">주문 확인</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center space-x-2 text-sm">
          <span className="text-gray-400">폐기물</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">차량</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">주소</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">시간</span>
          <span className="text-gray-300">→</span>
          <span className="text-amber-500 font-bold">확인</span>
        </div>

        {/* 주문 요약 카드 */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-bold text-lg border-b pb-3">📋 주문 요약</h2>

          {/* 배차 항목 */}
          <div>
            <p className="text-gray-500 text-sm mb-2">배차 항목</p>
            <div className="space-y-2">
              {orderData.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-gray-50 rounded-lg p-3"
                >
                  <span className="font-medium">
                    {wasteLabels[item.wasteType] || item.wasteType}
                  </span>
                  <span className="text-gray-600">
                    {vehicleLabels[item.vehicleType] || item.vehicleType} × {item.vehicleCount}대
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">
              총 {totalVehicles}대
            </p>
          </div>

          {/* 현장 주소 */}
          <div className="flex justify-between items-start">
            <span className="text-gray-500 flex-shrink-0">현장 주소</span>
            <span className="font-medium text-right ml-4">
              {orderData.address || '-'}
              {orderData.detailAddress && (
                <span className="block text-sm text-gray-400">
                  {orderData.detailAddress}
                </span>
              )}
            </span>
          </div>

          {/* 희망 일시 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">희망 일시</span>
            <span className="font-medium">
              {orderData.dateLabel || orderData.date || '-'}{' '}
              {orderData.timeLabel || orderData.time || ''}
            </span>
          </div>

          {/* 금액 */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-bold text-lg">예상 금액</span>
              <span className="text-amber-600 font-bold text-xl">
                {formatPrice(totalPrice)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              * 최종 금액은 현장 상황에 따라 변동될 수 있습니다
            </p>
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            ℹ️ 배차 요청 후 집하장에서 기사를 배정합니다. 배정이 완료되면 알려드립니다.
          </p>
        </div>

        {/* 배차 요청 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {loading ? '요청 중...' : '🚛 배차 요청하기'}
        </button>
      </div>
    </div>
  );
}