from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/maddox_quant"
    storage_path: str = "./storage/reports"
    cors_origins: str = "http://localhost:4321"
    llm_api_key: str = ""
    llm_api_base: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"
    auto_analyze: bool = False
    collect_enabled: bool = False
    max_upload_mb: int = 50


settings = Settings()
