from unittest.mock import MagicMock

from app.services.study_path_service import StudyPathService


def make_service(tmp_path):
    yaml_content = "vaccini:\n  id: abc-123\n  nome: Vaccini\n  argomento: vaccini\n"
    yaml_file = tmp_path / "notebooks.yaml"
    yaml_file.write_text(yaml_content)
    db = MagicMock()
    db.insert.return_value = {"id": "job-1"}
    db.update.return_value = None
    return StudyPathService(db_client=db, notebooks_yaml_path=str(yaml_file))


def test_get_notebooklm_id_found(tmp_path):
    svc = make_service(tmp_path)
    assert svc.get_notebooklm_id("vaccini") == "abc-123"


def test_get_notebooklm_id_not_found(tmp_path):
    svc = make_service(tmp_path)
    assert svc.get_notebooklm_id("missing") is None


def test_list_study_path_calls_select(tmp_path):
    svc = make_service(tmp_path)
    svc.db.select.return_value = [{"id": "a1", "type": "study_guide"}]
    result = svc.list_study_path("nb-1")
    assert result == [{"id": "a1", "type": "study_guide"}]
    svc.db.select.assert_called_once()
    call_kwargs = svc.db.select.call_args
    assert call_kwargs[0][0] == "artifacts"
    assert "eq.nb-1" in call_kwargs[1]["filters"]["notebook_id"]
