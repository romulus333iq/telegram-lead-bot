# Telegram Lead Bot

Бот для сбора заявок. Подходит для быстрой продажи услуги: клиент оставляет имя, телефон и задачу, заявки сохраняются в `data/leads.json` и `data/leads.csv`, админ получает уведомление.

## Как запустить

1. В Telegram откройте [@BotFather](https://t.me/BotFather), отправьте `/newbot`, получите токен.
2. Скопируйте `config.example.json` в `config.json` и вставьте токен:
   ```json
   {
     "token": "123456:ABC...",
     "adminId": "123456789"
   }
   ```
   `adminId` — ваш числовой Telegram ID, можно узнать у [@userinfobot](https://t.me/userinfobot). Если не указать, уведомления админу не придут, но заявки всё равно будут сохраняться.
3. Установите зависимости и запустите:
   ```powershell
   cd "C:\Users\Роман\Documents\Проект по умолчанию\telegram-lead-bot"
   & "$env:LOCALAPPDATA\Programs\node-v24.22.3-win-x64\npm.cmd" install
   & "$env:LOCALAPPDATA\Programs\node-v24.22.3-win-x64\node.exe" bot.mjs
   ```

## Команды

- `/start` — приветствие и кнопка заявки
- `/new` — начать заявку
- `/cancel` — отменить
- `/leads` — последние 10 заявок (только админ)
- `/export` — скачать `leads.csv` (только админ)
- `/stats` — количество заявок всего и за сегодня (только админ)

## Продажа

Готовый вариант можно продавать как «Telegram-бот для заявок под ключ» за 5 000–7 000 ₽. Для каждого клиента меняете `config.json` и тексты в `bot.mjs`.

Для круглосуточной работы нужен хостинг. В репозитории есть `render.yaml`:

1. Залей папку в GitHub (без `config.json` и `data/` — они в `.gitignore`).
2. В Render создай **New → Web Service** и подключи репозиторий. Render сам прочитает `render.yaml`.
3. В переменных окружения задай `BOT_TOKEN` (тот, что выдал BotFather). `ADMIN_CHAT_ID` уже прописан в `render.yaml`.
4. Бесплатный сервис Render засыпает без входящих запросов — `/` отвечает `ok`, поэтому можно использовать бесплатный UptimeRobot с пингом раз в 5 минут, чтобы держать бота онлайн.

Альтернатива: включить на ПК VPN/прокси, который пускает `api.telegram.org`, задать `HTTPS_PROXY` и запустить `node bot.mjs` локально.
