import { NextResponse } from 'next/server'

export const runtime = 'edge'

// 여러 모델을 순서대로 시도 (모델 단종/지역 제한 대응)
const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      text: '⚙️ GEMINI_API_KEY가 Vercel에 설정되지 않았습니다.\n\nVercel → Settings → Environment Variables 에서 GEMINI_API_KEY를 추가하고 재배포해주세요.',
      _diag: 'NO_API_KEY',
    })
  }

  let prompt
  try {
    const body = await req.json()
    prompt = body?.prompt
  } catch {
    return NextResponse.json({ text: '요청을 처리할 수 없습니다.', _diag: 'BAD_REQUEST' })
  }
  if (!prompt) {
    return NextResponse.json({ text: '기도 정보가 부족합니다.', _diag: 'NO_PROMPT' })
  }

  const errors = []
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.85 },
          }),
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        errors.push(`${model}: ${res.status} ${errText.slice(0, 120)}`)
        // 404(모델없음)면 다음 모델 시도, 그 외 오류도 일단 다음 시도
        continue
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        return NextResponse.json({ text: text.trim(), _model: model })
      }
      errors.push(`${model}: 응답에 텍스트 없음`)
    } catch (e) {
      errors.push(`${model}: ${e.message}`)
    }
  }

  // 모든 모델 실패 → 진단 정보 포함해 반환
  return NextResponse.json({
    text: '⚠️ AI 기도문 생성에 실패했어요.\n\n진단: ' + errors.join(' | '),
    _diag: 'ALL_MODELS_FAILED',
    _errors: errors,
  })
}
