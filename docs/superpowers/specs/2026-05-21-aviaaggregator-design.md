# Личный авиа-агрегатор — дизайн

**Статус:** утверждён к реализации
**Дата:** 2026-05-21
**Заказчик:** проживает в Екатеринбурге
**Скоуп:** MVP

---

## 1. Цели, не-цели, общая архитектура

### 1.1 Цели
1. Один веб-дашборд, на котором заказчик и другие зарегистрированные пользователи видят интересные авиа-предложения для городов **EKB / MOW / LED** (родные хабы).
2. Три слоя поиска работают одновременно:
   - **L1** — персональные сохранённые поиски (отслеживание конкретных маршрутов с порогом цены).
   - **L2** — общая лента дешёвых рейсов из родных хабов.
   - **L3** — детектор аномалий из транзитных хабов (EVN/TBS/IST/DXB/BEG/HEL/RIX/TLL/AYT/KUT) — главная отличительная фича, ловит «выбросы» типа EVN→FCO за 5 000 ₽ при медиане 18 000 ₽.
3. Раздел **«Прикольные стыковки»** с 4 типами: long_layover, cheap_detour, virtual_interlining, open_jaw — каждый с собственным алгоритмом детекции и формулой score.
4. Все кнопки «Купить» несут аффилиатный маркер Travelpayouts → реферальный доход с конверсий.
5. Email-нотификации: L1 hit / L3 ультра-аномалия (≥50%) / еженедельный дайджест — все с opt-in и anti-spam.

### 1.2 Не-цели MVP
- Бронирование внутри приложения (только редирект на Aviasales).
- Поиск отелей / трансферов / страховок.
- Мобильное нативное приложение.
- Источники данных кроме Travelpayouts.
- Multi-language UI (только RU), multi-currency (только RUB).
- A/B тесты, ML-прогноз цен, социальные фичи.
- Push-нотификации браузера, Telegram-бот.

