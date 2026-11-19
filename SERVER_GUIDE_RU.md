# Уральский контекст: передача сайта на собственный сервер

Подготовлено 19 ноября 2026

## 1. Что передаётся

| Параметр | Значение |
|---|---|
| GitHub | https://github.com/ctiv656-rgb/uralsky-kontekst |
| Ветка для переноса и дальнейших обновлений | `server` |
| Клонирование | `git clone --branch server --single-branch https://github.com/ctiv656-rgb/uralsky-kontekst.git` |
| Текущий опубликованный сайт | https://uralsky-kontekst.ctiv656.chatgpt.site/ |
| Старый GitHub Pages | https://ctiv656-rgb.github.io/uralsky-kontekst/ |
| Тип сайта | Статический HTML, CSS и JavaScript |
| Серверная база для инструкции | Ubuntu 24.04 LTS, Nginx, Python 3, Git, systemd |

Ветка `server` подготовлена из версии сайта, опубликованной 10 ноября: главная с «Мысли двигают горы», страницы двух направлений, прошлые сезоны, новый сезон с предварительной сеткой на 12 команд и форма предложений тем

Последние эксперименты с малахитовым логотипом не встраивались в сайт: это отдельные изображения

Новый сервер пока не подключён: IP, домен и доступ к нему не были предоставлены

## 2. Что нужно получить от коллеги до установки

1. IP сервера, ОС и её версия
2. SSH-пользователь, порт и способ входа; административный доступ через `sudo`
3. Домен или поддомен для сайта и доступ к его DNS
4. Какие сайты и сервисы уже работают на сервере: Nginx, Apache, Docker, панель управления
5. GitHub-логин коллеги, если он должен отправлять изменения в существующий репозиторий
6. Возможность сервера обращаться к GitHub по HTTPS, а браузеров посетителей — к действующему серверу формы

Расположение коллеги в Москве не требует специальной версии сайта; важно, где фактически находится сервер и доступны ли внешние сервисы

Если используется Windows Server, shared hosting или панель управления, не выполнять Linux-команды ниже без адаптации

Сайт должен открываться в корне выделенного домена, например `https://context.example.com/`, а не в подпапке `/context/`: ссылки страниц начинаются с `/`

Пароли, закрытые SSH-ключи и токены не вставлять в переписку или репозиторий; подключать через защищённые средства среды, в которой работает коллега

## 3. Как устроен комплект

```text
index.html               главная
league.html              Лига дебатов, сезоны и форма темы
lectures.html            По поводу
cinema.html              Чо по телику
brand.html               страница бренда
projects.js / projects.css новые направления и новый сезон
app.js / data.json        прежние встречи, команды и результаты
topic-config.js          публичный адрес сервера формы
assets/                  фотографии
brand-assets/            логотипы и материалы бренда
server/                  исходники внешнего обработчика тем
deploy/                  сборка, Nginx, скрипт обновления, systemd
```

Для самого сайта не нужны Node.js, npm, Docker, PHP или отдельная база данных

Python нужен для проверки и копирования публичных файлов при публикации; на запросы пользователей отвечает Nginx

`deploy/build.py` копирует только публичные страницы и ресурсы; `server/`, Git, инструкции и файлы развёртывания не попадают в веб-каталог

## 4. Установка на Ubuntu 24.04

Команды выполняются по SSH на целевом сервере пользователем с `sudo`

### 4.1. Проверить сервер

```bash
cat /etc/os-release
sudo ss -ltnp
sudo nginx -T  # только если Nginx уже установлен
```

Сохранить копии существующих конфигураций перед изменением; не заменять чужие сайты, не удалять `/var/www/html` и не выключать Apache/Nginx без выяснения их роли

### 4.2. Установить зависимости и отдельного пользователя

```bash
sudo apt update
sudo apt install -y nginx git python3 curl ca-certificates util-linux
sudo adduser --system --group --home /opt/uralsky-kontekst context-deploy
sudo install -d -o context-deploy -g context-deploy -m 755 /opt/uralsky-kontekst
sudo install -d -o context-deploy -g context-deploy -m 755 /opt/uralsky-kontekst/releases
sudo install -d -o context-deploy -g context-deploy -m 755 /opt/uralsky-kontekst/tmp
```

