'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface DispatchRequest {
  id: string;
  site_address: string;
  site_detail: string;
  latitude: number | null;
  longitude: number | null;
  waste_type: string;
  vehicle_type: string;
  requested_date: string;
  requested_time: string;
  status: string;
  payment_amount: number;
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

const STATUS_FLOW = [
  { status: 'dispatched', label: '배차됨', icon: '📋', desc: '배차가 배정되었습니다' },
  { status: 'departed', label: '출발', icon: '🚛', desc: '현장으로 출발합니다' },
  { status: 'arrived', label: '도착', icon: '📍', desc: '현장에 도착했습니다' },
  { status: 'working', label: '작업중', icon: '⚙️', desc: '상차 작업 중입니다' },
  { status: 'completed', label: '완료', icon: '✅', desc: '작업이 완료되었습니다' },
];

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<DispatchRequest | null>(null);
  const [currentStatus, setCurrentStatus] = useState('dispatched');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusHistory, setStatusHistory] = useState<string[]>(['dispatched']);
  const [driverId, setDriverId] = useState<string | null>(null); // 현재 로그인한 기사 ID
  const [showNavMenu, setShowNavMenu] = useState(false); // 네비 선택 메뉴 표시 여부

  useEffect(() => {
    const fetchData = async () => {
      // 1. 로그인한 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 2. 기사 역할인지 확인
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userData?.role !== 'driver') {
        alert('기사만 접근 가능합니다');
        router.push('/');
        return;
      }

      setDriverId(user.id);

      // 3. 배차 정보 조회
      const { data, error } = await supabase
        .from('dispatch_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('조회 에러:', error);
        setLoading(false);
        return;
      }

      setRequest(data);

      // 4. 진행 상태 확인
      if (data.status === 'in_progress') {
        const { data: logs } = await supabase
          .from('dispatch_logs')
          .select('status')
          .eq('request_id', id)
          .order('created_at', { ascending: true });

        if (logs && logs.length > 0) {
          const statuses = logs.map((l) => l.status);
          setStatusHistory(['dispatched', ...statuses]);
          setCurrentStatus(statuses[statuses.length - 1]);
        }
      } else if (data.status === 'completed') {
        setCurrentStatus('completed');
        setStatusHistory(STATUS_FLOW.map((s) => s.status));
      } else {
        setCurrentStatus(data.status);
      }

      setLoading(false);
    };

    fetchData();
  }, [id, router]);

  // 다음 상태로 변경
  const handleNextStatus = async () => {
    if (!driverId) return;

    const currentIndex = STATUS_FLOW.findIndex((s) => s.status === currentStatus);
    if (currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    setUpdating(true);

    try {
      // 완료면 status='completed', 아니면 'in_progress'
      const dbStatus = nextStatus.status === 'completed' ? 'completed' : 'in_progress';
      await supabase
        .from('dispatch_requests')
        .update({ status: dbStatus })
        .eq('id', id);

      // 상태 변경 로그 저장 (실제 로그인한 기사 ID로!)
      await supabase.from('dispatch_logs').insert({
        request_id: id,
        status: nextStatus.status,
        changed_by: driverId,
      });

      // 완료 시 기사 상태 available로 변경 (실제 로그인한 기사 ID로!)
      if (nextStatus.status === 'completed') {
        await supabase
          .from('drivers')
          .update({ status: 'available' })
          .eq('id', driverId);
      }

      setCurrentStatus(nextStatus.status);
      setStatusHistory([...statusHistory, nextStatus.status]);

      if (nextStatus.status === 'completed') {
        alert('작업이 완료되었습니다!');
        router.push('/driver');
      }
    } catch (err) {
      console.error('상태 변경 에러:', err);
      alert('상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  // 카카오맵으로 길안내 열기
  const openKakaoNavi = () => {
    if (!request) return;

    // 좌표가 있으면 좌표 기반 길안내, 없으면 주소 검색
    if (request.latitude && request.longitude) {
      // 카카오맵 길찾기 (현재 위치 → 목적지)
      const url = `https://map.kakao.com/link/to/${encodeURIComponent(
        request.site_address
      )},${request.latitude},${request.longitude}`;
      window.open(url, '_blank');
    } else {
      // 좌표가 없으면 주소 검색
      const url = `https://map.kakao.com/link/search/${encodeURIComponent(
        request.site_address
      )}`;
      window.open(url, '_blank');
    }
    setShowNavMenu(false);
  };

  // 티맵으로 길안내 열기
  const openTmap = () => {
    if (!request) return;

    if (request.latitude && request.longitude) {
      // 티맵 URL 스킴 (모바일에서 앱 자동 실행)
      const url = `tmap://route?goalname=${encodeURIComponent(
        request.site_address
      )}&goalx=${request.longitude}&goaly=${request.latitude}`;
      window.location.href = url;

      // 앱이 설치 안 되어 있을 경우 대비 (웹 버전)
      setTimeout(() => {
        window.open(
          `https://tmap.life/?goalname=${encodeURIComponent(request.site_address)}`,
          '_blank'
        );
      }, 1500);
    } else {
      window.open(
        `https://tmap.life/?goalname=${encodeURIComponent(request.site_address)}`,
        '_blank'
      );
    }
    setShowNavMenu(false);
  };

  const getNextStatus = () => {
    const currentIndex = STATUS_FLOW.findIndex((s) => s.status === currentStatus);
    if (currentIndex >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[currentIndex + 1];
  };

  const getButtonColor = () => {
    const next = getNextStatus();
    if (!next) return '';
    switch (next.status) {
      case 'departed': return 'bg-blue-500 hover:bg-blue-600';
      case 'arrived': return 'bg-purple-500 hover:bg-purple-600';
      case 'working': return 'bg-amber-500 hover:bg-amber-600';
      case 'completed': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-gray-500';
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
        <p className="text-gray-400">배차를 찾을 수 없습니다</p>
      </div>
    );
  }

  const nextStatus = getNextStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.push('/driver')} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">배차 상세</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 현장 정보 카드 */}
        <div className="bg-white rounded-xl border p-5">
          <p className="font-bold text-gray-800 text-lg">{request.site_address}</p>
          {request.site_detail && (
            <p className="text-sm text-gray-500 mt-1">{request.site_detail}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
              {wasteLabels[request.waste_type] || request.waste_type}
            </span>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
              {vehicleLabels[request.vehicle_type] || request.vehicle_type}
            </span>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
              {request.requested_date} {request.requested_time}
            </span>
          </div>
        </div>

        {/* 네비 버튼 (완료 전까지만 표시) */}
        {currentStatus !== 'completed' && (
          <div className="space-y-2">
            {!showNavMenu ? (
              <button
                onClick={() => setShowNavMenu(true)}
                className="w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-center text-blue-700 font-medium hover:bg-blue-100"
              >
                🗺️ 네비게이션 열기
              </button>
            ) : (
              <div className="bg-white border rounded-xl p-3 space-y-2">
                <p className="text-sm text-gray-600 font-medium px-2 pt-1">
                  어떤 네비로 열까요?
                </p>
                <button
                  onClick={openKakaoNavi}
                  className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 rounded-lg text-gray-900 font-bold flex items-center justify-center space-x-2"
                >
                  <span>🗺️</span>
                  <span>카카오맵으로 길안내</span>
                </button>
                <button
                  onClick={openTmap}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg text-white font-bold flex items-center justify-center space-x-2"
                >
                  <span>🧭</span>
                  <span>티맵으로 길안내</span>
                </button>
                <button
                  onClick={() => setShowNavMenu(false)}
                  className="w-full py-2 text-gray-500 text-sm"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        )}

        {/* 진행 상태 타임라인 */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-gray-700 mb-4">진행 상태</h3>
          <div className="space-y-0">
            {STATUS_FLOW.map((step, idx) => {
              const isDone = statusHistory.includes(step.status);
              const isCurrent = step.status === currentStatus;

              return (
                <div key={step.status} className="flex items-start">
                  <div className="flex flex-col items-center mr-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        isDone
                          ? 'bg-green-100'
                          : isCurrent
                          ? 'bg-amber-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      {step.icon}
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                      <div
                        className={`w-0.5 h-8 ${
                          isDone ? 'bg-green-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-2">
                    <p
                      className={`font-medium ${
                        isDone
                          ? 'text-green-700'
                          : isCurrent
                          ? 'text-amber-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 다음 상태 버튼 */}
        {nextStatus && (
          <button
            onClick={handleNextStatus}
            disabled={updating}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
              updating ? 'bg-gray-400 cursor-not-allowed' : getButtonColor()
            }`}
          >
            {updating
              ? '처리 중...'
              : `${nextStatus.icon} ${nextStatus.label}`}
          </button>
        )}
      </div>
    </div>
  );
}