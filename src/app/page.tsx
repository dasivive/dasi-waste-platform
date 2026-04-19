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
  payment_amount: number;
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
  completed: 'bg-green-100 text-green-700',
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [activeRequests, setActiveRequests] = useState<DispatchRequest[]>([]);
  const [completedRequests, setCompletedRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser({ id: user.id, email: user.email || '' });
      fetchRequests(user.id);
    };
    checkUser();
  }, [router]);

  const fetchRequests = async (userId: string) => {
    setLoading(true);

    const { data: active } = await supabase
      .from('dispatch_requests')
      .select('*')
      .eq('requester_id', userId)
      .in('status', ['requested', 'dispatched', 'in_progress'])
      .order('created_at', { ascending: false });

    const { data: completed } = await supabase
      .from('dispatch_requests')
      .select('*')
      .eq('requester_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    setActiveRequests(active || []);
    setCompletedRequests(completed || []);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = dayNames[date.getDay()];
    return `${mm}/${dd}(${day})`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-amber-500 text-white px-4 py-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">다시</h1>
            <p className="text-amber-100 text-xs mt-1">폐기물 배차 플랫폼</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-amber-100 text-sm hover:text-white"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 새 배차 요청 버튼 */}
      <div className="px-4 -mt-4">
        <button
          onClick={() => {
            localStorage.removeItem('orderData');
            router.push('/order/waste');
          }}
          className="w-full bg-white rounded-xl shadow-lg p-5 flex items-center justify-between hover:shadow-xl transition-shadow"
        >
          <div>
            <p className="font-bold text-gray-800 text-lg">🚛 새 배차 요청</p>
            <p className="text-sm text-gray-400 mt-1">폐기물 수거를 요청하세요</p>
          </div>
          <span className="text-amber-500 text-2xl">→</span>
        </button>
      </div>

      {/* 탭 */}
      <div className="px-4 mt-6">
        <div className="flex space-x-2 border-b">
          <button
            onClick={() => setTab('active')}
            className={`pb-2 px-3 text-sm font-medium ${
              tab === 'active'
                ? 'text-amber-600 border-b-2 border-amber-500'
                : 'text-gray-400'
            }`}
          >
            진행중 ({activeRequests.length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`pb-2 px-3 text-sm font-medium ${
              tab === 'completed'
                ? 'text-amber-600 border-b-2 border-amber-500'
                : 'text-gray-400'
            }`}
          >
            완료 ({completedRequests.length})
          </button>
        </div>
      </div>

      {/* 주문 리스트 */}
      <div className="px-4 mt-4 space-y-3 pb-24">
        {loading ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : (tab === 'active' ? activeRequests : completedRequests).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">{tab === 'active' ? '📭' : '📋'}</p>
            <p className="text-gray-400">
              {tab === 'active' ? '진행중인 주문이 없습니다' : '완료된 주문이 없습니다'}
            </p>
          </div>
        ) : (
          (tab === 'active' ? activeRequests : completedRequests).map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/order/${req.id}`)}
              className="w-full bg-white rounded-xl border p-4 text-left hover:shadow-md transition-shadow"
            >
              {/* 상태 + 날짜 */}
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusColors[req.status] || 'bg-gray-100'
                  }`}
                >
                  {statusLabels[req.status] || req.status}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(req.requested_date)} {req.requested_time}
                </span>
              </div>

              {/* 주소 */}
              <p className="font-medium text-gray-800 mb-2">{req.site_address}</p>

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

    {/* 하단 메뉴 */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex justify-around py-3">
          <button className="flex flex-col items-center text-amber-500">
            <span className="text-lg">🏠</span>
            <span className="text-xs mt-1 font-medium">홈</span>
          </button>
          <button
            onClick={() => router.push('/order/waste')}
            className="flex flex-col items-center text-gray-400"
          >
            <span className="text-lg">📝</span>
            <span className="text-xs mt-1">주문내역</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-lg">👤</span>
            <span className="text-xs mt-1">마이페이지</span>
          </button>
        </div>
      </div>
    </div>
  );
}