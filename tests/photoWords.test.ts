import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanWord, itemsToSave, markDuplicates, normalizePos, parseExtraction,
  parseExtractionText, splitMeanings, wordKey,
} from "../lib/photoWords";

test("splitMeanings: 쉼표·세미콜론·슬래시·①로 나누고 괄호 안은 유지", () => {
  assert.deepEqual(splitMeanings("주저하다, 망설이다; 머뭇거리다"), ["주저하다", "망설이다", "머뭇거리다"]);
  assert.deepEqual(splitMeanings("①포기하다 ②그만두다"), ["포기하다", "그만두다"]);
  assert.deepEqual(splitMeanings("(일·계획 등을, 미리) 세우다"), ["(일·계획 등을, 미리) 세우다"]);
  assert.deepEqual(splitMeanings(["달리다", "달리다", " "]), ["달리다"]);
  assert.deepEqual(splitMeanings(undefined), []);
});

test("cleanWord / wordKey", () => {
  assert.equal(cleanWord("12. hesitate "), "hesitate");
  assert.equal(cleanWord("③ give up"), "give up");
  assert.equal(wordKey("  Hesitate. "), "hesitate.");
  assert.equal(wordKey("Give  Up"), "give up");
  assert.equal(wordKey("don’t"), "don't");
});

test("normalizePos", () => {
  assert.equal(normalizePos("명"), "n.");
  assert.equal(normalizePos("V"), "v.");
  assert.equal(normalizePos("adj"), "adj.");
  assert.equal(normalizePos("phr.v."), "phr.v.");
  assert.equal(normalizePos("모름"), "");
});

test("parseExtraction: 이상한 항목은 버림", () => {
  const items = parseExtraction({
    items: [
      { word: "1. abandon", meanings: ["버리다, 포기하다"], part_of_speech: "v", phonetic: "", example: "" },
      { word: "사과", meanings: ["apple"] },
      { word: "orbit", meanings: [] },
      null,
      { word: "rely on", meaning: "의존하다" },
    ],
  });
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { word: "abandon", meanings: ["버리다", "포기하다"], part_of_speech: "v.", phonetic: "", example: "" });
  assert.equal(items[1].word, "rely on");
  assert.deepEqual(parseExtractionText("not json"), []);
});

test("markDuplicates: 내 단어장·사진 안 중복은 기본 체크 해제", () => {
  const items = parseExtraction({ items: [
    { word: "Hesitate", meanings: ["주저하다"] },
    { word: "abandon", meanings: ["버리다"] },
    { word: "abandon", meanings: ["포기하다"] },
  ] });
  const r = markDuplicates(items, ["hesitate", "orbit"]);
  assert.deepEqual(r.map((x) => [x.duplicate, x.repeatedInPhoto, x.checked]), [
    [true, false, false], [false, false, true], [false, true, false],
  ]);
});

test("itemsToSave: 체크해도 기존 단어·반복 단어는 저장 안 함", () => {
  const r = markDuplicates(parseExtraction({ items: [
    { word: "hesitate", meanings: ["주저하다"] },
    { word: "abandon", meanings: ["버리다"] },
    { word: "ABANDON", meanings: ["포기하다"] },
    { word: "orbit", meanings: ["궤도"] },
  ] }), ["hesitate"]);
  for (const x of r) x.checked = true;
  r[3].meanings = [" "];
  assert.deepEqual(itemsToSave(r, ["hesitate"]).map((x) => x.word), ["abandon"]);
});