Если пользователь или каталоги уже существуют, проверить их назначение; не создавать поверх работающей установки

### 4.3. Клонировать именно ветку server

```bash
sudo -u context-deploy git clone --branch server --single-branch \
  https://github.com/ctiv656-rgb/uralsky-kontekst.git \
  /opt/uralsky-kontekst/repo

sudo -u context-deploy git -C /opt/uralsky-kontekst/repo log -1 --oneline
```

Репозиторий публичный: серверу не нужен персональный GitHub-токен для чтения

### 4.4. Собрать первый релиз

```bash
sudo install -o root -g root -m 755 \
  /opt/uralsky-kontekst/repo/deploy/update-server.sh \
  /usr/local/bin/uralsky-kontekst-update

sudo -u context-deploy /usr/local/bin/uralsky-kontekst-update
cat /opt/uralsky-kontekst/current/__version.json
```

Скрипт получает коммит ветки `server`, проверяет обязательные страницы, локальные ссылки и ресурсы, собирает отдельный релиз и атомарно переключает `current`

Если получение кода или сборка завершаются ошибкой, прежний релиз продолжает работать; старые релизы автоматически не удаляются

### 4.5. Подключить Nginx

В примере заменить `example.com` настоящим доменом; не использовать домен `*.chatgpt.site`, которым управляет прежний хостинг

```bash
sudo cp /opt/uralsky-kontekst/repo/deploy/nginx.conf.example \
  /etc/nginx/sites-available/uralsky-kontekst
sudoedit /etc/nginx/sites-available/uralsky-kontekst
```

Проверить `server_name` и `root /opt/uralsky-kontekst/current;`

```bash
sudo ln -s /etc/nginx/sites-available/uralsky-kontekst \
  /etc/nginx/sites-enabled/uralsky-kontekst
sudo nginx -t
sudo systemctl reload nginx
```

Если ссылка уже существует, сначала проверить её; повторно создавать не нужно

Непривязанный стандартный сайт не мешает запросам с правильным `Host`; удалять его ради проекта не требуется

```bash
curl --fail -H 'Host: example.com' http://127.0.0.1/__version.json
curl --fail -I -H 'Host: example.com' http://127.0.0.1/league.html
```

### 4.6. Домен, порты и HTTPS

1. Установить A-запись выбранного домена на IPv4 нового сервера
2. Устанавливать AAAA только при рабочем IPv6; неправильная AAAA может мешать посетителям и выпуску сертификата
3. Открыть TCP 80 и 443 в панели хостинга и используемом firewall; сохранить текущий доступ SSH
4. Проверить, что домен открывает новый сервер по HTTP
5. Выпустить сертификат по текущей инструкции Certbot для Nginx и Ubuntu: https://certbot.eff.org/instructions?os=snap&ws=nginx

Типовая установка на сервере с работающим snapd, если Certbot ещё не установлен:

```bash
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d example.com
sudo /snap/bin/certbot renew --dry-run
sudo nginx -t
```

Если Certbot уже установлен другим способом, использовать существующий способ и не смешивать установки

После выпуска сертификата включить предложенный Certbot переход с HTTP на HTTPS и проверить доступность сайта по HTTPS

## 5. Автоматические обновления

### Вариант FirstVDS: если Git-транспорт зависает

На проверенном FirstVDS Git-клонирование зависало, хотя IPv4 HTTPS-запросы к GitHub работали. Для такой среды подготовлен `deploy/update-http.py`: он получает SHA ветки через GitHub API, скачивает архив именно этого коммита, проверяет сборку и атомарно переключает релиз

Этот вариант использует `deploy/uralsky-kontekst-http-update.service` и `.timer`; проверка выполняется раз в **5 минут**, чтобы не расходовать лимит публичного GitHub API каждую минуту. Исходники текущего релиза доступны в `/opt/uralsky-kontekst/source-current`

Установка: скопировать `update-http.py` в `/usr/local/bin/uralsky-kontekst-http-update` с правами 755, два unit-файла — в `/etc/systemd/system/`, выполнить `systemctl daemon-reload`, затем запустить service и включить timer. При этом старый `uralsky-kontekst-update.timer` оставлять выключенным. Первый запуск возможен из распакованного архива без Git-клонирования

