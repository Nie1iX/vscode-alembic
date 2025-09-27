# 🧪 Пошаговое тестирование расширения VS Code для Alembic

## Шаг 1: Запуск расширения в режиме разработки

### 1.1 Запуск Extension Development Host

```bash
# Убедитесь, что находитесь в директории проекта
cd /home/artur/vscode-alembic

# Откройте проект в VS Code
code .
```

**В VS Code:**

1. Нажмите `F5` или перейдите в `Run and Debug` (Ctrl+Shift+D)
2. Выберите "Run Extension"
3. Откроется новое окно VS Code с заголовком "[Extension Development Host]"

### 1.2 Проверка активации расширения

В новом окне Extension Development Host:

1. Откройте Developer Tools: `Help` → `Toggle Developer Tools`
2. Важно: расширение активируется только при выполнении его команды (`onCommand:alembic.init`, `onCommand:alembic.showMigrationGraph`) или если открыт рабочий каталог с `alembic.ini`.
   - Запустите любую команду расширения (например, `Alembic: Show Version`), ИЛИ
   - Откройте папку проекта с `alembic.ini` (см. Шаг 2.2)
3. В Console появится сообщение: `"VS Code Alembic extension is now active!"`

## Шаг 2: Создание тестового проекта с Alembic

### 2.1 Создание нового проекта

```bash
# Создайте отдельную папку для тестирования
mkdir /tmp/test-alembic-project
cd /tmp/test-alembic-project

# Создайте виртуальное окружение Python
python3 -m venv venv
source venv/bin/activate

# Установите Alembic и SQLAlchemy
pip install alembic sqlalchemy
```

### 2.2 Откройте тестовый проект в Extension Development Host

В окне Extension Development Host:

1. `File` → `Open Folder`
2. Выберите `/tmp/test-alembic-project`

## Шаг 3: Тестирование функций расширения

### 3.0 Проверка версии Alembic

**Перед инициализацией рекомендуется проверить версию Alembic:**

1. Откройте Command Palette (`Ctrl+Shift+P`)
2. Найдите и выполните: `Alembic: Show Version`

**Ожидаемый результат:**

- Показано уведомление с версией Alembic
- В Output Channel (Alembic) отображена версия
- Если версия не определилась, проверьте установку Alembic

### 3.1 Инициализация Alembic

1. Откройте Command Palette (`Ctrl+Shift+P`)
2. Найдите и выполните: `Alembic: Initialize Alembic`
3. Выберите шаблон из списка (рекомендуется `generic`)
4. Введите имя директории или оставьте по умолчанию `alembic`

**Доступные шаблоны (зависят от версии Alembic):**

- Список и описания шаблонов берутся напрямую из команды `alembic list_templates`
- **`generic` (Рекомендуемый)** - всегда доступен, стандартная конфигурация
- **`async`** - для async/await проектов (может отсутствовать в старых версиях)
- **`multidb`** - для нескольких БД (может отсутствовать в старых версиях)
- **`pyproject`**, **`pyproject_async`** - только в новых версиях Alembic

**Ожидаемый результат:**

- В Output Channel показана версия Alembic
- Показан список обнаруженных шаблонов с оригинальными описаниями из Alembic
- `generic` шаблон отображается первым и помечен как рекомендуемый
- Создана папка `alembic/` (или с указанным именем)
- Создан файл `alembic.ini`
- В Primary Side Bar появилась секция "Alembic" → вид "Alembic Migrations"

### 3.2 Тестирование дерева миграций

В панели Explorer:

1. Найдите секцию "Alembic Migrations"
2. Должно показать "No migrations found"

### 3.3 Создание первой миграции

1. Command Palette → `Alembic: Create New Migration`
2. Введите сообщение: "Initial migration"
3. Если используется `alembic.revisionIdStrategy` = `hybrid`, убедитесь, что в имени файла есть нумерация (`0001_1a2b3c4d`).

**Ожидаемый результат:**

- Создан файл миграции в `alembic/versions/`
- Дерево миграций обновилось и показывает новую миграцию

