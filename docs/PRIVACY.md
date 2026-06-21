# Rayzek Privacy & Security

Rayzek is designed to be **defensive, local-first, and privacy-respecting**.

## What Rayzek stores (locally, in SQLite)

- Process metadata: name, PID, executable path (when permitted), owning user (when permitted).
- Connection metadata: local/remote IP and port, protocol, TCP state, timestamps, observation count.
- Destination metadata: IP, hostname (reverse DNS), country/city, organization/ASN, coordinates.
- Alerts and their evidence; application settings.

All of this lives in a local database file (`backend/rayzek.db` by default).

## What Rayzek never does

- Capture passwords, cookies, message contents, page contents, or form data.
- Capture packet payloads or attempt HTTPS/TLS decryption.
- Send your process list or connection history to any third-party analytics service.
- Scan other hosts, modify packets, or block/alter connections.

## External requests

The **only** outbound request Rayzek makes is to the configured geolocation provider, and only:

- when `GEOLOCATION_ENABLED=true`, and
- for **public** destination IP addresses (private, loopback, link-local, multicast, and reserved
  addresses are filtered out before any request).

Reverse DNS uses your system resolver and can be disabled (`HOSTNAME_RESOLUTION_ENABLED=false`).
Both can also be toggled from **Settings → Privacy**.

## Network exposure

- The backend binds to `127.0.0.1` by default and is not reachable from other machines.
- CORS is restricted to the local frontend origin.

## Your controls

- **Disable external geolocation** and **disable hostname resolution** in Settings.
- **Clear history** wipes stored connections, destinations, and alerts.
- **Export local data** to CSV.
- **Retention period** automatically prunes old records (configurable; 0 keeps everything).
- The approximate map origin is configurable and never reveals your exact location.

## Heuristics, not verdicts

Alerts and risk scores are conservative heuristics intended to prompt review. An alert does **not**
mean an application is malware, and Rayzek never acts on connections automatically.
