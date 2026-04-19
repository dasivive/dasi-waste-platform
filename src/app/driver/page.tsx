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
  dispatched: '배차됨',
  in_progress: '진행중',
  completed: '완료',
};

const statusColors: Record<string, string> = {
  dispatched: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

export default function DriverPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // 로그인 확인
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      // 역할 확인 — 기사가 아니면 접근 차단
      const { data: userData } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', authUser.id)
        .single();

      if (!userData || userData.role !== 'driver') {
        alert('기사 계정으로만 접근 가능합니다.');
        router.push('/');
        return;
      }

      setUser({ id: authUser.id, name: userData.name || '기사' });
      fetchMyRequests(authUser.id);
    };
    checkUser();
  }, [router]);

  // 기사에게 배정된 요청 불러오기
  const fetchMyRequests = async (driverId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('dispatch_requests')
      .select('*')
      .eq('assigned_driver_id', driverId)
      .in('status', ['dispatched', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('배차 조회 에러:', error);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  // 날짜 포맷
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
      <div className="bg-white border-b px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">🚛 내 배차</h1>
            <p className="text-xs text-gray-400 mt-1">{user.name}님</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 text-sm hover:text-gray-600"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 배차 리스트 */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400 font-medium">배정된 배차가 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">새 배차가 오면 여기에 표시됩니다</p>
          </div>
        ) : (
          requests.map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/driver/${req.id}`)}
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
              <p className="font-bold text-gray-800 text-lg mb-1">
                {req.site_address}
              </p>
              {req.site_detail && (
                <p className="text-sm text-gray-400 mb-2">{req.site_detail}</p>
              )}

              {/* 폐기물 + 차량 */}
              <div className="flex space-x-2">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                  {wasteLabels[req.waste_type] || req.waste_type}
                </span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                  {vehicleLabels[req.vehicle_type] || req.vehicle_type}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 새로고침 버튼 */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => user && fetchMyRequests(user.id)}
          className="w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-amber-600"
        >
          🔄
        </button>
      </div>
    </div>
  );
}