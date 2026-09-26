# AGENTS.md — карта проекта VSM Train

> Этот файл предназначен для AI-ассистентов и разработчиков, которые продолжают работу над проектом.
> Перед изменениями прочитайте его целиком. Не сканируйте весь репозиторий без необходимости: ниже указаны источники истины и точки входа для типовых задач.

## AI quick rules

Before editing:

1. Identify the task category using the Change Map below.
2. Read only the listed source files + related tests.
3. Preserve these boundaries:
   - shared/engine.ts = domain/game logic
   - shared/visual.ts = pure projection
   - client/src/game/* = rendering only
   - server/storage.ts = persistence boundary
4. Prefer the smallest local patch.
5. Do not introduce a dependency, abstraction, endpoint, or data model
   unless required by the task.
6. Never commit secrets, real PII, database dumps, or temporary artifacts.
7. If API / architecture / user flow changes, update the corresponding docs.
8. Finish with:
   npm run check
   npm test
   npm run build

## Hackathon-specific constraints

- Demo data must be synthetic or anonymized.
- No secrets or credentials in repository, logs, configs or DB dumps.
- API must remain documentable/integrable with HR/LMS systems.
- SQLite is the demo persistence implementation.
  Persistence must stay isolated behind server/storage.ts so it can be
  replaced without changing domain logic.
- Scenario logic must remain understandable and directly editable by the team.
- Avoid generated dead code, speculative integrations and unused abstractions.
- Changes should preserve an incremental, understandable Git history.

## 1. Кратко о проекте

**VSM Train** — геймифицированный тренажёр рабочих сценариев для проводников ВСМ.

В приложении уже реализованы:

- редактор сценариев и состава;
- симуляция перемещения пассажиров между вагонами;
- нелинейные диалоги, условия, флаги и таймеры;
- режимы «Тренировка» и «Проверочный рейс»;
- шкалы лояльности и безопасности;
- оценка компетенций и разбор решений;
- профиль, уровни, достижения и челленджи;
- рейтинг по бригаде, депо и компании;
- страница руководителя с аналитикой;
- игровой вид салона, персонажи, эмоции, состояния и визуальные последствия.

Проект находится на стадии **полировки**. Перед созданием новой подсистемы сначала проверьте, нельзя ли решить задачу локальным изменением существующего модуля.

## 2. Стек

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI / shadcn-подобные компоненты.
- **Маршрутизация:** wouter с hash-location.
- **Запросы и кэш:** TanStack Query.
- **Backend:** Express 5.
- **База данных:** SQLite через better-sqlite3 и Drizzle ORM.
- **Валидация:** Zod.
- **Тесты:** Vitest.
- **Сборка сервера:** esbuild через `script/build.ts`.

Алиасы TypeScript/Vite:

- `@/...` → `client/src/...`;
- `@shared/...` → `shared/...`.

## 3. Основной поток данных

```text
ScenarioData
    │
    ▼
shared/scenario.ts         схема и генерация вагонов
    │
    ▼
shared/engine.ts           createSim / tick / chooseOption / computeResult
    │
    ▼
SimState + LogEntry
    │
    ├──────────────► shared/visual.ts ─► GameSceneModel ─► client/src/game/*
    │
    └──────────────► client/src/pages/play.tsx ─► HUD / диалог / разбор

API: client/src/lib/api.ts ⇄ server/routes.ts ⇄ server/storage.ts ⇄ SQLite
```

### Главное архитектурное правило

- `shared/engine.ts` отвечает за игровую логику, но не знает о React, DOM и графике.
- `shared/visual.ts` только проецирует состояние симуляции в модель сцены; он не начисляет очки и не мутирует `SimState`.
- `client/src/game/*` только отображает готовую модель сцены.
- Общие структуры данных клиента и сервера находятся в `shared/*`.
- Сервер валидирует входные данные через схемы из `shared/*`.

Не переносите игровую логику в React-компоненты. Не добавляйте визуальные детали в движок симуляции, если их можно вывести из текущего состояния.

## 4. Корень репозитория

```text
VSM-Train/
├── client/                 React-клиент и статические игровые ассеты
├── docs/                   концепции и дополнительные данные сценариев
├── script/                 скрипты сборки и генерации ассетов
├── server/                 Express API, SQLite, сиды и уведомления
├── shared/                 общая доменная модель и чистая игровая логика
├── tests/                  Vitest-тесты движка и общих модулей
├── README.md               пользовательское описание и быстрый старт
├── AGENTS.md               этот файл: карта проекта для AI-моделей
├── package.json            зависимости и команды
├── drizzle.config.ts       конфигурация Drizzle
├── vite.config.ts          сборка клиента и алиасы
├── vitest.config.ts        конфигурация тестов
├── tailwind.config.ts      тема и Tailwind
├── postcss.config.js       PostCSS
├── tsconfig.json           TypeScript и алиасы путей
└── components.json         настройки UI-компонентов
```

### Не коммитить

- `node_modules/`;
- `dist/`;
- локальную базу `data.db`, если она игнорируется Git;
- временные дампы и сгенерированные диагностические файлы.

## 5. Папка `client/`

```text
client/
├── index.html              HTML-точка входа Vite
├── public/                 файлы, доступные по URL без импорта
│   ├── favicon.svg
│   └── game-assets/        игровые изображения и документация лицензий
└── src/                    исходники React-приложения
```

### `client/public/game-assets/`

```text
client/public/game-assets/
├── README.md               происхождение, лицензии и правила ассетов
└── landscape/              бесшовные SVG для параллакса
    ├── day-far.svg
    ├── day-near.svg
    ├── sunset-far.svg
    ├── sunset-near.svg
    ├── night-far.svg
    └── night-near.svg
```

Все новые изображения, фоны и спрайты размещайте внутри `game-assets/`, распределяя по тематическим подпапкам, например:

```text
client/public/game-assets/
├── characters/
├── interiors/
├── landscape/
└── train/
```

После добавления ассета зарегистрируйте его в `client/src/game/assets.ts`. Не прописывайте пути к изображениям напрямую во множестве компонентов.

## 6. Папка `client/src/`

```text
client/src/
├── main.tsx                подключение React-приложения
├── App.tsx                 провайдеры и таблица маршрутов
├── index.css               глобальные стили, layout и CSS-анимации игры
├── pages/                  страницы верхнего уровня
├── components/             прикладные и базовые UI-компоненты
├── game/                   визуальный игровой режим
├── lib/                    API, Query Client, игрок и утилиты
└── hooks/                  общие React-хуки
```

### Маршруты `App.tsx`

| Маршрут | Страница | Назначение |
| --- | --- | --- |
| `#/` | `pages/home.tsx` | выбор сценария, режима, создание и удаление |
| `#/editor/:id` | `pages/editor.tsx` | редактор сценария |
| `#/play/:id/:mode` | `pages/play.tsx` | игровой рейс |
| `#/leaderboard` | `pages/leaderboard.tsx` | рейтинг |
| `#/profile` | `pages/profile.tsx` | профиль игрока |
| `#/team` | `pages/team.tsx` | аналитика бригады |
| остальное | `pages/not-found.tsx` | 404 |

`editor` и `play` загружаются лениво. Не импортируйте тяжёлые игровые модули в общие страницы без необходимости.

## 7. Папка `client/src/pages/`

| Файл | Ответственность |
| --- | --- |
| `home.tsx` | главная страница, выбор режима и сценария, запуск редактора |
| `editor.tsx` | состояние редактора, выбор инструмента, изменение сценария, сохранение |
| `play.tsx` | игровой цикл, `requestAnimationFrame`, управление симуляцией, визуальная пауза, отправка результата |
| `leaderboard.tsx` | рейтинг по области: бригада, депо, компания |
| `profile.tsx` | уровень, навыки, достижения, челленджи и история |
| `team.tsx` | матрица навыков бригады и частые ошибки |
| `not-found.tsx` | страница неизвестного маршрута |

### Осторожно с крупными страницами

`editor.tsx` и `play.tsx` — оркестраторы. Не добавляйте в них большие SVG, справочники или самостоятельные бизнес-правила. Выносите:

- визуальные элементы — в `client/src/game/` или `components/app/`;
- формы редактора — в `components/app/editor-panels.tsx`;
- доменную логику — в `shared/`;
- сетевые вызовы — в `client/src/lib/api.ts`.

## 8. Папка `client/src/components/`

```text
components/
├── app/                    компоненты предметной области VSM Train
└── ui/                     переиспользуемые UI-примитивы
```

### `components/app/`

| Файл | Ответственность |
| --- | --- |
| `CarMap.tsx` | SVG-карта вагона сверху, клетки, места, акторы и компактный режим |
| `Debrief.tsx` | разбор решений после рейса |
| `Logo.tsx` | логотип приложения |
| `NotificationBell.tsx` | уведомления и периодический опрос API |
| `Shell.tsx` | общий каркас страниц и навигация |
| `VisualPanel.tsx` | настройки визуальной сцены в редакторе |
| `editor-panels.tsx` | формы акторов, шагов, событий, диалогов и состава |
| `widgets.tsx` | небольшие прикладные виджеты |

### `components/ui/`

Базовые компоненты интерфейса: `button`, `card`, `input`, `label`, `progress`, `select`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toast`, `tooltip` и другие.

Перед созданием новой кнопки, таблицы, вкладок или уведомления проверьте эту папку. Не дублируйте существующие UI-примитивы.

## 9. Папка `client/src/game/`

Это визуальный слой рейса. Он получает `GameSceneModel`, а не самостоятельно решает правила сценария.

| Файл | Ответственность |
| --- | --- |
| `GameStage.tsx` | композиция сцены, камера, слои интерьера и персонажей |
| `CharacterSprite.tsx` | SVG-персонаж, эмоции, состояние и визуальный fallback |
| `TrainInterior.tsx` | векторный салон, кресла, столы, окна, передний и задний планы |
| `WindowLandscape.tsx` | фон за окнами и параллакс |
| `DialogueStage.tsx` | реплика, варианты ответа, клавиатура, подсказки и таймер |
| `GameHud.tsx` | время, режим, лояльность, безопасность и изменения шкал |
| `MiniCarMap.tsx` | сворачиваемая карта состава во время рейса |
| `ConsequenceOverlay.tsx` | положительная, отрицательная и timeout-реакция |
| `ScenePreview.tsx` | предпросмотр визуальных настроек в редакторе |
| `assets.ts` | единый реестр пейзажей, интерьеров и стилей спрайтов |
| `motion.ts` | константы и вспомогательная логика движения/анимации |
| `world.ts` | преобразование модели вагона в координаты сцены |

### Где менять визуал

| Задача | Основные файлы |
| --- | --- |
| форма и детали персонажа | `CharacterSprite.tsx`, `assets.ts` |
| ходьба, дыхание, реакции | `CharacterSprite.tsx`, `motion.ts`, `index.css` |
| направление взгляда | сначала `shared/visual.ts`, затем отображение в `CharacterSprite.tsx` / `GameStage.tsx` |
| кресла и столы в боковой сцене | `TrainInterior.tsx`, `world.ts` |
| планировка карты сверху | `shared/scenario.ts`, `CarMap.tsx` |
| палитры классов | `assets.ts` |
| изображения интерьера | `public/game-assets/interiors/`, `assets.ts`, `TrainInterior.tsx` |
| пейзаж | `public/game-assets/landscape/`, `assets.ts`, `WindowLandscape.tsx` |
| реакция после выбора | `ConsequenceOverlay.tsx`, `GameStage.tsx`, `index.css` |

### Важное про направление персонажа

`shared/visual.ts` уже вычисляет `SceneCharacter.facing`:

- при ходьбе — по следующей точке маршрута;
- в диалоге — в сторону собеседника;
- в покое — по положению в вагоне.

Если персонаж визуально не разворачивается, сначала проверьте, как `facing` применяется в `GameStage.tsx` и `CharacterSprite.tsx`. Не создавайте второй независимый расчёт направления в React без необходимости.

### Важное про CSS transform

Не назначайте перемещение, зеркальный поворот и покадровую анимацию одному DOM/SVG-элементу: правила `transform` будут перезаписывать друг друга. Используйте вложенные уровни:

```text
character-position     координаты в сцене
└── character-facing   scaleX(-1/1)
    └── character-motion  idle/walk/talk/reaction
        └── SVG sprite
```

## 10. Папка `client/src/lib/`

| Файл | Ответственность |
| --- | --- |
| `api.ts` | типизированные вызовы серверного API |
| `queryClient.ts` | TanStack Query, общий fetch и обработка ошибок |
| `player.tsx` | глобальный контекст текущего игрока |
| `deleteConfirmation.ts` | подтверждение удаления сценария |
| `utils.ts` | общие клиентские утилиты, включая объединение CSS-классов |

Не вызывайте `fetch()` в случайных компонентах, если запрос относится к существующему API-слою.

## 11. Папка `client/src/hooks/`

- `use-toast.ts` — управление toast-уведомлениями.

Новый общий хук помещайте сюда только если он используется несколькими независимыми компонентами. Локальный хук одного игрового компонента можно оставить рядом с ним.

## 12. Папка `shared/`

Это главный источник истины для домена. Код из этой папки должен оставаться независимым от браузера и Express, если нет веской причины иначе.

| Файл | Ответственность |
| --- | --- |
| `scenario.ts` | Zod-схемы сценария, типы вагонов/клеток/акторов/диалогов, `buildCar()`, миграция старых данных |
| `engine.ts` | симуляция, маршруты BFS, шаги акторов, события, диалоги, таймауты, флаги и итоговая оценка |
| `visual.ts` | чистый проектор `ScenarioData + SimState → GameSceneModel` |
| `rules.ts` | числовые правила: скорость, веса очков, штрафы, терпение классов, XP, уровни, сроки |
| `schema.ts` | схемы и типы таблиц Drizzle/API-сущностей |
| `gamification.ts` | уровни, опыт, баллы практики, челленджи и прогресс |
| `achievements.ts` | декларативные определения достижений |
| `analytics.ts` | анализ попыток, навыков и ошибок |
| `scenarios/` | встроенные сценарии, которыми наполняется база |

### `shared/scenarios/`

- `onboard.ts` — встроенный сценарий «Ситуации на борту».
- `accessibility.ts` — сценарий про маломобильных пассажиров и бесхозную вещь.

Если сценарий должен редактироваться пользователем, храните его в БД через API. В `shared/scenarios/` помещаются только встроенные/демонстрационные сценарии, необходимые при первом запуске.

### Инварианты движка

- `tick()` мутирует `SimState`; это ожидаемое поведение.
- Координаты актора могут быть дробными для плавного движения.
- `x` идёт вдоль вагона, `y` — поперёк.
- Маршрут строится по BFS внутри вагона и через двери между вагонами.
- Баллы и компетенции рассчитываются в `computeResult()`.
- Диалоговые условия и переходы должны проходить через `evalCondition()`, `visibleOptions()` и `resolveNext()`.
- Визуальная пауза не должна ухудшать время реакции следующего решения; для этого есть `resetReactionClock()`.

## 13. Папка `server/`

| Файл | Ответственность |
| --- | --- |
| `index.ts` | запуск Express/HTTP-сервера и подключение окружения |
| `routes.ts` | все API-маршруты и валидация запросов |
| `storage.ts` | доступ к SQLite, CRUD и агрегированные запросы |
| `seed.ts` | демо-структура, игроки, челленджи и история |
| `notifications.ts` | создание, синхронизация и чтение уведомлений |
| `vite.ts` | Vite middleware в development |
| `static.ts` | раздача собранного клиента в production |

### Группы API

```text
/api/scenarios                 сценарии
/api/cars/template             генерация вагона
/api/attempts                  результаты рейсов
/api/players/:name             профиль
/api/challenges                челленджи
/api/notifications             уведомления
/api/structure                 депо и бригады
/api/teams/:id/analytics       аналитика бригады
/api/leaderboard               рейтинг
```

При добавлении endpoint:

1. Добавьте/обновите Zod-схему в `shared/schema.ts` или `shared/scenario.ts`.
2. Добавьте метод хранения в `server/storage.ts`.
3. Добавьте маршрут в `server/routes.ts`.
4. Добавьте клиентскую функцию в `client/src/lib/api.ts`.
5. Добавьте тест бизнес-логики, если она вынесена в `shared/`.

## 14. Папка `docs/`

```text
docs/
├── practice-mode-concept.md   концепция практического режима
└── scenarios/
    ├── shift-4-6-28.scenario.json
    └── shift-4-6-28.cinematics.json
```

- `*.scenario.json` — внешнее/концептуальное описание сценария.
- `*.cinematics.json` — визуальные указания: фон, план камеры, поза, эффект и дополнительные перемещения.

Эти JSON-файлы не являются автоматическим источником истины движка, если код явно их не загружает. Перед изменением поведения проверьте, подключён ли документ к runtime, или он используется только как спецификация.

## 15. Папка `script/`

- `build.ts` — production-сборка клиента и сервера.
- `gen-landscapes.py` — генерация SVG-пейзажей.

Если меняются генерируемые пейзажи, сначала исправьте генератор, затем перегенерируйте файлы. Не редактируйте большой набор сгенерированных SVG вручную, если изменение можно выразить в скрипте.

## 16. Папка `tests/`

Тесты покрывают:

- условия и ветвления;
- таймауты;
- терпение классов;
- ролевую модель;
- расчёт геймификации и достижений;
- аналитику;
- уведомления;
- доступность;
- визуальную проекцию;
- встроенные сценарии;
- подтверждение удаления.

Ключевые файлы:

```text
tests/
├── conditions.test.ts
├── timeout.test.ts
├── patience.test.ts
├── roleModel.test.ts
├── visual.test.ts
├── gamification.test.ts
├── achievements.test.ts
├── analytics.test.ts
├── notifications.test.ts
├── accessibility.test.ts
├── onboard.test.ts
├── deleteConfirmation.test.ts
└── helpers.ts
```

### Когда обязательно добавлять тест

- меняется `shared/engine.ts`;
- добавляется условие, шаг поведения или тип перехода;
- меняется начисление очков, XP или достижений;
- меняется `projectGameScene()`;
- исправляется баг, который можно воспроизвести чистой функцией;
- меняется миграция старого сценария.

## 17. Команды

```bash
npm install          # установить зависимости
npm run dev          # development, http://localhost:5000
npm run check        # TypeScript
npm test             # Vitest
npm run build        # production-сборка в dist/
npm start            # запуск production-сборки
npm run db:push      # применить схему Drizzle
```

Минимальная проверка перед завершением задачи:

```bash
npm run check
npm test
npm run build
```

Если менялись только Markdown или изображения без кода, допускается не запускать полный набор, но это нужно явно указать в отчёте.

## 18. Карта типовых изменений

| Требуется изменить | Начать с | Затем проверить |
| --- | --- | --- |
| компоновка кресел и столов | `shared/scenario.ts` → `buildCar()` | `CarMap.tsx`, `world.ts`, `TrainInterior.tsx`, тесты |
| новый класс вагона | `shared/scenario.ts` | `rules.ts`, `assets.ts`, редактор, API шаблона, тесты |
| новый тип клетки | `shared/scenario.ts` | `isWalkable()`, `CarMap.tsx`, `TrainInterior.tsx`, BFS-тесты |
| движение персонажа | `shared/engine.ts` | `shared/visual.ts`, `motion.ts`, `GameStage.tsx` |
| поворот персонажа | `shared/visual.ts` | `GameStage.tsx`, `CharacterSprite.tsx`, `visual.test.ts` |
| CSS-анимация персонажа | `CharacterSprite.tsx`, `index.css` | reduced-motion, мобильная версия |
| внешний вид персонажа | `assets.ts`, `CharacterSprite.tsx` | `VisualPanel.tsx`, `ScenePreview.tsx` |
| интерьер | `assets.ts`, `TrainInterior.tsx` | `world.ts`, глубина и перекрытия |
| изображения | `public/game-assets/` | `game-assets/README.md`, `assets.ts`, preload/fallback |
| новая реплика/ветка | редактор или `shared/scenarios/*` | Zod-валидация, условия, таймаут |
| новое правило оценки | `shared/rules.ts`, `engine.ts` | аналитика, достижения, тесты |
| новая ачивка | `shared/achievements.ts` | профиль и тесты |
| новый челлендж | `server/seed.ts` / БД | `gamification.ts`, профиль |
| API | `shared/schema.ts` → `storage.ts` → `routes.ts` | `client/src/lib/api.ts` |
| страница | `client/src/pages/` | маршрут в `App.tsx`, `Shell.tsx` |

## 19. Планировки вагонов

Источник истины базовой сетки — `buildCar()` в `shared/scenario.ts`.

При реализации схем вроде «кресло — стол — кресло»:

1. Не подменяйте интерактивную планировку одной картинкой.
2. Представляйте кресла и столы клетками модели.
3. Проверяйте уникальность номеров мест.
4. Проверяйте проходимость маршрутов.
5. Учитывайте обе визуализации: карту сверху и боковую сцену.
6. Не допускайте наложения стола и кресла после проекции глубины.
7. Добавляйте тест на количество мест, столов и достижимость прохода.

Референсные чертежи можно хранить в `docs/` или `client/public/game-assets/references/`, но runtime-планировка должна оставаться структурированными данными.

## 20. Ассеты и лицензии

Для каждого нового внешнего ассета обновляйте:

```text
client/public/game-assets/README.md
```

Укажите:

- имя файла;
- источник;
- автора или правообладателя;
- лицензию/разрешение;
- изменения, сделанные в проекте;
- назначение в приложении.

Не добавляйте найденные в интернете изображения без подтверждённого права использования. Для временного прототипа лучше использовать собственный SVG, генерацию или явно помеченный внутренний референс, не включаемый в публичную сборку.

## 21. Правила для AI-модели

Перед изменением:

1. Прочитайте `AGENTS.md`.
2. Прочитайте `README.md`, только если нужен продуктовый контекст или актуальная дорожная карта.
3. Откройте только файлы из соответствующей строки раздела «Карта типовых изменений».
4. Найдите связанные тесты.
5. Проверьте `git diff` и последние релевантные коммиты.

Во время изменения:

- делайте минимальный локальный патч;
- сохраняйте существующие границы `shared / server / client`;
- используйте существующие типы и Zod-схемы;
- не дублируйте расчёты между движком, проектором и React;
- не заменяйте строгие типы на `any`;
- не удаляйте fallback и `prefers-reduced-motion`;
- не меняйте формат старых сценариев без миграции/совместимого default;
- не добавляйте новую библиотеку ради простой CSS-анимации или небольшой утилиты;
- не переписывайте крупный файл целиком ради точечной правки.

После изменения:

1. Запустите релевантные тесты.
2. Запустите `npm run check`.
3. По возможности запустите `npm run build`.
4. Опишите изменённые файлы и ручную проверку.
5. Если остаётся ограничение, укажите его явно.

## 22. Запрещённые короткие пути

Не следует:

- рассчитывать очки в клиентском компоненте;
- менять `SimState` внутри `shared/visual.ts`;
- использовать PNG-схему вместо клеточной модели вагона;
- хранить новые API-типы только на клиенте;
- создавать второй реестр ассетов рядом с `assets.ts`;
- напрямую обращаться к SQLite из `routes.ts`, минуя `storage.ts`;
- добавлять `setInterval` игровому циклу вместо существующего `requestAnimationFrame`;
- привязывать направление персонажа к роли, если оно выводится из пути;
- помещать большие данные сценария в React JSX;
- считать `docs/scenarios/*.json` автоматически подключёнными к runtime без проверки кода загрузки.

## 23. Текущие зоны полировки

Приоритетные локальные улучшения без перестройки архитектуры:

- улучшить анимации `idle`, `walk`, `talk`, `listen`, `positive`, `negative`;
- проверить применение `SceneCharacter.facing` и зеркальный разворот;
- разделить CSS-transform позиции, направления и анимации;
- уточнить планировки вагонов по классам;
- добавить столы и группы кресел как структурированные клетки;
- улучшить визуальное различие классов обслуживания;
- обеспечить корректную глубину и отсутствие наложений в `TrainInterior`;
- расширить ассеты с обязательным fallback и учётом лицензий;
- проверить адаптивность игровой сцены и редактора;
- усилить тесты визуального проектора и генератора вагонов.

## 24. Definition of Done

Изменение считается завершённым, если:

- задача решена в правильном архитектурном слое;
- старые сценарии продолжают загружаться;
- TypeScript проходит без ошибок;
- релевантные тесты проходят;
- production-сборка создаётся;
- предусмотрены пустые/неизвестные данные и fallback;
- интерфейс проверен на desktop и mobile, если менялся UI;
- клавиатура и `prefers-reduced-motion` учтены, если менялась интерактивность;
- новые ассеты описаны и имеют понятный статус лицензии;
- в коммите нет временных файлов и несвязанных изменений.

## 25. Быстрый маршрут чтения

Для большинства задач достаточно читать файлы в таком порядке:

### Игровая логика

```text
shared/scenario.ts
→ shared/rules.ts
→ shared/engine.ts
→ нужный тест
```

### Визуальная сцена

```text
shared/visual.ts
→ client/src/game/GameStage.tsx
→ конкретный компонент client/src/game/*
→ client/src/index.css
→ tests/visual.test.ts
```

### Редактор

```text
client/src/pages/editor.tsx
→ client/src/components/app/editor-panels.tsx
→ client/src/components/app/CarMap.tsx
→ shared/scenario.ts
```

### API и данные

```text
shared/schema.ts
→ server/storage.ts
→ server/routes.ts
→ client/src/lib/api.ts
→ страница-потребитель
```

### Геймификация

```text
shared/rules.ts
→ shared/gamification.ts
→ shared/achievements.ts
→ shared/analytics.ts
→ server/storage.ts
→ profile.tsx / leaderboard.tsx / team.tsx
```

Если задача чисто визуальная:
- CSS / animation / SVG → начните с client/src/game/* и index.css;
- отображение состояния персонажа → дополнительно проверьте shared/visual.ts;
- не меняйте shared/visual.ts, если необходимых данных уже достаточно.
