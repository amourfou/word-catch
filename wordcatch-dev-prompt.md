# WordCatch 개발 프롬프트

> 이 문서는 기획 대화에서 확정된 내용을 바탕으로 **코딩 에이전트**가 WordCatch MVP를 구현하기 위한 지시서입니다.  
> 아래 원칙과 범위를 엄격히 지키면서 개발하세요.

---

## 1. 프로젝트 개요

**앱 이름**: WordCatch

**한 줄 요약**  
중2 학생이 학원에서 고1 선행 영어를 배우면서 나오는 모르는 단어를  
**직접 스펠링을 치면서 등록**하고, **해당 문제 문맥에 맞는 뜻을 직접 조사해서 입력**한 뒤,  
플래시카드와 테스트를 통해 효율적으로 복습할 수 있게 도와주는 웹앱.

**핵심 목표**
- 학원 수업/시험 후 모르는 단어만 빠르게 정리하는 습관 만들기
- 스펠링과 문맥 뜻을 능동적으로 처리하게 만들기 (자동완성 최소화)
- 테스트와 플래시카드를 통해 꾸준히 외울 수 있는 흐름 제공
- 복습 결과를 저장해 통계와 진척도를 보여주며 동기부여

**타겟 사용자**
- 주 사용자: 중학교 2학년 (고1 영어 선행 중)
- 모바일 사용을 기본으로 가정

---

## 2. 핵심 학습 원칙 (절대 준수)

1. **단어는 반드시 수동 입력**  
   - OCR, 사진 인식, 자동 추출 금지

2. **뜻도 자동으로 채우지 않음**  
   - 사전 API 자동완성 금지  
   - 사용자가 문맥에 맞는 뜻을 직접 찾아서 입력

3. **출처(문맥)를 남기는 것을 중요하게 취급**

4. **기능을 최소화하고 시작**  
   - 수집 → 목록/필터 → 복습(플래시카드 + 테스트) → 결과/통계

---

## 3. 기술 스택 (확정)

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router) |
| 패키지 매니저 | pnpm |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS + shadcn/ui |
| 데이터베이스 | Supabase (PostgreSQL) |
| 배포 | Vercel |
| 인증 | 간단한 아이디 입력 방식 (기존 Supabase 사용자 테이블 활용) |

환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. MVP 범위

### 필수 기능
- 단어 수동 추가 (영어 단어 + 여러 뜻 + 출처 + 메모)
- 단어 목록 + 필터(status, 출처, 날짜) + 검색
- 오늘 추가한 단어 모아보기
- 복습 모드 2가지: **플래시카드** + **테스트**
- 테스트 결과 저장 및 통계
- 숙달 상태 관리 (`unknown` → `learning` → `mastered`)
- 기본 수정 / 삭제
- 복습 결과 화면에서 진척도 및 통계 표시

### MVP에서 하지 말 것
- OCR / 사진 인식
- 뜻 자동 완성
- 복잡한 SRS 알고리즘
- 음성 / 발음 평가
- 부모 대시보드
- 정식 회원가입/비밀번호 인증
- 사전 찾아보기 기능 (보류)

---

## 5. 데이터 모델 (Supabase)

