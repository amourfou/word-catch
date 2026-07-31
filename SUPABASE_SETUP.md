# Supabase 설정 가이드 (WordCatch)

ShortJapan / HaanRiver / nextLotto와 **동일한 Supabase 프로젝트**를 사용합니다.  
공유 `users` 테이블은 이미 있으므로 생성하지 않습니다.

## 1. 테이블 생성

1. [Supabase](https://supabase.com) 대시보드 → **SQL Editor**
2. `supabase-schema.sql` 내용을 복사해 실행
3. `wordcatch_words`, `wordcatch_review_logs`, `wordcatch_sources` 테이블이 생성됩니다

이미 테이블이 있는 경우, 추가 마이그레이션:

1. `supabase-migration-phonetic.sql` → `phonetic` 컬럼
2. `supabase-migration-audio.sql` → `audio_url` 컬럼 + 듣기 복습 방향

## 2. 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 ShortJapan과 동일한 값을 넣으세요.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- **Project URL / anon key**: Settings → API

## 3. 패키지 설치

```bash
pnpm install
pnpm dev
```

## 4. 로그인

- 공유 `users` 테이블의 **이름**으로 로그인합니다.
- 등록 시 이름(≤10자)·소속(≤15자)으로 계정을 만들며, 다른 앱과 동일 계정을 씁니다.
