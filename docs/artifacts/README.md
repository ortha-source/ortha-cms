# Паспорта пакетов

Технико-бизнесовое описание каждого пакета монорепозитория: назначение и бизнес-смысл,
модель данных, HTTP API, экраны админки, инварианты и чек-лист тестирования.

Готовились как основа для QA-прогонов, админской и продуктовой документации. Источник
утверждений — **исходный код** на момент составления; файлы `AGENTS.md` использовались как
каркас, но каждое утверждение сверялось с реализацией. Найденные расхождения вынесены в
последний раздел каждого паспорта.

Каждый файл — самодостаточная HTML-страница (стили и шрифты внутри, тёмная и светлая тема).
Открывается двойным щелчком локально; опубликованная копия живёт по ссылке в таблице.

## Состав

| Пакет | Файл | Опубликовано |
| --- | --- | --- |
| identity | [identity.html](identity.html) | https://claude.ai/code/artifact/79be4062-536f-4c33-bd49-3cd9d475aa10 |
| users | [users.html](users.html) | https://claude.ai/code/artifact/81665627-b6d7-445b-ad7f-a9699a0917f6 |
| workspaces | [workspaces.html](workspaces.html) | https://claude.ai/code/artifact/ff977394-5f42-40d0-b41a-fce58dbf0f3d |
| api-tokens | [api-tokens.html](api-tokens.html) | https://claude.ai/code/artifact/49dc2d4d-3a95-4153-bd05-833c8d0e972d |
| segments | [segments.html](segments.html) | https://claude.ai/code/artifact/19c60450-4e7b-479a-bf98-17e954501c75 |
| activity | [activity.html](activity.html) | https://claude.ai/code/artifact/eaaa29f4-efe1-4526-a710-adc0f652387c |
| content | [content.html](content.html) | https://claude.ai/code/artifact/0eb1f888-8867-459b-bdf0-04a2519cdcd5 |
| media | [media.html](media.html) | https://claude.ai/code/artifact/8bd342b7-0246-491c-8110-2ee4a48378e7 |
| i18n | [i18n.html](i18n.html) | https://claude.ai/code/artifact/443da988-fbef-4514-9f0a-469422822688 |
| wysiwyg | [wysiwyg.html](wysiwyg.html) | https://claude.ai/code/artifact/eeec8589-a8c7-4b00-b4eb-c626ad4411d9 |
| alarms | [alarms.html](alarms.html) | https://claude.ai/code/artifact/b583aa19-d7c9-4125-89c1-bb673067d1c0 |
| transfer | [transfer.html](transfer.html) | https://claude.ai/code/artifact/7104b80d-780b-428e-8fa8-2dc6f58ca7c7 |
| copilot | [copilot.html](copilot.html) | https://claude.ai/code/artifact/e040daef-6ee5-4d01-9955-df276a426856 |
| tools | [tools.html](tools.html) | https://claude.ai/code/artifact/f70d21fc-436b-4768-aea0-06704400f71f |
| mcp | [mcp.html](mcp.html) | https://claude.ai/code/artifact/fb53de0a-9a7d-4fe2-82d9-0cd0b6a40f1f |
| shell | [shell.html](shell.html) | https://claude.ai/code/artifact/c5f4cf7e-ce93-461a-a030-98f9e5e3a375 |
| design-system | [design-system.html](design-system.html) | https://claude.ai/code/artifact/bcc102c8-30f2-4e47-95ae-30fafd45ecdf |
| insights | [insights.html](insights.html) | https://claude.ai/code/artifact/bed1f0c0-d7bc-412c-bbc7-52aad1985508 |
| query-builder | [query-builder.html](query-builder.html) | https://claude.ai/code/artifact/0e6368ea-6d2c-41b9-8441-f8f448f2c471 |
| bootstrap | [bootstrap.html](bootstrap.html) | https://claude.ai/code/artifact/050ff5cd-78f6-4e21-b753-3cda5f56a9ef |
| database | [database.html](database.html) | https://claude.ai/code/artifact/fbdbcab1-23e6-4ff6-ad4e-92f0ae88c6f2 |
| utils | [utils.html](utils.html) | https://claude.ai/code/artifact/f2904b42-c33e-4e10-acdc-d088c9924231 |
| nx | [nx.html](nx.html) | https://claude.ai/code/artifact/366fe839-9945-4461-9717-53bdfa0afb1a |
| cli | [cli.html](cli.html) | https://claude.ai/code/artifact/40c5084d-6a32-4c4a-9b8a-49c3b02bf82f |
| create-ortha-app | [create-ortha-app.html](create-ortha-app.html) | https://claude.ai/code/artifact/3d9ece77-a7d1-4ee8-b253-7aab9cfac89a |

