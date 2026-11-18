# syntax=docker/dockerfile:1
#
# backup: өдөр бүр pg_dump хийж, гаднах S3 тохирол бүхий хадгалалт руу илгээнэ, 30 хоногоос
# хуучныг устгана (design 7 "backup", ФБШ-16). Railway-д cron service болгож ажиллуулна (Cron Schedule):
# ажиллаад дуусмагц процесс гарна.
#
# pg_dump нь өөрөөсөө ШИНЭ хувилбартай сервертэй ажиллахаас татгалздаг. Тиймээс PG_MAJOR нь Postgres
# service-ийн хувилбартай ижил эсвэл түүнээс шинэ байх ёстой. Railway-д PG_MAJOR нэртэй service
# хувьсагч өгвөл build-д дамжина. Railway-ийн Postgres хувилбарыг DEPLOY.md-ийн заавраар шалга.
ARG PG_MAJOR=16
FROM postgres:${PG_MAJOR}-alpine

RUN apk add --no-cache aws-cli

COPY --chmod=755 deploy/backup/backup.sh /usr/local/bin/backup

# postgres image-ийн ENTRYPOINT-ыг (сервер эхлүүлэгч) цуцалж, зөвхөн энэ скриптийг ажиллуулна.
ENTRYPOINT []
CMD ["backup"]
