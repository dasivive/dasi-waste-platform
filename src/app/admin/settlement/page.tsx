'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ============================================================
// 관리자 정산 화면 (A03)
// ============================================================
// 개념 정리:
// - payment_status: 고객 → 다시 방향의 결제 상태 (돈이 들어옴)
// - payout_status:  다시 → 집하장 방향의 정산 상태 (돈이 나감)
//
// 이 화면은 주로 payout_status를 관리합니다.
// (= 고객이 결제한 돈 중 집하장에 아직 안 준 것을 찾아서 송금 처리)
// ============================================================

interface DispatchRequest {
  id: string;
  site_address: string;
  waste_type: string;
  vehicle_type: string;
  requested_date: string;
  requested_time: string;
  status: string;
  payment_status: string;
  payment_amount: number;
  platform_fee: number | null;
  yard_payout: number | null;
  payout_status: string | null;
  payout_date: string | null;
  paid_at: string | null;
  assigned_driver_id: string | null;
  yard_id: string | null;
  created_at: string;
  // 추가 조회 필드
  driver_name?: string;
  yard_name?: string;
}

const wasteLabels: Record<string, string> = {
  mixed: '혼합',
  wood: '나무',
  concrete: '폐콘',
  metal: '고철',
};

const vehicleLabels: Record<string, string> = {
  '2.5ton': '2.5톤',
  grab: '집게차',
};

// 필터 타입
type FilterType = 'pending_payout' | 'paid_payout' | 'all_paid';

