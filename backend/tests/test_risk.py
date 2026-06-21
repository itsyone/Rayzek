from app.services.risk import RiskInputs, compute_risk, risk_level


def test_risk_boundaries():
    assert risk_level(0) == "low"
    assert risk_level(24) == "low"
    assert risk_level(25) == "review"
    assert risk_level(49) == "review"
    assert risk_level(50) == "elevated"
    assert risk_level(74) == "elevated"
    assert risk_level(75) == "high"
    assert risk_level(100) == "high"


def test_private_destination_is_zero_risk():
    score = compute_risk(
        RiskInputs(private_destination=True, is_new_country=True, uncommon_port=True)
    )
    assert score == 0


def test_score_is_clamped():
    score = compute_risk(
        RiskInputs(
            is_new_destination=True,
            is_new_country=True,
            uncommon_port=True,
            failed_state=True,
            unknown_executable=True,
            high_volume=True,
        )
    )
    assert 0 <= score <= 100


def test_score_is_conservative_for_normal_traffic():
    assert compute_risk(RiskInputs(is_new_destination=True)) < 25