### words 테이블
```sql
id              uuid primary key default gen_random_uuid()
user_id         text not null          -- 아이디 기반 접근
word            text not null          -- 영어 단어
meanings        text[] not null        -- 문맥에 맞는 뜻들
part_of_speech  text                   -- 품사 (선택)
source          text                   -- 출처
memo            text                   -- 메모
status          text default 'unknown' -- unknown | learning | mastered
wrong_count     int default 0
correct_streak  int default 0
last_reviewed_at timestamptz
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

### review_logs 테이블 (테스트/플래시카드 결과 저장)
```sql
id              uuid primary key default gen_random_uuid()
user_id         text not null
word_id         uuid references words(id)
mode            text not null          -- 'flashcard' | 'test'
test_type       text                   -- 'multiple_choice' | 'direct_input' | null
direction       text                   -- 'en_to_ko' | 'ko_to_en' | null
user_answer     text
is_correct      boolean
reviewed_at     timestamptz default now()
```

### sources 테이블 (이전에 입력한 출처 재사용)
```sql
id              uuid primary key default gen_random_uuid()
user_id         text not null
name            text not null
created_at      timestamptz default now()
unique(user_id, name)
```

---

## 6. 숙달 상태 규칙

- `unknown` → `learning` → `mastered`
- 새로 등록 → `unknown`
- 틀림 또는 “모름” 선택 → `unknown` + `wrong_count + 1` + `correct_streak = 0`
- 맞힘 또는 “알고 있음” 선택:
  - `correct_streak + 1`
  - `unknown`에서 1회 성공 → `learning`
  - `learning`에서 **연속 2회** 성공 → `mastered`
  - `mastered`에서 성공 → 유지
- 플래시카드와 테스트 모드 동일한 규칙 적용

---

## 7. 페이지 구조

```
/                     → 아이디 입력 또는 대시보드
/words                → 단어 목록 + 필터 + 검색
/words/new            → 단어 추가 (가장 중요한 화면)
/words/[id]           → 단어 상세 / 수정
/review               → 복습 설정 (방식, 대상, 문제 수 선택)
/review/session       → 실제 복습 진행
/review/result        → 결과 + 통계 + 진척도
```

---

## 8. 주요 화면 UX 상세

### 8.1 단어 추가 (`/words/new`)
- 영어 단어 입력 (autofocus)
- 뜻: “+ 뜻 추가” 버튼으로 여러 개 입력 가능 (각 항목 삭제 가능)
- 출처: 자유 텍스트 + 이전에 입력한 출처 목록에서 선택 가능
- 품사, 메모 (선택)
- 저장 후 → 입력 폼 초기화되어 **계속 다음 단어 추가**
- “완료” 버튼 → 대시보드로 이동

### 8.2 단어 목록 (`/words`)
- 단어, 첫 번째 뜻, 출처, status 배지, 등록일 표시
- status 배지 색상:
  - unknown → 빨강 “모름”
  - learning → 노랑 “아는 중”
  - mastered → 초록 “외움”
- 필터: status, 출처, 날짜(오늘/이번 주/전체)
- 검색: 단어 또는 뜻
- 클릭 시 상세/수정 페이지로 이동

### 8.3 복습 설정 (`/review`)
사용자가 직접 선택:
- 복습 방식: 플래시카드 / 테스트
- 방향 (테스트일 때): 영→한 / 한→영 / 섞어서
- 대상: 오늘 추가한 단어, unknown, learning, mastered, 전체
- 문제 수: 5 / 10 / 15 / 20 / 직접 입력
- 기본값: 테스트 + 섞어서 + (오늘 추가 + unknown + learning) + 10개

### 8.4 플래시카드 모드
1. 앞면: 영어 단어
2. “뜻 보기” 버튼
3. 뒷면: 사용자가 입력한 뜻들 + 출처 + 메모
4. “모름” / “알고 있음” 버튼
5. 결과에 따라 status 업데이트 + 로그 저장

### 8.5 테스트 모드
- **1단계 (객관식)**: 초보/초반 단어
- **2단계 (직접 입력)**: status가 learning 이상이거나 연속 정답이 쌓인 단어
- 방향: 영→한 / 한→영 / 섞어서
- 제출 후 즉시 정답/오답 피드백
- 모든 시도는 `review_logs`에 저장

### 8.6 결과 화면 (`/review/result`)
- 이번 세션 요약 (맞은 개수, 틀린 개수, 정답률)
- 전체 진척도 (`mastered` 비율, status별 개수)
- 최근 추이 (간단한 정답률 변화)
- 틀린 단어 목록 + “틀린 것만 다시 복습” 버튼
- 동기부여 문구

---

## 9. 구현 시 주의사항

- pnpm 사용
- 모바일 우선 (큰 버튼, 충분한 여백)
- UI 텍스트는 한국어
- 불필요한 라이브러리 설치 금지
- 에러 처리와 로딩 상태 기본 포함
- 나중에 Auth, OCR, SRS 등을 붙이기 쉽도록 폴더 구조와 타입을 깔끔하게 유지
- 다크 모드 지원 권장

---

## 10. 개발 순서 제안

1. Next.js + TypeScript + Tailwind + pnpm + shadcn/ui 초기화
2. Supabase 연결 및 테이블 생성
3. 간단한 아이디 입력 접근 구현
4. 단어 추가 페이지 구현
5. 단어 목록 + 필터/검색
6. 복습 설정 화면
7. 플래시카드 모드
8. 테스트 모드 (객관식 → 직접 입력)
9. 결과 화면 + 통계
10. 반응형/모바일 다듬기 및 Vercel 배포

---

## 11. 성공 기준 (Acceptance Criteria)

- [ ] 영어 단어와 여러 뜻을 직접 타이핑해서 저장할 수 있다
- [ ] 뜻 필드에 자동 완성 기능이 없다
- [ ] 출처를 입력하고, 이전에 입력한 출처를 재선택할 수 있다
- [ ] 단어 목록에서 status와 필터/검색이 동작한다
- [ ] 플래시카드와 테스트 모드 둘 다 사용할 수 있다
- [ ] 테스트/플래시카드 결과가 저장되고 status가 규칙대로 업데이트된다
- [ ] 결과 화면에서 진척도와 통계를 볼 수 있다
- [ ] 모바일에서 큰 불편 없이 사용 가능하다
- [ ] pnpm으로 빌드되고 Vercel에 배포 가능하다

---

**이 프롬프트를 받았다면**  
위 원칙과 MVP 범위를 엄격히 지키면서 구현을 시작하세요.  
먼저 프로젝트 초기화와 Supabase 테이블부터 진행하고, **단어 추가 화면**을 최우선으로 완성하세요.