### 3.4 Тестирование графа миграций

1. В секции "Alembic Migrations" нажмите иконку графа (или Command Palette → `Alembic: Show Migration Graph`)
2. Откроется веб-панель с визуализацией

**Ожидаемый результат:**

- Граф показывает одну миграцию
- Работают кнопки управления: Refresh, Fit to Screen, Toggle Physics
- Дополнительные действия (работают по выбранному узлу): Upgrade to selected, Downgrade to selected, Merge from selected

### 3.5 Редактор alembic.ini (file_template и прочее)

1. Command Palette → `Alembic: Edit alembic.ini`
2. В открывшемся webview:
   - Выберите пресет для File naming template (file_template):
     - default: `%(rev)s_%(slug)s`
     - date_rev_slug: `%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s`
     - date_slug / rev-slug-dash / rev-only
   - При необходимости задайте timezone (например, `Europe/Berlin`) и truncate_slug_length
   - Проверьте `script_location` и `version_locations`, нажмите "Validate paths"
   - Нажмите "Save"

Ожидаемый результат:

- В `alembic.ini` обновлён `[alembic].file_template` и связанные ключи
- Валидация показывает OK/NOT FOUND для указанных путей

Примечание про ревизии: file_template влияет на имя файла, а не на сам revision id. Генерацию последовательных id можно включить опционально (см. Настройки ниже).

### 3.6 Подсветка синтаксиса alembic.ini

1. Откройте `alembic.ini`
2. Убедитесь, что подсвечиваются: секции `[section]`, ключи, булевы/числа/URL, токены шаблона `%(rev)s`, `%(year)d` и т.п.

### 3.7 Просмотр истории миграций

1. Command Palette → `Alembic: Show Migration History`

**Ожидаемый результат:**

- В Output Channel ("Alembic") отображается заголовок `=== Alembic Migration History ===` и список миграций

### 3.8 Выбор интерпретатора Python

1. Command Palette → `Alembic: Select Python Interpreter`

**Ожидаемый результат:**

- В настройке `alembic.pythonPath` обновлён путь к интерпретатору
- Возможен инфо-тост об автоопределении интерпретатора

## Шаг 4: Тестирование операций с миграциями

### 4.1 Создание базы данных

Создайте простую модель для тестирования:

```python
# models.py
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Database URL
DATABASE_URL = "sqlite:///test.db"
```

### 4.2 Настройка alembic.ini

Отредактируйте `alembic.ini`:

```ini
sqlalchemy.url = sqlite:///test.db
```

### 4.3 Настройка env.py

Отредактируйте `alembic/env.py` для импорта моделей:

```python
# Добавьте в начало файла
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import Base
target_metadata = Base.metadata
```

### 4.4 Создание миграции с изменениями

1. Command Palette → `Alembic: Create New Migration`
2. Введите: "Add users table"

**Ожидаемый результат:**

- Новая миграция с кодом создания таблицы users
- Граф показывает связь между миграциями

### 4.5 Merge веток миграций

Создадим второй независимый head (ветку) и сольём:

```bash
# находимся в проекте с уже созданной первой ревизией
source venv/bin/activate
alembic revision -m "parallel head" --head base
```

Теперь запустите команду:

1. Command Palette → `Alembic: Merge Migration Branches`
2. В списке выберите оба head (id отображаются с описанием)
3. Введите сообщение merge

Ожидаемый результат:

- Создана merge-ревизия
- Граф отображает объединение веток

### 4.6 Тестирование Upgrade

1. Щелкните правой кнопкой на миграции в дереве
2. Выберите "Upgrade Database"

**Ожидаемый результат:**

- Создана база данных `test.db`
- В панели Output (канал "Alembic") показан вывод команды
- Статус миграции в дереве обновился

### 4.7 Инспекция видимости моделей

1. Command Palette → `Alembic: Inspect Alembic Model Visibility`
2. Ожидаемый вывод:
   - В webview и Output-канале появится отчёт: список таблиц из `target_metadata` и список "Hidden models" (классы с `__tablename__`, не видимые Alembic)
