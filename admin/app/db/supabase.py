from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase settings are missing."""


class SupabaseRequestError(RuntimeError):
    """Raised when a Supabase REST call fails."""


@dataclass
class SupabaseRestClient:
    base_url: str
    api_key: str
    timeout: float = 20.0

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    def select(
        self,
        table: str,
        *,
        select: str,
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
        single: bool = False,
    ) -> list[dict[str, Any]] | dict[str, Any] | None:
        params: dict[str, str] = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        url = f"{self.base_url.rstrip('/')}/rest/v1/{table}?{urlencode(params)}"
        headers = self._headers()
        if single:
            headers["Accept"] = "application/vnd.pgrst.object+json"

        with httpx.Client(timeout=self.timeout) as client:
            response = client.get(url, headers=headers)

        if response.status_code == 404 and single:
            return None
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"Supabase request failed ({response.status_code}): {response.text}"
            )

        if not response.content:
            return None
        return response.json()

    def insert(
        self,
        table: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/rest/v1/{table}"
        headers = {
            **self._headers(),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"Supabase insert failed ({response.status_code}): {response.text}"
            )
        return response.json()[0]

    def update(
        self,
        table: str,
        filters: dict[str, str],
        payload: dict[str, Any],
    ) -> None:
        params: dict[str, str] = {**filters}
        url = f"{self.base_url.rstrip('/')}/rest/v1/{table}?{urlencode(params)}"
        headers = {**self._headers(), "Content-Type": "application/json"}
        with httpx.Client(timeout=self.timeout) as client:
            response = client.patch(url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"Supabase update failed ({response.status_code}): {response.text}"
            )


def build_supabase_client(url: str | None, api_key: str | None) -> SupabaseRestClient:
    if not url or not api_key:
        raise SupabaseConfigError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be configured."
        )
    return SupabaseRestClient(base_url=url, api_key=api_key)
