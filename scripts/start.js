// 跨平台设置 NODE_ENV=production 后再启动后端。
// 直接 node server/dist/index.js 时若未设置 NODE_ENV，后端不会托管 web/dist 前端。
process.env.NODE_ENV ||= 'production';
await import('../server/dist/index.js');
