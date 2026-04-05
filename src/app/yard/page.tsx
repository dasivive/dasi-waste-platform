'use client';

import { useState, useEffect } from 'react';
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
  created_at: string;
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
  completed: 'bg-gray-100 text-gray-500',
};

export default function YardListPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'requested' | 'dispatched' | 'in_progress'>('all');

  // 배차 요청 목록 불러오기
  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('dispatch_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('요청 목록 에러:', error);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[date.getDay()];
    return `${mm}/${dd}(${day})`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold">📋 배차 요청 목록</h1>
        <p className="text-xs text-gray-400 mt-1">집하장 관리</p>
      </div>

      {/* 필터 탭 */}
      <div className="bg-white border-b px-4 py-2 flex space-x-2 overflow-x-auto">
        {[
          { key: 'all', label: '전체' },
          { key: 'requested', label: '대기중' },
          { key: 'dispatched', label: '배차완료' },
          { key: 'in_progress', label: '진행중' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
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

      {/* 요청 리스트 */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : requests.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            요청이 없습니다
          </div>
        ) : (
          requests.map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/yard/${req.id}`)}
              className="w-full bg-white rounded-xl border p-4 text-left hover:shadow-md transition-shadow"
            >
              {/* 상태 + 날짜 */}
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusColors[req.status] || 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {statusLabels[req.status] || req.status}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(req.requested_date)} {req.requested_time}
                </span>
              </div>

              {/* 주소 */}
              <p className="font-medium text-gray-800 mb-1">
                {req.site_address}
              </p>
              {req.site_detail && (
                <p className="text-sm text-gray-400 mb-2">{req.site_detail}</p>
              )}

              {/* 폐기물 + 차량 + 금액 */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                    {wasteLabels[req.waste_type] || req.waste_type}
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                    {vehicleLabels[req.vehicle_type] || req.vehicle_type}
                  </span>
                </div>
                <span className="text-amber-600 font-bold text-sm">
                  {req.payment_amount?.toLocaleString()}원
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={fetchRequests}
          className="w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-amber-600"
        >
          🔄
        </button>
      </div>
    </div>
  );
}