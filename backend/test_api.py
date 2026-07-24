import requests
import json

base_url = "http://localhost:8000/api"

print("Logging in...")
res = requests.post(f"{base_url}/auth/login", json={"email": "prajwalganiga06@gmail.com", "password": "12345678"})
if res.status_code == 200:
    token = res.json().get("token")
    print("Login success.")
    print("Fetching predictions...")
    res2 = requests.get(f"{base_url}/predict", headers={"Authorization": f"Bearer {token}"})
    print(f"Status: {res2.status_code}")
    print(res2.text)
else:
    print("Login failed:")
    print(res.status_code, res.text)
