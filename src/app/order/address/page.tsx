'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// 카카오 주소 검색 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose: () => void;
      }) => { embed: (element: HTMLElement) => void };
    };
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: unknown) => unknown;
        Marker: new (options: unknown) => unknown;
        services: {
          Geocoder: new () => {
            addressSearch: (
              address: string,
              callback: (result: GeocoderResult[], status: string) => void
            ) => void;
          };
          Status: { OK: string };
        };
      };
    };
  }
}

interface DaumPostcodeData {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
}

interface GeocoderResult {
  x: string;
  y: string;
}

export default function AddressPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  // 스크립트 로드
  useEffect(() => {
    // 다음 우편번호 스크립트
    const postcodeScript = document.createElement('script');
    postcodeScript.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    document.head.appendChild(postcodeScript);

    // 카카오맵 SDK
    const kakaoScript = document.createElement('script');
    kakaoScript.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false&libraries=services`;
    kakaoScript.onload = () => {
      window.kakao.maps.load(() => {
        setMapReady(true);
      });
    };
    document.head.appendChild(kakaoScript);
  }, []);

  // 주소가 바뀌면 지도 표시
  useEffect(() => {
    if (!address || !mapReady || !mapRef.current) return;

    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const lat = parseFloat(result[0].y);
        const lng = parseFloat(result[0].x);
        setLatitude(lat);
        setLongitude(lng);

        const mapOption = {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 3,
        };
        const map = new window.kakao.maps.Map(mapRef.current!, mapOption);
        new window.kakao.maps.Marker({
          map: map,
          position: new window.kakao.maps.LatLng(lat, lng),
        });
      }
    });
  }, [address, mapReady]);

  // 주소 검색 열기
  const openPostcode = () => {
    setIsSearchOpen(true);
    const waitForPostcode = setInterval(() => {
      if (window.daum && window.daum.Postcode) {
        clearInterval(waitForPostcode);
        setTimeout(() => {
          const container = document.getElementById('postcode-container');
          if (container) {
            new window.daum.Postcode({
              oncomplete: (data: DaumPostcodeData) => {
                const selectedAddress = data.roadAddress || data.jibunAddress;
                setAddress(selectedAddress);
                setIsSearchOpen(false);
              },
              onclose: () => {
                setIsSearchOpen(false);
              },
            }).embed(container);
          }
        }, 100);
      }
    }, 100);
  };

  // 다음 단계로 이동
  const handleNext = () => {
    if (!address) {
      alert('주소를 검색해주세요.');
      return;
    }

    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    orderData.address = address;
    orderData.detailAddress = detailAddress;
    orderData.latitude = latitude;
    orderData.longitude = longitude;
    localStorage.setItem('orderData', JSON.stringify(orderData));

    router.push('/order/time');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">현장 주소 입력</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center space-x-2 text-sm">
          <span className="text-gray-400">폐기물</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">차량</span>
          <span className="text-gray-300">→</span>
          <span className="text-amber-500 font-bold">주소</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">시간</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">확인</span>
        </div>

        {/* 주소 검색 버튼 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            현장 주소
          </label>
          <button
            onClick={openPostcode}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-left hover:border-amber-500 transition-colors"
          >
            {address ? (
              <span className="text-gray-900 font-medium">{address}</span>
            ) : (
              <span className="text-gray-400">🔍 주소를 검색하세요</span>
            )}
          </button>
        </div>

        {/* 주소 검색 팝업 */}
        {isSearchOpen && (
          <div className="border rounded-xl overflow-hidden bg-white shadow-lg">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-100">
              <span className="text-sm font-medium">주소 검색</span>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-gray-500 text-lg"
              >
                ✕
              </button>
            </div>
            <div id="postcode-container" style={{ height: '400px' }}></div>
          </div>
        )}

        {/* 지도 표시 */}
        {address && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위치 확인
            </label>
            <div
              ref={mapRef}
              style={{ width: '100%', height: '200px' }}
              className="rounded-xl overflow-hidden border"
            ></div>
          </div>
        )}

        {/* 상세 위치 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상세 위치 (선택)
          </label>
          <input
            type="text"
            value={detailAddress}
            onChange={(e) => setDetailAddress(e.target.value)}
            placeholder="예: 3층 철거 현장, 주차장 옆"
            className="w-full p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* 다음 단계 버튼 */}
        <button
          onClick={handleNext}
          disabled={!address}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
            address
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          다음: 시간 선택
        </button>
      </div>
    </div>
  );
}