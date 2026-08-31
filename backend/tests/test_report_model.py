from app.models.report import Report


def test_report_has_required_fields():
    report = Report(title="测试研报", status="pending")
    assert report.title == "测试研报"
    assert report.status == "pending"
