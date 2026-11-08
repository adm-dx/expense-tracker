# Деплой на VPS

Приложение открывается по адресу `https://rmillerqa.tech/expense-tracker`:

```
браузер ─HTTPS─> nginx ─┬─ /expense-tracker/api/*  ->  NestJS  127.0.0.1:3001  (префикс отрезается)
                        └─ /expense-tracker/*      ->  Next.js 127.0.0.1:3000  (basePath)
                                                         PostgreSQL в Docker, 127.0.0.1:5432
```

Процессы держит pm2 (`ecosystem.config.cjs`), сборку и перезапуск делает `scripts/deploy.sh`.

## 1. Подготовка сервера (один раз)

Ubuntu/Debian:

```bash
sudo apt update && sudo apt install -y git nginx

# Node 24.9+
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # затем перелогиньтесь

npm install -g pm2

# Firewall: снаружи только SSH и HTTP(S). API и Next слушают только 127.0.0.1, Postgres тоже
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. Код и `.env`

```bash
sudo mkdir -p /opt/expense-tracker && sudo chown $USER /opt/expense-tracker
git clone https://github.com/adm-dx/expense-tracker.git /opt/expense-tracker
cd /opt/expense-tracker
cp .env.example .env && chmod 600 .env
```

Секреты: `openssl rand -base64 48` (по одному на пароль БД и каждый JWT-секрет). В `.env` поменяйте:

```bash
DATABASE_URL="postgresql://expense_tracker:<POSTGRES_PASSWORD>@localhost:5432/expense_tracker?schema=public"
API_URL="http://127.0.0.1:3001"
WEB_URL="https://rmillerqa.tech"          # origin для CORS, без пути
NEXT_PUBLIC_API_URL="https://rmillerqa.tech/expense-tracker/api"
NEXT_PUBLIC_BASE_PATH="/expense-tracker"
POSTGRES_PASSWORD="<пароль>"
POSTGRES_DB="expense_tracker"
JWT_ACCESS_SECRET="<секрет 1>"
JWT_REFRESH_SECRET="<секрет 2>"
```

С `NODE_ENV=production` (его ставит pm2) API не запустится, если JWT-секреты короче 32 символов, совпадают друг с другом или остались из `.env.example`, или если в `DATABASE_URL` пароль `dev_password`. Причина в `pm2 logs et-api`.

Если пароль содержит `/`, `+` или `=`, в `DATABASE_URL` его нужно URL-кодировать. Проще сгенерировать без них: `openssl rand -hex 32`.

`NEXT_PUBLIC_*` вшиваются в клиентский код при сборке: после их изменения нужен повторный деплой. `NEXT_PUBLIC_BASE_PATH` нужен ещё и при `next start` (иначе все страницы отдают 404); `ecosystem.config.cjs` сам читает его из `.env`.

## 3. Первый запуск

```bash
scripts/deploy.sh --no-pull
pm2 startup     # выполните команду, которую он выведет, чтобы pm2 стартовал после перезагрузки
```

Скрипт поднимает Postgres (`docker-compose.prod.yml` берёт пароль из `.env`; он применяется только при создании тома), ставит зависимости, собирает все workspace'ы, применяет миграции и запускает `et-api` и `et-web` в pm2.

Порты 3000/3001 заняты? Поменяйте `API_PORT` и `WEB_PORT` в `.env` и порты в nginx.

## 4. nginx

В блок `server { listen 443 ssl; server_name rmillerqa.tech; ... }`:

```nginx
location /expense-tracker/api/ {
    proxy_pass http://127.0.0.1:3001/;      # слэш в конце отрезает префикс
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /expense-tracker {
    proxy_pass http://127.0.0.1:3000;       # без слэша: Next ждёт префикс (basePath)
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`X-Forwarded-For` в блоке API обязателен: по нему API узнаёт IP клиента для rate limit (без него все запросы считаются с одного адреса, и лимит логина в 10 попыток в минуту станет общим на всех).

Не добавляйте редирект `/expense-tracker` → `/expense-tracker/`: Next редиректит в обратную сторону, получится цикл.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Если SSL ещё нет: `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d rmillerqa.tech`. HTTPS обязателен: без него браузер не даёт геолокацию виджету погоды.

## 5. Проверка

- Откройте `https://rmillerqa.tech/expense-tracker`, зарегистрируйтесь, добавьте транзакцию.
- В DevTools → Network запросы идут на `/expense-tracker/api/...`.
- Логи: `pm2 logs et-api`, `pm2 logs et-web`; состояние: `pm2 status`.

## 6. Обновление

После мержа в `main`:

```bash
cd /opt/expense-tracker && scripts/deploy.sh
```

## 7. Бэкапы

```bash
mkdir -p /opt/backups && crontab -e
```

```
0 3 * * * docker exec expense-tracker-postgres pg_dump -U expense_tracker expense_tracker | gzip > /opt/backups/et-$(date +\%F).sql.gz
```

Восстановление: `gunzip -c файл.sql.gz | docker exec -i expense-tracker-postgres psql -U expense_tracker expense_tracker`.
