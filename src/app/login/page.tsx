'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Yard {
  id: string;
  name: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 회원가입 시 추가 정보
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('2.5ton'); // 기사 전용
  const [yardId, setYardId] = useState(''); // 기사/집하장 관리자 전용
  const [yards, setYards] = useState<Yard[]>([]);

  // 집하장 목록 불러오기 (회원가입 모드 진입 시)
  useEffect(() => {
    if (isSignUp) {
      fetchYards();
    }
  }, [isSignUp]);

  const fetchYards = async () => {
    const { data } = await supabase
      .from('yards')
      .select('id, name')
      .order('name');
    setYards(data || []);
    // 기본값으로 첫 번째 집하장 선택
    if (data && data.length > 0 && !yardId) {
      setYardId(data[0].id);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    if (isSignUp) {
      // 유효성 검사
      if (!name) {
        setError('이름을 입력해주세요.');
        setLoading(false);
        return;
      }
      if ((role === 'driver' || role === 'yard_manager') && !yardId) {
        setError('소속 집하장을 선택해주세요.');
        setLoading(false);
        return;
      }
      if (!phone) {
        setError('전화번호를 입력해주세요.');
        setLoading(false);
        return;
      }

      // 1. Supabase Auth에 회원가입
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 2. users 테이블에 기본 정보 저장
      const userInsert: Record<string, unknown> = {
        id: authData.user.id,
        name: name,
        role: role,
        phone: phone,
        company_name: '',
      };

      // 기사/집하장 관리자는 yard_id도 저장
      if (role === 'driver' || role === 'yard_manager') {
        userInsert.yard_id = yardId;
      }

      const { error: insertError } = await supabase
        .from('users')
        .insert(userInsert);

      if (insertError) {
        console.error('유저 정보 저장 실패:', insertError);
        setError('유저 정보 저장에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 3. 기사인 경우 drivers 테이블에도 자동 추가
      if (role === 'driver') {
        const { error: driverError } = await supabase.from('drivers').insert({
          id: authData.user.id, // users.id와 동일
          yard_id: yardId,
          vehicle_type: vehicleType,
          status: 'available',
        });

        if (driverError) {
          console.error('기사 정보 저장 실패:', driverError);
          setError('기사 정보 저장에 실패했습니다.');
          setLoading(false);
          return;
        }
      }

      setError('회원가입 완료! 로그인해주세요.');
      setIsSignUp(false);
      // 폼 초기화
      setName('');
      setPhone('');
      setRole('customer');
    } else {
      // 로그인
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError('이메일 또는 비밀번호가 틀렸습니다.');
        setLoading(false);
        return;
      }

      // users 테이블에서 역할 확인 → 역할별 페이지로 이동
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userData) {
        switch (userData.role) {
          case 'yard_manager':
            router.push('/yard');
            break;
          case 'driver':
            router.push('/driver');
            break;
          case 'admin':
            router.push('/admin');
            break;
          default:
            router.push('/');
        }
      } else {
        router.push('/');
      }
    }
    setLoading(false);
  };

  const roles = [
    { value: 'customer', label: '고객 (철거/인테리어)' },
    { value: 'yard_manager', label: '집하장 관리자' },
    { value: 'driver', label: '기사' },
  ];

  const vehicleTypes = [
    { value: '2.5ton', label: '2.5톤' },
    { value: 'grab', label: '집게차' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">다시</h1>
        <p className="text-gray-500 text-center mb-8">폐기물 배차 플랫폼</p>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>

          <div className="space-y-4">
            {/* 회원가입일 때만 추가 정보 */}
            {isSignUp && (
              <>
                {/* 이름 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 전화번호 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 역할 선택 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    역할 선택
                  </label>
                  <div className="space-y-2">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRole(r.value)}
                        className={`w-full px-4 py-3 rounded-lg border text-left text-sm ${
                          role === r.value
                            ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                            : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 기사일 때만: 차량 유형 */}
                {role === 'driver' && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      차량 유형
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {vehicleTypes.map((v) => (
                        <button
                          key={v.value}
                          onClick={() => setVehicleType(v.value)}
                          className={`px-4 py-3 rounded-lg border text-sm ${
                            vehicleType === v.value
                              ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium'
                              : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 기사/집하장 관리자일 때만: 소속 집하장 */}
                {(role === 'driver' || role === 'yard_manager') && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      소속 집하장
                    </label>
                    {yards.length === 0 ? (
                      <p className="text-sm text-red-500 py-2">
                        등록된 집하장이 없습니다. 관리자에게 문의하세요.
                      </p>
                    ) : (
                      <select
                        value={yardId}
                        onChange={(e) => setYardId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      >
                        {yards.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자리 이상"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? '처리중...' : isSignUp ? '회원가입' : '로그인'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            {isSignUp ? '이미 계정이 있나요?' : '계정이 없나요?'}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-amber-500 font-medium ml-1"
            >
              {isSignUp ? '로그인' : '회원가입'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}