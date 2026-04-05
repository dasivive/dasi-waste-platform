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
  payment_status: string;
  payment_amount: number;
  assigned_driver_id: string | null;
  created_at: string;
}

interface StatusLog {
  status: string;
  created_at: string;
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
  { status: 'requested', label: '배차 요청', icon: '📝', desc: '집하장에서 기사를 배정 중입니다' },
  { status: 'dispatched', label: '기사 배정', icon: '🚛', desc: '기사가 배정되었습니다' },
  { status: 'departed', label: '출발', icon: '🏃', desc: '기사가 현장으로 출발했습니다' },
  { status: 'arrived', label: '현장 도착', icon: '📍', desc: '기사가 현장에 도착했습니다' },
  { status: 'working', label: '작업중', icon: '⚙️', desc: '상차 작업 중입니다' },
  { status: 'completed', label: '완료', icon: '✅', desc: '작업이 완료되었습니다' },
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<DispatchRequest | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [currentDetailStatus, setCurrentDetailStatus] = useState('requested');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 배차 요청 정보
      const { data: reqData, error } = await supabase
        .from('dispatch_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !reqData) {
        console.error('조회 에러:', error);
        setLoading(false);
        return;
      }

      setRequest(reqData);

      // 기사 정보
      if (reqData.assigned_driver_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, phone')
          .eq('id', reqData.assigned_driver_id)
          .single();

        if (userData) {
          setDriverName(userData.name);
          setDriverPhone(userData.phone);
        }
      }

      // 상태 로그
      const { data: logs } = await supabase
        .from('dispatch_logs')
        .select('status, created_at')
        .eq('request_id', id)
        .order('created_at', { ascending: true });

      if (logs) {
        setStatusLogs(logs);
        // 세부 상태 결정
        if (reqData.status === 'completed') {
          setCurrentDetailStatus('completed');
        } else if (logs.length > 0) {
          setCurrentDetailStatus(logs[logs.length - 1].status);
        } else if (reqData.status === 'dispatched') {
          setCurrentDetailStatus('dispatched');
        } else {
          setCurrentDetailStatus('requested');
        }
      }

      setLoading(false);
    };

    fetchData();

    // 실시간 업데이트 (5초마다 새로고침)
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  // 현재까지 완료된 상태들
  const getCompletedStatuses = () => {
    const completed = ['requested'];
    if (request?.status === 'dispatched' || request?.status === 'in_progress' || request?.status === 'completed') {
      completed.push('dispatched');
    }
    statusLogs.forEach((log) => {
      if (!completed.includes(log.status)) {
        completed.push(log.status);
      }
    });
    if (request?.status === 'completed') {
      completed.push('completed');
    }
    return completed;
  };

  const completedStatuses = getCompletedStatuses();

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
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
        <p className="text-gray-400">주문을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.push('/')} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">주문 상세</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 현재 상태 배너 */}
        {request.status === 'requested' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="text-amber-800 font-bold">배차 대기중</p>
            <p className="text-sm text-amber-600 mt-1">집하장에서 기사를 배정하고 있습니다</p>
          </div>
        )}

        {request.status === 'dispatched' && driverName && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">🚛</p>
            <p className="text-blue-800 font-bold">기사가 배정되었습니다</p>
            <div className="mt-3 bg-white rounded-lg p-3">
              <p className="font-bold text-gray-800">{driverName} 기사님</p>
              {driverPhone && (
                <a href={`tel:${driverPhone}`} className="text-blue-500 text-sm mt-1 block">
                  📞 {driverPhone}
                </a>
              )}
            </div>
          </div>
        )}

        {request.status === 'in_progress' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">⚙️</p>
            <p className="text-green-800 font-bold">작업 진행중</p>
            {driverName && (
              <div className="mt-3 bg-white rounded-lg p-3">
                <p className="font-bold text-gray-800">{driverName} 기사님</p>
                {driverPhone && (
                  <a href={`tel:${driverPhone}`} className="text-blue-500 text-sm mt-1 block">
                    📞 {driverPhone}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {request.status === 'completed' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-gray-800 font-bold">작업 완료</p>
          </div>
        )}

        {/* 주문 정보 */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">폐기물</span>
            <span className="font-medium">{wasteLabels[request.waste_type] || request.waste_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">차량</span>
            <span className="font-medium">{vehicleLabels[request.vehicle_type] || request.vehicle_type}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-gray-500 text-sm">현장</span>
            <span className="font-medium text-right">
              {request.site_address}
              {request.site_detail && (
                <span className="block text-xs text-gray-400">{request.site_detail}</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">일시</span>
            <span className="font-medium">{request.requested_date} {request.requested_time}</span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="text-gray-700 font-bold">금액</span>
            <span className="text-amber-600 font-bold text-lg">
              {request.payment_amount?.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 진행 타임라인 */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-gray-700 mb-4">진행 상태</h3>
          <div className="space-y-0">
            {STATUS_FLOW.map((step, idx) => {
              const isDone = completedStatuses.includes(step.status);
              const isCurrent = step.status === currentDetailStatus;
              const log = statusLogs.find((l) => l.status === step.status);

              return (
                <div key={step.status} className="flex items-start">
                  <div className="flex flex-col items-center mr-4">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
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
                        className={`w-0.5 h-6 ${
                          isDone ? 'bg-green-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <div className="flex items-center space-x-2">
                      <p
                        className={`font-medium text-sm ${
                          isDone ? 'text-green-700' : isCurrent ? 'text-amber-700' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      {log && (
                        <span className="text-xs text-gray-300">
                          {formatTime(log.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}