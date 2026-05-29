import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { prompt } = await req.json()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const text = data.content?.map(c => c.text || '').join('') || '기도문 생성에 실패했습니다.'
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ text: '오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
