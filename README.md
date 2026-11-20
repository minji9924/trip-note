# 트립노트 - 여행 가계부

Django + PostgreSQL + React(TypeScript) + PWA

```
backend/   Django REST API (JWT 인증)
frontend/  React + TypeScript + Vite (PWA)
docker-compose.yml  PostgreSQL + 백엔드
```

## 모드
- **local (기본)**: 서버 없이 기기에만 저장. 아이폰 앱(Xcode)과 PWA에 사용.
- **api**: Django 서버와 연동 (`npm run dev:api`, `npm run build:api`). 로그인, 여러 명 공유 가능.

## 아이폰에 설치 (Xcode, 무료 Apple ID)
필요: Mac, Xcode 26 이상, Node 22 이상, 아이폰 + 케이블
```bash
cd frontend
npm install
npm run build
npx cap add ios        # 최초 1회 (iOS 프로젝트 생성)
npm run ios:sync       # 웹 빌드를 앱에 반영 (코드를 바꿀 때마다)
npm run ios:open       # Xcode 열기
```
Xcode에서: App 타깃 → Signing & Capabilities → Team에 본인 Apple ID 선택 →
Bundle Identifier를 고유하게 변경(`capacitor.config.ts`의 appId와 맞추기) → 상단에서 내 아이폰 선택 → ▶︎ 실행.
처음 한 번 아이폰 `설정 > 일반 > VPN 및 기기 관리`에서 개발자 앱을 신뢰해야 해요.
앱 아이콘은 `frontend/resources/app-icon-1024.png`를 Xcode의 Assets > AppIcon에 넣으세요.

⚠️ 무료 Apple ID로 설치한 앱은 **7일 후 실행되지 않아요.** 출발 직전에 설치하고, 해외에서는 재설치가 어려우니 여행 기간(7일 이하)을 꼭 확인하세요.
앱을 지우지 말고 덮어서 재설치해야 데이터가 유지돼요. 설정 > "백업 내보내기"로 수시로 백업해 두세요.

## (선택) 서버 연동 모드 개발

```bash
# 1) DB + 백엔드 (http://localhost:8000)
docker compose up --build

# 2) 프론트엔드 (http://localhost:5173, /api 는 8000 으로 프록시)
cd frontend && npm install && npm run dev
```

Docker 없이 백엔드만 돌려 보려면 (SQLite):
```bash
cd backend && pip install -r requirements.txt
USE_SQLITE=1 python manage.py migrate && USE_SQLITE=1 python manage.py runserver
USE_SQLITE=1 python manage.py test      # API 테스트
```

## API 요약 (모두 `/api` 아래, 로그인 후 `Authorization: Bearer <access>`)

| 경로 | 설명 |
|---|---|
| `POST auth/register/`, `auth/login/`, `auth/refresh/`, `GET auth/me/` | 회원가입, 로그인(JWT), 토큰 갱신 |
| `trips/` | 내 여행 목록, 생성 (생성자는 owner) |
| `trips/{id}/` | 여행 상세(인원, 카드, 충전, 사용 내역 전체), 수정, 삭제(owner만) |
| `trips/{id}/members/` | 멤버 조회, 이메일로 초대(owner만) |
| `trips/{id}/persons/` `cards/` `recharges/` `expenses/` | 각 리소스 CRUD |

- 사용 내역은 `shares`(인원별 부담 금액)를 함께 보내며, 합계가 `total_amount`와 같아야 해요.
- 카드 소유 / 충전 / 사용 내역에 쓰인 인원·카드는 삭제 시 409를 반환해요.
- 여행 멤버만 해당 여행 데이터에 접근할 수 있어요.

## ERD 대비 추가한 필드
`Trip.place`, `Expense.category`, `Recharge.card`(nullable, 카드별 충전/잔액용)

## 배포 메모
- PWA(홈 화면 추가, 서비스워커)는 HTTPS에서만 동작해요.
- 프론트와 API를 같은 도메인(`/api` 프록시)으로 두면 CORS 설정이 필요 없어요.
  다른 도메인이면 프론트 빌드 시 `VITE_API_URL`, 백엔드에 `CORS_ALLOWED_ORIGINS`를 설정하세요.
- 운영에서는 `SECRET_KEY`, `DEBUG=0`, `ALLOWED_HOSTS`, `DB_PASSWORD`를 꼭 바꿔 주세요.
