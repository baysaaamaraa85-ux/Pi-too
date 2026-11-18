# syntax=docker/dockerfile:1
#
# api БА worker хоёрын нэг image (design 7: "api-тай ижил image, өөр эхлүүлэх команд").
# Аль нь болохыг SERVICE_ROLE орчны хувьсагч заана: хоосон/api бол HTTP сервер, worker бол outbox ба
# хичээл үүсгэгч. Build context нь репогийн root (Railway-д RAILWAY_DOCKERFILE_PATH-аар зааж өгнө).
#
# Яагаад tsx-ээр ажиллуулдаг вэ: @pitoo/contracts нь build-гүй TypeScript эх код (exports: ./src/index.ts)
# тул `tsc` гаралтыг node-оор шууд ажиллуулах боломжгүй. Хөгжүүлэлт, e2e-тэй ижил аргаар ажиллуулснаар
# "хөгжүүлэлтөд ажилладаг, үйлдвэрт ажиллахгүй" эрсдэл багасна.
# prisma (migrate deploy), tsx хоёр devDependency тул dev багцыг орхихгүй.
FROM node:24-bookworm-slim

# openssl: Prisma-ийн schema-engine (migrate deploy) шаардана.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Хамаарлыг эхлээд суулгана: эх код өөрчлөгдөхөд энэ давхарга кэшээс ирнэ.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --workspace=@pitoo/api --workspace=@pitoo/contracts

COPY packages/contracts packages/contracts
COPY apps/api apps/api

WORKDIR /app/apps/api

# Prisma 7: DATABASE_URL нь prisma.config.ts-д унших ёстой, гэхдээ generate холбогдохгүй тул хуурамч утга.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

# ФШ-59: PDF-ийн Roboto шрифт image-д жинхэнэ орсныг шалгана. Дутуу бол build зогсоно.
RUN node --import tsx scripts/verify-pdf-fonts.ts

# Багш, салбарын зургийн volume-ийн цэг (ФШ-78). Railway volume-ийг /data/uploads дээр холбоно.
# /app-д бичих шаардлагагүй (root-ийн эзэмшилд, node унших эрхтэй), зөвхөн /data-г node эзэмшинэ.
RUN mkdir -p /data/uploads && chown -R node:node /data
ENV UPLOAD_DIR=/data/uploads

COPY --chmod=755 deploy/docker/api-start.sh /usr/local/bin/api-start
USER node

EXPOSE 3000
CMD ["api-start"]
