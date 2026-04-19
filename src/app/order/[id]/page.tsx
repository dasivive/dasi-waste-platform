'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requestPayment } from '@/lib/portone';

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
  payment_status: string;
  payment_amount: number;
  payment_id: string | null;      // PortOne 결제 고유 ID
  paid_at: string | null;          // 결제 완료 시각
  platform_fee: number | null;     // 다시 수수료 (내부용, 고객엔 안 보임)
  yard_payout: number | null;      // 집하장 지급액 (내부용, 고객엔 안 보임)
  assigned_driver_id: string | null;
  created_at: string;
  driver_latitude: number | null;
  driver_longitude: number | null;
  driver_location_updated_at: string | null;
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

const MAP_VISIBLE_STATUSES = ['departed', 'arrived', 'working'];

declare global {
  interface Window {
    kakao: any;
  }
}

function PhoneLink({ phone }: { phone: string }) {
  const href = 'tel:' + phone;
  return (
    <a href={href} className="text-blue-500 text-sm mt-1 block">
      📞 {phone}
    </a>
  );
}

// 두 좌표 사이 거리(미터) 계산. null이 들어오면 0 반환.
function getDistanceMeters(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return 0;
  }
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<DispatchRequest | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [currentDetailStatus, setCurrentDetailStatus] = useState('requested');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false); // 결제 진행 중 여부

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const siteMarkerRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
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

      const { data: logs } = await supabase
        .from('dispatch_logs')
        .select('status, created_at')
        .eq('request_id', id)
        .order('created_at', { ascending: true });

      if (logs) {
        setStatusLogs(logs);
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

    // Realtime 구독: dispatch_requests 테이블의 이 주문이 바뀔 때마다 자동 업데이트
    const channel = supabase
      .channel('order-' + id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dispatch_requests',
          filter: 'id=eq.' + id,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispatch_logs',
          filter: 'request_id=eq.' + id,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // ==========================================================
  // 결제 처리 함수 (Step 5 - 핵심!)
  // ==========================================================
  // 1. 로그인된 사용자 정보 조회
  // 2. PortOne 결제창 호출
  // 3. 결제 성공 시 DB 업데이트 + 기사 busy 상태 변경
  // 4. 결제 실패 시 에러 메시지 표시
  const handlePayment = async () => {
    if (!request) return;
    if (paying) return; // 중복 클릭 방지

    setPaying(true);

    try {
      // 1. 현재 로그인한 고객 정보 조회 (결제창에 이름 넣기 위해)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('name, phone')
        .eq('id', user.id)
        .single();

      const customerName = userData?.name || '고객';
      const customerPhone = userData?.phone || undefined;

      // 2. 주문명 생성 (결제창에 표시될 내용)
      const orderName =
        (wasteLabels[request.waste_type] || request.waste_type) +
        ' ' +
        (vehicleLabels[request.vehicle_type] || request.vehicle_type);

      // 3. PortOne 결제창 호출
      const result = await requestPayment({
        orderId: request.id,
        orderName: orderName,
        amount: request.payment_amount,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: user.email,
      });

      // 4. 결제 실패 (사용자가 취소했거나 카드 거절)
      if (!result.success) {
        alert('결제가 완료되지 않았습니다.\n' + (result.errorMessage || ''));
        setPaying(false);
        return;
      }

      // 5. 결제 성공 → DB 업데이트
      const { error: updateError } = await supabase
        .from('dispatch_requests')
        .update({
          payment_status: 'paid',
          payment_id: result.paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('DB 업데이트 실패:', updateError);
        alert('결제는 완료되었지만 저장에 실패했습니다. 관리자에게 문의해주세요.');
        setPaying(false);
        return;
      }

      // 6. 기사 상태를 busy로 변경 (이제야 배차 확정)
      if (request.assigned_driver_id) {
        await supabase
          .from('drivers')
          .update({ status: 'busy' })
          .eq('id', request.assigned_driver_id);
      }

      // 7. 결제 로그 기록 (타임라인 추적용)
      await supabase.from('dispatch_logs').insert({
        request_id: request.id,
        status: 'paid',
        changed_by: user.id,
      });

      alert('결제가 완료되었습니다!\n기사가 곧 출발할 예정입니다.');

      // Realtime이 자동으로 UI를 업데이트해줌 (별도 새로고침 불필요)
    } catch (err) {
      console.error('결제 처리 오류:', err);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    if (!MAP_VISIBLE_STATUSES.includes(currentDetailStatus)) return;
    if (!request) return;
    if (!request.latitude || !request.longitude) return;
    if (!mapContainerRef.current) return;

    const siteLat = request.latitude;
    const siteLng = request.longitude;
    const driverLat = request.driver_latitude;
    const driverLng = request.driver_longitude;

    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) return;
      if (!mapContainerRef.current) return;

      window.kakao.maps.load(() => {
        const kakao = window.kakao;

        if (!mapInstanceRef.current) {
          const options = {
            center: new kakao.maps.LatLng(siteLat, siteLng),
            level: 4,
          };
          mapInstanceRef.current = new kakao.maps.Map(mapContainerRef.current, options);

          const sitePosition = new kakao.maps.LatLng(siteLat, siteLng);
          siteMarkerRef.current = new kakao.maps.Marker({
            position: sitePosition,
            map: mapInstanceRef.current,
          });
        }

        if (driverLat && driverLng) {
          const driverPosition = new kakao.maps.LatLng(driverLat, driverLng);

          const svgString =
            '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#3B82F6" stroke="white" stroke-width="3"/><text x="24" y="31" text-anchor="middle" font-size="22">🚛</text></svg>';
          const imageSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
          const imageSize = new kakao.maps.Size(48, 48);
          const imageOption = { offset: new kakao.maps.Point(24, 24) };
          const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

          if (driverMarkerRef.current) {
            driverMarkerRef.current.setPosition(driverPosition);
          } else {
            driverMarkerRef.current = new kakao.maps.Marker({
              position: driverPosition,
              map: mapInstanceRef.current,
              image: markerImage,
            });
          }

          const bounds = new kakao.maps.LatLngBounds();
          const sitePos = new kakao.maps.LatLng(siteLat, siteLng);
          bounds.extend(sitePos);
          bounds.extend(driverPosition);

          const distance = getDistanceMeters(siteLat, siteLng, driverLat, driverLng);
          if (distance > 50 && mapInstanceRef.current) {
            mapInstanceRef.current.setBounds(bounds);
          }
        }
      });
    };

    if (window.kakao && window.kakao.maps) {
      initMap();
      return;
    }

    const existingScript = document.getElementById('kakao-map-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', initMap);
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-map-sdk';
    script.async = true;
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + kakaoKey + '&autoload=false';
    script.onload = initMap;
    document.head.appendChild(script);
  }, [currentDetailStatus, request]);

  const getSecondsSinceUpdate = (updatedAt: string | null) => {
    if (!updatedAt) return null;
    const updated = new Date(updatedAt).getTime();
    const now = new Date().getTime();
    return Math.floor((now - updated) / 1000);
  };

  const getTimeAgoText = (seconds: number | null) => {
    if (seconds === null) return '';
    if (seconds < 60) return seconds + '초 전';
    if (seconds < 3600) return Math.floor(seconds / 60) + '분 전';
    return '오래 전';
  };

  const getCompletedStatuses = () => {
    const completed = ['requested'];
    if (
      request?.status === 'dispatched' ||
      request?.status === 'in_progress' ||
      request?.status === 'completed'
    ) {
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

  const showMap =
    MAP_VISIBLE_STATUSES.includes(currentDetailStatus) &&
    request.latitude &&
    request.longitude;

  const secondsAgo = getSecondsSinceUpdate(request.driver_location_updated_at);
  const hasRecentLocation =
    request.driver_latitude &&
    request.driver_longitude &&
    secondsAgo !== null &&
    secondsAgo < 120;

  // 결제 버튼을 보여줄 조건:
  // - 배차가 확정됨 (status === 'dispatched')
  // - 결제가 아직 안 됨 (payment_status === 'awaiting_payment')
  const showPaymentButton =
    request.status === 'dispatched' &&
    request.payment_status === 'awaiting_payment';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.push('/')} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">주문 상세</h1>
      </div>

      <div className="p-4 space-y-4">
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
              {driverPhone && <PhoneLink phone={driverPhone} />}
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
                {driverPhone && <PhoneLink phone={driverPhone} />}
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

        {/* ========================================================== */}
        {/* 결제하기 버튼 (Step 5 핵심) */}
        {/* 배차 확정 + 결제 대기 상태에서만 표시 */}
        {/* ========================================================== */}
        {showPaymentButton && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5 space-y-3">
            <div className="text-center">
              <p className="text-2xl mb-1">💳</p>
              <p className="font-bold text-amber-900 text-lg">결제를 진행해주세요</p>
              <p className="text-xs text-amber-700 mt-1">
                결제 완료 후 기사가 출발합니다
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 flex justify-between items-center">
              <span className="text-gray-600">결제 금액</span>
              <span className="text-amber-600 font-bold text-xl">
                {request.payment_amount?.toLocaleString()}원
              </span>
            </div>
            <button
              onClick={handlePayment}
              disabled={paying}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
                paying
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {paying ? '결제 진행 중...' : '💳 결제하기'}
            </button>
          </div>
        )}

        {/* 결제 완료 배지 */}
        {request.payment_status === 'paid' && request.status === 'dispatched' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-bold">✅ 결제가 완료되었습니다</p>
            {request.paid_at && (
              <p className="text-xs text-green-600 mt-1">
                {new Date(request.paid_at).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
        )}

        {showMap && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🚛</span>
                <p className="font-bold text-gray-700">기사 실시간 위치</p>
              </div>
              {hasRecentLocation ? (
                <span className="text-xs text-green-600 font-medium">
                  🟢 {getTimeAgoText(secondsAgo)}
                </span>
              ) : (
                <span className="text-xs text-gray-400">위치 정보 없음</span>
              )}
            </div>
            <div
              ref={mapContainerRef}
              className="w-full bg-gray-100"
              style={{ height: '300px' }}
            >
            </div>
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex items-center space-x-4">
              <span>📍 현장</span>
              <span>🚛 기사 위치</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">폐기물</span>
            <span className="font-medium">
              {wasteLabels[request.waste_type] || request.waste_type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">차량</span>
            <span className="font-medium">
              {vehicleLabels[request.vehicle_type] || request.vehicle_type}
            </span>
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
            <span className="font-medium">
              {request.requested_date} {request.requested_time}
            </span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="text-gray-700 font-bold">금액</span>
            <span className="text-amber-600 font-bold text-lg">
              {request.payment_amount?.toLocaleString()}원
            </span>
          </div>
        </div>

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
                      className={
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm ' +
                        (isDone ? 'bg-green-100' : isCurrent ? 'bg-amber-100' : 'bg-gray-100')
                      }
                    >
                      {step.icon}
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                      <div
                        className={
                          'w-0.5 h-6 ' + (isDone ? 'bg-green-300' : 'bg-gray-200')
                        }
                      />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <div className="flex items-center space-x-2">
                      <p
                        className={
                          'font-medium text-sm ' +
                          (isDone ? 'text-green-700' : isCurrent ? 'text-amber-700' : 'text-gray-400')
                        }
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