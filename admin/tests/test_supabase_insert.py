from unittest.mock import MagicMock, patch

import pytest

from app.db.supabase import SupabaseRequestError, SupabaseRestClient


def make_client():
    return SupabaseRestClient(base_url="https://x.supabase.co", api_key="test-key")


def test_insert_returns_created_row():
    client = make_client()
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = [{"id": "abc", "type": "study_guide"}]

    with patch("httpx.Client") as mock_httpx:
        mock_httpx.return_value.__enter__.return_value.post.return_value = mock_response
        result = client.insert(
            "artifacts",
            {
                "type": "study_guide",
                "notebook_id": "nb1",
                "title": "t",
                "format": "markdown",
                "content": {},
            },
        )

    assert result == {"id": "abc", "type": "study_guide"}


def test_insert_raises_on_error():
    client = make_client()
    mock_response = MagicMock()
    mock_response.status_code = 422
    mock_response.text = "Unprocessable"

    with patch("httpx.Client") as mock_httpx:
        mock_httpx.return_value.__enter__.return_value.post.return_value = mock_response
        with pytest.raises(SupabaseRequestError):
            client.insert("artifacts", {"type": "bad"})


def test_update_calls_patch():
    client = make_client()
    mock_response = MagicMock()
    mock_response.status_code = 204

    with patch("httpx.Client") as mock_httpx:
        mock_patch = mock_httpx.return_value.__enter__.return_value.patch
        mock_patch.return_value = mock_response
        client.update("generation_jobs", {"id": "eq.abc"}, {"status": "done"})

    mock_patch.assert_called_once()
    _, kwargs = mock_patch.call_args
    assert kwargs["json"] == {"status": "done"}
