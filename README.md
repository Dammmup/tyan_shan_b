# Tyan Shan Backend

NestJS API для автоматизации ресторана (MongoDB + Socket.io).

## Local

```bash
cp .env.example .env
npm install
npm run seed
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`

## Render

В настройках Web Service:

| Setting | Value |
| --- | --- |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |

`npm start` = `node dist/main` (уже собранный JS). Не используй `nest start` на Render — на free/small инстансе это даёт OOM.

Обязательные env:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` — URL фронта на Vercel (без слэша в конце)
- `PORT` — Render подставляет сам

После деплоя: `https://<service>.onrender.com/api/v1` и `/docs`.
