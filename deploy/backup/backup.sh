#!/bin/sh
# ФБШ-16: өгөгдлийн сангийн өдөр тутмын нөөц. Хэрэгтэй хувьсагчууд:
#   DATABASE_URL            нөөцлөх сан (унших эрхтэй)
#   BACKUP_S3_BUCKET        bucket-ийн нэр
#   BACKUP_S3_ENDPOINT      S3-тэй тохирох үйлчилгээний хаяг (AWS S3 бол хоосон)
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
#   BACKUP_PREFIX           bucket доторх хавтас (анхдагч: pitoo)
#   BACKUP_RETENTION_DAYS   хэдэн хоног хадгалах (анхдагч: 30)
#   BACKUP_DRY_RUN=1        илгээхгүй, зөвхөн дампыг үүсгэж шалгана
set -eu

: "${DATABASE_URL:?DATABASE_URL шаардлагатай}"
PREFIX="${BACKUP_PREFIX:-pitoo}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Огноог файлын нэрэнд (UTC) бичнэ: нэрээр нь цагийн дарааллаар эрэмбэлэгдэж, хуучныг нэрээр нь таньна.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/tmp/pitoo-${STAMP}.dump"

echo "pg_dump эхэллээ: ${STAMP}"
# custom формат: шахагдсан, pg_restore-оор сонгон сэргээж болно. --no-owner: өөр сан руу сэргээхэд эзэмшигч хамаарахгүй.
pg_dump --format=custom --no-owner --file="${FILE}" "${DATABASE_URL}"

# Дамп бүтэн эсэхийг уншиж шалгана (тасарсан файлыг илгээхгүй).
pg_restore --list "${FILE}" > /dev/null
SIZE="$(wc -c < "${FILE}")"
echo "Дамп бэлэн: ${SIZE} байт"

if [ "${BACKUP_DRY_RUN:-0}" = "1" ]; then
  echo "BACKUP_DRY_RUN=1: илгээлгүй дууслаа."
  exit 0
fi

: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET шаардлагатай}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID шаардлагатай}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY шаардлагатай}"

# Хоосон ENDPOINT-д --endpoint-url дамжуулахгүй.
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  aws_s3() { aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 "$@"; }
else
  aws_s3() { aws s3 "$@"; }
fi

aws_s3 cp "${FILE}" "s3://${BACKUP_S3_BUCKET}/${PREFIX}/pitoo-${STAMP}.dump" --no-progress
echo "Илгээлээ: s3://${BACKUP_S3_BUCKET}/${PREFIX}/pitoo-${STAMP}.dump"
rm -f "${FILE}"

# Хадгалах хугацаа: файлын нэрэн дэх цагийг (YYYYMMDDTHHMMSSZ) 14 оронтой тоо болгож, хязгаартай жишнэ.
CUTOFF="$(date -u -d "@$(( $(date -u +%s) - RETENTION_DAYS * 86400 ))" +%Y%m%dT%H%M%SZ | tr -d TZ)"
aws_s3 ls "s3://${BACKUP_S3_BUCKET}/${PREFIX}/" | awk '{print $4}' | while read -r key; do
  case "${key}" in
    pitoo-????????T??????Z.dump)
      key_stamp="${key#pitoo-}"
      key_stamp="$(printf '%s' "${key_stamp%.dump}" | tr -d TZ)"
      if [ "${key_stamp}" -lt "${CUTOFF}" ]; then
        aws_s3 rm "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${key}"
        echo "Хуучин нөөцийг устгав: ${key}"
      fi
      ;;
  esac
done
echo "Нөөцлөлт дууслаа."
