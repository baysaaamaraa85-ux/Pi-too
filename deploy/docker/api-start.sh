#!/bin/sh
# SERVICE_ROLE-оор api эсвэл worker эхлүүлнэ. exec ашигласнаар node нь PID 1 болж,
# Railway-ийн SIGTERM шууд node-д хүрнэ (дахин байршуулахад цэвэрхэн зогсоно).
set -eu

case "${SERVICE_ROLE:-api}" in
  api)    exec node --import tsx src/server.ts ;;
  worker) exec node --import tsx src/worker.ts ;;
  *)
    echo "SERVICE_ROLE буруу: '${SERVICE_ROLE}'. 'api' эсвэл 'worker' байх ёстой." >&2
    exit 1
    ;;
esac
