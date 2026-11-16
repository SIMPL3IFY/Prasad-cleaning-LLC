"""5. Edge Function attacks: missing or forged secrets, tokens and JWTs, and malformed input."""
import time
import uuid

import pytest

from helpers import MARKER, PUBLIC_KEY, TEST_INBOX, Client, assert_no_leak, fake_claims, forge_jwt

GENERIC_REVIEW_ERROR = "This review link is invalid or expired."


def webhook_body():
    record = {"id": str(uuid.uuid4()), "customer_name": f"{MARKER} webhook probe", "email": TEST_INBOX,
              "service": "Deep Cleaning", "appointment_date": "2030-01-01", "appointment_time": "10:00"}
    return {"type": "INSERT", "table": "accepted_quotes", "schema": "public", "record": record, "old_record": record}


SECRET_ATTEMPTS = {
    "no secret": {},
    "empty secret": {"x-webhook-secret": ""},
    "wrong secret": {"x-webhook-secret": "letmein"},
    "secret in wrong header": {"x-webhook-signature": "letmein"},
    "public key as secret": {"x-webhook-secret": PUBLIC_KEY},
}


@pytest.mark.parametrize("function", ["notify-quote-accepted", "notify-appointment-updated"])
@pytest.mark.parametrize("attempt", SECRET_ATTEMPTS)
def test_notify_functions_require_webhook_secret(anon, function, attempt):
    resp = anon.fn(function, json_body=webhook_body(), headers=SECRET_ATTEMPTS[attempt])
    assert resp.status_code == 401, f"{function} with {attempt}: {resp.status_code} {resp.text[:300]}"


@pytest.mark.parametrize("headers", [{}, {"x-review-cron-secret": ""}, {"x-review-cron-secret": "letmein"}])
def test_review_invites_require_cron_secret(anon, headers):
    resp = anon.fn("send-review-invites", json_body={}, headers=headers)
    assert resp.status_code == 401, f"{resp.status_code}: {resp.text[:300]}"


def test_review_invites_reject_get(anon):
    assert anon.fn("send-review-invites", method="GET").status_code in (401, 405)


FORGED_TOKENS = {
    "garbage": "garbage",
    "alg none": forge_jwt(fake_claims(), alg="none"),
    "alg none as service_role": forge_jwt(fake_claims(role="service_role"), alg="none"),
    "guessed HS256 secret": forge_jwt(fake_claims(), "HS256", "super-secret-jwt-token-with-at-least-32-characters-long"),
    "expired": forge_jwt(fake_claims(exp_offset=-3600), "HS256", "secret"),
}


@pytest.mark.parametrize("function", ["sync-appointment", "delete-account"])
@pytest.mark.parametrize("label", ["missing"] + list(FORGED_TOKENS))
def test_jwt_functions_reject_forged_sessions(function, label):
    # NEVER send a real session to delete-account: it would delete that account.
    client = Client(token=None if label == "missing" else FORGED_TOKENS[label])
    resp = client.fn(function, json_body={"quoteId": str(uuid.uuid4())})
    assert resp.status_code == 401, f"{function} with {label} token: {resp.status_code} {resp.text[:300]}"


@pytest.mark.parametrize("token", [
    "",
    "not-a-token",
    f"{uuid.uuid4()}.{'A' * 43}",
    f"{uuid.uuid4()}.{'A' * 43}extra",
    f"../../{uuid.uuid4()}.{'A' * 43}",
])
def test_review_function_rejects_bad_tokens(anon, token):
    resp = anon.fn("submit-appointment-review", json_body={"token": token, "action": "validate"})
    assert_no_leak(resp)
    assert resp.json().get("error") == GENERIC_REVIEW_ERROR, resp.text[:300]


def test_review_function_does_not_reveal_real_quote_ids(anon, canaries):
    """A forged signature on a real id must look exactly like a random id."""
    real = anon.fn("submit-appointment-review", json_body={"token": f"{canaries['accepted_quotes']['id']}.{'A' * 43}"})
    fake = anon.fn("submit-appointment-review", json_body={"token": f"{uuid.uuid4()}.{'A' * 43}"})
    assert (real.status_code, real.json()) == (fake.status_code, fake.json())


def test_review_function_cannot_submit_with_forged_token(anon, canaries):
    resp = anon.fn("submit-appointment-review", json_body={
        "token": f"{canaries['accepted_quotes']['id']}.{'B' * 43}", "customerName": f"{MARKER} forged",
        "rating": 5, "review": f"{MARKER} forged review",
    })
    assert resp.json().get("error") == GENERIC_REVIEW_ERROR, resp.text[:300]


def test_review_function_handles_broken_json(anon):
    resp = anon.fn("submit-appointment-review", data="{not json", headers={"Content-Type": "application/json"})
    assert_no_leak(resp)
    assert resp.status_code < 500


def test_address_honeypot_blocks_bots(anon):
    resp = anon.fn("validate-address", json_body={
        "address": {"street": "1 Main St", "city": "Sacramento", "state": "CA", "zip": "95814"}, "website": "spam.example",
    })
    assert resp.status_code == 400, resp.text[:300]


def test_address_rejects_huge_body(anon):
    resp = anon.fn("validate-address", json_body={"address": {"street": "A" * 100_000, "city": "B" * 100_000,
                                                             "state": "CA", "zip": "95814"}, "website": ""})
    assert_no_leak(resp)
    assert resp.status_code < 500, f"{resp.status_code}: {resp.text[:300]}"


@pytest.mark.parametrize("function", ["sync-appointment", "delete-account", "notify-quote-accepted",
                                      "send-review-invites", "submit-appointment-review", "validate-address"])
def test_cors_does_not_allow_credentialed_cross_site_calls(anon, function):
    resp = anon.fn(function, method="OPTIONS", auth=False, headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
    })
    allow_origin = resp.headers.get("Access-Control-Allow-Origin", "")
    allow_creds = resp.headers.get("Access-Control-Allow-Credentials", "").lower() == "true"
    assert not (allow_origin == "https://evil.example" and allow_creds), (
        f"{function} lets any website make logged-in requests (reflected origin + credentials)"
    )


VALID_ADDRESS = {"street": "1315 10th St", "city": "Sacramento", "state": "CA", "zip": "95814"}


@pytest.mark.quota
def test_address_rate_limit_kicks_in(anon):
    """Uses up to 11 Geocodio lookups."""
    codes = [anon.fn("validate-address", json_body={"address": VALID_ADDRESS, "website": ""}).status_code
             for _ in range(11)]
    assert 429 in codes, f"No rate limit after 11 quick calls: {codes}"


@pytest.mark.quota
def test_address_rate_limit_cannot_be_bypassed_with_spoofed_ip(anon):
    """The limit is keyed on X-Forwarded-For. If a fake header resets it, attackers can drain the Geocodio quota."""
    time.sleep(61)  # let the previous test's window expire
    codes = []
    for i in range(12):
        resp = anon.fn("validate-address", json_body={"address": VALID_ADDRESS, "website": ""},
                       headers={"X-Forwarded-For": f"203.0.113.{i + 1}"})
        codes.append(resp.status_code)
    assert 429 in codes, f"Rate limit bypassed by rotating X-Forwarded-For: {codes}"
