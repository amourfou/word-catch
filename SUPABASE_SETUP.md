# Supabase 설정 가이드 (WordCatch)

ShortJapan / HaanRiver / nextLotto와 **동일한 Supabase 프로젝트**를 사용합니다.  
공유 `users` 테이블은 이미 있으므로 생성하지 않습니다.

## 1. 테이블 생성

1. [Supabase](https://supabase.com) 대시보드 → **SQL Editor**
2. `supabase-schema.sql` 내용을 복사해 실행
3. `wordcatch_dictionary`, `wordcatch_words`, `wordcatch_review_logs`, `wordcatch_sources` 테이블이 생성됩니다

이미 테이블이 있는 경우, 추가 마이그레이션:

1. `supabase-migration-phonetic.sql` → `phonetic` 컬럼
2. `supabase-migration-audio.sql` → `audio_url` 컬럼 + 듣기 복습 방향
3. `supabase-migration-dictionary.sql` → 공유 사전 캐시 + 사용자별 단어 중복 방지
4. `supabase-migration-idioms.sql` → 숙어(`idioms` JSONB: phrase + meaning)
5. `supabase-migration-push.sql` → Web Push 구독 테이블 (`wordcatch_push_subscriptions`)
6. `supabase-migration-push-remind-hour.sql` → 복습 알림 시각(KST)·일일 중복 방지 컬럼

## 2. 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 ShortJapan과 동일한 값을 넣으세요.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Web Push (node scripts/generate-vapid.mjs)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
PUSH_CRON_SECRET=
CRON_SECRET=

# 예약 발송 역할 (개인 서버만 true)
PUSH_SCHEDULER_ENABLED=false
```

- **Project URL / anon key**: Settings → API
- **VAPID**: 앱(Vercel)과 발송 서버에 동일 키 등록
- **스케줄 발송**: `PUSH_SCHEDULER_ENABLED=true` 인 호스트만 **프로세스 안 타이머**로 매시 발송
  - Vercel(앱 UI·구독 저장): `false` 또는 미설정
  - 개인 서버: `true` 후 `pnpm build && pnpm start` (crontab 불필요)

## 3. 패키지 설치

```bash
pnpm install
pnpm dev
```

## 4. 로그인

- 공유 `users` 테이블의 **이름**으로 로그인합니다.
- 등록 시 이름(≤10자)·소속(≤15자)으로 계정을 만들며, 다른 앱과 동일 계정을 씁니다.
