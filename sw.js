const CACHE = 'mytracker-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  '/',
  '/index.html',
  '/contacts.html',
  '/money.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
];

// Install — cache key assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can, ignore failures
      return Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls (always fresh)
  if(request.method !== 'GET') return;
  if(url.hostname.includes('supabase.co')) return;
  if(url.hostname.includes('anthropic.com')) return;

  // HTML pages — network first, cache fallback, offline page last resort
  if(request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          // Cache successful page responses
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || new Response(OFFLINE_PAGE, {
              headers: { 'Content-Type': 'text/html' }
            }))
        )
    );
    return;
  }

  // Static assets — cache first, network fallback
  e.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached;
      return fetch(request).then(res => {
        if(res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});

const OFFLINE_PAGE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MyTracker — Offline</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,sans-serif;background:#0b0d12;color:#e4e8f0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100vh;padding:24px;text-align:center;gap:16px}
  .icon{width:72px;height:72px;background:#4f8ef7;border-radius:20px;
    display:flex;align-items:center;justify-content:center;font-size:36px}
  h1{font-size:22px;font-weight:700}
  p{font-size:14px;color:#8892aa;max-width:280px;line-height:1.6}
  button{margin-top:8px;padding:12px 28px;background:#4f8ef7;color:#fff;border:none;
    border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
</style>
</head>
<body>
  <div class="icon">📊</div>
  <h1>You're offline</h1>
  <p>MyTracker needs a connection to sync your data. Pull down to refresh when you're back online.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`;
