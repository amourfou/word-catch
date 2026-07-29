# WordCatch

중학생이 모르는 영어 단어를 **직접 스펠링·뜻으로 등록**하고, 플래시카드·테스트로 복습하는 모바일 우선 웹앱입니다.

## 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하세요.

## 기술 스택

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL) — ShortJapan / HaanRiver와 동일 프로젝트, 공유 `users`
- pnpm, Vercel 배포

## 기능

- 이름 로그인 / 등록 (공유 `users`)
- 단어 수동 추가 (여러 뜻, 출처 재선택)
- 목록 필터·검색
- 플래시카드 / 테스트 복습 + 숙달 상태
- 결과·진척도

## Supabase

`SUPABASE_SETUP.md`와 `supabase-schema.sql`을 참고해 `wordcatch_*` 테이블을 생성하세요.

## Git

- 원격: `https://github.com/amourfou/word-catch.git`
- 기본 브랜치: `main`

## Vercel

1. Import `amourfou/word-catch`
2. Framework: Next.js, Build: `pnpm build`
3. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
