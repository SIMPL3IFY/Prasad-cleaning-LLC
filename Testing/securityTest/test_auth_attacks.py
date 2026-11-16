"""6. Auth attacks: forged tokens, account enumeration, weak passwords, brute force."""
import uuid

import pytest
import requests

from helpers import PUBLIC_KEY, RUN_ID, SUPABASE_URL, TIMEOUT, Client, fake_claims, forge_jwt, tamper_payload


def auth_post(path, body):
    return requests.post(f"{SUPABASE_URL}/auth/v1/{path}", json=body, headers={"apikey": PUBLIC_KEY}, timeout=TIMEOUT)


def forged_tokens(customer):
    return {
        "alg none": forge_jwt(fake_claims(sub=customer.user_id), alg="none"),
        "alg none service_role": forge_jwt(fake_claims(role="service_role"), alg="none"),
        "guessed default secret": forge_jwt(fake_claims(role="service_role"), "HS256",
                                            "super-secret-jwt-token-with-at-least-32-characters-long"),
        "real token, role changed": tamper_payload(customer.token, role="service_role"),
        "real token, user changed": tamper_payload(customer.token, sub=str(uuid.uuid4())),
        "real token, expiry pushed": tamper_payload(customer.token, exp=4102444800),
        "real token, signature removed": customer.token.rsplit(".", 1)[0] + ".",
    }


@pytest.mark.parametrize("label", [
    "alg none", "alg none service_role", "guessed default secret", "real token, role changed",
    "real token, user changed", "real token, expiry pushed", "real token, signature removed",
])
def test_database_rejects_forged_jwts(customer, label):
    token = forged_tokens(customer)[label]
    resp = Client(token=token).rest("GET", "profiles", params={"select": "id,is_admin", "limit": 5})
    assert resp.status_code == 401, f"Forged JWT ({label}) accepted: {resp.status_code} {resp.text[:300]}"


def test_auth_server_rejects_tampered_token(customer):
    resp = requests.get(f"{SUPABASE_URL}/auth/v1/user", timeout=TIMEOUT, headers={
        "apikey": PUBLIC_KEY, "Authorization": f"Bearer {tamper_payload(customer.token, sub=str(uuid.uuid4()))}",
    })
    assert resp.status_code in (401, 403), resp.text[:300]


def test_sign_in_errors_do_not_reveal_which_emails_exist(customer):
    real = auth_post("token?grant_type=password", {"email": customer.email, "password": f"wrong-{RUN_ID}"})
    fake = auth_post("token?grant_type=password", {"email": f"nobody-{RUN_ID}@example.invalid", "password": f"wrong-{RUN_ID}"})
    assert real.status_code == fake.status_code, (real.status_code, fake.status_code)
    pick = lambda r: {k: r.json().get(k) for k in ("error_code", "msg", "error", "error_description")}
    assert pick(real) == pick(fake), f"Different errors for real vs unknown email: {pick(real)} vs {pick(fake)}"


@pytest.mark.parametrize("password", ["123", "abc12"])
def test_sign_up_rejects_short_passwords(password):
    # Rejected before any account or email is created
    resp = auth_post("signup", {"email": f"sectest-{RUN_ID}-{len(password)}@example.invalid", "password": password})
    assert resp.status_code in (400, 422), f"Weak password {password!r} accepted: {resp.text[:300]}"


@pytest.mark.quota
def test_password_brute_force_gets_rate_limited():
    """Locks YOUR IP out of signing in for about 5 minutes. Uses a made-up email, so no real account is locked."""
    email = f"bruteforce-{RUN_ID}@example.invalid"
    codes = []
    for i in range(40):
        codes.append(auth_post("token?grant_type=password", {"email": email, "password": f"guess-{i}"}).status_code)
        if codes[-1] == 429:
            break
    assert 429 in codes, f"No rate limit after {len(codes)} wrong passwords: {sorted(set(codes))}"


@pytest.mark.quota
def test_password_reset_does_not_reveal_which_emails_exist(customer):
    """Sends one real reset email to the test customer's inbox."""
    real = auth_post("recover", {"email": customer.email})
    fake = auth_post("recover", {"email": f"nobody-{RUN_ID}@example.invalid"})
    assert real.status_code == fake.status_code, (real.status_code, real.text[:200], fake.status_code, fake.text[:200])
