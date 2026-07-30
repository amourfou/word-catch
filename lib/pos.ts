/** Common school English parts of speech */
export const PARTS_OF_SPEECH = [
  { value: "n.", label: "n. 명사" },
  { value: "v.", label: "v. 동사" },
  { value: "adj.", label: "adj. 형용사" },
  { value: "adv.", label: "adv. 부사" },
  { value: "prep.", label: "prep. 전치사" },
  { value: "conj.", label: "conj. 접속사" },
  { value: "pron.", label: "pron. 대명사" },
  { value: "det.", label: "det. 한정사" },
  { value: "phr.v.", label: "phr.v. 구동사" },
  { value: "phr.", label: "phr. 구·숙어" },
] as const;

export type PartOfSpeechValue = (typeof PARTS_OF_SPEECH)[number]["value"];
