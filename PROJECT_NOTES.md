# WordCatch 프로젝트 노트

## 목적
중학교 2학년 딸이 쓰는 영어 단어 암기 앱(PWA)이에요. 단어를 직접 등록하고(사전 자동완성), 플래시카드·객관식·직접입력·듣기로 복습하며, 정해진 시각에 웹 푸시로 복습 알림을 받아요. 관리자(super_admin/admin) 화면에서 담당 학생의 단어·통계·알림을 관리해요.

## 스택
- Next.js 14.2.18 (App Router), React, TypeScript, Tailwind, pnpm
- Supabase (`@supabase/supabase-js`, anon 키 하나로 브라우저·서버 모두 접속)
- Merriam-Webster Learner's Dictionary API (서버 전용 키)
- Web Push (`web-push`, VAPID), 서비스워커 `public/sw.js`
- 배포: GitHub `amourfou/word-catch` main → Vercel 프로젝트 `word-catch` (prj_qTbO8IvhwphnrolRfvaC0pjLAfjF), 기본 주소 word-catch-three.vercel.app

## 구조
- `app/` 화면과 API 라우트
- `components/` AppShell, AuthProvider(로컬 세션), 사전 팝업/패널, PushNotifyCard, PwaRegister, ui/*
- `lib/` db.ts(단어·로그·출처 CRUD), auth.ts(이름 로그인), adminAuth.ts·roles.ts, reviewEngine.ts(세션 구성), mastery.ts(숙련도), dictionary*.ts, push*.ts, date.ts(KST)
- `instrumentation.ts` + `lib/pushScheduler.ts`: 장기 실행 서버에서만 매시 알림 타이머
- `supabase-schema.sql` + `supabase-migration-*.sql` 9개
- `.github/workflows/push-remind.yml`: 수동(workflow_dispatch) 알림 발송 트리거
- `scripts/generate-vapid.mjs`, `scripts/test-push.mjs`

## 화면
| 경로 | 내용 |
|---|---|
| `/login` | 이름(+소속)으로 로그인/가입. 비밀번호 없음 |
| `/` | 홈(오늘 현황, 알림 카드) |
| `/words`, `/words/new`, `/words/[id]` | 단어 목록·필터(상태/출처/기간/검색), 등록(사전 검증), 상세·수정 |
| `/review`, `/review/session`, `/review/result` | 복습 설정 → 세션(플래시카드/객관식/직접입력, 영→한/한→영/듣기) → 결과 |
| `/stats` | 학습 통계 |
| `/dict` | 사전 검색 |
| `/admin` | 관리자: 사용자·명단·단어·통계·설정·푸시 |

## API
| 경로 | 내용 | 인증 |
|---|---|---|
| `/api/dictionary` | MW 사전 프록시 + `wordcatch_dictionary` 캐시 | 없음 |
| `/api/push/subscribe` (GET/POST/PATCH) | 구독 저장, 알림 시각 조회/변경 | body의 userId만 |
| `/api/push/send` POST | 본인 테스트 발송(userId), cron 발송 | 테스트는 userId만, 전체는 CRON_SECRET |
| `/api/push/send` GET | 매시 due 알림 | CRON_SECRET + PUSH_SCHEDULER_ENABLED |
| `/api/admin/*` (push, settings, stats, users, words) | 관리자 기능 | `x-admin-user-id` 헤더/쿼리의 사용자 ID로 역할 확인만 |

## 데이터 모델 (Supabase, 프로젝트 tmav…, 원신 앱과 같은 DB)
- `users` (공유: genshin-guide/ShortJapan/HaanRiver 등): id, name, organization, high_score, is_admin, role(super_admin/admin/user, roles 마이그레이션으로 추가). WordCatch가 anon 키로 **읽기·insert(가입)·update(updated_at)** 함
- `wordcatch_dictionary`: word_key, word, phonetic, audio_url, entry/raw(jsonb), learner_user_ids
- `wordcatch_words`: user_id, dictionary_id, word, meanings[], part_of_speech, phonetic, audio_url, source, idioms(jsonb), memo, status(unknown/learning/mastered), wrong_count, correct_streak, last_reviewed_at
- `wordcatch_review_logs`: user_id, word_id, mode, test_type, direction, user_answer, is_correct, reviewed_at
- `wordcatch_sources`: 사용자별 출처 이름
- `push_subscriptions`(통합) / `wordcatch_push_subscriptions`(구버전): endpoint, p256dh, auth, remind_hour_kst
- `wordcatch_app_settings`, `wordcatch_admin_roster`(admin_id ↔ user_id)
- RLS: 전 테이블 `FOR ALL USING (true) WITH CHECK (true)` (사실상 무방비)

숙련도: 오답 → unknown, 정답 시 unknown→learning, learning에서 연속 2회 → mastered. 간격 반복(복습 예정일) 개념은 없음.

## 환경변수
| 변수 | 사용처 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | lib/supabase.ts (브라우저+서버 공용) |
| MERRIAM_WEBSTER_API_KEY | app/api/dictionary, lib/dictionary.ts (서버) |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | lib/pushClient.ts 구독, lib/push.ts |
| VAPID_PRIVATE_KEY, VAPID_SUBJECT | lib/push.ts (서버) |
| CRON_SECRET / PUSH_CRON_SECRET | /api/push/send 인증(CRON_SECRET 우선), GitHub Actions secret |
| PUSH_SCHEDULER_ENABLED | instrumentation.ts·pushConfig: true일 때만 예약 발송. `.env.example`에만 있음 → Vercel에선 꺼짐 |

## 배포·알림 흐름
- main에 push → Vercel 자동 배포. `vercel.json`은 비어 있음(크론 없음)
- 예약 알림은 Vercel에서 동작 안 함(설계상). 개인 장기 실행 서버에서 `PUSH_SCHEDULER_ENABLED=true pnpm start` 하거나 외부 크론이 `GET /api/push/send`(Bearer CRON_SECRET) 호출. GitHub Actions는 수동 트리거뿐이고, Vercel은 스케줄러가 꺼져 있어 503이 남 → **현재 자동 복습 알림은 아마 발송되지 않음**(확인 필요)

## 실행
```
export COREPACK_HOME=$HOME/.cache/corepack
pnpm install && pnpm dev     # .env.local 필요 (.env.example 참고)
pnpm build && pnpm lint
```
2026-10-14 박스 확인: install·build·lint 모두 통과(Node 20 사용 시 supabase-js 경고만 있음).
