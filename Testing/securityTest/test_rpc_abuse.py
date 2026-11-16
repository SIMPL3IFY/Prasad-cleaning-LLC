"""4. RPC abuse: database functions called directly by people who aren't admins."""
import uuid

import pytest

from helpers import assert_no_leak, is_denied

# The calls the admin dashboard makes, with valid-looking arguments, so only
# the permission check stands between the caller and the function body.
ADMIN_CALLS = [
    ("scrum242_delete_quote", {"p_table": "quotes", "p_quote_id": str(uuid.uuid4())}),
    ("scrum215_update_completion", {"p_action": "note", "p_appointment_id": str(uuid.uuid4()), "p_note": "x"}),
]
# Cron-only functions. If one runs it only does what the scheduled job does anyway.
CRON_CALLS = [
    ("scrum215_complete_due_appointments", {}),
    ("scrum242_purge_expired_declined_quotes", {}),
]


def assert_rpc_denied(resp, name):
    assert_no_leak(resp)
    assert is_denied(resp) or "Administrator access required" in resp.text, (
        f"{name} ran for a non-admin caller ({resp.status_code}): {resp.text[:300]}"
    )


@pytest.mark.parametrize("name,args", ADMIN_CALLS + CRON_CALLS)
def test_anon_cannot_call_functions(anon, name, args):
    assert_rpc_denied(anon.rpc(name, args), name)


@pytest.mark.parametrize("name,args", ADMIN_CALLS + CRON_CALLS)
def test_customer_cannot_call_functions(customer, name, args):
    assert_rpc_denied(customer.rpc(name, args), name)


@pytest.mark.parametrize("name,args", CRON_CALLS)
def test_admin_cannot_call_cron_functions_from_browser(admin, name, args):
    """These are granted to service_role only, so even an admin session is refused."""
    resp = admin.rpc(name, args)
    assert_no_leak(resp)
    assert is_denied(resp), f"{name} is callable from a browser session: {resp.text[:300]}"


def test_no_function_is_exposed_to_anonymous_users(anon):
    """PostgREST lists only the functions the caller may run. Anonymous users should get none."""
    resp = anon.rest("GET", "")
    if resp.status_code != 200:
        pytest.skip(f"API schema is hidden from anonymous users ({resp.status_code}), which is good")
    exposed = sorted(p.split("/rpc/")[1] for p in resp.json().get("paths", {}) if p.startswith("/rpc/"))
    assert not exposed, f"Functions anonymous users can execute: {exposed}"


def test_customer_sees_only_expected_functions(customer):
    resp = customer.rest("GET", "")
    if resp.status_code != 200:
        pytest.skip(f"API schema is hidden ({resp.status_code})")
    allowed = {name for name, _ in ADMIN_CALLS}  # granted to authenticated, guarded inside
    exposed = {p.split("/rpc/")[1] for p in resp.json().get("paths", {}) if p.startswith("/rpc/")}
    unexpected = sorted(exposed - allowed)
    assert not unexpected, f"Unreviewed functions signed-in users can execute: {unexpected}"
