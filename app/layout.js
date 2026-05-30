export const metadata = {
  title: '오이코스 전도 프로그램',
  description: '소중한 한 영혼을 위한 30일 기도 여정',
  openGraph: {
    title: '오이코스 전도 프로그램 | 하남교회',
    description: '소중한 한 영혼을 위한 30일 기도 여정',
    images: [{ url: 'https://oikos-app-eta.vercel.app/icon-512.png', width: 512, height: 512 }],
    url: 'https://oikos-app-eta.vercel.app',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="오이코스" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
