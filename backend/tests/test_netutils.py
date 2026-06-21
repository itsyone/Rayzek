from app.utils.netutils import (
    ConnectionIdentity,
    classify_ip,
    is_non_public_ip,
    is_uncommon_port,
)


def test_private_ip_detection():
    assert is_non_public_ip("192.168.1.1") is True
    assert is_non_public_ip("10.0.0.5") is True
    assert is_non_public_ip("127.0.0.1") is True
    assert is_non_public_ip("169.254.1.1") is True
    assert is_non_public_ip("224.0.0.1") is True
    assert is_non_public_ip(None) is True
    assert is_non_public_ip("not-an-ip") is True


def test_public_ip_detection():
    assert is_non_public_ip("142.250.181.14") is False
    assert is_non_public_ip("1.1.1.1") is False


def test_classify_ip():
    assert classify_ip("127.0.0.1") == "loopback"
    assert classify_ip("192.168.0.1") == "private"
    assert classify_ip("8.8.8.8") == "public"
    assert classify_ip("bad") == "invalid"


def test_uncommon_port():
    assert is_uncommon_port(443) is False
    assert is_uncommon_port(80) is False
    # High/ephemeral ports are NOT flagged (VPN/WebRTC/P2P use them normally).
    assert is_uncommon_port(51820) is False
    assert is_uncommon_port(None) is False
    # Only a curated set of genuinely notable ports is flagged.
    assert is_uncommon_port(4444) is True
    assert is_uncommon_port(3389) is True
    assert is_uncommon_port(23) is True


def test_connection_identity_key_is_stable():
    a = ConnectionIdentity(1, "192.168.1.2", 5000, "8.8.8.8", 443, "TCP")
    b = ConnectionIdentity(1, "192.168.1.2", 5000, "8.8.8.8", 443, "TCP")
    assert a.key() == b.key()
    c = ConnectionIdentity(2, "192.168.1.2", 5000, "8.8.8.8", 443, "TCP")
    assert a.key() != c.key()