### 1.3 Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────┐    HTTPS     ┌──────────────────────────┐   │
│  │   Браузер   │ ───────────▶ │  Next.js App (Vercel)    │   │
│  │ пользователя│              │  ─ RSC дашборд           │   │
│  └─────────────┘              │  ─ API routes            │   │
│                               │  ─ Supabase JS client    │   │
│                               └──────────┬───────────────┘   │
│                                          │                   │
│                                          ▼                   │
│                               ┌──────────────────────────┐   │
│                               │  Supabase                │   │
│                               │  ─ Postgres              │   │
│                               │  ─ Auth (magic link)     │   │
│                               │  ─ RLS политики          │   │
│                               └──────────▲───────────────┘   │
│                                          │                   │
│  ┌──────────────────────────┐  Bearer   │                   │
│  │ GitHub Actions cron      │─────────▶ │                   │
│  │ ─ poll_l1  (4×/день)     │  HTTPS:   │                   │
│  │ ─ poll_l2  (4×/день)     │  /api/cron/*  ─ Vercel route  │
│  │ ─ poll_l3  (24×/день)    │           │                   │
│  │ ─ poll_vi  (1×/день)     │           ▼                   │
│  │ ─ poll_oj  (1×/день)     │  ┌──────────────────────────┐ │
│  │ ─ poll_cleanup (weekly)  │  │  Travelpayouts API       │ │
│  │ ─ poll_watchdog (daily)  │  │  data + live-search      │ │
│  │ ─ poll_digest (weekly)   │  └──────────────────────────┘ │
│  └──────────────────────────┘                               │
└──────────────────────────────────────────────────────────────┘
```

**Ключевые решения:**
- **Хостинг:** Vercel Hobby (free) + Supabase free tier + GH Actions cron на **public репозитории** (безлимит минут).
- **Cron:** GitHub Actions — единственный планировщик. Один workflow с job-ами по разным cron-расписаниям. Каждый job дёргает защищённый Vercel endpoint Bearer-токеном.
- **Vercel API routes** делают всю работу синхронно. Лимит 10 сек на функцию (Hobby) → тяжёлый L3 батчится: одна транзитная hub за вызов, GH Actions крутит цикл по 10 hub-ам через round-robin по часам.
- **Supabase RLS:** пользовательские таблицы защищены policy «owner = auth.uid()». Общие ленты читаются всеми, пишутся только service-role-key из cron.

---

## 2. Схема данных (Supabase Postgres)

### 2.1 Пользовательские таблицы (RLS включён)

#### `saved_searches` — L1
| поле | тип | описание |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→auth.users | owner |
| `origin_iata` | text | EKB / MOW / LED / транзитный |
| `destination_iata` | text NULL | NULL = «куда угодно» |
| `date_from` | date | начало окна |
| `date_to` | date | конец окна |
| `max_price_rub` | int | порог алерта |
| `notify_email` | bool | слать email при срабатывании |
| `created_at` | timestamptz | |

RLS: `auth.uid() = user_id`

#### `dismissed_deals`
| поле | тип |
|---|---|
| `(user_id, deal_kind, deal_id)` PK | uuid + text + uuid |
| `dismissed_at` | timestamptz |

`deal_kind` ∈ `'deal'` / `'anomaly'` / `'layover'`. RLS: owner.

### 2.2 Общие таблицы (read all, write service-role)

#### `price_snapshots` — фундамент L3
| поле | тип |
|---|---|
| `id` | bigserial PK |
| `origin_iata`, `destination_iata` | text |
| `depart_date`, `return_date` | date (return NULL для one-way) |
| `price_rub` | int |
| `airline`, `transfers` | text / smallint |
| `observed_at` | timestamptz |

Индексы: `(origin_iata, destination_iata, depart_date)`, `(observed_at)` для очистки.

#### `deals` — L2 лента
| поле | тип |
|---|---|
| `id` | uuid PK |
| `origin_iata`, `destination_iata` | text |
| `depart_date`, `return_date`, `price_rub` | date + date + int |
| `airline`, `transfers` | text / smallint |
| `deep_link` | text (с partner_marker) |
| `first_seen_at`, `last_seen_at` | timestamptz |
| `is_active` | bool |

#### `anomalies` — L3
| поле | тип |
|---|---|
| `id`, `origin_iata`, `destination_iata`, `depart_date`, `return_date` | как у `deals` |
| `price_rub` | int — текущая цена |
| `median_price_rub` | int — 30-дневная медиана по месяцу вылета |
| `discount_pct` | numeric |
| `z_score` | numeric |
| `airline`, `transfers`, `deep_link` | |
| `detected_at` | timestamptz |
| `is_active` | bool |

Индекс: `(detected_at DESC, discount_pct DESC)`.

#### `layover_deals` — стыковки
| поле | тип |
|---|---|
| `id`, `origin_iata`, `destination_iata` | |
| `layover_type` | text: `'long_layover'` / `'cheap_detour'` / `'virtual_interlining'` / `'open_jaw'` |
| `layover_iata`, `layover_hours` | text / numeric |
| `total_price_rub`, `vs_direct_price_rub` | int |
| `segments_json` | jsonb — детали ног маршрута |
| `score` | numeric |
| `deep_link` | text |
| `detected_at` | timestamptz |
| `is_active` | bool |

#### `cron_runs` — observability
| поле | тип |
|---|---|
| `id` | bigserial |
| `job` | `'poll_l1'` / `'poll_l2'` / `'poll_l3'` / `'poll_vi'` / `'poll_oj'` / `'poll_cleanup'` / `'poll_watchdog'` / `'poll_digest'` |
| `started_at`, `finished_at` | timestamptz |
| `api_calls`, `rows_inserted` | int |
| `error` | text NULL (JSON-массив, если ошибок несколько) |

#### `conversions` — webhook от Travelpayouts
| поле | тип |
|---|---|
| `id` | uuid |
| `deal_kind`, `deal_id`, `user_id` | расшифровка из SUB_ID |
| `commission_rub`, `gross_ticket_rub` | numeric / int |
| `converted_at` | timestamptz |
| `raw_payload` | jsonb |
| `provider_event_id` | text UNIQUE (идемпотентность) |

#### `email_log` — anti-spam и дебаг
| поле | тип |
|---|---|
| `id` | bigserial |
| `user_id` | uuid |
| `kind` | `'saved_hit'` / `'anomaly'` / `'digest'` |
| `subject` | text |
| `payload_summary` | jsonb |
| `sent_at` | timestamptz |
| `provider_message_id` | text |
| `bounced`, `complained` | bool |

#### `profiles` — расширение auth.users
| поле | тип |
|---|---|
| `user_id` | uuid PK FK→auth.users |
| `role` | text: `'user'` / `'admin'` |
| `notify_anomalies` | bool (opt-in на L3 ультра-алерты) |
| `notify_digest` | bool (opt-in на еженедельный дайджест) |
| `timezone` | text default `'Europe/Moscow'` |

### 2.3 Справочники
Список IATA-кодов аэропортов — **не в БД**, статический JSON в `/data/airports.json` (~10 КБ для 500 крупнейших). Используется в UI для типахеда формы saved-search. Регенерируется скриптом из Travelpayouts data dump.

### 2.4 Прикидка по объёму (free tier Supabase = 500 МБ)

**Правило дедупа `price_snapshots` (важно):** одна строка на `(origin_iata, destination_iata, depart_date)` в сутки. Если за сегодня уже есть snapshot для этой пары, делаем `UPDATE` на минимум цены + `observed_at = now()`, иначе `INSERT`. Это не убивает L3 (он работает по медиане за окно, дневной апдейт минимумом — даже лучше).

С этим правилом:
- L2: 3 hubs × ~200 уникальных пар = ~600 строк/день
- L3: 10 hubs × ~300 уникальных пар = ~3 000 строк/день (но за сутки каждый hub поллится несколько раз → 3000 уникальных строк, остальное update)
- L1: до 80 строк/день
- **Итого ~3 700 inserts/день** × 200 байт × 30 дней (retention) ≈ **22 МБ**

Остальное:
- `deals` / `anomalies` / `layover_deals` — активные + 30 дней истории ≈ **2 МБ**
- `conversions` / `email_log` / `cron_runs` ≈ **3 МБ**

**Итого** ~30 МБ с запасом на год роста, спокойно < 100 МБ из 500.

### 2.5 Очистка
Раз в неделю отдельный cron `poll_cleanup`:
- `price_snapshots WHERE observed_at < now() - interval '30 days'`
- `deals` / `anomalies` / `layover_deals` где `depart_date < today` ИЛИ `last_seen_at < now() - interval '30 days'`
- `cron_runs WHERE started_at < now() - interval '30 days'`
- `email_log WHERE sent_at < now() - interval '90 days'`

---

## 3. Алгоритмы L1 / L2 / L3

### 3.1 Общие соглашения
- Валюта: всё в RUB (Travelpayouts `currency=rub`).
- L2/L3 по умолчанию one-way; L1 — как указано пользователем.
- Прямые и с пересадками храним вместе, фильтрация в UI.
- Аффилиатный маркер — единая функция `buildAviasalesLink()`, никаких прямых URL в коде.

### 3.2 L1 — Saved Searches

**Расписание:** каждые 6ч (4×/сутки).

**Алгоритм:**
```
для каждой строки saved_searches:
  cheapest ← GET /v1/prices/cheap
              ?origin&destination
              &depart_date in [date_from..date_to]
              &currency=rub
  ЕСЛИ cheapest.price ≤ max_price_rub:
    ЕСЛИ за последние 24ч не было оповещения по (search_id, depart_date, price±5%):
      INSERT INTO deals (...)
      ЕСЛИ notify_email: mailer.send(saved_hit, ...)
  INSERT INTO price_snapshots
```

**API-бюджет:** 1 вызов/saved_search × 4 = до 80/день при 20 поисках.

**Антишум:** дедуп по `(saved_search_id, depart_date, price-бакет ±5%)` за 24ч.

### 3.3 L2 — Deal Feed из родных хабов

**Расписание:** каждые 6ч (4×/сутки).

**Алгоритм:**
```
для каждого home_iata in [EKB, MOW, LED]:
  results ← GET /v2/prices/latest
              ?origin=home_iata
              &period_type=year&one_way=true
              &limit=200&sorting=price
              &currency=rub
  для каждого результата:
    UPSERT INTO price_snapshots (по правилу дедупа из 2.4)
    UPSERT INTO deals (по origin/destination/depart_date/price±5%)
  деактивировать deals где last_seen_at < now() - interval '48h'

# После основного цикла — piggyback на детекцию стыковок
вызвать detect_layovers(deals_inserted_this_run, source='L2')
```

**API-бюджет:** 3 × 4 = **12/день**.

### 3.4 L3 — Anomaly Engine

**Транзитные хабы (config):** `EVN, TBS, IST, DXB, BEG, HEL, RIX, TLL, AYT, KUT` (10 шт).

**Расписание:** каждый час (24×/сутки).

**Алгоритм:**
```
slot ← (hour_of_day) mod len(TRANSIT_HUBS)
hub  ← TRANSIT_HUBS[slot]

results ← GET /v2/prices/latest
            ?origin=hub
            &period_type=year&one_way=true
            &limit=300&sorting=price
            &currency=rub

для каждого результата (origin, dest, depart_date, price):
  INSERT INTO price_snapshots

  -- одним запросом получаем медиану, stddev и count
  stats ← SELECT
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price_rub) AS median,
            stddev_samp(price_rub)                                 AS stddev,
            count(*)                                               AS n
          FROM price_snapshots
          WHERE origin_iata=hub AND destination_iata=dest
            AND date_trunc('month', depart_date) = date_trunc('month', $depart_date)
            AND observed_at > now() - interval '30 days'

  ЕСЛИ stats.n ≥ 10
     И stats.median ≥ 3000
     И price ≥ 1000
     И transfers ≤ 3
     И price ≤ stats.median × 0.70:
    discount_pct ← (stats.median - price) / stats.median * 100
    z_score     ← (price - stats.median) / NULLIF(stats.stddev, 0)
    INSERT INTO anomalies (...)
    ЕСЛИ discount_pct ≥ 50:
      для всех users WHERE profiles.notify_anomalies:
        mailer.send(anomaly, ...)

# После основного цикла — piggyback на детекцию стыковок
вызвать detect_layovers(deals_inserted_this_run, source='L3')
```

**Cold start:** первые 14 дней L3 копит снапшоты, ничего не флагает.

**API-бюджет:** 1 × 24 = **24/день**.

---

## 4. Прикольные стыковки

| Тип | Сложность | Где детектится | API |
|---|---|---|---|
| `long_layover` | Низкая | Piggyback на L2/L3 | Средняя |
| `cheap_detour` | Низкая | Piggyback на L2/L3 | Низкая |
| `open_jaw` | Средняя | Отдельный cron 1×/день | Средняя |
| `virtual_interlining` | Высокая | Отдельный cron 1×/день | Высокая |

### 4.1 `long_layover`

**Интересные города (config):** `IST, DXB, DOH, SIN, ICN, HKG, BKK, AUH, AMS, FRA, HEL, REK` (12 шт).

**Алгоритм:**
```
для каждой новой deal с transfers ≥ 1 из батча L2/L3:
  details ← GET /v1/flight_search/{search_id}
  для каждой стыковки в details.segments:
    layover_hours ← departure[i+1] - arrival[i]
    layover_iata  ← arrival[i].airport
    ЕСЛИ layover_iata ∈ INTERESTING_CITIES
       И 8 ≤ layover_hours ≤ 48:
      INSERT INTO layover_deals (
        layover_type='long_layover',
        score = city_weight(layover_iata)
              × sweet_spot_factor(layover_hours)
              × (1 / log(total_price_rub / 10000))
      )
```

- `city_weight`: 1.0…2.0, IST=2.0, FRA=1.0
- `sweet_spot_factor`: пик при 24ч → 1.0, на границах 8ч/48ч → 0.5

**API-стоимость:** ~20/день.

### 4.2 `cheap_detour`

**Алгоритм:**
```
для каждой новой deal A→C с transfers ≥ 1:
  direct ← GET /v1/prices/direct ?origin=A&destination=C
  ЕСЛИ direct IS NULL:
    тег 'unique_routing' (нет прямого вообще)
    score = 50 + saving_vs_typical
    INSERT
    continue
  saving_pct ← (direct - deal.price) / direct * 100
  ЕСЛИ saving_pct ≥ 30:
    score = saving_pct + (transfers == 1 ? 10 : 0)
    INSERT
```

**API-стоимость:** ~10/день.

### 4.3 `virtual_interlining` (Selfconnect — с дисклеймером)

**Список dest (config):** `BCN, FCO, ATH, BKK, GOI, DPS, ...` (30 шт).
**Hubs:** `IST, EVN, TBS, DXB, BEG, AYT`.

**Алгоритм (1×/день):**
```
для каждого dest:
  bundle ← GET /v1/prices/cheap ?origin=MOW&destination=dest
  для каждого hub:
    leg1 ← cheapest(MOW → hub, window)
    leg2 ← cheapest(hub → dest, window, shifted by 24h)
    ЕСЛИ leg1.arrival + 5h ≤ leg2.departure ≤ leg1.arrival + 36h:
      vi_price = leg1.price + leg2.price
      ЕСЛИ vi_price ≤ bundle × 0.7:
        score = saving_pct - risk_penalty(leg1.airline, leg2.airline)
        INSERT (segments_json = [leg1, leg2])
```

- `risk_penalty`: −10 если лоукост с жёсткими тарифами, +5 если у обеих гибкая отмена.

**UI:** обязательная пометка «**Selfconnect — на свой страх и риск, между ногами нет защиты**».

**API-стоимость:** ~360/день.

### 4.4 `open_jaw`

**Кластеры (config):**
```
[BCN, MAD]
[FCO, NAP, MXP]
[PAR, BRU, AMS]
[BER, MUC, FRA, PRG, VIE]
[WAW, KRK, BUD]
[...топ-15 кластеров]
```

**Алгоритм (1×/день):**
```
для каждого cluster:
  для каждой пары (A, B), A≠B:
    out ← cheapest(MOW → A, window)
    ret ← cheapest(B → MOW, window[+7..14d])
    open_jaw_price = out + ret
    closed_price = cheapest(MOW ⇄ A round-trip)
    ЕСЛИ open_jaw_price ≤ closed_price × 1.15:
      score = savings_pct + cities_visited_bonus(len(cluster))
      INSERT
```

**API-стоимость:** ~180/день (топ-15 кластеров).

### 4.5 Сводный API-бюджет
| Слой | Вызовов/день |
|---|---|
| L1+L2+L3 | ~120 |
| long_layover + cheap_detour | ~30 |
| virtual_interlining | ~360 |
| open_jaw | ~180 |
| **Итого** | **~700/день** |

Травелпейаутс партнёрский лимит — несколько тысяч/день. Запас ~7×.

### 4.6 UI-структура
- `/` — главная: L2 + L3 объединённой лентой, сортировка по новизне
- `/saved` — L1 (только мои, требует логин)
- `/layovers` — табы по 4 типам, сортировка `score DESC`
- `/anomalies` — только L3, подсветка `discount_pct ≥ 50`
- `/status` — публичная страница здоровья cron-job'ов и API-бюджета
- `/settings` — opt-in на дайджест/аномалии, выход из аккаунта
- `/admin/earnings` — только для `profiles.role = 'admin'`

---

## 5. Аффилиатная интеграция и email

### 5.1 Travelpayouts affiliate

**Регистрационные артефакты:**
- `marker` — числовой ID партнёра
- API ключ для data API
- Webhook URL для конверсий

**Структура deep-link:**
```
https://www.aviasales.ru/search/{ORIG}{DDMM}{DEST}{DDMM}1
  ?marker={MARKER}.{SUB_ID}
  &t={airline}_{flight_number}
```

**SUB_ID:** `{deal_kind}_{deal_id_hex}_{user_id_hex?}`

`deal_kind` ∈ `l1` / `l2` / `l3` / `lay`. `*_hex` — UUID без дефисов (Travelpayouts SUB_ID не любит `-`, чтобы не конфликтовать с собственными разделителями; UUID без дефисов не содержит `_`, значит парсер однозначен).

Примеры:
- `l2_a3f7c901b8e25f1209cd7eab12345678_` (анонимный из L2)
- `l3_b8e2d5f190abcdef12345678abcdef00_u7c4a9b8e2d5f190abcdef1234567890` (залогиненный из L3)
- `l1_3f8a1e2200000000000000000000000a_u7c4a9b8e2d5f190abcdef1234567890` (L1)

**Helper:** `lib/affiliate.ts → buildAviasalesLink()` — единственное место конструкции URL.

**Webhook конверсий:** `POST /api/webhooks/travelpayouts`
- Проверка HMAC по `X-Signature` header
- Идемпотентность по `provider_event_id`
- Парсинг SUB_ID → запись в `conversions`

**Дашборд `/admin/earnings`:**
- Топ конвертирующих дилов
- Доход по слоям (L1/L2/L3/layovers)
- Доход по дням/неделям
- CTR на главной

### 5.2 Email (Resend)

**Провайдер:** Resend (3000/мес free), абстракция `lib/mailer.ts`.

**Fallback на Яндекс SMTP** — если из РФ проблемы с доставкой на mail.ru/yandex. Решение по результатам первого тестового шквала.

**Домен:**
- Старт: `onboarding@resend.dev`
- Production: верифицированный домен (DKIM/SPF) или Яндекс SMTP

**Три типа писем:**

1. **L1 hit** (saved-search сработал)
   - Тема: `✈ MOW → IST за 18 200 ₽ на 12 октября — ваш порог 25 000 ₽`
   - Тело: маршрут, цена, дата, авиакомпания, кнопка «Купить»

2. **L3 ультра-аномалия** (`discount_pct ≥ 50`)
   - Тема: `🔥 Аномалия: EVN → FCO за 5 000 ₽ (обычно ~18 000 ₽)`
   - Дисклеймер «Цены меняются быстро, проверьте перед покупкой»
   - Только для opt-in (`profiles.notify_anomalies`)

3. **Еженедельный дайджест**
   - Cron `Sun 09:00 MSK`
   - Топ-10 L2 за неделю + 3 топ-аномалии L3
   - Только для opt-in (`profiles.notify_digest`)

**Anti-spam (зашито в mailer.send):**
- Максимум 5 писем/сутки на юзера (счётчик в `email_log`)
- Тихие часы 23:00–08:00 МСК: алерты копятся, отправляются утром пачкой
- `List-Unsubscribe` header в каждом письме, ссылка отписки → `/settings`

**Resend webhook:** `POST /api/webhooks/resend` — на `email.bounced` и `email.complained` выключаем `saved_searches.notify_email` и/или соответствующие opt-in флаги в `profiles`.

### 5.3 Секреты в env
| Имя | Где |
|---|---|
| `TP_API_KEY` | Vercel + GH Actions |
| `TP_PARTNER_MARKER` | Vercel + GH Actions |
| `TP_WEBHOOK_SECRET` | Vercel |
| `RESEND_API_KEY` | Vercel |
| `RESEND_WEBHOOK_SECRET` | Vercel |
| `CRON_BEARER_TOKEN` | Vercel + GH Actions |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server-only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (публичный) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (публичный) |

---

## 6. Ошибки, лимиты, observability, тестирование

### 6.1 Обработка ошибок

**Travelpayouts:**
- Retry с backoff: 3 попытки (1с / 3с / 9с)
- Таймаут 8 сек (из 10 сек лимита Vercel Hobby функции)
- Пустая выдача = `rows_inserted=0`, не ошибка
- Ошибка одного маршрута → агрегируется в `cron_runs.error` JSON-массивом, остальные продолжаются

**Supabase:**
- Read fail на дашборде → placeholder «Не удалось загрузить, обновите через минуту»
- Write fail в cron → retry 3×, потом `cron_runs.error`

**Webhooks:**
- HMAC подпись обязательна (401 при невалидной)
- Идемпотентность через `provider_event_id`
- Парсинг в try/catch

**Email:**
- Bounce → `notify_email = false` автоматически
- Complaint → все opt-in выключены
- Daily cap → откладываем до утра

**Аномалии — защита от мусора:**
- Минимум 10 снапшотов на пару
- Игнорируем цены < 1000 ₽
- Игнорируем `transfers > 3`
- Игнорируем медианы < 3000 ₽

### 6.2 Рейт-лимиты

| Ресурс | Расход | Лимит free | Запас |
|---|---|---|---|
| Travelpayouts data API | ~700/день | ~5000/день | 7× |
| Supabase writes | ~6K/мес | 50K/мес | 8× |
| Supabase storage | ~30 МБ/год | 500 МБ | 16× |
| Vercel compute | < 1 ГБ⋅ч/мес | 100 ГБ⋅ч/мес | 100× |
| Resend emails | < 500/мес | 3000/мес | 6× |
| **GH Actions minutes** | **~3000/мес** | **безлимит (public repo)** | ✓ |

**Решение по GH Actions:** репозиторий **public** — минуты Actions безлимитны. Все секреты в GH Secrets / Vercel env, в коде их нет.

### 6.3 Observability

**Структурированные логи (JSON в console.log):**
```json
{ "level":"info","ts":"2026-05-21T07:00:01Z",
  "job":"poll_l3","hub":"EVN","api_calls":1,
  "results":287,"anomalies_detected":3,"duration_ms":1840 }
```

**`cron_runs`** — историческая БД здоровья.

**Страница `/status` (публичная):**
- Для каждого cron-job: последний успешный запуск, средняя длительность, ошибок за 24ч
- Текущий API-бюджет: вызовов за сутки / лимит
- Last anomaly detected / last L2 first-seen

**Watchdog cron** (`Sun 09:00 MSK` + после каждого деплоя):
- Проверка: ни один job не пропустил больше 2× своего интервала
- Email админу при нарушении (макс 1/день)

**Sentry** — опционально, free 5K/мес, только в production. На MVP можно отложить.

### 6.4 Тестирование

**Vitest unit-тесты** (целевое покрытие 80% по lib/*):
- `lib/affiliate.ts` — URL конструкция
- `lib/anomaly.ts` — детектор: cold-start, низкая медиана, разные пороги discount/z-score
- `lib/layovers/long.ts` — окна 8/48ч, интересные/неинтересные города
- `lib/layovers/detour.ts` — нет прямого, разница 29/30/31%
- `lib/layovers/openjaw.ts` — кластеры, пары A=B
- `lib/layovers/vi.ts` — окна стыковок, risk_penalty
- `lib/mailer.ts` — anti-spam: cap, тихие часы

**MSW** (Mock Service Worker) с фикстурами в `/test/fixtures/`:
- `tp-cheap-evn.json`
- `tp-flight-search-with-layover.json`
- `resend-bounce-webhook.json`
- `tp-conversion-webhook.json`

**Integration** против локального Supabase (`supabase start`):
- Миграции применяются чисто
- RLS блокирует cross-user доступ
- Webhooks парсят SUB_ID и пишут в `conversions`
- L1 дедуп не отправляет два письма за 24ч

**Playwright e2e** — минимальный smoke:
- Magic-link логин (через тестовый inbox)
- Создание saved-search → виден в `/saved`
- Клик на «Купить» → редирект с правильным `marker.SUB_ID`

**CI workflow `.github/workflows/ci.yml`:**
- PR: lint + typecheck + unit + build (~3 мин)
- main: всё выше + integration + Vercel preview (auto)
- tag `v*`: production deploy

**No-prod-API правило:** cron в CI и unit/integration тесты **никогда** не дёргают живой Travelpayouts. Только моки. Manual smoke — `pnpm smoke:tp`, локально.

### 6.5 Миграции

Numbered SQL files в `/supabase/migrations/`, применяются `supabase db push` на деплой.

---

## 7. Стек и пакеты

- **Frontend:** Next.js 15 (App Router, React 19, RSC), TypeScript
- **Стилизация:** Tailwind CSS v4 + shadcn/ui (минимально)
- **Auth & DB:** `@supabase/ssr` + `@supabase/supabase-js`
- **Email:** `resend` + `react-email` (компоненты)
- **HTTP:** native `fetch` с обёрткой `lib/http.ts` (retry, timeout)
- **Тесты:** Vitest + MSW + Playwright
- **Линт и формат:** Biome (одним инструментом — быстрее ESLint + Prettier и нулевая конфигурация для старта)
- **Менеджер пакетов:** pnpm
- **Cron runner:** GitHub Actions
- **Хостинг:** Vercel + Supabase Cloud + GitHub (public repo)

---

## 8. Open questions / отложено

- Конкретный домен для email-from (заведём после первой регистрации в Resend)
- Финальный список из 30 destinations для `virtual_interlining` — соберём в первом коммите конфига после быстрого UX-обсуждения
- Включать ли Telegram-бот как дополнительный канал нотификаций (v2)
- Multi-language UI (v2)
- ML-прогноз цен (v3)
