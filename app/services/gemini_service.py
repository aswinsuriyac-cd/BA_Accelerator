import os
from collections.abc import Sequence
from typing import Any

from google import genai
from google.genai import errors

from app.config import settings


QUOTA_ERROR_STATUSES = {"RESOURCE_EXHAUSTED", "RATE_LIMIT_EXCEEDED"}
QUOTA_ERROR_PHRASES = ("quota", "rate limit", "resource exhausted", "too many requests")


def _split_api_keys(value: str | None) -> list[str]:
    if not value:
        return []

    normalized = value.replace("\n", ",").replace(";", ",")
    return [key.strip() for key in normalized.split(",") if key.strip()]


def get_gemini_api_keys() -> list[str]:
    keys = [
        settings.gemini_api_key,
        os.environ.get("GEMINI_API_KEY"),
        *_split_api_keys(settings.gemini_fallback_api_keys),
        *_split_api_keys(os.environ.get("GEMINI_FALLBACK_API_KEYS")),
        *_split_api_keys(settings.gemini_api_keys),
        *_split_api_keys(os.environ.get("GEMINI_API_KEYS")),
    ]

    deduped_keys: list[str] = []
    for key in keys:
        if key and key not in deduped_keys:
            deduped_keys.append(key)

    return deduped_keys


def _is_quota_error(exc: errors.APIError) -> bool:
    status = str(getattr(exc, "status", "") or "").upper()
    code = getattr(exc, "code", None)
    message = str(getattr(exc, "message", "") or exc).lower()

    return code == 429 or status in QUOTA_ERROR_STATUSES or any(
        phrase in message for phrase in QUOTA_ERROR_PHRASES
    )


def _masked_key_label(index: int, key: str) -> str:
    suffix = key[-4:] if len(key) >= 4 else "****"
    return f"key #{index + 1} (...{suffix})"


class GeminiFallbackClient:
    def __init__(self, api_keys: Sequence[str] | None = None):
        self.api_keys = list(api_keys or get_gemini_api_keys())
        self._clients: dict[str, genai.Client] = {}

    def _client_for_key(self, api_key: str) -> genai.Client:
        if api_key not in self._clients:
            self._clients[api_key] = genai.Client(api_key=api_key)
        return self._clients[api_key]

    def generate_content(self, *, model: str, contents: Any, config: Any):
        if not self.api_keys:
            raise ValueError(
                "No Gemini API keys are configured. Set GEMINI_API_KEY, "
                "GEMINI_FALLBACK_API_KEYS, or GEMINI_API_KEYS in your `.env` file."
            )

        quota_failures: list[str] = []
        for index, api_key in enumerate(self.api_keys):
            try:
                return self._client_for_key(api_key).models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
            except errors.APIError as exc:
                if _is_quota_error(exc):
                    quota_failures.append(f"{_masked_key_label(index, api_key)}: {exc.message}")
                    if index < len(self.api_keys) - 1:
                        continue

                    raise RuntimeError(
                        "All configured Gemini API keys are exhausted or rate limited. "
                        f"Attempted {len(self.api_keys)} key(s). Last error: {exc.message}"
                    ) from exc
                raise

        raise RuntimeError(
            "All configured Gemini API keys failed with quota or rate-limit errors: "
            + "; ".join(quota_failures)
        )


def generate_content_with_fallback(*, model: str, contents: Any, config: Any):
    return GeminiFallbackClient().generate_content(model=model, contents=contents, config=config)
