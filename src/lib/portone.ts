// ============================================================
// PortOne V2 결제 연동 유틸
// ============================================================
// 이 파일은 PortOne 결제창을 띄우는 공통 함수를 제공합니다.
// 사용처: 고객앱 주문 상세 화면 (C09 결제 버튼)
// ============================================================

import PortOne from '@portone/browser-sdk/v2';

// .env.local에서 불러온 PortOne 키
const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID as string;
const CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY as string;

// 결제 요청 시 전달받는 파라미터 타입
export interface PaymentParams {
  orderId: string;        // 우리 시스템의 주문 ID (dispatch_requests.id)
  orderName: string;      // 주문명 (예: "혼합 폐기물 2.5톤")
  amount: number;         // 결제 금액 (원)
  customerName: string;   // 고객명
  customerPhone?: string; // 고객 전화번호 (선택)
  customerEmail?: string; // 고객 이메일 (선택)
}

// 결제 결과 타입
export interface PaymentResult {
  success: boolean;
  paymentId?: string; // PortOne이 발급한 결제 고유 ID
  errorMessage?: string;
}

/**
 * PortOne 결제창을 띄우고 결제를 진행합니다.
 *
 * @param params 결제 정보
 * @returns 결제 결과 (성공/실패)
 *
 * 사용 예시:
 *   const result = await requestPayment({
 *     orderId: 'abc-123',
 *     orderName: '혼합 폐기물 2.5톤',
 *     amount: 600000,
 *     customerName: '홍길동',
 *   });
 *   if (result.success) { ... }
 */
export async function requestPayment(params: PaymentParams): Promise<PaymentResult> {
  try {
// paymentId는 우리가 생성하는 고유 ID (중복 결제 방지용)
    // ⚠️ KG이니시스는 주문번호(oid)가 최대 40자까지만 허용
    // 그래서 UUID 전체(36자)를 쓰지 않고 앞 8자리만 사용
    // + timestamp를 36진법으로 압축해서 짧게
    const shortOrderId = params.orderId.replace(/-/g, '').substring(0, 8);
    const shortTimestamp = Date.now().toString(36); // 숫자→36진법 (더 짧아짐)
    const paymentId = 'pay-' + shortOrderId + '-' + shortTimestamp;

    // PortOne SDK 타입이 일부 결제수단을 필수로 요구하는 문제 우회
    // (alipayPlus 등 우리가 안 쓰는 옵션까지 타입 체크 걸리는 이슈)
    // 실제로는 필요한 값만 넘기면 정상 동작함
    const request: Parameters<typeof PortOne.requestPayment>[0] = {
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY,
      paymentId: paymentId,
      orderName: params.orderName,
      totalAmount: params.amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD', // 카드 결제
      customer: {
        fullName: params.customerName,
        // KG이니시스 V2는 휴대폰 번호가 필수
        // 하이픈(-), 공백 등을 제거해서 숫자만 전달 (01012345678 형태)
        // 전화번호가 없으면 테스트용 기본값 사용
        phoneNumber: (params.customerPhone || '01000000000').replace(/[^0-9]/g, ''),
        email: params.customerEmail,
      },
    } as any;

    const response = await PortOne.requestPayment(request);

    // 결제 실패 (사용자가 창 닫거나 결제 거절)
    if (response?.code !== undefined) {
      return {
        success: false,
        errorMessage: response.message || '결제가 취소되었습니다.',
      };
    }

    // 결제 성공
    return {
      success: true,
      paymentId: response?.paymentId || paymentId,
    };
  } catch (error) {
    console.error('PortOne 결제 오류:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : '결제 중 오류가 발생했습니다.',
    };
  }
}