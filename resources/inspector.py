import json
import os
import sys
import types
from pathlib import Path


class _StopImport(Exception):
    pass


def _prepare_alembic_context(config_path):
    try:
        # Prefer real Alembic Config when available
        from alembic.config import Config

        cfg = Config(config_path)
    except Exception:
        # Minimal stub if Alembic isn't importable in this interpreter
        class _Cfg:
            def __init__(self, path):
                self.config_file_name = str(Path(path).resolve())
                self.config_ini_section = "alembic"
                self.attributes = {}

            def get_main_option(self, name, default=None):
                return default

            def get_section(self, name):
                return {}

        cfg = _Cfg(config_path)

    # Monkey-patch alembic.context for env.py import time
    try:
        import alembic.context as ctx_mod  # type: ignore
    except Exception:
        # Create stub module hierarchy if alembic cannot be imported
        alembic_pkg = types.ModuleType("alembic")
        ctx_mod = types.ModuleType("alembic.context")
        sys.modules["alembic"] = alembic_pkg
        sys.modules["alembic.context"] = ctx_mod
        setattr(alembic_pkg, "context", ctx_mod)

    ctx_mod.config = cfg
    # Stubs commonly referenced by env.py at import-time
    ctx_mod.get_x_argument = lambda *a, **k: None
    ctx_mod.get_tag_argument = lambda *a, **k: None
    ctx_mod.get_context = lambda: None
    ctx_mod.configure = lambda *a, **k: None

    # Prevent executing run_migrations_* on import
    def _is_offline_mode():
        raise _StopImport("Skip run_migrations on import")

    ctx_mod.is_offline_mode = _is_offline_mode
    return cfg


def _exec_env_py(env_path, config_path):
    g = {"__name__": "alembic_env", "__file__": str(env_path)}
    _prepare_alembic_context(config_path)
    code = Path(env_path).read_text(encoding="utf-8")
    errors = []
    try:
        exec(compile(code, str(env_path), "exec"), g)
    except _StopImport:
        pass
    except Exception as e:
        errors.append(str(e))
    return g, errors


def load_env(config_path):
    # Locate env.py relative to alembic.ini
    cfg_dir = Path(config_path).resolve().parent
    candidates = [cfg_dir / "alembic" / "env.py", cfg_dir / "env.py"]
    for p in candidates:
        if p.exists():
            g, errors = _exec_env_py(str(p), config_path)
            return g, errors
    return None, ["env.py not found near alembic.ini"]


def get_target_metadata(globals_dict):
    # Try common patterns: target_metadata or any *metadata with tables
    if not isinstance(globals_dict, dict):
        return None
    tm = globals_dict.get("target_metadata")
    if tm is not None:
        return tm
    for k, v in globals_dict.items():
        if k.endswith("metadata") and getattr(v, "tables", None) is not None:
            return v
    return None


def list_declared_models():
    # Best-effort: import SQLAlchemy and iterate over Base subclasses if present
    try:
        from sqlalchemy.orm import DeclarativeMeta

        subclasses = set()
        for cls in DeclarativeMeta.__subclasses__():
            try:
                if getattr(cls, "__tablename__", None):
                    subclasses.add(cls)
            except Exception:
                pass
        return sorted({f"{c.__module__}.{c.__name__}" for c in subclasses})
    except Exception:
        return []


def main():
    # params: script.py -c alembic.ini
    cfg = None
    args = sys.argv[1:]
    for i in range(len(args)):
        if args[i] == "-c" and i + 1 < len(args):
            cfg = args[i + 1]
            break
    if not cfg:
        print(json.dumps({"errors": ["no -c config"]}))
        return

    # allow VSCode to pass PYTHONPATH
    ws = os.environ.get("VSCODE_WORKSPACE")
    if ws and ws not in sys.path:
        sys.path.insert(0, ws)

    env_globals, import_errors = load_env(cfg)
    if env_globals is None:
        print(
            json.dumps(
                {"errors": import_errors, "visible_models": [], "hidden_models": []}
            )
        )
        return

    md = get_target_metadata(env_globals)
    visible = []
    if md is not None:
        try:
            visible = sorted(list(md.tables.keys()))
        except Exception as e:
            import_errors.append(str(e))

    declared = list_declared_models()
    # hidden models: declared classes whose __tablename__ not in target md
    hidden = []
    for qual in declared:
        try:
            mod_name, cls_name = qual.rsplit(".", 1)
            mod = __import__(mod_name, fromlist=[cls_name])
            cls = getattr(mod, cls_name)
            tn = getattr(cls, "__tablename__", None)
            if tn and (md is None or tn not in md.tables):
                hidden.append(f"{qual} (table: {tn})")
        except Exception:
            pass

    print(
        json.dumps(
            {
                "visible_models": visible,
                "hidden_models": hidden,
                "errors": import_errors,
            }
        )
    )


if __name__ == "__main__":
    main()
