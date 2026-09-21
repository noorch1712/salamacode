# ============================================================
# SalamaCode — production server (Suga/Render)
# Kunci anti-gagal: server di-bundle jadi SATU file mandiri
# (express + genai + supabase semuanya masuk, 3MB). Docker hanya
# perlu npm ci --omit=dev (electron TIDAK pernah di-install).
# ============================================================
FROM node:22-slim

WORKDIR /app

# 1) install dependensi PRODUKSI SAJA (electron/vite/electron-toolkit di
#    devDependencies -> otomatis TERBUANG, karena --omit=dev)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 2) server mandiri (sudah di-bundle penuh, tanpa node_modules berat)
COPY deploy/server.cjs ./server.cjs

# 3) frontend hasil vite build (dilayani server ini sendiri)
COPY deploy/web ./dist

ENV NODE_ENV=production
ENV PORT=3000
ENV ENABLE_TERMINAL=false

EXPOSE 3000

CMD ["node", "server.cjs"]