export default function SettlementPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('pending_payout');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null); // 처리 중인 id

  // 관리자 권한 확인
  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return false;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      alert('관리자만 접근 가능합니다');
      router.push('/');
      return false;
    }

    return true;
  }

  const fetchRequests = async () => {
    setLoading(true);

    // 결제 완료된 건만 (고객이 돈 낸 것만 정산 대상)
    let query = supabase
      .from('dispatch_requests')
      .select('*')
      .eq('payment_status', 'paid')
      .order('paid_at', { ascending: false });

    // 필터에 따라 추가 조건
    if (filter === 'pending_payout') {
      query = query.or('payout_status.is.null,payout_status.eq.pending');
    } else if (filter === 'paid_payout') {
      query = query.eq('payout_status', 'paid');
    }
    // 'all_paid'는 추가 필터 없음 (결제 완료 전체)

    const { data, error } = await query;

    if (error) {
      console.error('정산 조회 에러:', error);
      setLoading(false);
      return;
    }

    // 각 건별로 기사명 + 집하장명 조회
    const enriched: DispatchRequest[] = [];
    for (const req of data || []) {
      // 기사명
      let driverName = '미배정';
      if (req.assigned_driver_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', req.assigned_driver_id)
          .single();
        driverName = userData?.name || '알 수 없음';
      }

      // 집하장명
      let yardName = '미지정';
      if (req.yard_id) {
        const { data: yardData } = await supabase
          .from('yards')
          .select('name')
          .eq('id', req.yard_id)
          .single();
        yardName = yardData?.name || '알 수 없음';
      }

      enriched.push({
        ...req,
        driver_name: driverName,
        yard_name: yardName,
      });
    }

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    checkAdmin().then((ok) => {
      if (ok) setIsAuthorized(true);
    });
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [filter, isAuthorized]);

  // 집하장 지급 완료 처리
  const handlePayout = async (id: string) => {
    if (!confirm('이 건을 집하장에 지급 완료로 처리하시겠습니까?\n(은행 이체를 완료한 뒤 클릭해주세요)')) {
      return;
    }

    setProcessing(id);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { error } = await supabase
      .from('dispatch_requests')
      .update({
        payout_status: 'paid',
        payout_date: today,
      })
      .eq('id', id);

    if (error) {
      console.error('지급 처리 에러:', error);
      alert('지급 처리에 실패했습니다.');
    } else {
      alert('지급 처리가 완료되었습니다.');
      fetchRequests();
    }

    setProcessing(null);
  };

  // 지급 완료 취소 (실수로 눌렀을 때)
  const handleCancelPayout = async (id: string) => {
    if (!confirm('지급 완료 상태를 취소하시겠습니까?')) return;

    setProcessing(id);

    const { error } = await supabase
      .from('dispatch_requests')
      .update({
        payout_status: 'pending',
        payout_date: null,
      })
      .eq('id', id);

    if (error) {
      alert('취소 처리에 실패했습니다.');
    } else {
      fetchRequests();
    }

    setProcessing(null);
  };

  // ==========================================================
  // 수익 지표 계산 (대시보드용)
  // ==========================================================
  // 이번 달 시작일 (매월 1일)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  // 이번 달 결제 완료된 건들
  const thisMonthPaid = requests.filter((r) => {
    if (!r.paid_at) return false;
    return new Date(r.paid_at) >= thisMonthStart;
  });

  // 이번 달 총 결제액 (고객이 낸 돈)
  const thisMonthRevenue = thisMonthPaid.reduce(
    (sum, r) => sum + (r.payment_amount || 0),
    0
  );

  // 이번 달 다시 수수료 수익 (10%)
  const thisMonthFee = thisMonthPaid.reduce(
    (sum, r) => sum + (r.platform_fee || 0),
    0
  );

  // 이번 달 집하장 지급액 (90%)
  const thisMonthPayout = thisMonthPaid.reduce(
    (sum, r) => sum + (r.yard_payout || 0),
    0
  );

  // 미지급 총액 (집하장에 줘야 할 돈)
  const pendingPayoutTotal = requests
    .filter((r) => !r.payout_status || r.payout_status === 'pending')
    .reduce((sum, r) => sum + (r.yard_payout || 0), 0);

  const pendingPayoutCount = requests.filter(
    (r) => !r.payout_status || r.payout_status === 'pending'
  ).length;

  // 집하장별 미지급 금액 그룹
  const yardGroupedPending: Record<string, { total: number; count: number }> = {};
  requests
    .filter((r) => !r.payout_status || r.payout_status === 'pending')
    .forEach((r) => {
      const yardName = r.yard_name || '미지정';
      if (!yardGroupedPending[yardName]) {
        yardGroupedPending[yardName] = { total: 0, count: 0 };
      }
      yardGroupedPending[yardName].total += r.yard_payout || 0;
      yardGroupedPending[yardName].count += 1;
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return `${mm}/${dd}`;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-gray-800 text-white px-4 py-4">
        <h1 className="text-lg font-bold">⚙️ 관리자 정산</h1>
        <p className="text-gray-400 text-xs mt-1">DASI 폐기물 배차 플랫폼</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white border-b px-4 py-2 flex space-x-4">
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-400 pb-1"
        >
          가격 설정
        </button>
        <button
          onClick={() => router.push('/admin/yards')}
          className="text-sm text-gray-400 pb-1"
        >
          집하장 관리
        </button>
        <button className="text-sm font-bold text-amber-600 border-b-2 border-amber-500 pb-1">
          정산 관리
        </button>
      </div>

      {/* ============================================================ */}
      {/* 이번달 수익 대시보드 (다시의 핵심 지표)                        */}
      {/* ============================================================ */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl text-white p-5 shadow-lg">
          <p className="text-xs opacity-80">이번 달 다시 수익</p>
          <p className="text-3xl font-bold mt-1">
            {thisMonthFee.toLocaleString()}원
          </p>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-70 text-xs">총 결제액</p>
              <p className="font-bold">{thisMonthRevenue.toLocaleString()}원</p>
            </div>
            <div>
              <p className="opacity-70 text-xs">집하장 지급액</p>
              <p className="font-bold">{thisMonthPayout.toLocaleString()}원</p>
            </div>
          </div>
          <p className="text-xs opacity-70 mt-2">
            총 {thisMonthPaid.length}건 · {thisMonthStart.getMonth() + 1}월
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 집하장별 미지급 요약 (송금 시 참고용)                          */}
      {/* ============================================================ */}
      {Object.keys(yardGroupedPending).length > 0 && (
        <div className="px-4 pb-2">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-red-800 text-sm">
                🔔 지급 대기 중인 정산
              </p>
              <p className="text-red-700 font-bold">
                총 {pendingPayoutTotal.toLocaleString()}원 ({pendingPayoutCount}건)
              </p>
            </div>
            <div className="space-y-1 mt-3">
              {Object.entries(yardGroupedPending).map(([yardName, info]) => (
                <div
                  key={yardName}
                  className="flex justify-between text-sm bg-white rounded p-2"
                >
                  <span className="text-gray-700">{yardName}</span>
                  <span className="font-medium text-red-600">
                    {info.total.toLocaleString()}원 ({info.count}건)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="px-4 mt-2 flex space-x-2 overflow-x-auto">
        {[
          { key: 'pending_payout' as FilterType, label: '지급 대기', color: 'red' },
          { key: 'paid_payout' as FilterType, label: '지급 완료', color: 'green' },
          { key: 'all_paid' as FilterType, label: '전체 결제', color: 'gray' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === tab.key
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 거래 리스트 */}
      <div className="p-4 space-y-2">
        {loading ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border">
            <p className="text-gray-400 mb-1">
              {filter === 'pending_payout' && '지급 대기 중인 거래가 없습니다'}
              {filter === 'paid_payout' && '지급 완료된 거래가 없습니다'}
              {filter === 'all_paid' && '결제 완료된 거래가 없습니다'}
            </p>
            <p className="text-xs text-gray-300">
              결제가 완료된 건들만 정산 대상입니다
            </p>
          </div>
        ) : (
          requests.map((req) => {
            const isPaidPayout = req.payout_status === 'paid';
            const isPending = !req.payout_status || req.payout_status === 'pending';

            return (
              <div
                key={req.id}
                className={`bg-white rounded-xl border p-4 ${
                  isPending ? 'border-red-200' : ''
                }`}
              >
                {/* 상단: 상태 + 집하장 + 날짜 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {isPaidPayout ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        ✅ 지급 완료
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        ⏳ 지급 대기
                      </span>
                    )}
                    <span className="text-xs text-blue-600 font-medium">
                      🏢 {req.yard_name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    결제: {formatDateTime(req.paid_at)}
                  </span>
                </div>

                {/* 현장 정보 */}
                <div className="mb-3">
                  <p className="font-medium text-gray-800 text-sm">
                    {req.site_address}
                  </p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {wasteLabels[req.waste_type] || req.waste_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {vehicleLabels[req.vehicle_type] || req.vehicle_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      기사: {req.driver_name}
                    </span>
                  </div>
                </div>

                {/* 금액 상세 */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">고객 결제액</span>
                    <span className="font-medium">
                      {req.payment_amount?.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>└ 다시 수수료 (10%)</span>
                    <span className="font-medium">
                      +{(req.platform_fee || 0).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-bold">
                      집하장 지급액
                    </span>
                    <span className="text-blue-600 font-bold">
                      {(req.yard_payout || 0).toLocaleString()}원
                    </span>
                  </div>
                  {isPaidPayout && req.payout_date && (
                    <div className="flex justify-between text-xs text-green-600 pt-1">
                      <span>지급일</span>
                      <span>{req.payout_date}</span>
                    </div>
                  )}
                </div>

                {/* 버튼 */}
                <div className="mt-3">
                  {isPending ? (
                    <button
                      onClick={() => handlePayout(req.id)}
                      disabled={processing === req.id}
                      className={`w-full py-2 rounded-lg font-medium text-sm ${
                        processing === req.id
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {processing === req.id
                        ? '처리 중...'
                        : '💸 집하장에 지급 완료 처리'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCancelPayout(req.id)}
                      disabled={processing === req.id}
                      className="w-full py-2 rounded-lg font-medium text-sm text-gray-500 hover:text-red-600 border border-gray-200"
                    >
                      {processing === req.id ? '처리 중...' : '지급 완료 취소'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 여백 */}
      <div className="h-8"></div>
    </div>
  );
}