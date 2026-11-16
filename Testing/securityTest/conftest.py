import os

import pytest

from helpers import MARKER, PUBLIC_KEY, SUPABASE_URL, Client, quote_row, sign_in

QUOTE_TABLES = ("quotes", "accepted_quotes", "declined_quotes")


def pytest_configure(config):
    config.addinivalue_line("markers", "quota: uses up rate limits or paid API calls; run on purpose with -m quota")


@pytest.fixture(scope="session", autouse=True)
def _require_supabase():
    if not SUPABASE_URL or not PUBLIC_KEY:
        pytest.exit("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env", returncode=2)


@pytest.fixture(scope="session")
def anon():
    return Client()


@pytest.fixture(scope="session")
def admin():
    email, password = os.environ.get("TEST_ADMIN_EMAIL"), os.environ.get("TEST_ADMIN_PASSWORD")
    if not email or not password:
        pytest.skip("Set TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (needed to check results and clean up)")
    client = sign_in(email, password)
    rows = client.rest("GET", "profiles", params={"select": "is_admin", "id": f"eq.{client.user_id}"}).json()
    if not rows or not rows[0].get("is_admin"):
        pytest.skip("TEST_ADMIN_EMAIL is not an admin account")
    return client


@pytest.fixture(scope="session")
def customer():
    email, password = os.environ.get("TEST_CUSTOMER_EMAIL"), os.environ.get("TEST_CUSTOMER_PASSWORD")
    if not email or not password:
        pytest.skip("Set TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD (a throwaway customer account)")
    client = sign_in(email, password)
    rows = client.rest("GET", "profiles", params={"select": "is_admin", "id": f"eq.{client.user_id}"}).json()
    if isinstance(rows, list) and rows and rows[0].get("is_admin"):
        pytest.exit("TEST_CUSTOMER_EMAIL is an ADMIN account. Use a plain customer account.", returncode=2)
    return client


@pytest.fixture(scope="session")
def canaries(admin):
    """One admin-made row per quote table. Attackers try to change or delete these
    instead of real customer data, so a hole never damages production rows."""
    made = {}
    for table in QUOTE_TABLES:
        row = quote_row(customer_name=f"{MARKER} Canary {table}")
        if table == "accepted_quotes":
            row["status"] = "accepted"
        if table == "declined_quotes":
            row.pop("status")
            row["decline_reason"] = f"{MARKER} canary"
        resp = admin.rest("POST", table, json_body=row, prefer="return=representation")
        assert resp.status_code == 201, f"Admin could not create the {table} canary: {resp.text[:300]}"
        made[table] = resp.json()[0]
    return made


def read_canary(admin, table, row_id):
    rows = admin.rest("GET", table, params={"select": "*", "id": f"eq.{row_id}"}).json()
    return rows[0] if rows else None


@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    """After the run, delete every row and file tagged with this run's marker."""
    yield
    email, password = os.environ.get("TEST_ADMIN_EMAIL"), os.environ.get("TEST_ADMIN_PASSWORD")
    if not email or not password:
        print(f"\n[security] No admin account, so nothing was cleaned up. Search for '{MARKER}' by hand.")
        return
    admin = sign_in(email, password)
    leftovers = []
    like = f"ilike.*{MARKER}*"

    for table in QUOTE_TABLES:
        rows = admin.rest("GET", table, params={"select": "id", "customer_name": like}).json()
        for row in rows if isinstance(rows, list) else []:
            resp = admin.rpc("scrum242_delete_quote", {"p_table": table, "p_quote_id": row["id"]})
            if resp.status_code >= 300:
                leftovers.append(f"{table} {row['id']}")

    filters = {"or": f"(customer_name.{like},review.{like})"}
    rows = admin.rest("GET", "customer_reviews", params={"select": "id", **filters}).json()
    for row in rows if isinstance(rows, list) else []:
        resp = admin.rest("DELETE", "customer_reviews", params={"id": f"eq.{row['id']}"}, prefer="return=representation")
        if resp.status_code >= 300 or resp.json() == []:
            leftovers.append(f"customer_reviews {row['id']}")

    rows = admin.rest("GET", "services", params={"select": "id", "name": like}).json()
    for row in rows if isinstance(rows, list) else []:
        resp = admin.rest("DELETE", "services", params={"id": f"eq.{row['id']}"}, prefer="return=representation")
        if resp.status_code >= 300 or resp.json() == []:
            leftovers.append(f"services {row['id']}")

    listing = admin.storage("POST", "object/list/service-images", json_body={"prefix": "", "search": MARKER, "limit": 100})
    names = [o["name"] for o in listing.json()] if listing.status_code == 200 else []
    if names:
        resp = admin.storage("DELETE", "object/service-images", json_body={"prefixes": names})
        if resp.status_code >= 300:
            leftovers.extend(f"storage service-images/{n}" for n in names)

    print(f"\n[security] cleanup for {MARKER}: leftovers: {', '.join(leftovers) or 'none'}")
