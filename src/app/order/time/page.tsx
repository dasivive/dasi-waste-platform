'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TimePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // 오늘부터 7일간 날짜 생성
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];

    dates.push({
      value: `${yyyy}-${mm}-${dd}`,
      label: i === 0 ? '오늘' : i === 1 ? '내일' : `${mm}/${dd}`,
      day: dayName,
      full: `${mm}월 ${dd}일 (${dayName})`,
    });
  }

  // 시간 옵션 (오전 6시 ~ 오후 6시)
  const times = [
    { value: '06:00', label: '오전 6시' },
    { value: '07:00', label: '오전 7시' },
    { value: '08:00', label: '오전 8시' },
    { value: '09:00', label: '오전 9시' },
    { value: '10:00', label: '오전 10시' },
    { value: '11:00', label: '오전 11시' },
    { value: '12:00', label: '오후 12시' },
    { value: '13:00', label: '오후 1시' },
    { value: '14:00', label: '오후 2시' },
    { value: '15:00', label: '오후 3시' },
    { value: '16:00', label: '오후 4시' },
    { value: '17:00', label: '오후 5시' },
    { value: '18:00', label: '오후 6시' },
  ];

  // 다음 단계로 이동 (C07 주문 확인)
  const handleNext = () => {
    if (!selectedDate || !selectedTime) {
      alert('날짜와 시간을 모두 선택해주세요.');
      return;
    }

    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    orderData.date = selectedDate;
    orderData.time = selectedTime;
    // 표시용 텍스트도 저장
    const dateObj = dates.find((d) => d.value === selectedDate);
    const timeObj = times.find((t) => t.value === selectedTime);
    orderData.dateLabel = dateObj?.full || selectedDate;
    orderData.timeLabel = timeObj?.label || selectedTime;
    localStorage.setItem('orderData', JSON.stringify(orderData));

    router.push('/order/confirm');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => router.back()} className="text-gray-600 mr-3">
          ← 뒤로
        </button>
        <h1 className="text-lg font-bold">시간 선택</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center space-x-2 text-sm">
          <span className="text-gray-400">폐기물</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">차량</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">주소</span>
          <span className="text-gray-300">→</span>
          <span className="text-amber-500 font-bold">시간</span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-400">확인</span>
        </div>

        {/* 날짜 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            📅 날짜 선택
          </label>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {dates.map((date) => (
              <button
                key={date.value}
                onClick={() => setSelectedDate(date.value)}
                className={`flex-shrink-0 w-20 py-3 rounded-xl text-center border-2 transition-colors ${
                  selectedDate === date.value
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-xs text-gray-400">{date.day}</div>
                <div className="font-bold text-sm mt-1">{date.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 시간 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            🕐 시간 선택
          </label>
          <div className="grid grid-cols-3 gap-2">
            {times.map((time) => (
              <button
                key={time.value}
                onClick={() => setSelectedTime(time.value)}
                className={`py-3 rounded-xl text-center border-2 transition-colors ${
                  selectedTime === time.value
                    ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>

        {/* 선택 요약 */}
        {selectedDate && selectedTime && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <span className="text-amber-800 font-medium">
              {dates.find((d) => d.value === selectedDate)?.full}{' '}
              {times.find((t) => t.value === selectedTime)?.label}
            </span>
          </div>
        )}

        {/* 다음 단계 버튼 */}
        <button
          onClick={handleNext}
          disabled={!selectedDate || !selectedTime}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg ${
            selectedDate && selectedTime
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          다음: 주문 확인
        </button>
      </div>
    </div>
  );
}