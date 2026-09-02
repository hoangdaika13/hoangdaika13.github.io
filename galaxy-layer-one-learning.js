(function (globalScope, factory) {
  "use strict";
  var api = factory(globalScope || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHGalaxyLayerOneLearning = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var SCHEMA = "hh-galaxy.learning.export";
  var SCHEMA_VERSION = 1;
  var DAY_MS = 86400000;

  var LIMITS = deepFreeze({
    importBytes: 2 * 1024 * 1024,
    decks: 100,
    cardsPerDeck: 1000,
    cardsTotal: 5000,
    activities: 20000,
    quizQuestions: 100,
    choicesPerQuestion: 6,
    titleChars: 180,
    descriptionChars: 2000,
    cardTextChars: 8000,
    hintChars: 2000,
    answerChars: 8000,
    tagsPerCard: 20,
    tagChars: 60,
    idChars: 160,
    seedChars: 128
  });

  var DIRECTIONS = Object.freeze(["front-to-back", "back-to-front"]);
  var QUIZ_MODES = Object.freeze(["typing", "multiple-choice"]);
  var ACTIVITY_TYPES = Object.freeze(["review", "quiz-answer"]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function fail(code, message, details) {
    var error = new Error(message);
    error.code = code;
    if (details !== undefined) error.details = clone(details);
    throw error;
  }

  function cleanText(value, limit) {
    var result = String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
      .trim();
    if (typeof result.normalize === "function") result = result.normalize("NFC");
    return result.slice(0, limit);
  }

  function cleanId(value, fallback) {
    var id = cleanText(value, LIMITS.idChars).replace(/[^A-Za-z0-9._:-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return id || fallback;
  }

  function hashText(value) {
    var hash = 2166136261;
    var text = String(value || "");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function generatedId(prefix, basis) {
    return prefix + "-" + hashText(basis || prefix);
  }

  function toIso(value, fallback, required) {
    var date = value instanceof Date ? value : new Date(value == null ? "" : value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
    if (required) fail("DATE_INVALID", "Mốc thời gian không hợp lệ.");
    return fallback == null ? null : fallback;
  }

  function nowIso(options) {
    var value = options && options.now !== undefined ? options.now : new Date();
    return toIso(value, new Date().toISOString(), false);
  }

  function boundedInteger(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isInteger(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function boundedNumber(value, minimum, maximum, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function utf8ByteLength(value) {
    var text = String(value == null ? "" : value);
    var bytes = 0;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      if (code <= 0x7F) bytes += 1;
      else if (code <= 0x7FF) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xDC00 && text.charCodeAt(index + 1) <= 0xDFFF) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function normalizeTags(value) {
    if (!Array.isArray(value)) return [];
    var seen = new Set();
    var result = [];
    value.slice(0, LIMITS.tagsPerCard).forEach(function (tag) {
      var normalized = cleanText(tag, LIMITS.tagChars);
      var key = normalized.toLocaleLowerCase("vi");
      if (normalized && !seen.has(key)) {
        seen.add(key);
        result.push(normalized);
      }
    });
    return result;
  }

  function normalizeSchedule(value) {
    var source = asObject(value);
    var quality = source.lastQuality == null ? null : boundedInteger(source.lastQuality, 0, 5, null);
    return {
      repetitions: boundedInteger(source.repetitions, 0, 100000, 0),
      intervalDays: boundedInteger(source.intervalDays, 0, 36500, 0),
      easeFactor: Math.round(boundedNumber(source.easeFactor, 1.3, 3, 2.5) * 100) / 100,
      dueAt: source.dueAt ? toIso(source.dueAt, null, false) : null,
      lastReviewedAt: source.lastReviewedAt ? toIso(source.lastReviewedAt, null, false) : null,
      lastQuality: quality,
      reviewCount: boundedInteger(source.reviewCount, 0, 1000000, 0),
      lapses: boundedInteger(source.lapses, 0, 1000000, 0)
    };
  }

  function normalizeFlashcard(value, options) {
    options = options || {};
    var source = asObject(value);
    var front = cleanText(source.front, LIMITS.cardTextChars);
    var back = cleanText(source.back, LIMITS.cardTextChars);
    if (!front) fail("CARD_FRONT_REQUIRED", "Mặt trước của thẻ không được để trống.");
    if (!back) fail("CARD_BACK_REQUIRED", "Mặt sau của thẻ không được để trống.");
    var inheritedSample = options.inheritSample === true;
    var isSample = inheritedSample || source.isSample === true;
    var current = nowIso(options);
    var id = cleanId(source.id, generatedId("card", front + "\u0000" + back));
    return {
      id: id,
      front: front,
      back: back,
      hint: cleanText(source.hint, LIMITS.hintChars),
      tags: normalizeTags(source.tags),
      isSample: isSample,
      source: isSample ? "sample" : (cleanText(source.source, 40) || "user"),
      createdAt: toIso(source.createdAt, current, false),
      updatedAt: toIso(source.updatedAt, current, false),
      schedule: normalizeSchedule(source.schedule)
    };
  }

  function normalizeDeck(value, options) {
    options = options || {};
    var source = asObject(value);
    var title = cleanText(source.title, LIMITS.titleChars);
    if (!title) fail("DECK_TITLE_REQUIRED", "Tên bộ thẻ không được để trống.");
    var rawCards = Array.isArray(source.cards) ? source.cards : [];
    if (rawCards.length > LIMITS.cardsPerDeck) fail("DECK_CARD_LIMIT", "Bộ thẻ vượt quá số thẻ cho phép.", { maximum: LIMITS.cardsPerDeck });
    var isSample = source.isSample === true;
    var current = nowIso(options);
    var seen = new Set();
    var cards = rawCards.map(function (card, index) {
      var normalized = normalizeFlashcard(card, { now: current, inheritSample: isSample });
      var explicitId = cleanId(asObject(card).id, "");
      if (seen.has(normalized.id)) {
        if (explicitId) fail("DUPLICATE_CARD_ID", "ID thẻ bị trùng trong cùng bộ thẻ.", { id: normalized.id });
        var suffix = 2;
        var candidate = normalized.id + "-" + suffix;
        while (seen.has(candidate)) { suffix += 1; candidate = normalized.id + "-" + suffix; }
        normalized.id = candidate;
      }
      seen.add(normalized.id);
      return normalized;
    });
    return {
      id: cleanId(source.id, generatedId("deck", title)),
      title: title,
      description: cleanText(source.description, LIMITS.descriptionChars),
      subject: cleanText(source.subject, 100),
      language: cleanText(source.language, 40) || "vi",
      tags: normalizeTags(source.tags),
      isSample: isSample,
      source: isSample ? "sample" : (cleanText(source.source, 40) || "user"),
      createdAt: toIso(source.createdAt, current, false),
      updatedAt: toIso(source.updatedAt, current, false),
      cards: cards
    };
  }

  function validationResult(normalizer, value, options) {
    try {
      return deepFreeze({ valid: true, errors: [], value: normalizer(value, options) });
    } catch (error) {
      return deepFreeze({
        valid: false,
        errors: [{ code: cleanText(error && error.code, 80) || "VALIDATION_ERROR", message: cleanText(error && error.message, 500) || "Dữ liệu không hợp lệ." }],
        value: null
      });
    }
  }

  function validateFlashcard(value, options) { return validationResult(normalizeFlashcard, value, options); }
  function validateDeck(value, options) { return validationResult(normalizeDeck, value, options); }

  function seedToNumber(seed) {
    var value = parseInt(hashText(seed), 36) >>> 0;
    return value || 0x6D2B79F5;
  }

  function createRandom(seed) {
    var state = seedToNumber(seed);
    return function () {
      state += 0x6D2B79F5;
      var value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, random) {
    var result = values.slice();
    for (var index = result.length - 1; index > 0; index -= 1) {
      var target = Math.floor(random() * (index + 1));
      var temporary = result[index];
      result[index] = result[target];
      result[target] = temporary;
    }
    return result;
  }

  function uniqueAnswers(cards, direction, excludedId, correctAnswer) {
    var seen = new Set([String(correctAnswer).toLocaleLowerCase("vi")]);
    return cards.filter(function (card) {
      if (card.id === excludedId) return false;
      var answer = direction === "back-to-front" ? card.front : card.back;
      var key = answer.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function createQuiz(deckValue, options) {
    options = options || {};
    var deck = normalizeDeck(deckValue, options);
    if (!deck.cards.length) fail("QUIZ_EMPTY_DECK", "Bộ thẻ chưa có nội dung để tạo bài kiểm tra.");
    var direction = DIRECTIONS.indexOf(options.direction) >= 0 ? options.direction : "front-to-back";
    var requestedMode = QUIZ_MODES.indexOf(options.mode) >= 0 ? options.mode : "multiple-choice";
    var seed = cleanText(options.seed == null ? deck.id : options.seed, LIMITS.seedChars) || deck.id;
    var count = boundedInteger(options.count, 1, Math.min(LIMITS.quizQuestions, deck.cards.length), Math.min(10, deck.cards.length));
    var choiceCount = boundedInteger(options.choiceCount, 2, LIMITS.choicesPerQuestion, 4);
    var random = createRandom(seed + "\u0000" + deck.id + "\u0000" + direction);
    var selected = shuffled(deck.cards, random).slice(0, count);
    var questions = selected.map(function (card, questionIndex) {
      var prompt = direction === "back-to-front" ? card.back : card.front;
      var answer = direction === "back-to-front" ? card.front : card.back;
      var alternatives = shuffled(uniqueAnswers(deck.cards, direction, card.id, answer), random).slice(0, choiceCount - 1);
      var mode = requestedMode === "multiple-choice" && alternatives.length >= 1 ? "multiple-choice" : "typing";
      var questionId = "question-" + hashText(seed + "\u0000" + deck.id + "\u0000" + card.id + "\u0000" + questionIndex);
      var choices = [];
      var correctChoiceId = null;
      if (mode === "multiple-choice") {
        var choiceCards = alternatives.concat([card]);
        choices = shuffled(choiceCards, random).map(function (choiceCard, choiceIndex) {
          var text = direction === "back-to-front" ? choiceCard.front : choiceCard.back;
          var id = "choice-" + hashText(questionId + "\u0000" + choiceCard.id + "\u0000" + choiceIndex);
          if (choiceCard.id === card.id) correctChoiceId = id;
          return { id: id, text: text };
        });
      }
      return {
        id: questionId,
        cardId: card.id,
        prompt: prompt,
        hint: card.hint,
        mode: mode,
        answer: answer,
        choices: choices,
        correctChoiceId: correctChoiceId
      };
    });
    return deepFreeze({
      id: "quiz-" + hashText(seed + "\u0000" + deck.id + "\u0000" + direction + "\u0000" + count),
      deckId: deck.id,
      deckTitle: deck.title,
      seed: seed,
      direction: direction,
      isSample: deck.isSample,
      questions: questions
    });
  }

  function normalizedAnswer(value) {
    var answer = cleanText(value, LIMITS.answerChars).replace(/\s+/g, " ").toLocaleLowerCase("vi");
    if (typeof answer.normalize === "function") answer = answer.normalize("NFC");
    return answer;
  }

  function responseMap(value) {
    var result = new Map();
    if (Array.isArray(value)) {
      if (value.length > LIMITS.quizQuestions) fail("QUIZ_RESPONSE_LIMIT", "Số câu trả lời vượt quá giới hạn.");
      value.forEach(function (entry) {
        var source = asObject(entry);
        var id = cleanId(source.questionId, "");
        if (id && !result.has(id)) result.set(id, source);
      });
      return result;
    }
    var sourceObject = asObject(value);
    Object.keys(sourceObject).slice(0, LIMITS.quizQuestions).forEach(function (key) {
      result.set(cleanId(key, ""), { questionId: key, answer: sourceObject[key] });
    });
    return result;
  }

  function gradeQuiz(quizValue, responses, options) {
    options = options || {};
    var quiz = asObject(quizValue);
    var questions = Array.isArray(quiz.questions) ? quiz.questions.slice(0, LIMITS.quizQuestions) : [];
    if (!questions.length) fail("QUIZ_INVALID", "Bài kiểm tra không hợp lệ.");
    var answers = responseMap(responses);
    var at = toIso(options.at === undefined ? new Date() : options.at, null, true);
    var details = [];
    var activities = [];
    var correct = 0;
    var answered = 0;
    questions.forEach(function (questionValue) {
      var question = asObject(questionValue);
      var questionId = cleanId(question.id, "");
      var cardId = cleanId(question.cardId, "");
      if (!questionId || !cardId) fail("QUIZ_INVALID", "Câu hỏi thiếu định danh hợp lệ.");
      if (question.mode !== "typing" && question.mode !== "multiple-choice") fail("QUIZ_INVALID", "Kiểu câu hỏi không hợp lệ.");
      if (!cleanText(question.answer, LIMITS.answerChars)) fail("QUIZ_INVALID", "Câu hỏi thiếu đáp án hợp lệ.");
      if (question.mode === "multiple-choice") {
        var choiceIds = new Set((Array.isArray(question.choices) ? question.choices : []).map(function (choice) { return cleanId(asObject(choice).id, ""); }).filter(Boolean));
        if (!choiceIds.has(cleanId(question.correctChoiceId, ""))) fail("QUIZ_INVALID", "Đáp án trắc nghiệm không thuộc danh sách lựa chọn.");
      }
      var response = answers.get(questionId);
      var choiceId = response ? cleanId(response.choiceId, "") : "";
      var typedAnswer = response ? cleanText(response.answer, LIMITS.answerChars) : "";
      var hasAnswer = question.mode === "multiple-choice" ? Boolean(choiceId) : Boolean(typedAnswer);
      var isCorrect = false;
      if (hasAnswer) {
        answered += 1;
        isCorrect = question.mode === "multiple-choice"
          ? choiceId === cleanId(question.correctChoiceId, "")
          : normalizedAnswer(typedAnswer) === normalizedAnswer(question.answer);
        if (isCorrect) correct += 1;
        activities.push({
          id: "activity-" + hashText(cleanId(quiz.id, "quiz") + "\u0000" + questionId + "\u0000" + at),
          type: "quiz-answer",
          deckId: cleanId(quiz.deckId, ""),
          cardId: cardId,
          at: at,
          source: "user",
          userInitiated: true,
          isSample: quiz.isSample === true,
          correct: isCorrect
        });
      }
      details.push({ questionId: questionId, cardId: cardId, answered: hasAnswer, correct: hasAnswer ? isCorrect : null });
    });
    var total = questions.length;
    return deepFreeze({
      quizId: cleanId(quiz.id, generatedId("quiz", String(total))),
      totalQuestions: total,
      answered: answered,
      correct: correct,
      incorrect: answered - correct,
      unanswered: total - answered,
      scorePercent: answered ? Math.round(correct / total * 100) : null,
      accuracyPercent: answered ? Math.round(correct / answered * 100) : null,
      details: details,
      activities: activities,
      gradedAt: at
    });
  }

  function applyReview(cardValue, qualityValue, options) {
    options = options || {};
    var quality = Number(qualityValue);
    if (!Number.isInteger(quality) || quality < 0 || quality > 5) fail("REVIEW_QUALITY_INVALID", "Mức độ nhớ phải là số nguyên từ 0 đến 5.");
    var card = normalizeFlashcard(cardValue, options);
    var previous = card.schedule;
    var repetitions = previous.repetitions;
    var intervalDays;
    var lapses = previous.lapses;
    if (quality < 3) {
      repetitions = 0;
      intervalDays = 1;
      lapses += 1;
    } else {
      if (repetitions === 0) intervalDays = 1;
      else if (repetitions === 1) intervalDays = 6;
      else intervalDays = Math.max(1, Math.round(Math.max(1, previous.intervalDays) * previous.easeFactor));
      repetitions += 1;
    }
    var difference = 5 - quality;
    var easeFactor = Math.max(1.3, previous.easeFactor + (0.1 - difference * (0.08 + difference * 0.02)));
    easeFactor = Math.round(easeFactor * 100) / 100;
    var reviewedAt = toIso(options.reviewedAt === undefined ? new Date() : options.reviewedAt, null, true);
    var dueAt = new Date(Date.parse(reviewedAt) + intervalDays * DAY_MS).toISOString();
    var updated = clone(card);
    updated.updatedAt = reviewedAt;
    updated.schedule = {
      repetitions: repetitions,
      intervalDays: intervalDays,
      easeFactor: easeFactor,
      dueAt: dueAt,
      lastReviewedAt: reviewedAt,
      lastQuality: quality,
      reviewCount: previous.reviewCount + 1,
      lapses: lapses
    };
    var deckId = cleanId(options.deckId, "");
    if (!deckId) fail("REVIEW_DECK_REQUIRED", "Hoạt động ôn tập phải gắn với một bộ thẻ.");
    var activity = {
      id: "activity-" + hashText((deckId || "deck") + "\u0000" + card.id + "\u0000" + reviewedAt + "\u0000" + quality),
      type: "review",
      deckId: deckId,
      cardId: card.id,
      at: reviewedAt,
      source: "user",
      userInitiated: true,
      isSample: card.isSample,
      quality: quality
    };
    return deepFreeze({ card: updated, activity: activity });
  }

  function normalizeActivity(value, options) {
    options = options || {};
    var source = asObject(value);
    var type = ACTIVITY_TYPES.indexOf(source.type) >= 0 ? source.type : null;
    if (!type) fail("ACTIVITY_TYPE_INVALID", "Loại hoạt động học không hợp lệ.");
    var deckId = cleanId(source.deckId, "");
    var cardId = cleanId(source.cardId, "");
    if (!deckId || !cardId) fail("ACTIVITY_REFERENCE_INVALID", "Hoạt động học thiếu bộ thẻ hoặc thẻ tham chiếu.");
    var at = toIso(source.at, null, true);
    var result = {
      id: cleanId(source.id, generatedId("activity", type + "\u0000" + deckId + "\u0000" + cardId + "\u0000" + at)),
      type: type,
      deckId: deckId,
      cardId: cardId,
      at: at,
      source: source.source === "user" ? "user" : "import",
      userInitiated: source.userInitiated === true,
      isSample: source.isSample === true
    };
    if (type === "review") {
      var quality = Number(source.quality);
      if (!Number.isInteger(quality) || quality < 0 || quality > 5) fail("REVIEW_QUALITY_INVALID", "Hoạt động ôn tập có mức độ nhớ không hợp lệ.");
      result.quality = quality;
    } else result.correct = source.correct === true;
    return result;
  }

  function normalizeState(value, options) {
    options = options || {};
    var source = asObject(value);
    var rawDecks = Array.isArray(source.decks) ? source.decks : [];
    var rawActivities = Array.isArray(source.activities) ? source.activities : [];
    if (rawDecks.length > LIMITS.decks) fail("DECK_LIMIT", "Số bộ thẻ vượt quá giới hạn.");
    if (rawActivities.length > LIMITS.activities) fail("ACTIVITY_LIMIT", "Số hoạt động học vượt quá giới hạn.");
    var deckIds = new Set();
    var cardKeys = new Set();
    var cardCount = 0;
    var decks = rawDecks.map(function (deckValue) {
      var deck = normalizeDeck(deckValue, options);
      if (deckIds.has(deck.id)) fail("DUPLICATE_DECK_ID", "ID bộ thẻ bị trùng.", { id: deck.id });
      deckIds.add(deck.id);
      cardCount += deck.cards.length;
      if (cardCount > LIMITS.cardsTotal) fail("CARD_TOTAL_LIMIT", "Tổng số thẻ vượt quá giới hạn.");
      deck.cards.forEach(function (card) {
        var key = deck.id + "\u0000" + card.id;
        if (cardKeys.has(key)) fail("DUPLICATE_CARD_ID", "ID thẻ bị trùng.", { id: card.id });
        cardKeys.add(key);
      });
      return deck;
    });
    var activityIds = new Set();
    var activities = rawActivities.map(function (activityValue) {
      var activity = normalizeActivity(activityValue, options);
      if (activityIds.has(activity.id)) fail("DUPLICATE_ACTIVITY_ID", "ID hoạt động học bị trùng.", { id: activity.id });
      activityIds.add(activity.id);
      if (!cardKeys.has(activity.deckId + "\u0000" + activity.cardId)) {
        fail("ACTIVITY_REFERENCE_INVALID", "Hoạt động tham chiếu đến thẻ không tồn tại.", { deckId: activity.deckId, cardId: activity.cardId });
      }
      return activity;
    });
    return { decks: decks, activities: activities };
  }

  function dateKey(value) { return String(value || "").slice(0, 10); }

  function streakFromActivities(activities) {
    if (!activities.length) return 0;
    var dates = Array.from(new Set(activities.map(function (activity) { return dateKey(activity.at); }))).sort().reverse();
    var streak = 1;
    for (var index = 1; index < dates.length; index += 1) {
      var previous = Date.parse(dates[index - 1] + "T00:00:00.000Z");
      var current = Date.parse(dates[index] + "T00:00:00.000Z");
      if (previous - current !== DAY_MS) break;
      streak += 1;
    }
    return streak;
  }

  function computeProgress(value, options) {
    options = options || {};
    var state = normalizeState(value, options);
    var now = Date.parse(toIso(options.now === undefined ? new Date() : options.now, null, true));
    var eligibleDecks = state.decks.filter(function (deck) { return !deck.isSample; });
    var cardLookup = new Map();
    eligibleDecks.forEach(function (deck) {
      deck.cards.forEach(function (card) {
        if (!card.isSample) cardLookup.set(deck.id + "\u0000" + card.id, card);
      });
    });
    var activities = state.activities.filter(function (activity) {
      return activity.source === "user" && activity.userInitiated && !activity.isSample && cardLookup.has(activity.deckId + "\u0000" + activity.cardId);
    }).sort(function (left, right) { return Date.parse(left.at) - Date.parse(right.at); });
    var studied = new Set();
    var reviews = 0;
    var quizAnswers = 0;
    var correctAnswers = 0;
    activities.forEach(function (activity) {
      studied.add(activity.deckId + "\u0000" + activity.cardId);
      if (activity.type === "review") reviews += 1;
      else {
        quizAnswers += 1;
        if (activity.correct) correctAnswers += 1;
      }
    });
    var totalCards = cardLookup.size;
    var dueCards = 0;
    cardLookup.forEach(function (card) {
      if (card.schedule.reviewCount > 0 && card.schedule.dueAt && Date.parse(card.schedule.dueAt) <= now) dueCards += 1;
    });
    var byDeck = eligibleDecks.map(function (deck) {
      var deckCards = deck.cards.filter(function (card) { return !card.isSample; });
      var deckActivities = activities.filter(function (activity) { return activity.deckId === deck.id; });
      var deckStudied = new Set(deckActivities.map(function (activity) { return activity.cardId; })).size;
      var deckQuiz = deckActivities.filter(function (activity) { return activity.type === "quiz-answer"; });
      var deckCorrect = deckQuiz.filter(function (activity) { return activity.correct; }).length;
      return {
        deckId: deck.id,
        title: deck.title,
        totalCards: deckCards.length,
        studiedCards: deckStudied,
        progressPercent: deckCards.length ? Math.round(deckStudied / deckCards.length * 100) : 0,
        activityCount: deckActivities.length,
        accuracyPercent: deckQuiz.length ? Math.round(deckCorrect / deckQuiz.length * 100) : null
      };
    });
    return deepFreeze({
      totalDecks: eligibleDecks.length,
      totalCards: totalCards,
      studiedCards: studied.size,
      progressPercent: totalCards ? Math.round(studied.size / totalCards * 100) : 0,
      reviewCount: reviews,
      quizAnswers: quizAnswers,
      correctAnswers: correctAnswers,
      accuracyPercent: quizAnswers ? Math.round(correctAnswers / quizAnswers * 100) : null,
      dueCards: dueCards,
      streakDays: streakFromActivities(activities),
      lastActivityAt: activities.length ? activities[activities.length - 1].at : null,
      byDeck: byDeck
    });
  }

  function stringifyBounded(value, errorCode) {
    var json;
    try { json = JSON.stringify(value); }
    catch (error) { fail(errorCode || "JSON_INVALID", "Dữ liệu không thể chuyển thành JSON an toàn."); }
    if (utf8ByteLength(json) > LIMITS.importBytes) fail("IMPORT_TOO_LARGE", "Tệp học tập vượt quá dung lượng cho phép.", { maximumBytes: LIMITS.importBytes });
    return json;
  }

  function createExportPayload(value, options) {
    options = options || {};
    var state = normalizeState(value, options);
    var includeSamples = options.includeSamples === true;
    var decks = state.decks.filter(function (deck) { return includeSamples || !deck.isSample; }).map(function (deck) {
      if (includeSamples) return deck;
      var copy = clone(deck);
      copy.cards = copy.cards.filter(function (card) { return !card.isSample; });
      return copy;
    });
    var allowedCards = new Set();
    decks.forEach(function (deck) { deck.cards.forEach(function (card) { allowedCards.add(deck.id + "\u0000" + card.id); }); });
    var activities = state.activities.filter(function (activity) {
      return allowedCards.has(activity.deckId + "\u0000" + activity.cardId) && (includeSamples || !activity.isSample);
    });
    return {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      appVersion: VERSION,
      exportedAt: toIso(options.exportedAt === undefined ? new Date() : options.exportedAt, null, true),
      decks: decks,
      activities: activities
    };
  }

  function exportJSON(value, options) {
    var payload = createExportPayload(value, options);
    stringifyBounded(payload, "EXPORT_INVALID");
    return JSON.stringify(payload, null, 2);
  }

  function importJSON(value, options) {
    options = options || {};
    var json;
    var payload;
    if (typeof value === "string") {
      if (utf8ByteLength(value) > LIMITS.importBytes) fail("IMPORT_TOO_LARGE", "Tệp học tập vượt quá dung lượng cho phép.", { maximumBytes: LIMITS.importBytes });
      try { payload = JSON.parse(value); }
      catch (error) { fail("IMPORT_JSON_INVALID", "Tệp JSON không hợp lệ."); }
    } else {
      json = stringifyBounded(value, "IMPORT_JSON_INVALID");
      try { payload = JSON.parse(json); }
      catch (error) { fail("IMPORT_JSON_INVALID", "Dữ liệu JSON không hợp lệ."); }
    }
    var source = asObject(payload);
    if (source.schema !== SCHEMA) fail("IMPORT_SCHEMA_INVALID", "Tệp không thuộc định dạng Learning Star.");
    if (source.schemaVersion !== SCHEMA_VERSION) fail("IMPORT_VERSION_UNSUPPORTED", "Phiên bản dữ liệu Learning Star chưa được hỗ trợ.", { supported: SCHEMA_VERSION });
    if (!Array.isArray(source.decks) || !Array.isArray(source.activities)) fail("IMPORT_SHAPE_INVALID", "Gói Learning Star thiếu danh sách bộ thẻ hoặc hoạt động.");
    var state = normalizeState({ decks: source.decks, activities: source.activities }, options);
    return deepFreeze({
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      appVersion: cleanText(source.appVersion, 40) || null,
      exportedAt: toIso(source.exportedAt, null, false),
      decks: state.decks,
      activities: state.activities
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    SCHEMA: SCHEMA,
    SCHEMA_VERSION: SCHEMA_VERSION,
    LIMITS: LIMITS,
    DIRECTIONS: DIRECTIONS,
    QUIZ_MODES: QUIZ_MODES,
    ACTIVITY_TYPES: ACTIVITY_TYPES,
    utf8ByteLength: utf8ByteLength,
    normalizeFlashcard: normalizeFlashcard,
    normalizeDeck: normalizeDeck,
    normalizeActivity: normalizeActivity,
    normalizeState: normalizeState,
    validateFlashcard: validateFlashcard,
    validateDeck: validateDeck,
    createQuiz: createQuiz,
    gradeQuiz: gradeQuiz,
    applyReview: applyReview,
    computeProgress: computeProgress,
    createExportPayload: createExportPayload,
    exportJSON: exportJSON,
    importJSON: importJSON
  });
});
