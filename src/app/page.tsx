'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      setLoading(false)
    }
    checkUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-amber-500">다시</h1>
          <button onClick={handleLogout} className="text-sm text-gray-400">
            로그아웃
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">{user?.email}님 환영합니다</p>
      </div>

      <div className="px-4 mt-6">
        <button
          onClick={() => router.push('/order/waste')}
          className="w-full py-4 bg-amber-500 text-white rounded-xl text-lg font-semibold shadow-md hover:bg-amber-600"
        >
          + 새 배차 요청
        </button>
      </div>

      <div className="px-4 mt-8">
        <h2 className="text-base font-semibold text-gray-800 mb-3">진행중 주문</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-400 text-center py-4">진행중인 주문이 없습니다</p>
        </div>
      </div>

      <div className="px-4 mt-6 pb-20">
        <h2 className="text-base font-semibold text-gray-800 mb-3">완료된 주문</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-400 text-center py-4">완료된 주문이 없습니다</p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex justify-around py-3">
          <button className="flex flex-col items-center text-amber-500">
            <span className="text-xs font-medium">홈</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xs">주문내역</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xs">결제</span>
          </button>
          <button className="flex flex-col items-center text-gray-400">
            <span className="text-xs">마이페이지</span>
          </button>
        </div>
      </div>
    </div>
  )
}