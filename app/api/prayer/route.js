import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { prompt } = await req.json()

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.8 },
        }),
      }
    )

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '기도문 생성에 실패했습니다.'
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ text: '오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
