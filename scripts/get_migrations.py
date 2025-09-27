#!/usr/bin/env python3
"""
Пример скрипта для получения списка миграций через Alembic API
Может использоваться вместо парсинга вывода alembic history

Использование: python get_migrations.py path/to/alembic.ini
"""

import sys
import json
from pathlib import Path


def get_migrations(config_path):
    try:
        from alembic.script import ScriptDirectory
        from alembic.config import Config

        cfg = Config(config_path)
        script_dir = ScriptDirectory.from_config(cfg)

        migrations = []
        for rev in script_dir.walk_revisions():
            migrations.append(
                {
                    "id": rev.revision,
                    "down_revision": rev.down_revision,
                    "message": rev.doc or "",
                    "path": str(rev.path) if rev.path else "",
                    "short_id": rev.revision[:12] if rev.revision else "",
                }
            )

        return {"success": True, "migrations": migrations}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_current_revision(config_path):
    """Получить текущую ревизию из базы данных"""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.runtime.environment import EnvironmentContext
        from alembic import command

        # Это сложнее, требует подключения к БД
        # Лучше использовать alembic current команду
        return None
    except:
        return None


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": "Usage: python get_migrations.py alembic.ini",
                }
            )
        )
        sys.exit(1)

    config_path = sys.argv[1]
    if not Path(config_path).exists():
        print(
            json.dumps(
                {"success": False, "error": f"Config file not found: {config_path}"}
            )
        )
        sys.exit(1)

    result = get_migrations(config_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
