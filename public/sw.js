// ══════════════════════════════════════════════════════════════
// 오이코스 Service Worker — 푸시 알림 + 오프라인 캐싱
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'oikos-v1'
const STATIC_ASSETS = ['/', '/manifest.json']

// ── 설치: 정적 파일 캐싱 ───────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── 활성화: 구버전 캐시 정리 ───────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── 네트워크 요청: 캐시 우선 전략 ─────────────────────────────
self.addEventListener('fetch', (e) => {
  // API 요청은 캐싱 제외
  if (e.request.url.includes('/api/') || e.request.url.includes('supabase')) return

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})

// ══════════════════════════════════════════════════════════════
// 푸시 알림 수신
// ══════════════════════════════════════════════════════════════
self.addEventListener('push', (e) => {
  let data = { title: '오이코스', body: '오늘 기도 시간이에요 🙏', icon: '/icon-192.png', badge: '/icon-72.png' }
  
  try {
    data = { ...data, ...e.data.json() }
  } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon,
      badge:   data.badge,
      tag:     data.tag || 'oikos-prayer',
      data:    data.url || '/',
      actions: [
        { action: 'pray',    title: '기도했어요 🙏' },
        { action: 'dismiss', title: '나중에' },
      ],
      requireInteraction: false,
    })
  )
})

// ── 알림 클릭 처리 ─────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data || '/'

  if (e.action === 'pray') {
    // 기도 완료 처리 (앱으로 포커스 + 기도 완료 신호)
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
        const client = cs.find(c => c.url.includes(self.location.origin))
        if (client) { client.postMessage({ type: 'PRAYED' }); return client.focus() }
        return clients.openWindow(url + '?action=pray')
      })
    )
  } else {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(cs => {
        const client = cs.find(c => c.url.includes(self.location.origin))
        if (client) return client.focus()
        return clients.openWindow(url)
      })
    )
  }
})

// ══════════════════════════════════════════════════════════════
// 백그라운드 동기화 (Day 증가)
// ══════════════════════════════════════════════════════════════
self.addEventListener('sync', (e) => {
  if (e.tag === 'increment-day') {
    e.waitUntil(
      // 앱이 열리면 Day 카운터 증가 신호 전송
      clients.matchAll().then(cs =>
        cs.forEach(c => c.postMessage({ type: 'INCREMENT_DAY' }))
      )
    )
  }
})