## Структура паспорта

Разделы, которых у пакета нет, опускаются; специфичные — добавляются (матрица адаптеров
хранилища у `media`, таблица истинности `canRead` у `segments`, реестр инструментов у `tools`,
каталог видов событий у `activity`).

1. Бизнес-описание — зачем, кому, какая ценность, чем **не** является
2. Состав группы пакетов
3. Роли и права
4. Модель данных — таблицы, поля, ограничения, миграции
5. Жизненный цикл ключевой сущности
6. Сценарии по шагам — с обоснованиями «почему сделано именно так»
7. HTTP API — метод, путь, охрана, вход, успех, отказы
8. Админка — маршруты, экраны, состояния, слоты, доступность
9. Конфигурация
10. Безопасность и устойчивость
11. Инварианты `И-01…` — пригодны как утверждения для тестов
12. Чек-лист тестирования — «действие → ожидаемый результат»
13. Границы ответственности
14. Расхождения кода и документации

## Сквозные находки

Проблемы, всплывшие независимо в нескольких паспортах. Требуют проверки на живом стенде —
все выводы получены чтением исходников, стек не поднимался.

**Корневая документация отстала от кода.** `ARCHITECTURE.md`, `CONTEXT-MAP.md` и ADR-0002
утверждают, что `database` не владеет схемой (владеет — `outbox_events` и две миграции);
контракт `ServerPlugin` показан без поля `docs`; «Content Library определяет пять слотов» —
их 14; сессия названа «signed token» (она непрозрачная, без подписи); §8 отрицает наличие
контентной модели и интеграции с LLM. Обнаружено паспортами `bootstrap`, `database`, `workspaces`.

**`WorkspacePurger` реализуют только `media` и `api-tokens`.** Строки `alarm_rules`,
`alarm_findings`, `entry_access` и `segments.workspace_ids` переживают удаление воркспейса.
Обнаружено паспортами `workspaces` и `alarms`.

**Грамматика фильтров продублирована и разошлась.** Словарь операторов существует в двух
несинхронизируемых копиях (`utils-server` и `query-builder-admin/wireOp.ts`); оператор `like`
отсутствует в клиентской таблице обратного преобразования и молча теряется при подъёме дерева
из URL. `FILTER_MAX_LENGTH` продублирована в четырёх пакетах (4096/4096/4096/8192), а в самом
движке предела длины строки нет. Обнаружено паспортами `query-builder` и `utils`.

**Пять ADR реализованы, но висят в статусе `Proposed`** — 0003, 0006, 0007, 0011; плюс
`identity-provider-oidc` и `identity-provider-saml` ссылаются на несуществующий файл
`0012-sso-provider-port.md` (SSO-порт описан в ADR-0013).

**Первый опыт пользователя ломается в трёх местах.** `ortha --help` и `ortha -h` дают
`Unknown command` с кодом 1 (argv[0] всегда трактуется как имя команды); инструкция «как
добавить тип контента» в README сгенерированного приложения не работает буквально (пути
резолвятся от cwd, `out: ../../migrations` уводит выше корня); `npm test` в свежесозданном
приложении красный — `EXPECTED_PLUGINS` не содержит `content-views`, а тесты скаффолдера
этого не ловят, потому что грепают текст шаблона, а не исполняют его спеки.

**Эксплуатация outbox.** Очистки `outbox_events` нет, инструментария для мёртвых писем нет —
событие после 15 попыток (≈33 минуты) паркуется навсегда и находится только SQL-запросом.

## Обновление

Файл здесь и опубликованная страница — независимые копии. После правки HTML перевыпустите
страницу по её же ссылке (для Claude Code: передать URL из таблицы), иначе появится второй
артефакт вместо обновлённого.
