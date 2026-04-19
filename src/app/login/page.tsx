'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 회원가입 시 역할 선택
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    if (isSignUp) {
      // 회원가입
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // users 테이블에 역할 정보 저장
      if (authData.user) {
        const { error: insertError } = await supabase.from('users').insert({
          id: authData.user.id,
          name: name || email.split('@')[0],
          role: role,
          phone: '',
          company_name: '',
        });

        if (insertError) {
          console.error('유저 정보 저장 실패:', insertError);
        }
      }

      setError('회원가입 완료! 로그인해주세요.');
      setIsSignUp(false);
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
        // users 테이블에 정보가 없으면 고객으로 기본 이동
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">다시</h1>
        <p className="text-gray-500 text-center mb-8">폐기물 배차 플랫폼</p>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>

          <div className="space-y-4">
            {/* 회원가입일 때만 이름 + 역할 선택 표시 */}
            {isSignUp && (
              <>
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
              </>
            )}

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