'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Yard {
  id: string;
  name: string;
  address: string;
  manager_id: string | null;
  created_at: string;
}

export default function YardsManagePage() {
  const router = useRouter();
  const [yards, setYards] = useState<Yard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 폼 상태
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // 집하장 목록 불러오기
  const fetchYards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('yards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('집하장 조회 에러:', error);
    } else {
      setYards(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  // 관리자 권한 확인 후 데이터 조회
  async function checkAdminAndFetch() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    // users 테이블에서 role 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      alert('관리자만 접근 가능합니다');
      router.push('/');
      return;
    }

    // 관리자 확인 완료 → 집하장 목록 조회
    fetchYards();
  }

  // 새 집하장 추가
  const handleSave = async () => {
    if (!formName || !formAddress) {
      alert('집하장명과 주소를 입력해주세요.');
      return;
    }

    setSaving(true);

    if (editingId) {
      // 수정
      const { error } = await supabase
        .from('yards')
        .update({ name: formName, address: formAddress })
        .eq('id', editingId);

      if (error) {
        console.error('수정 에러:', error);
        alert('수정에 실패했습니다.');
      }
    } else {
      // 추가
      const { error } = await supabase.from('yards').insert({
        name: formName,
        address: formAddress,
      });

      if (error) {
        console.error('추가 에러:', error);
        alert('추가에 실패했습니다.');
      }
    }

    setFormName('');
    setFormAddress('');
    setShowForm(false);
    setEditingId(null);
    fetchYards();
    setSaving(false);
  };

  // 수정 모드
  const handleEdit = (yard: Yard) => {
    setEditingId(yard.id);
    setFormName(yard.name);
    setFormAddress(yard.address);
    setShowForm(true);
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 집하장을 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('yards').delete().eq('id', id);
    if (error) {
      console.error('삭제 에러:', error);
      alert('삭제에 실패했습니다.');
    } else {
      fetchYards();
    }
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
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-400 pb-1"
        >
          가격 설정
        </button>
        <button className="text-sm font-bold text-amber-600 border-b-2 border-amber-500 pb-1">
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
        {/* 추가 버튼 */}
        {!showForm ? (
          <button
            onClick={() => {
              setEditingId(null);
              setFormName('');
              setFormAddress('');
              setShowForm(true);
            }}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"
          >
            + 새 집하장 등록
          </button>
        ) : (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-bold text-gray-700">
              {editingId ? '집하장 수정' : '새 집하장 등록'}
            </h3>

            <div>
              <label className="block text-xs text-gray-500 mb-1">집하장명</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 인천 서구 집하장"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">주소</label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="예: 인천 서구 도요지로 100"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="flex-1 py-3 border rounded-lg text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600"
              >
                {saving ? '저장중...' : editingId ? '수정' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 집하장 목록 */}
        {loading ? (
          <div className="text-center text-gray-400 py-10">로딩 중...</div>
        ) : yards.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400">등록된 집하장이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {yards.map((yard) => (
              <div
                key={yard.id}
                className="bg-white rounded-xl border p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{yard.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{yard.address}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      등록일: {new Date(yard.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(yard)}
                      className="text-blue-500 text-sm hover:text-blue-700"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(yard.id)}
                      className="text-red-400 text-sm hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}