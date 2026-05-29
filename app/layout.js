export const metadata = {
  title: '오이코스 전도 프로그램',
  description: '소중한 한 영혼을 위한 30일 기도 여정',
  openGraph: {
    title: '오이코스 전도 프로그램 | 하남교회',
    description: '소중한 한 영혼을 위한 30일 기도 여정',
    images: [{ url: 'https://oikos-app-eta.vercel.app/logo.png', width: 1080, height: 400 }],
    url: 'https://oikos-app-eta.vercel.app',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#534AB7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