Для этого варианта команды проверки и журнала используют имя `uralsky-kontekst-http-update`; ручной запуск — `sudo systemctl start uralsky-kontekst-http-update.service`. Для отката останавливать именно этот timer и service. Остальная логика ветки `server`, домена, формы и проверки релизов остаётся той же

### Основной вариант: Git работает напрямую

В этой схеме GitHub остаётся местом хранения кода, а работающий сайт обслуживается сервером коллеги

Сервер примерно раз в минуту проверяет ветку `server`; после нового коммита выкладывает новый релиз без ручного копирования файлов и без доступа GitHub к SSH сервера

```bash
sudo cp /opt/uralsky-kontekst/repo/deploy/uralsky-kontekst-update.service \
  /etc/systemd/system/
sudo cp /opt/uralsky-kontekst/repo/deploy/uralsky-kontekst-update.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start uralsky-kontekst-update.service
sudo systemctl enable --now uralsky-kontekst-update.timer
systemctl list-timers uralsky-kontekst-update.timer
```

Ручной запуск проверки и журнал:

```bash
sudo systemctl start uralsky-kontekst-update.service
sudo journalctl -u uralsky-kontekst-update.service -n 80 --no-pager
```

После изменения самого `deploy/update-server.sh` или файлов systemd администратор повторно устанавливает их в `/usr/local/bin` и `/etc/systemd/system`; обновления контента, HTML/CSS/JS и изображений подхватываются автоматически

### Как вносить дальнейшие изменения

На компьютере разработчика:

```bash
git clone --branch server --single-branch https://github.com/ctiv656-rgb/uralsky-kontekst.git
cd uralsky-kontekst
git pull --ff-only origin server
# Внести и проверить правки
git add <изменённые-файлы>
git commit -m "Описание изменения"
git push origin server
```

Для `push` коллеге нужен доступ на запись в существующий репозиторий; его выдаёт владелец через GitHub, либо коллега работает через fork и pull request, который затем вливается в `server`

Не редактировать `current/` и `releases/` вручную: следующий релиз заменит такие правки

Изменения в другом чате ChatGPT, в Sites или только в ветке `main` сами на сервер не попадут: помощник должен изменить этот репозиторий и выполнить `push` именно в `server`

Передавать каждому помощнику адрес репозитория, ветку `server` и новый основной домен

Старый адрес Sites не переезжает автоматически и остаётся отдельной публикацией; после приёмки использовать новый домен во всех ссылках проекта. Если старый сайт должен перенаправлять посетителей, настроить это отдельным изменением уже после проверки нового

## 6. Форма «Предложить тему»: отдельная интеграция

Перенос статических страниц не переносит базу лимитов и Google-обработчик

Существующая цепочка:

```text
Браузер посетителя
  → https://liga-debatov-topics.ctiv656.workers.dev
  → Cloudflare D1 (лимит 24 часа и очередь)
  → Google Apps Script
  → Google Таблица организаторов
```

Таблица: https://docs.google.com/spreadsheets/d/1njwao7YmibMaEFBa5s1XKksznBYcPFcVL6cIDGKGQ9E/edit

Это закрытый рабочий документ; ссылка сама по себе не предоставляет доступ

### Обязательное действие для нового домена

Сейчас Worker разрешает `https://ctiv656-rgb.github.io` и `https://uralsky-kontekst.ctiv656.chatgpt.site`

Владелец Cloudflare должен добавить **точный origin** нового сайта в `ALLOWED_ORIGINS`: протокол + домен + нестандартный порт при наличии, без завершающего `/` и без пути

Например, для `https://context.example.com`:

```json
"ALLOWED_ORIGINS": "https://ctiv656-rgb.github.io,https://uralsky-kontekst.ctiv656.chatgpt.site,https://context.example.com"
```

Изменить `server/wrangler.jsonc` и развернуть существующий Worker из `server/` с авторизованным Wrangler (`npx wrangler deploy`), либо согласованно обновить переменную действующего Worker через Cloudflare

Не создавать новую D1, не сбрасывать базу и не менять `IP_SECRET` или `BRIDGE_SECRET` при обычном переносе сайта

Секреты `IP_SECRET`, `BRIDGE_SECRET`, `SHEETS_BRIDGE_URL` уже находятся в Cloudflare; `BRIDGE_SECRET` также настроен в Google Script Properties. Значения не включены в этот комплект

