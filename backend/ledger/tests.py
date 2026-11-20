from rest_framework.test import APITestCase


class FlowTest(APITestCase):
    def token(self, email, register=False):
        url = "/api/auth/register/" if register else "/api/auth/login/"
        r = self.client.post(url, {"email": email, "password": "password123"}, format="json")
        self.assertIn(r.status_code, (200, 201), r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def post(self, url, data, code=201):
        r = self.client.post(url, data, format="json")
        self.assertEqual(r.status_code, code, r.content)
        return r.data

    def test_full_flow(self):
        self.token("A@x.com", register=True)
        self.token("a@x.com")
        t = self.post("/api/trips/", {"name": "파리", "currency": "원", "start_date": "2025-05-14"})["id"]
        b = f"/api/trips/{t}"
        p1 = self.post(f"{b}/persons/", {"name": "민준"})["id"]
        p2 = self.post(f"{b}/persons/", {"name": "서연"})["id"]
        c = self.post(f"{b}/cards/", {"name": "트래블월렛", "owner": p1, "card_type": "트래블카드"})["id"]
        self.post(f"{b}/recharges/", {"person": p2, "card": c, "amount": 100000, "recharged_at": "2025-05-14"})
        e = {"card": c, "description": "저녁", "category": "식비", "total_amount": 500,
             "used_at": "2025-05-18T12:00:00", "shares": [{"person": p1, "amount": 300}, {"person": p2, "amount": 200}]}
        self.post(f"{b}/expenses/", {**e, "shares": [{"person": p1, "amount": 300}]}, 400)
        eid = self.post(f"{b}/expenses/", e)["id"]
        r = self.client.patch(f"{b}/expenses/{eid}/", {"total_amount": 400, "shares": [{"person": p1, "amount": 400}]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        d = self.client.get(f"{b}/").data
        self.assertEqual(len(d["expenses"]), 1)
        self.assertEqual(d["expenses"][0]["used_at"][:10], "2025-05-18")
        self.assertEqual(len(d["expenses"][0]["shares"]), 1)
        self.assertEqual(len(d["recharges"]), 1)
        self.assertEqual(self.client.delete(f"{b}/persons/{p1}/").status_code, 409)
        self.assertEqual(self.client.delete(f"{b}/cards/{c}/").status_code, 409)
        self.assertEqual(self.client.delete(f"{b}/expenses/{eid}/").status_code, 204)
        # 다른 사용자는 접근 불가 → 초대 후 접근 가능, 삭제는 owner만
        self.token("b@x.com", register=True)
        self.assertEqual(self.client.get(f"{b}/").status_code, 404)
        self.token("a@x.com")
        self.post(f"{b}/members/", {"email": "b@x.com"}, 200)
        self.token("b@x.com")
        self.assertEqual(self.client.get(f"{b}/").status_code, 200)
        self.assertEqual(self.client.delete(f"{b}/").status_code, 403)
        self.token("a@x.com")
        self.assertEqual(self.client.delete(f"{b}/").status_code, 204)
