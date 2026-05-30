import { NextResponse } from 'next/server'

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY

  // API 키 누락 시 명확한 오류 반환
  if (!apiKey) {
    console.error('[기도문 오류] GEMINI_API_KEY 환경변수가 설정되지 않았습니다.')
    return NextResponse.json(
      { text: 'AI 기도문 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.' },
      { status: 500 }
    )
  }

  try {
    const { prompt } = await req.json()

    // gemini-2.0-flash: 현재 무료 플랜 최신 모델
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.8,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[기도문 오류] Gemini API 응답 오류:', res.status, errText)
      return NextResponse.json(
        { text: 'AI 서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      console.error('[기도문 오류] 응답에 텍스트 없음:', JSON.stringify(data))
      return NextResponse.json(
        { text: '기도문 생성에 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ text: text.trim() })

  } catch (e) {
    console.error('[기도문 오류] 예외 발생:', e.message)
    return NextResponse.json(
      { text: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' },
      { status: 500 }
    )
  }
}
