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

const TEST_DRIVER_ID = '11111111-1111-1111-1111-111111111111';

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

  useEffect(() => {
    const fetchRequest = async () => {
      const { data, error } = await supabase
        .from('dispatch_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('조회 에러:', error);
      } else {
        setRequest(data);
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
      }
      setLoading(false);
    };

    fetchRequest();
  }, [id]);

  const handleNextStatus = async () => {
    const currentIndex = STATUS_FLOW.findIndex((s) => s.status === currentStatus);
    if (currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    setUpdating(true);

    try {
      const dbStatus = nextStatus.status === 'completed' ? 'completed' : 'in_progress';
      await supabase
        .from('dispatch_requests')
        .update({ status: dbStatus })
        .eq('id', id);

      await supabase.from('dispatch_logs').insert({
        request_id: id,
        status: nextStatus.status,
        changed_by: TEST_DRIVER_ID,
      });

      if (nextStatus.status === 'completed') {
        await supabase
          .from('drivers')
          .update({ status: 'available' })
          .eq('id', TEST_DRIVER_ID);
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
          <div className="flex space-x-3 mt-3">
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

        {/* 네비 버튼 */}
        {currentStatus !== 'completed' && (
          <button
            onClick={() => {
              const addr = encodeURIComponent(request.site_address);
              window.open('https://map.kakao.com/link/search/' + addr, '_blank');
            }}
            className="block w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-center text-blue-700 font-medium"
          >
            🗺️ 네비게이션 열기
          </button>
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