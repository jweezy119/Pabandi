"""
Pabandi SDK — Trust API client for Python.
"""
from typing import Any, Dict, Optional
import requests


class PabandiClient:
    """Minimal Pabandi Trust API client."""

    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.pabandi.com"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _request(self, path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        resp = requests.request(method, url, json=body, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
        if payload.get("error"):
            raise RuntimeError(payload["error"])
        return payload.get("data")

    def resolve(self, identifier: str) -> Dict[str, Any]:
        """Resolve a trust profile by email, wallet, or handle."""
        return self._request(f"/api/v1/trust/resolve/{identifier}")

    def credential(self, passport_id: str) -> Dict[str, Any]:
        """Get a signed verifiable credential for a passport."""
        return self._request(f"/api/v1/trust/credential/{passport_id}")

    def create_escrow(self, **kwargs: Any) -> Dict[str, Any]:
        """Create a universal escrow."""
        return self._request("/api/v1/escrow", method="POST", body=kwargs)

    def get_escrow(self, reference_id: str) -> Dict[str, Any]:
        """Get escrow by reference ID."""
        return self._request(f"/api/v1/escrow/{reference_id}")

    def update_escrow_status(self, reference_id: str, status: str) -> Dict[str, Any]:
        """Update escrow status."""
        return self._request(
            f"/api/v1/escrow/{reference_id}/status",
            method="PATCH",
            body={"status": status},
        )

    def get_staking_position(self) -> Dict[str, Any]:
        """Get current staking position."""
        return self._request("/api/v1/pab-staking/position")

    def stake(self, amount_pab: int, duration_days: int) -> Dict[str, Any]:
        """Stake PAB tokens."""
        return self._request(
            "/api/v1/pab-staking/stake",
            method="POST",
            body={"amountPab": amount_pab, "durationDays": duration_days},
        )
