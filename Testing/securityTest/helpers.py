"""Shared helpers for the security attack tests.

Every request goes straight to Supabase / Vercel over HTTP, the same way an attacker
would, using only the public key that ships in the site's JavaScript bundle.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
TIMEOUT = 30


def load_env():
    """Read the project's .env without overriding variables already set in the shell."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
PUBLIC_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY", "")
SITE_URL = os.environ.get("SITE_URL", "https://prasadscleaning.com").rstrip("/")

# Every row a test writes carries this marker so cleanup can find it afterwards.
RUN_ID = uuid.uuid4().hex[:8]
MARKER = f"SECTEST-{RUN_ID}"
# Inbox the team already uses for test mail. Any email a test triggers goes here.
TEST_INBOX = "prasad.testers2026@gmail.com"

# Text that means the server leaked database internals instead of a clean error.
LEAK_PATTERNS = [
    "syntax error at or near",
    "unterminated quoted string",
    "pg_catalog",
    "Traceback (most recent call last)",
    "    at ",
]

# Postgres "insufficient privilege" error code
PERMISSION_DENIED = "42501"


class Client:
    """One attacker identity: anonymous, a customer, or an admin."""

    def __init__(self, token=None, user_id=None, email=None):
        self.token = token
        self.user_id = user_id
        self.email = email

    def headers(self, extra=None):
        h = {"apikey": PUBLIC_KEY}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if extra:
            h.update(extra)
        return h

    def rest(self, method, path, json_body=None, params=None, prefer=None, headers=None):
        extra = dict(headers or {})
        if prefer:
            extra["Prefer"] = prefer
        return requests.request(
            method, f"{SUPABASE_URL}/rest/v1/{path}", params=params, json=json_body,
            headers=self.headers(extra), timeout=TIMEOUT,
        )

    def rpc(self, name, args=None):
        return self.rest("POST", f"rpc/{name}", json_body=args or {})

    def fn(self, name, method="POST", json_body=None, headers=None, data=None, auth=True):
        h = self.headers(headers) if auth else {"apikey": PUBLIC_KEY, **(headers or {})}
        return requests.request(
            method, f"{SUPABASE_URL}/functions/v1/{name}", json=json_body, data=data,
            headers=h, timeout=TIMEOUT,
        )

    def storage(self, method, path, data=None, json_body=None, headers=None):
        return requests.request(
            method, f"{SUPABASE_URL}/storage/v1/{path}", data=data, json=json_body,
            headers=self.headers(headers), timeout=TIMEOUT,
        )


def sign_in(email, password):
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": PUBLIC_KEY}, timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sign in failed for test account ({resp.status_code}): {resp.text[:200]}")
    body = resp.json()
    return Client(body["access_token"], body["user"]["id"], body["user"]["email"])


# ---------- assertions ----------

def body_text(resp):
    try:
        return resp.text
    except Exception:
        return ""


def is_waf_block(resp):
    """Cloudflare (in front of Supabase) answers obvious attack strings with its own 403 page."""
    return resp.status_code == 403 and "cloudflare" in resp.headers.get("server", "").lower()


def assert_no_leak(resp):
    if is_waf_block(resp):
        return
    text = body_text(resp)
    for pattern in LEAK_PATTERNS:
        assert pattern not in text, f"Server leaked internals ({pattern!r}): {text[:300]}"
    assert resp.status_code < 500 or resp.status_code in (501, 503), (
        f"Server crashed with {resp.status_code}: {text[:300]}"
    )


def json_or_none(resp):
    try:
        return resp.json()
    except ValueError:
        return None


def rows_of(resp):
    """The rows a read returned, or [] when it returned an error object or nothing."""
    body = json_or_none(resp)
    return body if isinstance(body, list) else []


def is_denied(resp):
    """True when PostgREST refused the request outright."""
    if resp.status_code in (401, 403, 404):
        return True
    body = json_or_none(resp)
    return isinstance(body, dict) and body.get("code") == PERMISSION_DENIED


def assert_blocked_or_empty(resp, what):
    """A read or write must either be refused or touch zero rows."""
    assert_no_leak(resp)
    if is_denied(resp):
        return
    body = json_or_none(resp)
    assert resp.status_code in (200, 204, 206) and body in ([], None), (
        f"{what}: expected blocked or empty, got {resp.status_code}: {body_text(resp)[:300]}"
    )


def assert_insert_blocked(resp, what):
    assert_no_leak(resp)
    assert resp.status_code not in (200, 201, 204), (
        f"{what}: insert was ACCEPTED ({resp.status_code}): {body_text(resp)[:300]}"
    )


# ---------- JWT forging ----------

def b64url(data):
    if isinstance(data, (dict, list)):
        data = json.dumps(data, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(part):
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def decode_jwt_payload(token):
    try:
        return json.loads(b64url_decode(token.split(".")[1]))
    except Exception:
        return None


def forge_jwt(payload, alg="none", secret=""):
    header = {"alg": alg, "typ": "JWT"}
    signing_input = f"{b64url(header)}.{b64url(payload)}"
    if alg == "none":
        return signing_input + "."
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(sig)}"


def fake_claims(role="authenticated", sub=None, exp_offset=3600):
    now = int(time.time())
    return {
        "iss": f"{SUPABASE_URL}/auth/v1",
        "aud": "authenticated",
        "role": role,
        "sub": sub or str(uuid.uuid4()),
        "iat": now,
        "exp": now + exp_offset,
    }


def tamper_payload(token, **changes):
    """Keep the real signature but change the claims, the classic JWT tampering attack."""
    header, payload, sig = token.split(".")
    claims = json.loads(b64url_decode(payload))
    claims.update(changes)
    return f"{header}.{b64url(claims)}.{sig}"


JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+")


def quote_row(**overrides):
    """A quote shaped like the public quote form sends it, tagged with the run marker."""
    row = {
        "customer_name": f"{MARKER} Security Probe",
        "email": TEST_INBOX,
        "phone": "9165550100",
        "address": "1 Test St, Sacramento, CA 95814",
        "property": "House",
        "service": "Deep Cleaning",
        "message": f"{MARKER} automated security test, safe to delete",
        "status": "pending",
    }
    row.update(overrides)
    return row
