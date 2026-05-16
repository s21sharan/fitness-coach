"""Interactive Garmin login that seeds the persistent token cache.

Garmin's SSO endpoint is aggressively IP rate-limited. Once that cache exists,
every subsequent sync uses the cached OAuth tokens against API endpoints (which
have separate, much looser limits) and never touches SSO again — so the
escape hatch for a blocked IP is to run this script once from a *different*
network (mobile hotspot, VPN), let it write the token file, then run the
service normally from your usual IP.

Usage:
    python services/garmin/cli_login.py
    GARMIN_EMAIL=... GARMIN_PASSWORD=... python services/garmin/cli_login.py
"""
import getpass
import os
import sys

from garmin_client import _token_dir_for, create_client, GarminMFARequired
from garminconnect import (
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)


def main() -> int:
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

    token_dir = _token_dir_for(email)
    print(f"[cli_login] token dir: {token_dir}")

    mfa_code: str | None = None
    while True:
        try:
            client = create_client(email, password, mfa_code=mfa_code)
            break
        except GarminMFARequired:
            mfa_code = input("MFA code: ").strip()
            continue
        except GarminConnectAuthenticationError as e:
            print(f"[cli_login] auth failed: {e}", file=sys.stderr)
            return 2
        except GarminConnectTooManyRequestsError as e:
            print(f"[cli_login] rate limited: {e}", file=sys.stderr)
            print(
                "[cli_login] your IP is blocked by Garmin SSO. Try a different "
                "network (mobile hotspot / VPN) and re-run this script.",
                file=sys.stderr,
            )
            return 3

    profile = client.display_name or "(unknown)"
    print(f"[cli_login] logged in as {profile}")

    token_file = os.path.join(token_dir, "garmin_tokens.json")
    if os.path.exists(token_file):
        size = os.path.getsize(token_file)
        print(f"[cli_login] tokens persisted to {token_file} ({size} bytes)")
        print("[cli_login] you can now restart the FastAPI service and sync should work.")
        return 0

    print(f"[cli_login] WARNING: expected token file {token_file} was not created", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
