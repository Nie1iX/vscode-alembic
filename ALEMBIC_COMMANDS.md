# Полезные команды Alembic для получения информации

Этот документ содержит все команды Alembic, которые можно использовать для получения информации о миграциях. Вместо самописного парсинга лучше использовать встроенные команды Alembic.

## Информационные команды

### `alembic current`

Показывает текущую ревизию в базе данных

```bash
alembic current
# Вывод: e828093ed553 (head)
```

### `alembic history`

Показывает историю миграций в хронологическом порядке

```bash
alembic history              # Базовый список
alembic history -v           # Verbose - с подробностями
alembic history -i           # С указанием текущей ревизии
alembic history -r start:end # Диапазон ревизий
```

### `alembic show <revision>`

**🎯 ИСПОЛЬЗУЕМ**: Показывает детали конкретной миграции, включая **путь к файлу**

```bash
alembic show 539911e07bf8
# Вывод:
# Rev: 539911e07bf8
# Parent: 0fffc1ade9f6
# Path: /path/to/migrations/versions/539911e07bf8_add_model_for_muted_notification_in_.py
```

### `alembic heads`

Показывает текущие головы (последние миграции в ветках)

```bash
alembic heads       # Простой список
alembic heads -v    # Verbose с подробностями
```

### `alembic branches`

Показывает точки ветвления

```bash
alembic branches    # Список точек ветвления
alembic branches -v # С подробностями
```

## Команды для проверки

### `alembic check`

Проверяет есть ли pending изменения в автогенерации

```bash
alembic check
```

## Программный API (Python)

Для более сложных случаев можно использовать Python API:

```python
from alembic.script import ScriptDirectory
from alembic.config import Config

# Настройка
cfg = Config('alembic.ini')
script_dir = ScriptDirectory.from_config(cfg)

# Получить ревизию по ID
rev = script_dir.get_revision('539911e07bf8')
print(rev.path)  # Путь к файлу

# Получить все ревизии
revisions = list(script_dir.walk_revisions())

# Получить текущие головы
heads = script_dir.get_heads()
```

## Рекомендации для VS Code расширения

### ✅ Используем команды Alembic

- `alembic show <id>` - для получения пути к файлу миграции
- `alembic history` - для получения списка миграций
- `alembic current` - для определения текущей ревизии
- `alembic heads` - для получения голов веток

### ❌ Избегаем самописного парсинга

- Не парсим файлы миграций самостоятельно
- Не ищем по файловой системе с glob patterns
- Не читаем `alembic.ini` для получения путей к миграциям
- Не парсим переменные `revision = '...'` в файлах

## Примеры использования в коде

### Открытие файла миграции

```typescript
// ✅ Правильно - используем alembic show
const result = await executeCommand(['alembic', 'show', migrationId]);
const pathMatch = result.match(/^Path:\s*(.+)$/m);
const filePath = pathMatch[1].trim();

// ❌ Неправильно - самописный поиск
const files = await vscode.workspace.findFiles('**/migrations/**/*.py');
// ... парсинг файлов
```

### Получение списка миграций

```typescript
// ✅ Правильно - используем alembic history
const historyResult = await executeCommand(['alembic', 'history']);
const currentResult = await executeCommand(['alembic', 'current']);

// ❌ Неправильно - читаем файлы самостоятельно
const migrationFiles = await findFiles('**/*.py');
// ... парсинг содержимого
```
