from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    app_name: str = "Story Flicks"
    debug: bool = True
    version: str = "1.0.0"
    
    # provider configuration
    text_provider: str = "openai"
    image_provider: str = "openai"

    # base url configuration
    openai_base_url: str = "https://api.openai.com/v1"
    aliyun_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    ollama_base_url: str = "http://localhost:11434/v1"
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"

    # api key
    openai_api_key: str = ""
    aliyun_api_key: str = ""
    deepseek_api_key: str = ""
    ollama_api_key: str = ""
    siliconflow_api_key: str = ""

    text_llm_model: str = "gpt-4o"
    image_llm_model: str = "dall-e-3"

    class Config:
        env_file = ".env"

def get_settings() -> Settings:
    return Settings()
