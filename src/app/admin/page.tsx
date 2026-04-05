'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Price {
  id: string;
  region: string;
  waste_type: string;
  vehicle_type: string;
  price: number;
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

const WASTE_TYPES = ['mixed', 'wood', 'concrete', 'metal'];
const VEHICLE_TYPES = ['2.5ton', 'grab'];

export default function AdminPage() {
  const router = useRouter();
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 새 가격 입력 폼
  const [newRegion, setNewRegion] = useState('');
  const [newWaste, setNewWaste] = useState('mixed');
  const [newVehicle, setNewVehicle] = useState('2.5ton');
  const [newPrice, setNewPrice] = useState('');
  const [showForm, setShowForm] = useState(false);

  // 가격 목록 불러오기
  const fetchPrices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prices')
      .select('*')
      .order('region', { ascending: true });

    if (error) {
      console.error('가격 조회 에러:', error);
    } else {
      setPrices(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  // 가격 추가
  const handleAdd = async () => {
    if (!newRegion || !newPrice) {
      alert('지역명과 금액을 입력해주세요.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('prices').insert({
      region: newRegion,
      waste_type: newWaste,
      vehicle_type: newVehicle,
      price: parseInt(newPrice),
    });

    if (error) {
      console.error('가격 추가 에러:', error);
      alert('가격 추가에 실패했습니다.');
    } else {
      setNewRegion('');
      setNewPrice('');
      setShowForm(false);
      fetchPrices();
    }
    setSaving(false);
  };

  // 가격 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 가격을 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('prices').delete().eq('id', id);
    if (error) {
      console.error('삭제 에러:', error);
    } else {
      fetchPrices();
    }
  };

  // 금액 포맷
  const formatPrice = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
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
        <button className="text-sm font-bold text-amber-600 border-b-2 border-amber-500 pb-1">
          가격 설정
        </button>
        <button
          onClick={() => router.push('/admin/yards')}
          className="text-sm text-gray-400 pb-1"
        >
          집하장 관리
        </button>
        <button
          onClick={() => router.push('/admin/settlement')}
          className="text-sm text-gray-400 pb-1"
        >
          정산 관리
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 가격 추가 버튼 */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"
          >
            + 새 가격 추가
          </button>
        ) : (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-bold text-gray-700">새 가격 추가</h3>

            {/* 지역 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">지역명</label>
              <input
                type="text"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="예: 인천, 서울, 경기 남부"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 폐기물 종류 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">폐기물 종류</label>
              <div className="grid grid-cols-2 gap-2">
                {WASTE_TYPES.map((w) => (
                  <button
                    key={w}
                    onClick={() => setNewWaste(w)}
                    className={`py-2 rounded-lg text-sm border-2 ${
                      newWaste === w
                        ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {wasteLabels[w]}
                  </button>
                ))}
              </div>
            </div>

            {/* 차량 유형 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">차량 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setNewVehicle(v)}
                    className={`py-2 rounded-lg text-sm border-2 ${
                      newVehicle === v
                        ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {vehicleLabels[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* 금액 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">금액 (원)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="예: 600000"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 버튼 */}
            <div className="flex space-x-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border rounded-lg text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600"
              >
                {saving ? '저장중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 가격 목록 */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center text-gray-400 py-10">로딩 중...</div>
          ) : prices.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400">등록된 가격이 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">위 버튼을 눌러 가격을 추가하세요</p>
            </div>
          ) : (
            prices.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold text-gray-800">{p.region}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {wasteLabels[p.waste_type] || p.waste_type} · {vehicleLabels[p.vehicle_type] || p.vehicle_type}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-amber-600 font-bold">
                    {formatPrice(p.price)}
                  </span>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-400 text-sm hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}