Проверка без добавления темы:

```bash
curl -i 'https://liga-debatov-topics.ctiv656.workers.dev/status' \
  -H 'Origin: https://context.example.com'
```

Ожидаются HTTP 200 и `Access-Control-Allow-Origin: https://context.example.com`

После этого проверить форму с нового домена и с согласия владельца отправить одну явно обозначенную тестовую тему; убедиться, что она появилась в таблице. Повторная новая тема с того же IP должна блокироваться до истечения 24 часов

**Не проксировать форму через Nginx с подставным Origin или IP**: текущий Worker определяет IP через Cloudflare, прокси может превратить всех посетителей в одного отправителя

Лимит действует на IP, а не на личность: общая сеть даёт общий лимит, смена сети может его обойти

Если требуется перенести на московский сервер ещё и всю серверную часть, это отдельная работа: заменить D1 и Cloudflare-определение IP, перенести активные лимиты и очередь, сохранить безопасную подпись Google и обработку повторов. Простое копирование `worker.mjs` в Nginx не запустит эту часть

Если из сетей аудитории недоступны Cloudflare или Google, считать перенос формы незавершённым и выбрать отдельный серверный вариант; не обещать работоспособность только по факту загрузки главной

## 7. Приёмка и откат

Проверить с нового домена, в том числе на телефоне и из сетей целевой аудитории:

- Главная, «Мысли двигают горы», полосы трёх направлений
- «По поводу»: дискуссии, лекции, тайминг и раскрытие ролей
- «Чо по телику»: весь контент и переходы
- Лига: карточки прошлых сезонов, окна, темы, фотографии
- Новый сезон: Кубок, предварительная сетка на 12 мест, переключение на регулярную лигу
- Вертикальная прокрутка над сеткой, горизонтальное перемещение сетки на телефоне
- Форма темы, копирование ссылки, запись в таблицу и повторная отправка
- HTTPS и `certbot renew --dry-run`
- Новый небольшой коммит в `server` действительно меняет `https://НОВЫЙ-ДОМЕН/__version.json` после работы таймера

В сетке нового сезона нет объявленных команд, результатов или расписания; это подготовленная схема, а не начатый турнир

Для временного отката сначала остановить таймер, чтобы он не вернул последний коммит:

```bash
sudo systemctl stop uralsky-kontekst-update.timer
sudo systemctl stop uralsky-kontekst-update.service
readlink -f /opt/uralsky-kontekst/previous
```

Если `previous` указывает на существующий предыдущий релиз:

```bash
sudo -u context-deploy ln -s \
  "$(readlink -f /opt/uralsky-kontekst/previous)" \
  /opt/uralsky-kontekst/rollback-link
sudo -u context-deploy mv -Tf \
  /opt/uralsky-kontekst/rollback-link /opt/uralsky-kontekst/current
```

Для постоянного исправления сделать `git revert` ошибочного коммита в ветке `server`, отправить его в GitHub, затем снова включить таймер

Хранение релизов: старые версии накапливаются в `releases/`; периодически удалять только проверенные ненужные версии, не затрагивая `current` и `previous`. Резервировать конфигурацию Nginx, сертификаты и необходимые серверные настройки; резервное копирование Google Таблицы и D1 остаётся отдельной задачей

## 8. Что передать владельцу после выполнения

Новый основной URL, IP и название сервера, применённую ОС, текущий SHA коммита, путь `/opt/uralsky-kontekst`, состояние таймера и сертификата, результат проверки формы и способ входа администратора через защищённый канал

Не писать «готово», если проверена только главная, но не подключена форма или не работает автоматическое обновление

## Официальные справочники

- [Установка Nginx на Ubuntu](https://ubuntu.com/server/docs/how-to/web-services/install-nginx/)
- [Настройка Nginx на Ubuntu](https://ubuntu.com/server/docs/how-to/web-services/configure-nginx/)
- [Статические файлы и root в Nginx](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/)
- [Таймеры systemd](https://freedesktop.org/software/systemd/man/latest/systemd.timer.html)
- [Certbot для Nginx](https://certbot.eff.org/instructions?os=snap&ws=nginx)