3. При необходимости скорректируйте импорты в `env.py`

## Шаг 5: Тестирование настроек

### 5.1 Открытие настроек

1. Command Palette → `Alembic: Configure Settings`
2. Или `File` → `Preferences` → `Settings` → найти "Alembic"

### 5.2 Проверка настроек

Проверьте доступные настройки:

- `alembic.pythonPath`
- `alembic.alembicPath`
- `alembic.configFile`
- `alembic.autoRefresh`
- `alembic.showFullHash`
- `alembic.revisionIdStrategy` (default/hybrid)
- `alembic.sequentialRevIdWidth`
- `alembic.hybridHashLength`

Настройка `revisionIdStrategy` управляет форматом revision ID:

- `default`: стандартный хэш Alembic
- `hybrid`: комбинированный формат `0001_1a2b3c4d` (читаемый номер + уникальный хэш)

## Шаг 6: Тестирование автообновления

### 6.1 Создание миграции вручную

```bash
# В терминале в папке проекта
cd /tmp/test-alembic-project
source venv/bin/activate
alembic revision -m "Manual migration"
```

**Ожидаемый результат:**

- Дерево миграций автоматически обновилось
- Новая миграция появилась в списке

## Шаг 7: Проверка ошибок и логов

### 7.1 Панель Output

1. `View` → `Output`
2. Выберите канал "Alembic"
3. Проверьте логи выполнения команд

### 7.2 Developer Console

1. `Help` → `Toggle Developer Tools`
2. Проверьте Console на наличие ошибок

## Шаг 8: Запуск тестов расширения (headless)

1. Установите системные зависимости (Ubuntu/Debian):

```bash
sudo apt-get update && sudo apt-get install -y \
  libatk1.0-0 libatk-bridge2.0-0 libxkbfile1 libsecret-1-0 libnss3 \
  libasound2 libxss1 libx11-xcb1 libxcomposite1 libxrandr2 libxdamage1 \
  libpango-1.0-0 libcairo2 libgbm1 libgtk-3-0 xvfb
```

1. Запустить тесты под xvfb (используется `@vscode/test-electron` из `npm test`):

```bash
CI=1 xvfb-run -a npm test
```

Ожидаемый результат: все тесты проходят (utils и smoke).

## Шаг 9: CI форматирование (Prettier)

При push/PR в основной репозиторий запускается job, проверяющий `npm run format:check`. Локально можно использовать pre-commit (husky + lint-staged), либо `npm run format`.

## ✅ Чек-лист успешного тестирования

- [ ] Расширение активируется без ошибок
- [ ] Инициализация Alembic работает
- [ ] Дерево миграций отображается корректно
- [ ] Граф миграций открывается и показывает данные
- [ ] Кнопки Upgrade/Downgrade/Merge в графе работают
- [ ] Создание миграций работает
- [ ] Upgrade/Downgrade выполняются
- [ ] Merge двух heads создаёт merge-ревизию
- [ ] Настройки доступны и изменяются
- [ ] Редактор alembic.ini применяет пресеты file_template, timezone, truncate_slug_length, валидация путей
- [ ] Подсветка синтаксиса в alembic.ini корректна
- [ ] Инспектор моделей показывает видимые и скрытые сущности
- [ ] Автообновление работает
- [ ] Логи отображаются в Output панели
- [ ] Нет ошибок в Developer Console

## 🐛 Возможные проблемы и решения

### Проблема: "Alembic not found"

**Решение:** Проверьте путь в настройках `alembic.alembicPath`

### Проблема: "Python not found"

**Решение:** Проверьте путь в настройках `alembic.pythonPath`

### Проблема: Дерево миграций не обновляется

**Решение:**

1. Проверьте настройку `alembic.autoRefresh`
2. Вручную обновите: нажмите кнопку Refresh в дереве

### Проблема: Граф не отображается

**Решение:**

1. Проверьте Developer Console на ошибки JavaScript
2. Убедитесь, что есть миграции для отображения

---

**Готово!** Если все тесты прошли успешно, расширение работает корректно! 🎉
