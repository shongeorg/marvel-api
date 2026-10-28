# Marvel API (local)

Самостійна заміна офіційного Marvel Comics API, яке Marvel вимкнув.
Дані збираються з [Marvel Fandom](https://marvel.fandom.com), зберігаються по одному JSON-файлу на сутність
і заливаються в Neon Postgres. Кожна сутність має власні роути й контролер.

## Стек

- Bun 1.4 + Elysia
- Neon Postgres (`Bun.sql`, без ORM)
- Скрапер на MediaWiki API (Fandom), без сторонніх залежностей

## Швидкий старт

```bash
bun install

bun run migrate
bun run scrape
bun run seed
bun run dev
```

`.env`:

```
NEON_DB=postgresql://...
```

Скрапер:

```bash
bun run scrape                     # все, з продовженням після обриву
bun run scrape --entity=comics     # тільки комікси
bun run scrape --limit=500         # обмежити кількість
```

Сід:

```bash
bun run seed
bun run seed --entity=characters
```

## Ендпоінти

| Метод | Шлях | Опис |
| --- | --- | --- |
| GET | `/` | індекс: ендпоінти й кількість записів |
| GET | `/health` | статус |
| GET | `/v1/public/characters` | персонажі, з пагінацією |
| GET | `/v1/public/characters/:id` | один персонаж |
| GET | `/v1/public/comics` | комікси, з пагінацією |
| GET | `/v1/public/comics/:id` | один комікс |
| GET | `/v1/public/creators` | автори, з пагінацією |
| GET | `/v1/public/creators/:id` | один автор |
| GET | `/v1/public/events` | події, з пагінацією |
| GET | `/v1/public/events/:id` | одна подія |
| GET | `/v1/public/series` | серії, з пагінацією |
| GET | `/v1/public/series/:id` | одна серія |
| GET | `/v1/public/stories` | історії, з пагінацією |
| GET | `/v1/public/stories/:id` | одна історія |

Кожен список пагінований за замовчуванням: `page=1`, `limit=20`, максимум `100`.

```
GET /v1/public/characters?page=2&limit=20&search=spider
```

```json
{
  "code": 200,
  "status": "Ok",
  "data": {
    "kind": "characters",
    "page": 2,
    "limit": 20,
    "total": 105910,
    "totalPages": 5296,
    "hasNext": true,
    "hasPrev": true,
    "results": []
  }
}
```

`results` у списку містить `id`, `kind`, `slug`, `name`, `description`, `thumbnail`, `modified`, `sourceUrl`.
Повний `data` віддається тільки в деталі.

```
GET /v1/public/characters/1678
```

```json
{ "code": 200, "status": "Ok", "data": { "results": [] } }
```

### Помилки

| Код | Коли |
| --- | --- |
| `400` | `page`/`limit`/`id` не додатне ціле |
| `404` | запис або роут не знайдено |
| `500` | помилка БД |

```json
{ "code": 400, "status": "Bad Request", "message": "Query parameter \"page\" must be a positive integer" }
```

### Формат сутності

```jsonc
{
  "id": 1678,
  "kind": "characters",
  "slug": "Peter Parker (Earth-616)",
  "name": "Peter Benjamin Parker",
  "description": "…",
  "thumbnail": {
    "path": "https://static.wikia.nocookie.net/marveldatabase/images/7/71/…",
    "extension": "jpg"
  },
  "modified": "2026-10-28T13:58:46.000Z",
  "sourceUrl": "https://marvel.fandom.com/wiki/Peter_Parker_(Earth-616)",
  "data": {
    "template": "Marvel Database: Character Template",
    "universe": "Earth-616",
    "aliases": ["Spider-Man"],
    "creators": "Stan Lee; Steve Ditko",
    "firstAppearance": "Amazing Fantasy Vol 1 15",
    "image": "https://static.wikia.nocookie.net/…"
  }
}
```

Картинки:

```ts
const original = `${thumbnail.path}.${thumbnail.extension}`;
const preview = `${thumbnail.path}.${thumbnail.extension}/revision/latest/scale-to-width-down/300`;
```

## Структура

```
src/
  index.ts
  routes/
    index.ts
    system.routes.ts
  entities/
    characters/
      characters.routes.ts
      characters.controller.ts
    comics/
    creators/
    events/
    series/
    stories/
  shared/
    http.ts
    pagination.ts
  db/
    client.ts
    schema.sql
  lib/
    fandom.ts
    parse.ts
  types.ts
scripts/
  scrape.ts
  seed.ts
  migrate.ts
data/
```

## Джерело даних

Fandom замість офіційного API: ті самі сутності, але `id` — це `pageid` Fandom, а не Marvel.
`description` обрізана до 4000 символів, `data` містить усі параметри інфобокса.

## Деплой

```bash
vc deploy
```

`NEON_DB` треба додати в Environment Variables проєкту на Vercel.
