# Начало тестирования расширения VS Code Alembic

Эта инструкция помогает быстро запустить расширение в режиме разработки и проверить базовые сценарии работы с Alembic.

## 1. Подготовка проекта

Откройте репозиторий расширения и установите зависимости:

```bash
make install
```

Проверьте, что проект собирается без ошибок:

```bash
make compile
```

Для запуска автоматических тестов используйте:

```bash
make test
```

Посмотреть все доступные команды автоматизации можно так:

```bash
make help
```

## 2. Запуск расширения в VS Code

1. Откройте этот репозиторий в VS Code.
2. Перейдите в `Run and Debug`.
3. Выберите конфигурацию `Run Extension`.
4. Нажмите `F5`.

Откроется новое окно VS Code с пометкой `[Extension Development Host]`. Именно в нем нужно тестировать расширение.

## 3. Создание тестового Alembic-проекта

В отдельной временной директории создайте проект для проверки. Команда создаст virtualenv, установит `alembic`, `sqlalchemy`, `psycopg2-binary`, добавит `docker-compose.yml`, тестовую модель `models.py` и настроит `alembic.ini` на Postgres:

```bash
make test-project
```

В окне `[Extension Development Host]` откройте папку `/tmp/test-alembic-project` через `File -> Open Folder`.

Чтобы поднять тестовую БД:

```bash
make test-db-up
```

Чтобы создать пробную autogenerate-миграцию по модели `User`:

```bash
make test-project-migration
```

Эта цель перед генерацией выполняет `alembic upgrade head`, потому что Alembic не создает новую autogenerate-миграцию, если БД не обновлена до текущего `head`.

Чтобы применить миграции и проверить состояние БД:

```bash
make test-db-upgrade
make test-db-current
make test-db-history
```

Чтобы откатить миграции:

```bash
make test-db-downgrade
```

Чтобы остановить контейнер:

```bash
make test-db-down
```

Если установлен CLI `code`, можно открыть тестовый проект с текущим расширением в dev-режиме:

```bash
make launch-test
```

Путь тестового проекта можно переопределить:

```bash
make test-project TEST_PROJECT_DIR=/tmp/my-alembic-check
```

Порт Postgres по умолчанию - `55432`, чтобы не конфликтовать с локальной БД на `5432`. Его можно переопределить:

```bash
make test-db-up TEST_DB_PORT=55433
```

## 4. Первичная проверка расширения

Откройте Command Palette (`Ctrl+Shift+P` или `Cmd+Shift+P`) и выполните команды:

- `Alembic: Show Version` - проверить, что Alembic найден.
- `Alembic: Initialize Alembic` - создать `alembic.ini` и папку миграций.
- `Alembic: Create New Migration` - создать тестовую миграцию.
- `Alembic: Show Migration Graph` - открыть граф миграций.
- `Alembic: Open Settings` или `Alembic: Configure Settings` - проверить настройки расширения.

После инициализации в боковой панели VS Code должен появиться контейнер `Alembic` и представление `Alembic Migrations`.

## 5. Что проверить вручную

- Расширение активируется без ошибок.
- В Output Channel `Alembic` появляются сообщения команд.
- Команды корректно работают с выбранным Python-интерпретатором.
- Миграции отображаются в дереве `Alembic Migrations`.
- Граф миграций открывается и обновляется.
- Webview-настройки сохраняют изменения в `alembic.ini`.

## 6. Диагностика проблем

Если команды не работают, проверьте:

- установлен ли Alembic в активном Python-окружении;
- корректен ли путь в настройке `alembic.pythonPath`;
- открыта ли папка, где есть или будет создан `alembic.ini`;
- не остался ли в `alembic.ini` placeholder `driver://user:pass@localhost/dbname`;
- запущен ли контейнер Postgres через `make test-db-up`;
- нет ли ошибок в `Help -> Toggle Developer Tools -> Console`;
- нет ли подробностей в Output Channel `Alembic`.

Перед отправкой изменений запустите:

```bash
make compile
make test
```
