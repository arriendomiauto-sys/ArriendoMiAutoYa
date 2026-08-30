from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SERVICE_NAME: str = "Arrienda Tu Auto — OCR Service"

    # Clave compartida: el backend la manda en el header X-OCR-Key. Si queda
    # vacía, el servicio no exige autenticación (dev / tests).
    OCR_SERVICE_KEY: str = ""

    # OCR: si USE_OCR_MOCK=True o no hay credenciales de Vision, se usa la
    # simulación determinista con datos chilenos.
    USE_OCR_MOCK: bool = True
    GOOGLE_CLOUD_VISION_API_KEY: Optional[str] = None
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # Fallback local para descargar imágenes servidas como /uploads/... por el
    # backend (mismo disco compartido). En producción normalmente no aplica.
    STORAGE_LOCAL_DIR: str = "./uploads"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
