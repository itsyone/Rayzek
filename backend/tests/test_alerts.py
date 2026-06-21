from app.services.alerts import AlertEngine


def _evaluate_many(engine, n, **kwargs):
    drafts = []
    for _ in range(n):
        drafts.extend(engine.evaluate(**kwargs))
    return drafts


def test_new_destination_rule():
    engine = AlertEngine({"enable_new_destination": True})
    drafts = engine.evaluate(
        process_name="chrome.exe",
        executable_path="C:/chrome.exe",
        remote_ip="8.8.8.8",
        remote_port=443,
        country_code="US",
        country_name="United States",
        status="ESTABLISHED",
        is_new_connection=True,
    )
    types = {d.alert_type for d in drafts}
    assert "new_destination" in types
    # Evidence must be present and machine-readable.
    nd = next(d for d in drafts if d.alert_type == "new_destination")
    assert nd.evidence["rule"] == "new_destination"
    assert nd.evidence["remote_ip"] == "8.8.8.8"


def test_burst_detection_rule():
    engine = AlertEngine({"burst_threshold": 10})
    drafts = []
    for i in range(12):
        drafts.extend(
            engine.evaluate(
                process_name="unknown.exe",
                executable_path=None,
                remote_ip=f"8.8.8.{i}",
                remote_port=443,
                country_code="US",
                country_name="United States",
                status="SYN_SENT",
                is_new_connection=True,
            )
        )
    assert any(d.alert_type == "connection_burst" for d in drafts)
    burst = next(d for d in drafts if d.alert_type == "connection_burst")
    assert burst.evidence["connections_in_60_seconds"] >= 10


def test_uncommon_port_rule():
    engine = AlertEngine()
    # A notable port (e.g. 4444) is flagged; a high/ephemeral port is not.
    drafts = engine.evaluate(
        process_name="weird.exe",
        executable_path="C:/weird.exe",
        remote_ip="8.8.8.8",
        remote_port=4444,
        country_code="US",
        country_name="United States",
        status="ESTABLISHED",
        is_new_connection=True,
    )
    assert any(d.alert_type == "uncommon_port" for d in drafts)


def test_high_ephemeral_port_does_not_alert():
    engine = AlertEngine()
    drafts = engine.evaluate(
        process_name="vpn.exe",
        executable_path="C:/vpn.exe",
        remote_ip="8.8.8.8",
        remote_port=51820,  # WireGuard / typical VPN port
        country_code="US",
        country_name="United States",
        status="ESTABLISHED",
        is_new_connection=True,
    )
    assert not any(d.alert_type == "uncommon_port" for d in drafts)


def test_self_process_is_never_alerted():
    engine = AlertEngine({"enable_new_destination": True})
    drafts = engine.evaluate(
        process_name="rayzek.exe",
        executable_path="C:/rayzek.exe",
        remote_ip="8.8.8.8",
        remote_port=4444,
        country_code="FR",
        country_name="France",
        status="ESTABLISHED",
        is_new_connection=True,
    )
    assert drafts == []


def test_no_alerts_when_rules_disabled():
    engine = AlertEngine(
        {
            "enable_new_country": False,
            "enable_new_destination": False,
            "enable_connection_burst": False,
            "enable_many_countries": False,
            "enable_uncommon_port": False,
            "enable_repeated_failures": False,
            "enable_unknown_executable": False,
        }
    )
    drafts = engine.evaluate(
        process_name="chrome.exe",
        executable_path="C:/chrome.exe",
        remote_ip="8.8.8.8",
        remote_port=51820,
        country_code="US",
        country_name="United States",
        status="ESTABLISHED",
        is_new_connection=True,
    )
    assert drafts == []
