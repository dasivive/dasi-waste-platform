'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface DispatchRequest {
  id: string;
  site_address: string;
  site_detail: string;
  waste_type: string;
  vehicle_type: string;
  requested_date: string;
  requested_time: string;
  status: string;
  payment_amount: number;
  payment_status: string | null;  // pending/awaiting_payment/paid/failed
  platform_fee: number | null;    // 다시 수수료 (10%) - 집하장엔 숨김, 관리자만 봄
  yard_payout: number | null;     // 집하장 지급액 (90%) - 집하장엔 "거래 금액"으로 표시
  assigned_driver_id: string | null;
  yard_id: string | null;         // 이 주문을 처리하는 집하장 (정산 추적용)
  created_at: string;
}

interface Driver {
  id: string;
  vehicle_type: string;
  status: string;
  users: {
    name: string;
    phone: string;
  };
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

const statusLabels: Record<string, string> = {
  requested: '대기중',
  dispatched: '배차완료',
  in_progress: '진행중',
  completed: '완료',
};

const statusColors: Record<string, string> = {
  requested: 'bg-red-100 text-red-700',
  dispatched: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

export default function YardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<DispatchRequest | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [showDriverList, setShowDriverList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // 요청 상세 불러오기
  useEffect(() => {
    const fetchRequest = async () => {
      const { data, error } = await supabase
        .from('dispatch_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('요청 조회 에러:', error);
      } else {
        setRequest(data);
      }
      setLoading(false);
    };

    fetchRequest();
  }, [id]);

  // 기사 목록 불러오기
  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, vehicle_type, status, users(name, phone)')
      .eq('status', 'available');

    if (error) {
      console.error('기사 조회 에러:', error);
    } else {
      setDrivers((data as unknown as Driver[]) || []);
    }
    setShowDriverList(true);
  };

  // 기사 배정 확정 + 결제 대기 상태로 전환
  //
  // 변경점 (Step 4 + Step 6):
  // 1. payment_status를 'awaiting_payment'로 설정 → 고객에게 결제 요청
  // 2. 플랫폼 수수료(10%), 집하장 지급액(90%) 자동 계산해서 DB에 저장
  //    (집하장 화면에는 수수료를 노출하지 않음 - 관리자만 봄)
  // 3. yard_id 저장 → 정산 시 어느 집하장에 돈 보낼지 추적
  // 4. 기사 상태 변경(busy)은 결제 완료 후로 미룸
  //    → 결제 실패/취소 시 기사가 헛되이 busy 상태로 잡히는 것 방지
  const handleAssign = async () => {
    if (!selectedDriver || !request) return;

    setAssigning(true);

    try {
      // 💰 플랫폼 수수료 계산 (내부 계산용, 집하장에겐 숨김)
      const PLATFORM_FEE_RATE = 0.1; // 10%
      const platformFee = Math.floor(request.payment_amount * PLATFORM_FEE_RATE);
      const yardPayout = request.payment_amount - platformFee;

      // 🏢 현재 로그인한 집하장 관리자의 소속 집하장 ID 조회
      // (정산 시 어느 집하장에 돈 보낼지 추적하기 위해 필수!)
      const { data: { user } } = await supabase.auth.getUser();
      let yardId: string | null = null;

      if (user) {
        const { data: managerData } = await supabase
          .from('users')
          .select('yard_id')
          .eq('id', user.id)
          .single();
        yardId = managerData?.yard_id || null;
      }

      // 배차 요청 상태 업데이트 + 결제 대기 상태 + 수수료/지급액 + 집하장 저장
      const { error: updateError } = await supabase
        .from('dispatch_requests')
        .update({
          status: 'dispatched',
          assigned_driver_id: selectedDriver,
          yard_id: yardId, // ← 이 집하장이 처리하는 주문 (정산 추적용)
          payment_status: 'awaiting_payment',
          platform_fee: platformFee,
          yard_payout: yardPayout,
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('배정 에러:', updateError);
        alert('기사 배정에 실패했습니다.');
        return;
      }

      // 배차 로그 기록 (user는 위에서 이미 조회함)
      await supabase.from('dispatch_logs').insert({
        request_id: request.id,
        status: 'dispatched',
        changed_by: user?.id,
      });

      alert('배차 확정 완료!\n고객의 결제를 기다리는 중입니다.');
      router.push('/yard');
    } catch (err) {
      console.error('에러:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">요청을 찾을 수 없습니다</p>
      </div>
    );
  }

  // 집하장에 보여줄 금액:
  // - 배차 확정 전: 예상 거래 금액 = payment_amount의 90% (수수료 떼기 전이니 추정치)
  // - 배차 확정 후: DB에 저장된 yard_payout 값 사용
  const displayAmount =
    request.status === 'requested'
      ? Math.floor(request.payment_amount * 0.9)
      : (request.yard_payout ?? Math.floor(request.payment_amount * 0.9));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">요청 상세</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 상태 배지 */}
        <div className="flex justify-between items-center">
          <span
            className={`px-3 py-1 rounded-full text-sm font-bold ${
              statusColors[request.status] || 'bg-gray-100'
            }`}
          >
            {statusLabels[request.status] || request.status}
          </span>
          <span className="text-sm text-gray-400">
            {new Date(request.created_at).toLocaleString('ko-KR')}
          </span>
        </div>

        {/* 요청 정보 카드 */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          {/* 현장 주소 */}
          <div>
            <p className="text-xs text-gray-400 mb-1">현장 주소</p>
            <p className="font-bold text-gray-800 text-lg">{request.site_address}</p>
            {request.site_detail && (
              <p className="text-sm text-gray-500 mt-1">{request.site_detail}</p>
            )}
          </div>

          {/* 폐기물 + 차량 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">폐기물 종류</p>
              <p className="font-medium">{wasteLabels[request.waste_type] || request.waste_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">차량 유형</p>
              <p className="font-medium">{vehicleLabels[request.vehicle_type] || request.vehicle_type}</p>
            </div>
          </div>

          {/* 날짜/시간 */}
          <div>
            <p className="text-xs text-gray-400 mb-1">희망 일시</p>
            <p className="font-medium">{request.requested_date} {request.requested_time}</p>
          </div>

          {/* 거래 금액 (집하장 입장에서 받을 돈 = 수수료 떼고 남는 금액) */}
          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">거래 금액</p>
              <p className="text-amber-600 font-bold text-xl">
                {displayAmount.toLocaleString()}원
              </p>
            </div>
            {request.status === 'requested' && (
              <p className="text-xs text-gray-400 mt-1 text-right">
                * 배차 확정 시 확정됩니다
              </p>
            )}
          </div>
        </div>

        {/* 기사 배정 (대기중일 때만 표시) */}
        {request.status === 'requested' && (
          <>
            {!showDriverList ? (
              <button
                onClick={fetchDrivers}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold text-lg hover:bg-blue-600"
              >
                🚛 기사 선택하기
              </button>
            ) : (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700">기사 선택</h3>

                {drivers.length === 0 ? (
                  <div className="bg-gray-50 border rounded-xl p-4 text-center">
                    <p className="text-gray-400">배정 가능한 기사가 없습니다</p>
                    <p className="text-xs text-gray-300 mt-1">
                      기사를 먼저 등록해주세요
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drivers.map((driver) => (
                      <button
                        key={driver.id}
                        onClick={() => setSelectedDriver(driver.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition ${
                          selectedDriver === driver.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold">{driver.users?.name || '이름 없음'}</p>
                            <p className="text-sm text-gray-500">{driver.users?.phone}</p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {vehicleLabels[driver.vehicle_type] || driver.vehicle_type}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 배정 확정 버튼 */}
                {selectedDriver && (
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
                      assigning
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600'
                    }`}
                  >
                    {assigning ? '배정 중...' : '✅ 배차 확정'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* 이미 배차된 경우 */}
        {request.status !== 'requested' && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-blue-700 font-medium">
                {request.status === 'dispatched' && '기사가 배정되었습니다'}
                {request.status === 'in_progress' && '작업이 진행 중입니다'}
                {request.status === 'completed' && '작업이 완료되었습니다'}
              </p>
            </div>

            {/* 결제 상태 표시 */}
            {request.status === 'dispatched' && (
              <div
                className={`rounded-xl p-4 text-center border ${
                  request.payment_status === 'paid'
                    ? 'bg-green-50 border-green-200'
                    : request.payment_status === 'awaiting_payment'
                    ? 'bg-amber-50 border-amber-200'
                    : request.payment_status === 'failed'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {request.payment_status === 'paid' && (
                  <p className="text-green-700 font-bold">✅ 결제 완료</p>
                )}
                {request.payment_status === 'awaiting_payment' && (
                  <>
                    <p className="text-amber-700 font-bold">⏳ 결제 대기중</p>
                    <p className="text-xs text-amber-600 mt-1">
                      고객의 결제를 기다리고 있습니다
                    </p>
                  </>
                )}
                {request.payment_status === 'failed' && (
                  <p className="text-red-700 font-bold">❌ 결제 실패</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}