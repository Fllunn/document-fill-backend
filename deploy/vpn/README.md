# Запуск на VPN-сервере

Снаружи ничего не открыто: frontend слушает только `127.0.0.1:3000`, у backend и Mongo портов нет.
Доступ — SSH-туннель (Termius): локальный `3000` → сервер `127.0.0.1:3000`, затем `http://localhost:3000`.
Правила и причины — `test-vpn/context/decisions.md`, раздел «Пет-проект на VPN-сервере».

| Файл | Что |
|---|---|
| `docker-compose.yml` | frontend + backend + Mongo, образы из ghcr |
| `docker-compose.local.yml` | локальная проверка: сборка образов из исходников |
| `.env.example` | шаблон `.env` (реальные значения — в Bitwarden) |

Данные — в томах `docfill_mongo_data` (база) и `docfill_storage` (файлы шаблонов: `templates/system/`, `users/<id>/templates/`).

## Первый запуск с переносом данных

Рядом с compose: `.env`, `mongo.archive.gz`, папки `storage/` и `s3/` из архива старого сервера.

```bash
docker compose up -d mongo
docker compose exec -T mongo sh -c 'mongorestore --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsInclude="document-fill.*"' < mongo.archive.gz
docker compose create backend
docker compose cp storage/templates backend:/app/storage/
docker compose cp s3/users backend:/app/storage/
# docker cp создаёт файлы от root, а backend работает от node (1000)
docker run --rm -v docfill_storage:/s alpine chown -R 1000:1000 /s
docker compose up -d
```

Перед запуском с `TELEGRAM_BOT_TOKEN` — остановить backend на старом сервере (два бота с одним токеном мешают друг другу).

## Обновление

После push в `production` GitHub Actions собирает образы в ghcr. На сервере:

```bash
docker compose pull && docker compose up -d && docker image prune -f
```

## Проверка, что снаружи ничего не открылось

```bash
ss -tlnp | grep -v '127.0.0.1\|::1'
docker compose ps --format '{{.Name}}\t{{.Ports}}'
```

Ожидаемо: публичные порты только 22, 80, 443, 8443; у compose — только `127.0.0.1:3000->3000/tcp`.

## Бэкап вручную

```bash
docker compose exec -T mongo sh -c 'mongodump --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db document-fill --archive --gzip' > mongo-$(date +%F).archive.gz
docker run --rm -v docfill_storage:/s -v "$PWD":/out alpine tar czf /out/storage-$(date +%F).tar.gz -C /s .
```
