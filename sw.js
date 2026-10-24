importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

// 缓存版本号
let cacheVersion = '-251024';
// 最大条目数
const maxEntries = 1000;

if (workbox) {
    console.log(`Workbox加载成功🎉`);
    // 新版本 service worker 立即接管，不用等所有标签页关闭
    self.skipWaiting();
    workbox.core.clientsClaim();
    // 缓存 HTML
    workbox.routing.registerRoute(
        new RegExp('.*\.html'),
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'html-cache' + cacheVersion,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: maxEntries,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    // 缓存 Google Fonts
    workbox.routing.registerRoute(
        new RegExp('.*\.(?:woff|woff2|ttf|otf|eot)'),
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'google-fonts' + cacheVersion,
            plugins: [
                // 使用 expiration 插件实现缓存条目数目和时间控制
                new workbox.expiration.ExpirationPlugin({
                    // 最大缓存条目数
                    maxEntries: maxEntries,
                    // 最长缓存时间 30 天
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
                // 使用 cacheableResponse 插件缓存状态码为 0 的请求
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    // 缓存 bootcdn、unpkg、jsdelivr 等公共库，用正则匹配
    workbox.routing.registerRoute(
        new RegExp('^https://(?:cdn\.bootcdn\.net|unpkg\.com|cdn\.jsdelivr\.net)'),
        new workbox.strategies.CacheFirst({
            cacheName: 'cdn' + cacheVersion,
            fetchOptions: {
                mode: 'cors',
                credentials: 'omit',
            },
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: maxEntries,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
            ],
        })
    );
    workbox.routing.registerRoute(
        new RegExp('^https://use\.fontawesome\.com'),
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'fontawesome' + cacheVersion,
            plugins: [
                // 使用 expiration 插件实现缓存条目数目和时间控制
                new workbox.expiration.ExpirationPlugin({
                    // 最大缓存条目数
                    maxEntries: maxEntries,
                    // 最长缓存时间 30 天
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
                // 使用 cacheableResponse 插件缓存状态码为 0 的请求
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    workbox.routing.registerRoute(
        new RegExp('^https://(?:cdn1|cdn2|cdn3|cdn4|cdn5)\.cdn-telegram\.org'),
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache' + cacheVersion,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: maxEntries,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    workbox.routing.registerRoute(
        new RegExp('^(?:http|https)://(?:pagead2\.googlesyndication\.com|www\.googletagmanager\.com|www\.clarity\.ms|static\.getclicky\.com|in\.getclicky\.com|static\.woopra\.com)'),
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'analytics' + cacheVersion,
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: maxEntries,
                    maxAgeSeconds: 7 * 24 * 60 * 60,
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );

    // 后缀匹配，针对其余没有被域名匹配到的静态文件
    workbox.routing.registerRoute(
        new RegExp('.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)'),
        new workbox.strategies.StaleWhileRevalidate()
    );
    // 自有 css/js 的地址带 ?v=<内容哈希>（scripts/update_assets.py），内容变了就是新地址
    workbox.routing.registerRoute(
        new RegExp('.*\.(css|js)'),
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'static' + cacheVersion,
        })
    );

    // 默认匹配剩下的请求
    workbox.routing.setDefaultHandler(
        // 优先使用缓存，缓存没有则使用网络请求
        new workbox.strategies.NetworkFirst({
            networkTimeoutSeconds: 3,
        })
    );

    // 清理旧版本的缓存（包括早期未命名的 workbox-runtime 缓存）
    self.addEventListener('activate', function (event) {
        event.waitUntil(caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (key) {
                return !key.endsWith(cacheVersion);
            }).map(function (key) {
                return caches.delete(key);
            }));
        }));
    });

} else {
    console.log(`Workbox加载失败😬`);
}
