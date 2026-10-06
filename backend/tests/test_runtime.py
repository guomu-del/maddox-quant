from app.core.runtime import is_serverless, scheduler_enabled


def test_vercel_region_disables_scheduler(monkeypatch):
    monkeypatch.setenv("VERCEL_REGION", "iad1")
    monkeypatch.delenv("ENABLE_SCHEDULER", raising=False)
    assert is_serverless()
    assert not scheduler_enabled()


def test_enable_scheduler_flag_overrides_serverless(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("ENABLE_SCHEDULER", "1")
    assert scheduler_enabled()
