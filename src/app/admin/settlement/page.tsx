'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
  assigned_driver_id: string | null;
  created_at: string;
  driver_name?: string;
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

const paymentLabels: Record<string, string> = {
  pending: '미정산',
  paid: '정산완료',
  failed: '실패',
};

const paymentColors: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-gray-100 text-gray-500',
};

export default function SettlementPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [isAuthorized, setIsAuthorized] = useState(false);

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
    let query = supabase
      .from('dispatch_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'pending') {
      query = query.eq('payment_status', 'pending');
    } else if (filter === 'paid') {
      query = query.eq('payment_status', 'paid');
    }

    const { data, error } = await query;

    if (error) {
      console.error('정산 조회 에러:', error);
      setLoading(false);
      return;
    }

    // 기사 이름 가져오기
    const requestsWithDriver: DispatchRequest[] = [];
    for (const req of data || []) {
      if (req.assigned_driver_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', req.assigned_driver_id)
          .single();
        requestsWithDriver.push({
          ...req,
          driver_name: userData?.name || '알 수 없음',
        });
      } else {
        requestsWithDriver.push({ ...req, driver_name: '미배정' });
      }
    }

    setRequests(requestsWithDriver);
    setLoading(false);
  };

  // 최초 진입 시 권한 체크
  useEffect(() => {
    checkAdmin().then((ok) => {
      if (ok) setIsAuthorized(true);
    });
  }, []);

  // 권한 확인된 후, 필터가 바뀔 때마다 목록 조회
  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [filter, isAuthorized]);

  // 정산 처리
  const handleSettle = async (id: string) => {
    if (!confirm('이 건을 정산 완료 처리하시겠습니까?')) return;

    const { error } = await supabase
      .from('dispatch_requests')
      .update({ payment_status: 'paid' })
      .eq('id', id);

    if (error) {
      console.error('정산 에러:', error);
      alert('정산 처리에 실패했습니다.');
    } else {
      fetchRequests();
    }
  };

  // 총 금액 계산
  const totalAmount = requests.reduce((sum, r) => sum + (r.payment_amount || 0), 0);
  const pendingAmount = requests
    .filter((r) => r.payment_status === 'pending')
    .reduce((sum, r) => sum + (r.payment_amount || 0), 0);
  const paidAmount = requests
    .filter((r) => r.payment_status === 'paid')
    .reduce((sum, r) => sum + (r.payment_amount || 0), 0);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return `${mm}/${dd}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-gray-800 text-white px-4 py-4">
        <h1 className="text-lg font-bold">⚙️ 관리자</h1>
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

      {/* 요약 카드 */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xs text-gray-400">전체</p>
          <p className="text-lg font-bold text-gray-800">
            {totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xs text-red-400">미정산</p>
          <p className="text-lg font-bold text-red-600">
            {pendingAmount.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-xs text-green-400">정산완료</p>
          <p className="text-lg font-bold text-green-600">
            {paidAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 필터 */}
      <div className="px-4 mt-4 flex space-x-2">
        {[
          { key: 'all', label: '전체' },
          { key: 'pending', label: '미정산' },
          { key: 'paid', label: '정산완료' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${
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
          <div className="text-center py-10">
            <p className="text-gray-400">거래 내역이 없습니다</p>
          </div>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        paymentColors[req.payment_status] || 'bg-gray-100'
                      }`}
                    >
                      {paymentLabels[req.payment_status] || req.payment_status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(req.requested_date)}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{req.site_address}</p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {wasteLabels[req.waste_type] || req.waste_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {vehicleLabels[req.vehicle_type] || req.vehicle_type}
                    </span>
                    <span className="text-xs text-blue-500 font-medium">
                      기사: {req.driver_name}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-amber-600 font-bold">
                    {req.payment_amount?.toLocaleString()}원
                  </p>
                  {req.payment_status === 'pending' && (
                    <button
                      onClick={() => handleSettle(req.id)}
                      className="text-xs text-blue-500 mt-1 hover:text-blue-700"
                    >
                      정산처리
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}