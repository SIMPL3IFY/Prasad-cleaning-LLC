"""1. SQL injection: payloads in filters, inserted data, RPC parameters and Edge Function bodies."""
import uuid

import pytest

from helpers import MARKER, assert_no_leak, is_denied, quote_row, rows_of

# 200 = handled as a literal value, 400 = rejected by the API, 403 = blocked by the Cloudflare WAF
SAFE_STATUSES = (200, 400, 403)

FILTER_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "1;DROP TABLE quotes--",
    "x') or (1=1",
    "eq.1)or(1.eq.1",
    "'; SELECT pg_sleep(5)--",
    "%00",
    "\\x00",
    "' UNION SELECT id, email FROM auth.users--",
]

STORED_PAYLOADS = [
    "Robert'); DROP TABLE quotes;--",
    "' OR '1'='1' --",
    "\"; DELETE FROM profiles WHERE 1=1; --",
    "1' AND (SELECT pg_sleep(5)) IS NULL --",
    "$$; drop table quotes; $$",
]


@pytest.mark.parametrize("payload", FILTER_PAYLOADS)
def test_filter_values_do_not_break_out(anon, payload):
    # A service name can never match these, so the result must be empty, not "every row".
    resp = anon.rest("GET", "services", params={"select": "id,name", "name": f"eq.{payload}"})
    assert_no_leak(resp)
    assert resp.status_code in SAFE_STATUSES, resp.text[:300]
    if resp.status_code == 200:
        assert resp.json() == [], f"Payload {payload!r} returned rows: {resp.text[:300]}"


@pytest.mark.parametrize("payload", FILTER_PAYLOADS)
def test_ilike_and_or_filters_do_not_break_out(anon, payload):
    resp = anon.rest("GET", "services", params={"select": "id,name", "or": f"(name.ilike.*{payload}*)"})
    assert_no_leak(resp)
    assert resp.status_code in SAFE_STATUSES, resp.text[:300]
    if resp.status_code == 200:
        assert all(payload.lower() in (r.get("name") or "").lower() for r in resp.json())


def test_cannot_smuggle_extra_filters_through_a_value(anon):
    """A value containing '&' or a second filter must stay one literal value."""
    resp = anon.rest("GET", "services", params={"select": "id", "name": "eq.x&id=not.is.null"})
    assert_no_leak(resp)
    assert resp.status_code in SAFE_STATUSES
    if resp.status_code == 200:
        assert resp.json() == [], f"Smuggled filter returned rows: {resp.text[:300]}"


@pytest.mark.parametrize("embed", ["*,profiles(*)", "*,settings(*)", "*,quotes(*)", "*,auth.users(*)"])
def test_cannot_embed_private_tables(anon, embed):
    resp = anon.rest("GET", "services", params={"select": embed})
    assert_no_leak(resp)
    for row in rows_of(resp):
        for key in ("profiles", "settings", "quotes", "users"):
            assert not row.get(key), f"Private table leaked through embedding: {resp.text[:300]}"


@pytest.mark.parametrize("payload", STORED_PAYLOADS)
def test_payloads_in_quote_form_are_stored_as_plain_text(anon, admin, payload):
    name = f"{MARKER} sqli {uuid.uuid4().hex[:6]}"
    row = quote_row(customer_name=name, message=payload, address=payload, phone=payload[:20])
    resp = anon.rest("POST", "quotes", json_body=row, prefer="return=minimal")
    assert_no_leak(resp)
    assert resp.status_code == 201, f"Quote form insert failed: {resp.status_code} {resp.text[:300]}"

    stored = admin.rest("GET", "quotes", params={"select": "message,address", "customer_name": f"eq.{name}"}).json()
    assert len(stored) == 1, "Exactly one row should exist for this payload"
    assert stored[0]["message"] == payload
    assert stored[0]["address"] == payload
    # The tables the payloads tried to drop still answer
    assert admin.rest("GET", "quotes", params={"select": "id", "limit": 1}).status_code == 200
    assert admin.rest("GET", "profiles", params={"select": "id", "limit": 1}).status_code == 200


@pytest.mark.parametrize("p_table", ["quotes; drop table quotes", "profiles", "public.quotes", "quotes' --", "auth.users"])
def test_delete_rpc_table_name_injection_as_customer(customer, p_table):
    resp = customer.rpc("scrum242_delete_quote", {"p_table": p_table, "p_quote_id": str(uuid.uuid4())})
    assert_no_leak(resp)
    assert is_denied(resp) or "Administrator access required" in resp.text, resp.text[:300]


@pytest.mark.parametrize("p_table", ["quotes; drop table quotes", "profiles", "public.quotes", "auth.users"])
def test_delete_rpc_rejects_unknown_tables_even_for_admin(admin, p_table):
    resp = admin.rpc("scrum242_delete_quote", {"p_table": p_table, "p_quote_id": str(uuid.uuid4())})
    assert_no_leak(resp)
    assert resp.status_code >= 400 and "Unknown quote table" in resp.text, resp.text[:300]
    assert admin.rest("GET", "quotes", params={"select": "id", "limit": 1}).status_code == 200


@pytest.mark.parametrize("args", [
    {"p_table": "quotes", "p_quote_id": "not-a-uuid"},
    {"p_table": "quotes", "p_quote_id": "' OR 1=1--"},
    {"p_table": None, "p_quote_id": None},
])
def test_delete_rpc_bad_ids(customer, args):
    resp = customer.rpc("scrum242_delete_quote", args)
    assert_no_leak(resp)
    assert resp.status_code >= 400


@pytest.mark.parametrize("action", ["complete' --", "note; drop table appointment_completions", None])
def test_completion_rpc_action_injection(customer, action):
    resp = customer.rpc("scrum215_update_completion", {"p_action": action, "p_appointment_id": str(uuid.uuid4())})
    assert_no_leak(resp)
    assert resp.status_code >= 400


@pytest.mark.parametrize("token", ["' OR 1=1--", "x" * 36 + "." + "y" * 43, {"$ne": None}, ["a"], 12345])
def test_review_function_rejects_injected_tokens(anon, token):
    resp = anon.fn("submit-appointment-review", json_body={"token": token, "action": "validate"})
    assert_no_leak(resp)
    assert "invalid or expired" in resp.text, resp.text[:300]


@pytest.mark.parametrize("address", [
    "'; DROP TABLE quotes--",
    ["1 Main St"],
    {"street": {"$gt": ""}, "city": ["x"], "state": None, "zip": 1},
    None,
])
def test_address_function_rejects_bad_shapes(anon, address):
    # These shapes fail validation before any paid Geocodio lookup happens.
    resp = anon.fn("validate-address", json_body={"address": address, "website": ""})
    assert_no_leak(resp)
    assert resp.status_code == 400, f"{resp.status_code}: {resp.text[:300]}"
