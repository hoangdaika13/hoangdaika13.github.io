(() => {
  "use strict";

  const global = typeof window !== "undefined" ? window : globalThis;
  const VERSION = 2;
  const BASE_KEY = "hh.japanese.state.v1";
  const VIEWS = Object.freeze([
    ["dashboard", "Hôm nay", "⌂"], ["learn", "Học", "学"], ["dictionary", "Tra cứu", "辞"],
    ["notebook", "Ôn tập", "★"], ["jlpt", "JLPT", "試"], ["progress", "Tiến độ", "↗"]
  ]);
  const VIEW_IDS = new Set(["dashboard", "learn", "lesson", "dictionary", "word", "kanji", "grammar", "reader", "notebook", "jlpt", "conversation", "tools", "progress"]);
  const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const today = () => new Date().toISOString().slice(0, 10);
  const dayMs = 86400000;
  const identityId = () => {
    try {
      const user = global.HHAuthSession?.user?.() || JSON.parse(localStorage.getItem("hh-auth-user") || "{}");
      return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
    } catch { return "guest"; }
  };
  const stateKey = () => `${BASE_KEY}:${identityId()}`;

  const WORDS = Object.freeze([
    ["日本", "にほん", "nihon", "Nhật Bản", "danh từ", "N5", "日本へ行きたいです。", "Tôi muốn đi Nhật Bản."],
    ["日本語", "にほんご", "nihongo", "tiếng Nhật", "danh từ", "N5", "日本語を勉強しています。", "Tôi đang học tiếng Nhật."],
    ["学生", "がくせい", "gakusei", "học sinh; sinh viên", "danh từ", "N5", "私は大学の学生です。", "Tôi là sinh viên đại học."],
    ["先生", "せんせい", "sensei", "giáo viên; thầy cô", "danh từ", "N5", "先生に質問します。", "Tôi hỏi giáo viên."],
    ["食べる", "たべる", "taberu", "ăn", "động từ nhóm 2", "N5", "朝ご飯を食べます。", "Tôi ăn sáng."],
    ["飲む", "のむ", "nomu", "uống", "động từ nhóm 1", "N5", "水を飲んでください。", "Hãy uống nước."],
    ["行く", "いく", "iku", "đi", "động từ nhóm 1", "N5", "明日学校へ行きます。", "Ngày mai tôi đi học."],
    ["見る", "みる", "miru", "xem; nhìn", "động từ nhóm 2", "N5", "映画を見ました。", "Tôi đã xem phim."],
    ["大切", "たいせつ", "taisetsu", "quan trọng; quý giá", "tính từ na", "N4", "家族はとても大切です。", "Gia đình rất quan trọng."],
    ["経験", "けいけん", "keiken", "kinh nghiệm; trải nghiệm", "danh từ", "N4", "いい経験になりました。", "Đó đã trở thành một trải nghiệm tốt."],
    ["準備", "じゅんび", "junbi", "chuẩn bị", "danh từ; động từ suru", "N4", "旅行の準備をしています。", "Tôi đang chuẩn bị cho chuyến đi."],
    ["続ける", "つづける", "tsuzukeru", "tiếp tục", "động từ nhóm 2", "N4", "毎日練習を続けます。", "Tôi tiếp tục luyện tập mỗi ngày."],
    ["間に合う", "まにあう", "maniau", "kịp giờ", "động từ nhóm 1", "N4", "電車に間に合いました。", "Tôi đã kịp chuyến tàu."],
    ["確認", "かくにん", "kakunin", "xác nhận; kiểm tra", "danh từ; động từ suru", "N3", "予定を確認してください。", "Hãy kiểm tra lịch trình."],
    ["影響", "えいきょう", "eikyou", "ảnh hưởng", "danh từ", "N3", "天気は生活に影響します。", "Thời tiết ảnh hưởng đến cuộc sống."],
    ["解決", "かいけつ", "kaiketsu", "giải quyết", "danh từ; động từ suru", "N3", "問題を一緒に解決しましょう。", "Hãy cùng giải quyết vấn đề."],
    ["成長", "せいちょう", "seichou", "trưởng thành; phát triển", "danh từ; động từ suru", "N3", "失敗から成長できます。", "Ta có thể trưởng thành từ thất bại."],
    ["状況", "じょうきょう", "joukyou", "tình hình; hoàn cảnh", "danh từ", "N3", "現在の状況を説明します。", "Tôi sẽ giải thích tình hình hiện tại."],
    ["方針", "ほうしん", "houshin", "phương châm; chính sách", "danh từ", "N2", "会社の方針が変わりました。", "Chính sách công ty đã thay đổi."],
    ["傾向", "けいこう", "keikou", "xu hướng", "danh từ", "N2", "若者の消費傾向を調べます。", "Chúng tôi nghiên cứu xu hướng tiêu dùng của giới trẻ."],
    ["実施", "じっし", "jisshi", "thực hiện; triển khai", "danh từ; động từ suru", "N2", "来月調査を実施します。", "Tháng sau sẽ tiến hành khảo sát."],
    ["維持", "いじ", "iji", "duy trì", "danh từ; động từ suru", "N2", "品質を維持する必要があります。", "Cần duy trì chất lượng."],
    ["促進", "そくしん", "sokushin", "thúc đẩy", "danh từ; động từ suru", "N1", "交流を促進する制度です。", "Đây là chế độ thúc đẩy giao lưu."],
    ["遂行", "すいこう", "suikou", "thi hành; hoàn thành", "danh từ; động từ suru", "N1", "責任を持って任務を遂行します。", "Tôi sẽ có trách nhiệm hoàn thành nhiệm vụ."],
    ["顕著", "けんちょ", "kencho", "rõ rệt; nổi bật", "tính từ na", "N1", "改善の効果が顕著に現れた。", "Hiệu quả cải thiện đã xuất hiện rõ rệt."],
    ["踏まえる", "ふまえる", "fumaeru", "dựa trên; xét đến", "động từ nhóm 2", "N1", "結果を踏まえて判断します。", "Chúng tôi phán đoán dựa trên kết quả."],
    ["ありがとう", "ありがとう", "arigatou", "cảm ơn", "cụm từ", "N5", "手伝ってくれて、ありがとう。", "Cảm ơn vì đã giúp tôi."],
    ["すみません", "すみません", "sumimasen", "xin lỗi; làm phiền", "cụm từ", "N5", "すみません、駅はどこですか。", "Xin lỗi, ga ở đâu vậy?"],
    ["働く", "はたらく", "hataraku", "làm việc", "động từ nhóm 1", "N5", "東京で働いています。", "Tôi đang làm việc ở Tokyo."],
    ["学ぶ", "まなぶ", "manabu", "học hỏi", "động từ nhóm 1", "N3", "経験から多くを学びました。", "Tôi đã học được nhiều từ trải nghiệm."]
  ].map(([word, kana, romaji, meaning, pos, level, example, exampleVi], index) => ({ id: `w${index + 1}`, word, kana, romaji, meaning, pos, level, example, exampleVi })));

  const THEMATIC_WORDS = Array.isArray(global.HHJapaneseVocabularyPacks?.words) ? global.HHJapaneseVocabularyPacks.words.slice(0, 5000) : [];
  const JMDICT_WORDS = Array.isArray(global.HHJapaneseVocabulary10K?.words) ? global.HHJapaneseVocabulary10K.words.slice(0, 10000) : [];
  const PACK_WORDS = [...THEMATIC_WORDS, ...JMDICT_WORDS];
  const seenVocabulary = new Set();
  const VOCABULARY = Object.freeze([...WORDS, ...PACK_WORDS].filter((item) => {
    const key = `${item.word}\u0000${item.kana}`;
    if (!item.word || seenVocabulary.has(key)) return false;
    seenVocabulary.add(key);
    return true;
  }));
  const VOCABULARY_TOPICS = Object.freeze([...new Set(VOCABULARY.map((item) => item.topic).filter(Boolean))]);
  const COURSE_THEMES = Object.freeze({
    N5: ["Nền tảng", "Cuộc sống hằng ngày", "Giao tiếp đầu tiên"],
    N4: ["Thói quen", "Đi lại và trải nghiệm", "Mở rộng hội thoại"],
    N3: ["Công việc", "Ý kiến và giải thích", "Đọc hiểu trung cấp"],
    N2: ["Xã hội", "Học thuật và kinh doanh", "Diễn đạt tự nhiên"],
    N1: ["Sắc thái", "Lập luận chuyên sâu", "Tiếng Nhật nâng cao"]
  });
  const COURSE_UNITS = Object.freeze(LEVELS.flatMap((level) => COURSE_THEMES[level].map((title, index) => ({
    id: `${level.toLowerCase()}-${index + 1}`,
    level,
    index,
    title,
    description: `15 từ theo ngữ cảnh · nhận diện · nghe · nhập Kana`
  }))));

  const KANJI = Object.freeze([
    ["日", ["Nhật", "ngày", "mặt trời"], ["ニチ", "ジツ"], ["ひ", "か"], 4, "日", "N5", ["日本・にほん", "毎日・まいにち"]],
    ["本", ["bản", "sách", "gốc"], ["ホン"], ["もと"], 5, "木", "N5", ["本・ほん", "日本・にほん"]],
    ["学", ["học"], ["ガク"], ["まなぶ"], 8, "子", "N5", ["学生・がくせい", "学校・がっこう"]],
    ["生", ["sinh", "sống"], ["セイ", "ショウ"], ["いきる", "うまれる"], 5, "生", "N5", ["学生・がくせい", "生活・せいかつ"]],
    ["食", ["thực", "ăn"], ["ショク"], ["たべる"], 9, "食", "N5", ["食事・しょくじ", "食べる・たべる"]],
    ["行", ["hành", "đi"], ["コウ", "ギョウ"], ["いく", "おこなう"], 6, "行", "N5", ["旅行・りょこう", "銀行・ぎんこう"]],
    ["大", ["đại", "lớn"], ["ダイ", "タイ"], ["おおきい"], 3, "大", "N5", ["大学・だいがく", "大切・たいせつ"]],
    ["験", ["nghiệm", "kiểm tra"], ["ケン", "ゲン"], [], 18, "馬", "N4", ["経験・けいけん", "試験・しけん"]],
    ["続", ["tục", "tiếp tục"], ["ゾク"], ["つづく", "つづける"], 13, "糸", "N4", ["継続・けいぞく", "続ける・つづける"]],
    ["解", ["giải", "hiểu", "tháo"], ["カイ", "ゲ"], ["とく", "わかる"], 13, "角", "N3", ["解決・かいけつ", "理解・りかい"]],
    ["決", ["quyết", "quyết định"], ["ケツ"], ["きめる", "きまる"], 7, "水", "N3", ["決定・けってい", "解決・かいけつ"]],
    ["響", ["hưởng", "vang"], ["キョウ"], ["ひびく"], 20, "音", "N3", ["影響・えいきょう", "響く・ひびく"]],
    ["維", ["duy", "giữ"], ["イ"], [], 14, "糸", "N2", ["維持・いじ", "繊維・せんい"]],
    ["傾", ["khuynh", "nghiêng"], ["ケイ"], ["かたむく"], 13, "人", "N2", ["傾向・けいこう", "傾く・かたむく"]],
    ["顕", ["hiển", "rõ rệt"], ["ケン"], ["あきらか"], 18, "頁", "N1", ["顕著・けんちょ", "顕在・けんざい"]],
    ["遂", ["toại", "hoàn thành"], ["スイ"], ["とげる"], 12, "辵", "N1", ["遂行・すいこう", "遂げる・とげる"]]
  ].map(([char, meanings, on, kun, strokes, radical, level, examples]) => ({ char, meanings, on, kun, strokes, radical, level, examples })));

  const GRAMMAR = Object.freeze([
    ["～です／～ます", "Lối nói lịch sự cơ bản", "N／Aです・Vます", "私は学生です。", "Tôi là sinh viên.", "N5"],
    ["～てください", "Hãy làm…", "Vて + ください", "ここに名前を書いてください。", "Hãy viết tên vào đây.", "N5"],
    ["～たい", "Muốn làm…", "Vます bỏ ます + たい", "日本へ行きたいです。", "Tôi muốn đi Nhật.", "N5"],
    ["～たことがある", "Đã từng…", "Vた + ことがある", "京都へ行ったことがあります。", "Tôi đã từng đi Kyoto.", "N4"],
    ["～ながら", "Vừa… vừa…", "Vます bỏ ます + ながら", "音楽を聞きながら勉強します。", "Tôi vừa nghe nhạc vừa học.", "N4"],
    ["～ようになる", "Trở nên có thể; hình thành thay đổi", "Vる／Vない + ようになる", "漢字が読めるようになりました。", "Tôi đã trở nên đọc được Kanji.", "N4"],
    ["～ことにする", "Quyết định sẽ…", "Vる／Vない + ことにする", "毎日運動することにしました。", "Tôi đã quyết định tập thể dục mỗi ngày.", "N3"],
    ["～ために", "Để; vì", "Nの／Vる + ために", "留学するために日本語を勉強します。", "Tôi học tiếng Nhật để du học.", "N3"],
    ["～に対して", "Đối với; trái lại", "N + に対して", "質問に対して丁寧に答えました。", "Tôi đã trả lời câu hỏi một cách lịch sự.", "N3"],
    ["～に違いない", "Chắc chắn là…", "Thể thông thường + に違いない", "彼は知っているに違いない。", "Chắc chắn anh ấy biết.", "N2"],
    ["～わけではない", "Không hẳn là…", "Thể thông thường + わけではない", "高いものが全部いいわけではない。", "Không phải mọi thứ đắt đều tốt.", "N2"],
    ["～に基づいて", "Dựa trên…", "N + に基づいて", "データに基づいて判断します。", "Chúng tôi phán đoán dựa trên dữ liệu.", "N2"],
    ["～を踏まえて", "Xét đến; dựa trên", "N + を踏まえて", "結果を踏まえて計画を直します。", "Chúng tôi sửa kế hoạch dựa trên kết quả.", "N1"],
    ["～に至るまで", "Cho đến tận…", "N + に至るまで", "細部に至るまで確認した。", "Đã kiểm tra đến từng chi tiết.", "N1"],
    ["～といえども", "Mặc dù là; ngay cả", "N／thể thông thường + といえども", "専門家といえども間違うことはある。", "Ngay cả chuyên gia cũng có lúc sai.", "N1"]
  ].map(([pattern, meaning, structure, example, translation, level], index) => ({ id: `g${index + 1}`, pattern, meaning, structure, example, translation, level })));

  const READINGS = Object.freeze([
    { id: "r-n5", level: "N5", title: "私の一日", minutes: 3, text: "私は毎朝七時に起きます。朝ご飯を食べて、八時に学校へ行きます。学校で日本語を勉強します。", translation: "Mỗi sáng tôi dậy lúc 7 giờ. Tôi ăn sáng rồi đi học lúc 8 giờ. Ở trường tôi học tiếng Nhật.", question: "何時に学校へ行きますか。", answer: "八時" },
    { id: "r-n4", level: "N4", title: "新しい習慣", minutes: 4, text: "先月から、寝る前に本を読むことにしました。最初は十ページだけでしたが、今は毎日三十分ぐらい読めるようになりました。", translation: "Từ tháng trước, tôi quyết định đọc sách trước khi ngủ. Ban đầu chỉ 10 trang, giờ tôi đã có thể đọc khoảng 30 phút mỗi ngày.", question: "今、毎日どのくらい読みますか。", answer: "三十分ぐらい" },
    { id: "r-n3", level: "N3", title: "町の図書館", minutes: 5, text: "町の図書館は利用者の意見を聞くために、アンケートを実施した。その結果、平日の開館時間を一時間延ばすことになった。", translation: "Thư viện thành phố đã khảo sát để lắng nghe ý kiến người dùng. Kết quả là thời gian mở cửa ngày thường được kéo dài một giờ.", question: "アンケートの結果、何が変わりましたか。", answer: "開館時間" },
    { id: "r-n2", level: "N2", title: "働き方の変化", minutes: 7, text: "技術の発達に伴って、働く場所に対する考え方も変化している。しかし、どこでも働ければ問題がすべて解決するわけではない。", translation: "Cùng với sự phát triển công nghệ, cách nghĩ về nơi làm việc cũng thay đổi. Tuy nhiên, không phải cứ làm việc ở đâu cũng được là mọi vấn đề đều được giải quyết.", question: "筆者はどのように考えていますか。", answer: "すべて解決するわけではない" },
    { id: "r-n1", level: "N1", title: "情報と判断", minutes: 9, text: "情報が豊富であることは、必ずしも判断の質を高めるとは限らない。重要なのは、情報の背景を踏まえ、何が必要かを見極めることである。", translation: "Thông tin phong phú không nhất thiết nâng cao chất lượng phán đoán. Điều quan trọng là xét bối cảnh và nhận định điều gì cần thiết.", question: "筆者が重要だと述べていることは何ですか。", answer: "必要な情報を見極めること" }
  ]);

  const KANA_ROWS = Object.freeze([
    ["あ", "い", "う", "え", "お"], ["か", "き", "く", "け", "こ"], ["さ", "し", "す", "せ", "そ"],
    ["た", "ち", "つ", "て", "と"], ["な", "に", "ぬ", "ね", "の"], ["は", "ひ", "ふ", "へ", "ほ"],
    ["ま", "み", "む", "め", "も"], ["や", "", "ゆ", "", "よ"], ["ら", "り", "る", "れ", "ろ"], ["わ", "", "", "", "を"], ["ん", "", "", "", ""]
  ]);

  const ROMAJI = Object.freeze({ kya:"きゃ",kyu:"きゅ",kyo:"きょ",sha:"しゃ",shu:"しゅ",sho:"しょ",cha:"ちゃ",chu:"ちゅ",cho:"ちょ",nya:"にゃ",nyu:"にゅ",nyo:"にょ",hya:"ひゃ",hyu:"ひゅ",hyo:"ひょ",mya:"みゃ",myu:"みゅ",myo:"みょ",rya:"りゃ",ryu:"りゅ",ryo:"りょ",gya:"ぎゃ",gyu:"ぎゅ",gyo:"ぎょ",ja:"じゃ",ju:"じゅ",jo:"じょ",bya:"びゃ",byu:"びゅ",byo:"びょ",pya:"ぴゃ",pyu:"ぴゅ",pyo:"ぴょ",shi:"し",chi:"ち",tsu:"つ",fu:"ふ",ka:"か",ki:"き",ku:"く",ke:"け",ko:"こ",sa:"さ",su:"す",se:"せ",so:"そ",ta:"た",te:"て",to:"と",na:"な",ni:"に",nu:"ぬ",ne:"ね",no:"の",ha:"は",hi:"ひ",he:"へ",ho:"ほ",ma:"ま",mi:"み",mu:"む",me:"め",mo:"も",ya:"や",yu:"ゆ",yo:"よ",ra:"ら",ri:"り",ru:"る",re:"れ",ro:"ろ",wa:"わ",wo:"を",ga:"が",gi:"ぎ",gu:"ぐ",ge:"げ",go:"ご",za:"ざ",ji:"じ",zu:"ず",ze:"ぜ",zo:"ぞ",da:"だ",de:"で",do:"ど",ba:"ば",bi:"び",bu:"ぶ",be:"べ",bo:"ぼ",pa:"ぱ",pi:"ぴ",pu:"ぷ",pe:"ぺ",po:"ぽ",a:"あ",i:"い",u:"う",e:"え",o:"お",n:"ん" });

  function romajiToHiragana(input = "") {
    let source = String(input).toLowerCase().replace(/[^a-z\s'-]/g, "");
    let result = "";
    while (source.length) {
      if (/^([bcdfghjkmprstvwxyz])\1/.test(source) && !source.startsWith("nn")) { result += "っ"; source = source.slice(1); continue; }
      if (source[0] === " " || source[0] === "-") { result += source[0]; source = source.slice(1); continue; }
      if (source.startsWith("nn")) { result += "ん"; source = source.slice(2); continue; }
      let matched = false;
      for (const size of [3, 2, 1]) {
        const key = source.slice(0, size);
        if (ROMAJI[key]) { result += ROMAJI[key]; source = source.slice(size); matched = true; break; }
      }
      if (!matched) { result += source[0]; source = source.slice(1); }
    }
    return result;
  }
  const hiraganaToKatakana = (input = "") => [...String(input)].map((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : char;
  }).join("");
  const normalizeSearch = (value = "") => String(value).trim().toLocaleLowerCase("vi").normalize("NFKC");
  function dictionarySearch(query = "") {
    const key = normalizeSearch(query);
    if (!key) return [];
    const kana = romajiToHiragana(key);
    return VOCABULARY.filter((item) => [item.word, item.kana, item.romaji, item.meaning, item.example, item.exampleVi, item.topic].some((value) => normalizeSearch(value).includes(key)) || (kana !== key && item.kana.includes(kana))).slice(0, 60);
  }
  function conjugateVerb(value = "") {
    const verb = String(value).trim();
    if (!verb) return null;
    if (verb === "する") return { dictionary: verb, polite:"します", negative:"しない", past:"した", te:"して", potential:"できる", passive:"される", causative:"させる" };
    if (verb === "来る" || verb === "くる") return { dictionary:verb, polite:"きます", negative:"こない", past:"きた", te:"きて", potential:"こられる", passive:"こられる", causative:"こさせる" };
    if (verb === "行く") return { dictionary:verb, polite:"行きます", negative:"行かない", past:"行った", te:"行って", potential:"行ける", passive:"行かれる", causative:"行かせる" };
    if (/[えけげせぜてでねへべめれ]る$/.test(verb) || /[いきぎしじちぢにひびみり]る$/.test(verb)) {
      const stem = verb.slice(0, -1); return { dictionary:verb, polite:`${stem}ます`, negative:`${stem}ない`, past:`${stem}た`, te:`${stem}て`, potential:`${stem}られる`, passive:`${stem}られる`, causative:`${stem}させる` };
    }
    const end = verb.slice(-1); const stem = verb.slice(0, -1);
    const rows = { "う":["い","わ","った","って","え","われ","わせ"],"く":["き","か","いた","いて","け","かれ","かせ"],"ぐ":["ぎ","が","いだ","いで","げ","がれ","がせ"],"す":["し","さ","した","して","せ","され","させ"],"つ":["ち","た","った","って","て","たれ","たせ"],"ぬ":["に","な","んだ","んで","ね","なれ","なせ"],"ぶ":["び","ば","んだ","んで","べ","ばれ","ばせ"],"む":["み","ま","んだ","んで","め","まれ","ませ"],"る":["り","ら","った","って","れ","られ","らせ"] };
    const row = rows[end]; if (!row) return null;
    return { dictionary:verb, polite:`${stem}${row[0]}ます`, negative:`${stem}${row[1]}ない`, past:`${stem}${row[2]}`, te:`${stem}${row[3]}`, potential:`${stem}${row[4]}る`, passive:`${stem}${row[5]}る`, causative:`${stem}${row[6]}る` };
  }

  function normalizeCustomWord(item, index = 0) {
    if (!item || typeof item !== "object") return null;
    const word = String(item.word || item.kana || "").trim().slice(0, 80);
    const kana = String(item.kana || "").trim().slice(0, 80);
    if (!word) return null;
    const seed = `${word}:${kana}`;
    const hash = [...seed].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7).toString(36);
    return {
      id: `custom-${hash || index}`,
      word,
      kana,
      romaji: String(item.romaji || "").trim().slice(0, 100),
      meaning: String(item.meaning || "Chưa có bản dịch tiếng Việt").trim().slice(0, 500),
      pos: String(item.pos || "Từ nhập từ kho trực tuyến").trim().slice(0, 240),
      level: LEVELS.includes(item.level) ? item.level : "N5",
      example: String(item.example || "").trim().slice(0, 500),
      exampleVi: String(item.exampleVi || "").trim().slice(0, 500),
      source: String(item.source || "Kho từ trực tuyến").trim().slice(0, 100)
    };
  }
  const defaults = () => ({ version: VERSION, view: "dashboard", level: "N5", dailyGoal: 20, streak: 0, lastStudyDay: "", xp: 0, dailyActivity: {}, saved: {}, reviews: {}, customWords: [], history: [], completedReadings: {}, completedLessons: {}, mistakes: [], offlinePacks: {}, testHistory: [], searchQuery: "", selectedVocabularyTopic: "all", selectedKanji: "日", selectedGrammarLevel: "all", selectedReading: "r-n5", selectedWordId: "w1", selectedGoal: "foundation", onboardingComplete: false, furigana: true, theme: "light", lesson: null, jlptSection: "vocabulary" });
  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey()) || "null");
      return { ...defaults(), ...(saved && typeof saved === "object" ? saved : {}), saved: saved?.saved || {}, reviews: saved?.reviews || {}, customWords: Array.isArray(saved?.customWords) ? saved.customWords.slice(0, 200).map(normalizeCustomWord).filter(Boolean) : [], dailyActivity: saved?.dailyActivity && typeof saved.dailyActivity === "object" ? saved.dailyActivity : {}, history: Array.isArray(saved?.history) ? saved.history.slice(0, 100) : [], completedReadings: saved?.completedReadings || {}, completedLessons: saved?.completedLessons || {}, mistakes: Array.isArray(saved?.mistakes) ? saved.mistakes.slice(0, 200) : [], offlinePacks: saved?.offlinePacks || {}, testHistory: Array.isArray(saved?.testHistory) ? saved.testHistory.slice(0, 100) : [] };
    } catch { return defaults(); }
  }
  function writeState(state) {
    const activity = Object.fromEntries(Object.entries(state.dailyActivity || {}).slice(-90));
    localStorage.setItem(stateKey(), JSON.stringify({ ...state, version: VERSION, customWords: (state.customWords || []).slice(0, 200), dailyActivity: activity, history: (state.history || []).slice(0, 100), mistakes: (state.mistakes || []).slice(0, 200), testHistory: (state.testHistory || []).slice(0, 100) }));
  }
  function markStudy(state, xp = 5) {
    const key = today();
    if (state.lastStudyDay !== key) {
      const yesterday = new Date(Date.now() - dayMs).toISOString().slice(0, 10);
      state.streak = state.lastStudyDay === yesterday ? Number(state.streak || 0) + 1 : 1;
      state.lastStudyDay = key;
    }
    state.xp = Number(state.xp || 0) + xp;
    state.dailyActivity = state.dailyActivity && typeof state.dailyActivity === "object" ? state.dailyActivity : {};
    state.dailyActivity[key] = Math.max(0, Number(state.dailyActivity[key] || 0) + xp);
  }
  const allWords = (state) => [...VOCABULARY, ...(state.customWords || [])];
  function saveWord(state, id) {
    const item = allWords(state).find((word) => word.id === id); if (!item) return;
    if (state.saved[id]) { delete state.saved[id]; delete state.reviews[id]; return; }
    state.saved[id] = { savedAt: new Date().toISOString(), note: "" };
    state.reviews[id] = { dueAt: new Date().toISOString(), interval: 0, ease: 2.5, repetitions: 0, mastery: 0 };
  }
  const dueWords = (state) => allWords(state).filter((word) => state.saved[word.id] && new Date(state.reviews[word.id]?.dueAt || 0).getTime() <= Date.now());
  const savedWordCount = (state) => allWords(state).filter((word) => state.saved[word.id]).length;
  function reviewWord(state, id, grade) {
    const review = state.reviews[id] || { interval:0, ease:2.5, repetitions:0, mastery:0 };
    const values = { again:0, hard:1, good:3, easy:5 }; const score = values[grade] ?? 0;
    if (score < 3) { review.repetitions = 0; review.interval = grade === "hard" ? 1 : 0; review.ease = Math.max(1.3, review.ease - .2); }
    else { review.repetitions += 1; review.interval = review.repetitions === 1 ? 1 : review.repetitions === 2 ? 3 : Math.max(4, Math.round(Math.max(1, review.interval) * review.ease * (grade === "easy" ? 1.3 : 1))); review.ease = Math.min(3, review.ease + (grade === "easy" ? .15 : .02)); }
    review.mastery = Math.max(0, Math.min(100, Number(review.mastery || 0) + (score < 3 ? -12 : score === 5 ? 18 : 12)));
    review.dueAt = new Date(Date.now() + (review.interval || .01) * dayMs).toISOString(); review.lastReviewedAt = new Date().toISOString();
    state.reviews[id] = review; markStudy(state, score < 3 ? 2 : 8);
  }

  function srsStatus(state, id) {
    const review = state.reviews[id];
    if (!state.saved[id] || !review) return "new";
    if (Number(review.mastery || 0) >= 85 && Number(review.repetitions || 0) >= 4) return "mastered";
    if (new Date(review.dueAt || 0).getTime() <= Date.now()) return "due";
    if (Number(review.mastery || 0) < 35) return "learning";
    return "scheduled";
  }
  function recordMistake(state, mistake) {
    const key = `${mistake.type || "practice"}:${mistake.id || mistake.prompt || "unknown"}`;
    const current = (state.mistakes || []).find((item) => item.key === key && !item.resolved);
    if (current) {
      current.count = Number(current.count || 1) + 1;
      current.answer = String(mistake.answer || "").slice(0, 300);
      current.at = new Date().toISOString();
      return current;
    }
    const entry = { key, type: mistake.type || "practice", id: mistake.id || "", prompt: String(mistake.prompt || "").slice(0, 300), answer: String(mistake.answer || "").slice(0, 300), correct: String(mistake.correct || "").slice(0, 300), count: 1, at: new Date().toISOString(), resolved: false };
    state.mistakes = [entry, ...(state.mistakes || [])].slice(0, 200);
    return entry;
  }
  function lessonWords(unit) {
    if (!unit) return [];
    const pool = VOCABULARY.filter((item) => item.level === unit.level && (item.meaningLanguage !== "en" || unit.level !== "N5"));
    const fallback = VOCABULARY.filter((item) => item.level === unit.level);
    const source = pool.length >= 15 ? pool : fallback;
    const start = (unit.index * 15) % Math.max(15, source.length);
    return Array.from({ length: Math.min(15, source.length) }, (_, offset) => source[(start + offset) % source.length]);
  }
  function isUnitUnlocked(state, unit) {
    const sameLevel = COURSE_UNITS.filter((item) => item.level === unit.level);
    const position = sameLevel.findIndex((item) => item.id === unit.id);
    return position <= 0 || Boolean(state.completedLessons?.[sameLevel[position - 1].id]);
  }
  const navGroup = (view) => ({ lesson: "learn", grammar: "learn", reader: "learn", conversation: "learn", kanji: "dictionary", tools: "dictionary", word: "dictionary" })[view] || view;

  let instance = null;
  const routeFor = (view) => view === "dashboard" ? "#/japanese" : `#/japanese/${view}`;
  const speak = (text, rate = .9) => {
    if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) return false;
    global.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(String(text || "")); utterance.lang = "ja-JP"; utterance.rate = rate;
    const voice = global.speechSynthesis.getVoices().find((item) => /^ja(?:-|_)/i.test(item.lang || "")); if (voice) utterance.voice = voice;
    global.speechSynthesis.speak(utterance); return true;
  };
  function toast(message, tone = "info") {
    const node = instance?.host?.querySelector("[data-hhj-toast]"); if (!node) return;
    node.textContent = message; node.dataset.tone = tone; node.hidden = false; clearTimeout(instance.toastTimer); instance.toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }
  const progressPercent = (state) => Math.min(100, Math.round((savedWordCount(state) * 2 + Object.keys(state.completedReadings).length * 8 + state.testHistory.length * 5)));
  const todayXp = (state) => Math.max(0, Number(state.dailyActivity?.[today()] || 0));
  function dailyPlan(state) {
    const due = dueWords(state);
    const reading = READINGS.find((item) => item.level === state.level && !state.completedReadings[item.id]) || READINGS.find((item) => item.level === state.level) || READINGS[0];
    const lesson = COURSE_UNITS.find((item) => item.level === state.level && isUnitUnlocked(state, item) && !state.completedLessons?.[item.id]) || COURSE_UNITS.find((item) => item.level === state.level);
    return [
      { id: "lesson", label: `Học 15 từ · ${lesson?.title || state.level}`, detail: "5–10 phút · bốn dạng bài", view: "learn", unitId: lesson?.id, done: Boolean(lesson && String(state.completedLessons?.[lesson.id]?.at || "").slice(0, 10) === today()) },
      { id: "review", label: due.length ? `Ôn ${Math.min(10, due.length)} từ đến hạn` : "Ôn từ khó trong Sổ lỗi", detail: due.length ? "SRS theo lịch ghi nhớ" : `${(state.mistakes || []).filter((item) => !item.resolved).length} lỗi cần xem lại`, view: "notebook", done: due.length === 0 && !(state.mistakes || []).some((item) => !item.resolved) },
      { id: "reading", label: `Đọc và nghe · ${reading.title}`, detail: `${reading.level} · ${reading.minutes} phút`, view: "reader", readingId: reading.id, done: Boolean(state.completedReadings[reading.id]) }
    ];
  }
  const normalizeJapaneseAnswer = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[\s。、！？!?.,・「」『』（）()]/g, "");
  function scoreDictation(expected, actual) {
    const target = [...normalizeJapaneseAnswer(expected)];
    const answer = [...normalizeJapaneseAnswer(actual)];
    if (!target.length || !answer.length) return 0;
    const rows = Array.from({ length: target.length + 1 }, (_, index) => [index, ...Array(answer.length).fill(0)]);
    for (let column = 1; column <= answer.length; column += 1) rows[0][column] = column;
    for (let row = 1; row <= target.length; row += 1) {
      for (let column = 1; column <= answer.length; column += 1) {
        rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + (target[row - 1] === answer[column - 1] ? 0 : 1));
      }
    }
    return Math.max(0, Math.round((1 - rows[target.length][answer.length] / Math.max(target.length, answer.length)) * 100));
  }

  function shell(content) {
    const { state } = instance; const view = state.view;
    return `<section class="hhj-app" data-theme="${esc(state.theme)}"><header class="hhj-topbar"><button class="hhj-mobile-menu" type="button" data-hhj-menu aria-label="Mở menu">☰</button><div class="hhj-brand"><span>日</span><div><small>HỌC TIẾNG NHẬT MỖI NGÀY</small><strong>HH Japanese</strong></div></div><form class="hhj-global-search" data-hhj-search><label><span>⌕</span><input name="query" value="${esc(state.searchQuery)}" placeholder="Kanji, Kana, Romaji hoặc tiếng Việt" autocomplete="off"></label><button>Tìm</button><button type="button" data-hhj-voice-search title="Tìm bằng giọng nói">🎙</button></form><div class="hhj-top-stats"><span><b>${state.streak}</b> ngày</span><span><b>${state.xp}</b> XP</span><button type="button" data-hhj-theme>${state.theme === "light" ? "◐ Tối" : "☀ Sáng"}</button></div></header><div class="hhj-layout"><aside class="hhj-sidebar" data-hhj-sidebar><nav>${VIEWS.map(([id,label,icon])=>`<button type="button" data-hhj-view="${id}" class="${navGroup(view)===id?"active":""}"><i>${icon}</i><span>${label}</span>${id==="notebook"&&(dueWords(state).length||(state.mistakes||[]).some(item=>!item.resolved))?`<b>${dueWords(state).length+(state.mistakes||[]).filter(item=>!item.resolved).length}</b>`:""}</button>`).join("")}</nav><section><small>LỘ TRÌNH CÁ NHÂN</small><strong>${state.level}</strong><select data-hhj-level>${LEVELS.map(level=>`<option ${level===state.level?"selected":""}>${level}</option>`).join("")}</select><span>${progressPercent(state)}% hành trình · ${esc(({foundation:"Nền tảng",conversation:"Giao tiếp",jlpt:"Ôn JLPT",work:"Đi làm"})[state.selectedGoal]||"Nền tảng")}</span><button type="button" data-hhj-reopen-onboarding>Đổi mục tiêu</button></section></aside><main class="hhj-main">${content}</main></div><div class="hhj-toast" data-hhj-toast hidden role="status"></div></section>`;
  }

  function dashboardView(state) {
    const due = dueWords(state); const plan=dailyPlan(state); const earned=todayXp(state); const mistakes=(state.mistakes||[]).filter(item=>!item.resolved); const nextUnit=COURSE_UNITS.find(item=>item.level===state.level&&isUnitUnlocked(state,item)&&!state.completedLessons?.[item.id])||COURSE_UNITS.find(item=>item.level===state.level);
    return `<section class="hhj-dashboard"><section class="hhj-hero hhj-today-hero"><div><small>${state.level} · HÔM NAY</small><h1>Chỉ cần<br><em>15 từ mỗi ngày.</em></h1><p>Học ngắn, ôn đúng lúc và tập trung vào những lỗi bạn thực sự mắc phải.</p><div><button class="primary" data-hhj-unit="${nextUnit?.id||"n5-1"}">Bắt đầu bài 5–10 phút →</button><button data-hhj-view="notebook">Ôn ${due.length} từ đến hạn</button></div></div><aside><b>${progressPercent(state)}%</b><span>TIẾN ĐỘ</span><i style="--p:${progressPercent(state)}%"></i></aside></section><section class="hhj-daily-plan"><header><div><small>VIỆC CẦN LÀM</small><h2>Ba bước là đủ cho hôm nay</h2></div><strong>${earned}/${state.dailyGoal} XP</strong></header><div class="hhj-goal-track"><span style="--p:${Math.min(100,Math.round(earned/Math.max(1,state.dailyGoal)*100))}%"></span></div><div>${plan.map(item=>`<button ${item.unitId?`data-hhj-unit="${item.unitId}"`:`data-hhj-view="${item.view}"`} ${item.readingId?`data-hhj-reading="${item.readingId}"`:""} class="${item.done?"done":""}"><i>${item.done?"✓":"○"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span><b>→</b></button>`).join("")}</div></section><div class="hhj-metrics"><article><span>Từ đang học</span><strong>${Object.values(state.reviews||{}).filter(item=>Number(item.mastery||0)<85).length}</strong><small>${due.length} từ đến hạn</small></article><article><span>Lỗi cần sửa</span><strong>${mistakes.length}</strong><small>Tự gom từ bài học và bài kiểm tra</small></article><article><span>Bài đã hoàn thành</span><strong>${Object.keys(state.completedLessons||{}).length}</strong><small>Trong lộ trình ${state.level}</small></article><article><span>Chuỗi học</span><strong>${state.streak}</strong><small>${state.streak?"Tiếp tục giữ nhịp":"Bắt đầu từ hôm nay"}</small></article></div><section class="hhj-quick-tools"><header><div><small>TRUY CẬP NHANH</small><h2>Cần gì, mở đúng chỗ đó</h2></div></header><div><button data-hhj-view="dictionary"><b>辞</b><span><strong>Tra từ</strong><small>10.000 từ offline</small></span></button><button data-hhj-view="reader"><b>読</b><span><strong>Đọc & nghe</strong><small>Chạm từ để tra</small></span></button><button data-hhj-view="grammar"><b>文</b><span><strong>Ngữ pháp</strong><small>Mẫu câu N5–N1</small></span></button><button data-hhj-view="conversation"><b>話</b><span><strong>Hội thoại</strong><small>Nói và shadowing</small></span></button></div></section></section>`;
  }

  function onboardingView(state) {
    return `<section class="hhj-onboarding"><header><span>日</span><div><small>THIẾT LẬP TRONG 60 GIÂY</small><h1>Bạn muốn học tiếng Nhật để làm gì?</h1><p>HH Japanese dùng lựa chọn này để sắp xếp bài học. Kết quả chỉ là đề xuất và có thể đổi bất cứ lúc nào.</p></div></header><form data-hhj-onboarding><fieldset><legend>1. Mục tiêu chính</legend><div class="hhj-choice-grid">${[["foundation","Bắt đầu từ đầu","Kana, từ cơ bản và câu ngắn"],["conversation","Giao tiếp","Nghe, nói và tình huống thực tế"],["jlpt","Ôn JLPT","Từ vựng, ngữ pháp và bài kiểm tra"],["work","Đi làm tại Nhật","Công việc và cách nói lịch sự"]].map(([value,label,detail])=>`<label><input type="radio" name="goal" value="${value}" ${state.selectedGoal===value?"checked":""}><span><strong>${label}</strong><small>${detail}</small></span></label>`).join("")}</div></fieldset><fieldset><legend>2. Trình độ hiện tại</legend><select name="level"><option value="auto">Kiểm tra nhanh và đề xuất</option>${LEVELS.map(level=>`<option value="${level}" ${state.level===level?"selected":""}>Đang học ${level}</option>`).join("")}</select><div class="hhj-placement"><p>Nếu chọn kiểm tra nhanh, hãy trả lời năm câu sau:</p>${[["日本","Nhật Bản"],["経験","kinh nghiệm"],["解決","giải quyết"],["傾向","xu hướng"],["遂行","hoàn thành nhiệm vụ"]].map(([word,answer],index)=>`<label><span>${word}</span><input name="placement${index}" placeholder="Nghĩa tiếng Việt" data-answer="${answer}"></label>`).join("")}</div></fieldset><fieldset><legend>3. Nhịp học mỗi ngày</legend><div class="hhj-goal-options">${[[10,"5 phút"],[20,"10 phút"],[30,"15 phút"],[50,"25 phút"]].map(([xp,label])=>`<label><input type="radio" name="dailyGoal" value="${xp}" ${Number(state.dailyGoal)===xp?"checked":""}><span><strong>${label}</strong><small>${xp} XP/ngày</small></span></label>`).join("")}</div></fieldset><button class="primary" type="submit">Tạo lộ trình của tôi →</button></form></section>`;
  }

  function learnView(state) {
    const units = COURSE_UNITS.filter((item) => item.level === state.level);
    const completed = units.filter((item) => state.completedLessons?.[item.id]).length;
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>LỘ TRÌNH ${state.level}</small><h1>Học từng bài, không bị ngợp</h1><p>Mỗi bài gồm đúng 15 từ và bốn kiểu luyện. Bài tiếp theo mở sau khi hoàn thành bài trước.</p></div><strong>${completed}/${units.length} bài</strong></header><section class="hhj-course-map">${units.map((unit,index)=>{const done=Boolean(state.completedLessons?.[unit.id]);const unlocked=isUnitUnlocked(state,unit);return `<article class="${done?"done":""} ${unlocked?"":"locked"}"><span>${done?"✓":unlocked?index+1:"🔒"}</span><div><small>${unit.level} · BÀI ${index+1}</small><h2>${esc(unit.title)}</h2><p>${esc(unit.description)}</p></div><button data-hhj-unit="${unit.id}" ${unlocked?"":"disabled"}>${done?"Học lại":unlocked?"Bắt đầu":"Chưa mở"}</button></article>`;}).join("")}</section><section class="hhj-learning-labs"><header><div><small>HỌC SÂU HƠN</small><h2>Kỹ năng bổ trợ</h2></div></header><div><button data-hhj-view="reader"><b>読</b><span><strong>Đọc & nghe</strong><small>Tra từ ngay trong câu, chép chính tả và shadowing</small></span></button><button data-hhj-view="grammar"><b>文</b><span><strong>Ngữ pháp</strong><small>Cấu trúc, ví dụ đúng ngữ cảnh và lưu để ôn</small></span></button><button data-hhj-view="conversation"><b>話</b><span><strong>Hội thoại</strong><small>Luyện phản xạ nói và nhận phản hồi</small></span></button><button data-hhj-view="kanji"><b>漢</b><span><strong>Kanji</strong><small>Âm On/Kun, bộ thủ và luyện viết</small></span></button></div></section></section>`;
  }

  function lessonQuestion(words, index) {
    const item = words[index];
    const mode = index % 4;
    const others = words.filter((word) => word.id !== item.id);
    const pick = (field) => [item[field], ...others.slice(index % Math.max(1, others.length), (index % Math.max(1, others.length)) + 3).map((word) => word[field])].filter(Boolean).slice(0, 4).sort((a,b)=>String(a).localeCompare(String(b),"ja"));
    if (mode === 0) return { mode, label: "NHẬN DIỆN", prompt: `「${item.word}」có nghĩa là gì?`, answer: item.meaning, options: pick("meaning") };
    if (mode === 1) return { mode, label: "CHỌN TỪ", prompt: `Từ nào có nghĩa “${item.meaning}”?`, answer: item.word, options: pick("word") };
    if (mode === 2) return { mode, label: "NGHE", prompt: "Nghe và chọn cách đọc đúng", answer: item.kana, options: pick("kana"), audio: item.word };
    return { mode, label: "NHẬP KANA", prompt: `Nhập cách đọc của 「${item.word}」`, answer: item.kana, input: true };
  }

  function lessonView(state) {
    const unit = COURSE_UNITS.find((item) => item.id === state.lesson?.unitId) || COURSE_UNITS.find((item) => item.level === state.level);
    const words = lessonWords(unit);
    const session = state.lesson && state.lesson.unitId === unit?.id ? state.lesson : { unitId: unit?.id, stage: "intro", index: 0, correct: 0, wrongIds: [] };
    if (!unit) return `<div class="hhj-empty">Chưa có bài phù hợp.</div>`;
    if (session.stage === "intro") return `<section class="hhj-page hhj-lesson"><header class="hhj-lesson-head"><button data-hhj-view="learn">← Lộ trình</button><div><small>${unit.level} · ${esc(unit.title)}</small><h1>15 từ trong 5–10 phút</h1><p>Xem trước từ mới, sau đó luyện nhận diện, chọn nghĩa, nghe và nhập Kana.</p></div><strong>0/15</strong></header><div class="hhj-lesson-preview">${words.map((item,index)=>`<button data-hhj-word-detail="${item.id}"><b>${index+1}</b><span><strong>${esc(item.word)}</strong><small>${esc(item.kana)} · ${esc(item.meaning)}</small></span><i>▶</i></button>`).join("")}</div><button class="primary hhj-lesson-cta" data-hhj-lesson-start>Bắt đầu luyện →</button></section>`;
    if (session.stage === "summary") return `<section class="hhj-lesson-summary"><span>${session.correct >= 12 ? "よくできました！" : "もう一度やってみよう"}</span><h1>Hoàn thành ${esc(unit.title)}</h1><strong>${session.correct}/15</strong><p>${session.wrongIds.length ? `${session.wrongIds.length} từ chưa chắc đã được đưa vào SRS và Sổ lỗi.` : "Bạn đã trả lời đúng toàn bộ bài học."}</p><div><button data-hhj-unit="${unit.id}">Học lại</button><button class="primary" data-hhj-lesson-complete>Hoàn tất và tiếp tục</button></div></section>`;
    const index = Math.min(words.length - 1, Number(session.index || 0)); const item=words[index]; const question=lessonQuestion(words,index); const progress=Math.round(index/Math.max(1,words.length)*100);
    return `<section class="hhj-page hhj-lesson"><header class="hhj-lesson-head"><button data-hhj-view="learn">× Thoát</button><div><small>${question.label} · ${unit.level}</small><h2>${esc(unit.title)}</h2></div><strong>${index+1}/15</strong></header><div class="hhj-lesson-progress"><span style="--p:${progress}%"></span></div><form class="hhj-lesson-question" data-hhj-lesson-answer data-id="${item.id}" data-answer="${esc(question.answer)}"><small>${question.label}</small><h1>${esc(question.prompt)}</h1>${question.audio?`<button type="button" class="hhj-audio-orb" data-hhj-speak="${esc(question.audio)}">▶ Nghe lại</button>`:""}${question.input?`<label>ひらがな<input name="answer" required lang="ja" autocomplete="off" autofocus placeholder="かなで入力"></label>`:`<div>${question.options.map(option=>`<label><input type="radio" name="answer" value="${esc(option)}" required><span>${esc(option)}</span></label>`).join("")}</div>`}<button class="primary" type="submit">Kiểm tra</button><output data-tone="${session.feedback?.ok?"success":"error"}">${session.feedback?esc(session.feedback.message):""}</output>${session.feedback?`<button type="button" data-hhj-lesson-next>${index+1>=words.length?"Xem kết quả":"Câu tiếp theo →"}</button>`:""}</form></section>`;
  }

  function wordDetailView(state) {
    const item = allWords(state).find((word) => word.id === state.selectedWordId) || allWords(state)[0];
    const related = allWords(state).filter((word) => word.id !== item.id && (word.topic === item.topic || word.level === item.level)).slice(0,6);
    const conjugation = conjugateVerb(item.word);
    const characters = [...item.word].filter((char) => /[\u3400-\u9fff]/.test(char));
    return `<section class="hhj-page hhj-word-detail"><header class="hhj-detail-back"><button data-hhj-view="dictionary">← Tra cứu</button><span>${item.level}${item.topic?` · ${esc(item.topic)}`:""}</span></header><section class="hhj-word-hero"><div><small>${item.meaningLanguage==="en"?"NGHĨA ANH TỪ JMDICT":"NGHĨA VIỆT ĐÃ BIÊN SOẠN"}</small><h1>${esc(item.word)}</h1><p>${esc(item.kana)}${item.romaji?` · ${esc(item.romaji)}`:""}</p><div><button class="primary" data-hhj-speak="${esc(item.word)}">▶ Phát âm</button><button data-hhj-save-word="${item.id}">${state.saved[item.id]?"★ Đã lưu vào SRS":"☆ Thêm vào SRS"}</button></div></div><aside><span>${esc(item.pos||"Từ vựng")}</span><strong>${esc(item.meaning)}</strong><small>${item.meaningLanguage==="en"?"Chưa có bản dịch Việt đã kiểm duyệt; không tự động dịch để tránh sai nghĩa.":"Nghĩa tiếng Việt"}</small></aside></section><div class="hhj-word-detail-grid"><section><small>VÍ DỤ TRONG NGỮ CẢNH</small><h2>${esc(item.example||"Chưa có câu ví dụ cho mục này.")}</h2><p>${esc(item.exampleVi||"Bản dịch ví dụ đang được bổ sung.")}</p>${item.example?`<button data-hhj-speak="${esc(item.example)}">▶ Nghe câu</button>`:""}</section><section><small>KANJI CẤU THÀNH</small><div class="hhj-character-chips">${characters.map(char=>`<button data-hhj-kanji="${char}">${char}</button>`).join("")||"Từ này không chứa Kanji."}</div><p>Mở Kanji Lab để xem âm On/Kun, bộ thủ và luyện nét.</p></section>${conjugation?`<section><small>CHIA ĐỘNG TỪ</small><dl>${Object.entries(conjugation).map(([key,value])=>`<dt>${esc(({dictionary:"Từ điển",polite:"Lịch sự",negative:"Phủ định",past:"Quá khứ",te:"Thể て",potential:"Khả năng",passive:"Bị động",causative:"Sai khiến"})[key]||key)}</dt><dd>${esc(value)}</dd>`).join("")}</dl></section>`:""}</div><section class="hhj-related-words"><header><h2>Từ liên quan và dễ gặp cùng chủ đề</h2></header><div>${related.map((word)=>`<button data-hhj-word-detail="${word.id}"><strong>${esc(word.word)}</strong><span>${esc(word.kana)} · ${esc(word.meaning)}</span></button>`).join("")}</div></section><button data-hhj-report-word="${item.id}">Báo nghĩa hoặc ví dụ cần sửa</button></section>`;
  }

  function wordCard(item, state) {
    return `<article class="hhj-word-card"><header><div><h3>${esc(item.word)}</h3><span>${esc(item.kana)}${item.romaji?` · ${esc(item.romaji)}`:""}</span></div><b>${item.level}</b></header><strong>${esc(item.meaning)}</strong><small>${esc(item.pos)}${item.topic?` · ${esc(item.topic)}`:""}${item.meaningLanguage==="en"?" · Nghĩa Anh":" · Nghĩa Việt"}</small>${item.example?`<p>${esc(item.example)}</p>`:""}${item.exampleVi?`<em>${esc(item.exampleVi)}</em>`:""}<footer><button data-hhj-word-detail="${item.id}">Chi tiết</button><button data-hhj-speak="${esc(item.word)}">▶ Nghe</button><button data-hhj-save-word="${item.id}" class="${state.saved[item.id]?"saved":""}">${state.saved[item.id]?"★ Đã lưu":"☆ Lưu từ"}</button></footer></article>`;
  }
  function searchStateWords(state, query) {
    const key=normalizeSearch(query); if(!key)return [];
    const kana=romajiToHiragana(key);
    return allWords(state).filter((item)=>[item.word,item.kana,item.romaji,item.meaning,item.example,item.exampleVi,item.topic].some((value)=>normalizeSearch(value).includes(key))||(kana!==key&&item.kana.includes(kana))).slice(0,500);
  }
  function onlineWordCard(item, index) {
    return `<article class="hhj-word-card hhj-online-word"><header><div><h3>${esc(item.word)}</h3><span>${esc(item.reading||"—")}</span></div><b>${esc(item.jlpt?.[0]||"WEB")}</b></header><strong>${esc((item.definitions||[]).join("; ")||"Chưa có nghĩa")}</strong><small>${esc((item.partsOfSpeech||[]).join(" · ")||"JMdict")}</small><em>${item.common?"Từ thông dụng · ":""}${esc(item.source||"JMdict")}</em><footer><button data-hhj-speak="${esc(item.word)}">▶ Nghe</button><button data-hhj-import-online="${index}">＋ Thêm vào SRS</button></footer></article>`;
  }
  function dictionaryView(state) {
    const topic=VOCABULARY_TOPICS.includes(state.selectedVocabularyTopic)?state.selectedVocabularyTopic:"all"; const candidates=state.searchQuery?searchStateWords(state,state.searchQuery):topic==="JMdict 10K"?allWords(state).filter(item=>item.topic===topic):allWords(state).filter(item=>item.level===state.level); const results=candidates.filter(item=>topic==="all"||item.topic===topic).slice(0,60); const recent=[...new Set((state.history||[]).filter(item=>item.type==="search"&&item.query).map(item=>item.query))].slice(0,6); const unsaved=results.filter(item=>!state.saved[item.id]).slice(0,10);
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>NHẬT ⇄ VIỆT</small><h1>Từ điển tiếng Nhật</h1><p>${VOCABULARY.length} từ offline theo ${VOCABULARY_TOPICS.length} chủ đề, cộng kho JMdict trực tuyến; nghe và lưu thẳng vào SRS.</p></div><div class="hhj-dictionary-filters"><select data-hhj-vocabulary-topic><option value="all">Tất cả chủ đề</option>${VOCABULARY_TOPICS.map(item=>`<option ${item===topic?"selected":""}>${esc(item)}</option>`).join("")}</select><span>${results.length} kết quả</span>${unsaved.length?`<button data-hhj-save-topic>＋ Thêm ${unsaved.length} từ vào SRS</button>`:""}</div></header><form class="hhj-dictionary-search" data-hhj-search><input name="query" value="${esc(state.searchQuery)}" placeholder="Ví dụ: 学ぶ, まなぶ, manabu, học hỏi" autofocus><button class="primary">Tra từ</button><button type="button" data-hhj-voice-search>🎙 Giọng nói</button><label>Ảnh / camera<input type="file" accept="image/*" capture="environment" data-hhj-ocr></label></form>${recent.length?`<div class="hhj-search-history"><span>Gần đây</span>${recent.map(query=>`<button data-hhj-search-again="${esc(query)}">${esc(query)}</button>`).join("")}<button data-hhj-clear-search-history>Xóa</button></div>`:""}<div class="hhj-input-status" data-hhj-input-status>Web Speech và OCR chỉ chạy khi trình duyệt hỗ trợ; không tạo kết quả giả.</div><div class="hhj-word-grid">${results.map(item=>wordCard(item,state)).join("") || `<div class="hhj-empty"><b>Không có trong dữ liệu cục bộ</b><p>Có thể đổi chủ đề, tra kho từ mở hoặc tìm một Kanji đơn qua KanjiAPI.</p>${[...state.searchQuery].length===1?`<button data-hhj-kanji-api="${esc(state.searchQuery)}">Tra Kanji trực tuyến</button>`:""}</div>`}</div>${state.searchQuery?`<section class="hhj-online-dictionary"><header><div><small>KHO TỪ MỞ · JMdict</small><h2>Mở rộng kết quả trực tuyến</h2><p>Nghĩa từ nguồn hiện bằng tiếng Anh; từ được chọn có thể thêm vào SRS cá nhân.</p></div><button data-hhj-online-dictionary="${esc(state.searchQuery)}">Tra kho trực tuyến</button></header><div class="hhj-word-grid" data-hhj-online-words></div><output data-hhj-online-status>Chưa gửi yêu cầu ra ngoài.</output></section>`:""}<section class="hhj-online-result" data-hhj-online-result hidden></section></section>`;
  }
  function kanjiDetail(item) {
    if (!item) return `<div class="hhj-empty">Chọn một Kanji để xem chi tiết.</div>`;
    return `<section class="hhj-kanji-detail"><div class="hhj-kanji-glyph"><b>${item.char}</b><span>${item.strokes} nét</span><button data-hhj-speak="${item.char}">▶ Nghe</button></div><div><small>${item.level} · BỘ ${esc(item.radical)}</small><h2>${item.meanings.map(esc).join(" · ")}</h2><dl><dt>Âm On</dt><dd>${item.on.map(esc).join("、")||"—"}</dd><dt>Âm Kun</dt><dd>${item.kun.map(esc).join("、")||"—"}</dd><dt>Từ ví dụ</dt><dd>${item.examples.map(esc).join(" · ")}</dd></dl><p>Thứ tự nét: dùng bảng luyện viết bên dưới hoặc mở nguồn nét chữ được cấp phép trong phần Nguồn học.</p></div></section>`;
  }
  function kanjiView(state) {
    const selected = KANJI.find(item=>item.char===state.selectedKanji)||KANJI[0];
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>KANJI LAB</small><h1>Hán tự và luyện viết</h1><p>Tra âm On/Kun, số nét, bộ thủ, từ ghép và luyện tay trực tiếp.</p></div><select data-hhj-kanji-level><option value="all">Tất cả cấp</option>${LEVELS.map(level=>`<option>${level}</option>`).join("")}</select></header><div class="hhj-kanji-layout"><div class="hhj-kanji-library">${KANJI.map(item=>`<button data-hhj-kanji="${item.char}" class="${item.char===selected.char?"active":""}" data-level="${item.level}"><b>${item.char}</b><span>${item.level} · ${item.strokes} nét</span></button>`).join("")}</div>${kanjiDetail(selected)}</div><section class="hhj-writing-pad"><header><div><h3>Luyện viết ${selected.char}</h3><p>Viết bằng chuột hoặc cảm ứng. Bảng chỉ ghi nét luyện tập, không tự tuyên bố nhận dạng chính xác.</p></div><div><button data-hhj-pad-clear>Xóa</button><button data-hhj-pad-download>Tải PNG</button></div></header><canvas width="700" height="420" data-hhj-writing-pad aria-label="Bảng luyện viết Kanji"></canvas></section></section>`;
  }
  function grammarView(state) {
    const level = state.selectedGrammarLevel || "all"; const rows = GRAMMAR.filter(item=>level==="all"||item.level===level);
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>JLPT GRAMMAR</small><h1>Ngữ pháp theo cấp độ</h1><p>Cách dùng, cấu trúc, câu ví dụ và bản dịch tiếng Việt.</p></div><select data-hhj-grammar-level><option value="all">Tất cả N5–N1</option>${LEVELS.map(item=>`<option ${item===level?"selected":""}>${item}</option>`).join("")}</select></header><div class="hhj-grammar-list">${rows.map(item=>`<details><summary><span><b>${item.level}</b><strong>${esc(item.pattern)}</strong></span><em>${esc(item.meaning)}</em></summary><div><small>CẤU TRÚC</small><code>${esc(item.structure)}</code><blockquote>${esc(item.example)}<button data-hhj-speak="${esc(item.example)}">▶</button></blockquote><p>${esc(item.translation)}</p><button data-hhj-save-grammar="${item.id}">${state.saved[`grammar:${item.id}`]?"★ Đã lưu":"☆ Lưu ngữ pháp"}</button></div></details>`).join("")}</div></section>`;
  }
  function annotateReading(text) {
    const candidates = VOCABULARY.filter((item) => item.word.length > 1 && text.includes(item.word)).sort((a,b)=>b.word.length-a.word.length);
    let cursor=0; let html="";
    while(cursor<text.length){const match=candidates.find((item)=>text.startsWith(item.word,cursor));if(match){html+=`<button data-hhj-reader-word="${match.id}" title="${esc(match.meaning)}">${esc(match.word)}</button>`;cursor+=match.word.length;}else{html+=esc(text[cursor]);cursor+=1;}}
    return html;
  }
  function readerView(state) {
    const selected = READINGS.find(item=>item.id===state.selectedReading)||READINGS[0]; const dictation=`${selected.text.split("。")[0]}。`;
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>READING IMMERSION</small><h1>Đọc, chạm để tra, rồi luyện nói</h1><p>Chạm vào từ được gạch chân để xem nghĩa; có nghe, bản dịch, chép chính tả và shadowing.</p></div><div class="hhj-reader-actions"><button data-hhj-offline-reading="${selected.id}">${state.offlinePacks?.[selected.id]?"✓ Đã lưu offline":"↓ Lưu bài offline"}</button><button data-hhj-furigana>${state.furigana?"Ẩn":"Hiện"} hỗ trợ đọc</button></div></header><div class="hhj-reader-layout"><aside>${READINGS.map(item=>`<button data-hhj-reading="${item.id}" class="${item.id===selected.id?"active":""}"><b>${item.level}</b><span><strong>${esc(item.title)}</strong><small>${item.minutes} phút ${state.completedReadings[item.id]?"· ✓":""}</small></span></button>`).join("")}</aside><article><header><span>${selected.level}</span><h2>${esc(selected.title)}</h2><button data-hhj-speak="${esc(selected.text)}">▶ Nghe toàn bài</button></header><p class="hhj-japanese-text ${state.furigana?"with-help":""}">${annotateReading(selected.text)}</p><div class="hhj-reader-tip">Chạm từ gạch chân để tra nhanh và lưu vào SRS.</div><details><summary>Xem bản dịch tiếng Việt</summary><p>${esc(selected.translation)}</p></details><form data-hhj-reading-check="${selected.id}"><label>${esc(selected.question)}<input name="answer" required placeholder="Trả lời bằng tiếng Nhật"></label><button class="primary">Kiểm tra</button><output></output></form><section class="hhj-dictation"><header><div><small>LISTENING DICTATION</small><h3>Nghe và chép lại câu đầu</h3></div><button data-hhj-speak="${esc(dictation)}">▶ Nghe câu</button></header><form data-hhj-dictation data-answer="${esc(dictation)}"><label>Nhập chính xác điều bạn nghe được<input name="answer" required autocomplete="off" lang="ja" placeholder="日本語で入力してください"></label><button>Chấm độ khớp</button><output></output></form></section><section class="hhj-shadowing"><div><small>SHADOWING</small><h3>Nghe → nhắc lại → so khớp</h3><p>Micro chỉ bật sau khi bạn nhấn nút; khả năng nhận dạng phụ thuộc trình duyệt.</p></div><button data-hhj-speak="${esc(dictation)}">1. Nghe mẫu</button><button data-hhj-shadowing="${esc(dictation)}">2. Thu và chấm</button><output data-hhj-shadowing-output></output></section></article></div></section>`;
  }
  function jlptQuestions(level, section = "vocabulary") {
    const pool = VOCABULARY.filter(item=>item.level===level); const grammar = GRAMMAR.filter(item=>item.level===level); const questions=[];
    if(section==="vocabulary"||section==="listening") pool.slice(0,8).forEach((item,index)=>{ const distract=pool.filter(row=>row.id!==item.id).slice(index,index+3).map(row=>section==="listening"?row.kana:row.meaning); const answer=section==="listening"?item.kana:item.meaning; questions.push({id:item.id,prompt:section==="listening"?"Nghe và chọn cách đọc đúng.":`「${item.word}」の意味は何ですか。`,answer,options:[answer,...distract].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"ja")),explanation:`${item.word}（${item.kana}）: ${item.meaning}`,audio:section==="listening"?item.word:""}); });
    if(section==="grammar") grammar.slice(0,8).forEach((item,index)=>{ const distract=GRAMMAR.filter(row=>row.id!==item.id).slice(index,index+3).map(row=>row.meaning); questions.push({id:item.id,prompt:`${item.pattern} có nghĩa gần nhất là gì?`,answer:item.meaning,options:[item.meaning,...distract].sort((a,b)=>a.localeCompare(b,"vi")),explanation:`${item.structure} · ${item.example}`}); });
    if(section==="reading"){const reading=READINGS.find(item=>item.level===level)||READINGS[0];questions.push({id:reading.id,prompt:`${reading.text}\n\n${reading.question}`,answer:reading.answer,options:[reading.answer,...READINGS.filter(item=>item.id!==reading.id).map(item=>item.answer).slice(0,3)].sort((a,b)=>a.localeCompare(b,"ja")),explanation:`Đáp án: ${reading.answer} · ${reading.translation}`});}
    return questions.slice(0,8);
  }
  function jlptView(state) {
    const level=state.level; const section=state.jlptSection||"vocabulary"; const questions=jlptQuestions(level,section); const latest=state.testHistory.find(item=>item.level===level&&item.section===section); const sectionLabel={vocabulary:"Từ vựng",grammar:"Ngữ pháp",reading:"Đọc hiểu",listening:"Nghe hiểu"}[section];
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>JLPT PRACTICE</small><h1>Luyện đúng kỹ năng đang yếu</h1><p>Bài luyện nội bộ có giải thích và tự đưa câu sai vào Sổ lỗi; không phải đề thi JLPT chính thức.</p></div><select data-hhj-level>${LEVELS.map(item=>`<option ${item===level?"selected":""}>${item}</option>`).join("")}</select></header><div class="hhj-jlpt-tabs">${[["vocabulary","Từ vựng"],["grammar","Ngữ pháp"],["reading","Đọc hiểu"],["listening","Nghe hiểu"]].map(([id,label])=>`<button data-hhj-jlpt-section="${id}" class="${id===section?"active":""}">${label}</button>`).join("")}</div><div class="hhj-jlpt-summary"><article><span>Cấp hiện tại</span><strong>${level}</strong></article><article><span>Số câu</span><strong>${questions.length}</strong></article><article><span>Kết quả gần nhất</span><strong>${latest?`${latest.score}%`:"—"}</strong></article><article><span>Phần luyện</span><strong>${sectionLabel}</strong></article></div><form class="hhj-jlpt-test" data-hhj-jlpt-test data-level="${level}" data-section="${section}">${questions.map((q,index)=>`<fieldset data-id="${q.id||index}" data-answer="${esc(q.answer)}" data-explanation="${esc(q.explanation)}"><legend><b>${index+1}</b><span>${esc(q.prompt)}</span></legend>${q.audio?`<button type="button" data-hhj-speak="${esc(q.audio)}">▶ Nghe câu hỏi</button>`:""}${q.options.map(answer=>`<label><input type="radio" name="q${index}" value="${esc(answer)}" required><span>${esc(answer)}</span></label>`).join("")}<output></output></fieldset>`).join("")}<button class="primary">Nộp bài và chấm điểm</button><output data-hhj-jlpt-result></output></form></section>`;
  }
  function notebookView(state) {
    const saved=allWords(state).filter(item=>state.saved[item.id]); const savedGrammar=GRAMMAR.filter(item=>state.saved[`grammar:${item.id}`]); const due=dueWords(state); const review=due[0]; const mistakes=(state.mistakes||[]).filter(item=>!item.resolved); const statusCounts={new:0,learning:0,due:0,scheduled:0,mastered:0};saved.forEach(item=>statusCounts[srsStatus(state,item.id)]++);
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>ÔN TẬP THÔNG MINH</small><h1>SRS và Sổ lỗi</h1><p>Ôn đúng từ đến hạn; mọi lỗi từ bài học, đọc nghe và JLPT được gom tự động.</p></div><span>${due.length} đến hạn</span></header><div class="hhj-srs-status">${[["new","Mới"],["learning","Đang học"],["due","Đến hạn"],["mastered","Đã thuộc"]].map(([id,label])=>`<article><span>${label}</span><strong>${statusCounts[id]}</strong></article>`).join("")}</div>${review?`<section class="hhj-flashcard"><small>FLASHCARD ${1}/${due.length} · ${review.level}</small><div><h2>${esc(review.word)}</h2><p>${esc(review.kana)} · ${esc(review.romaji)}</p><details><summary>Hiện đáp án</summary><strong>${esc(review.meaning)}</strong><blockquote>${esc(review.example||"")}<br>${esc(review.exampleVi||"")}</blockquote></details></div><footer><button data-hhj-review="${review.id}:again">Quên</button><button data-hhj-review="${review.id}:hard">Khó</button><button data-hhj-review="${review.id}:good">Nhớ</button><button data-hhj-review="${review.id}:easy">Dễ</button></footer></section>`:`<div class="hhj-empty"><b>Đã hoàn thành lượt ôn đến hạn</b><p>Bạn có thể xem lại Sổ lỗi hoặc học bài 15 từ tiếp theo.</p><button data-hhj-view="learn">Mở lộ trình học</button></div>`}<section class="hhj-mistake-book"><header><div><small>MISTAKE NOTEBOOK</small><h2>Sổ lỗi cá nhân</h2></div><strong>${mistakes.length} lỗi</strong></header>${mistakes.slice(0,20).map(item=>`<article><b>${({lesson:"Từ vựng",jlpt:"JLPT",reading:"Đọc",dictation:"Nghe"})[item.type]||"Luyện tập"}</b><div><strong>${esc(item.prompt)}</strong><span>Bạn trả lời: ${esc(item.answer||"—")} · Đúng: ${esc(item.correct||"—")}</span><small>Sai ${item.count} lần · ${new Date(item.at).toLocaleDateString("vi-VN")}</small></div><button data-hhj-resolve-mistake="${esc(item.key)}">Đã hiểu</button></article>`).join("")||`<div class="hhj-empty">Chưa có lỗi nào. Hãy hoàn thành một bài học hoặc bài JLPT.</div>`}</section><details class="hhj-saved-list"><summary>${saved.length} từ đã lưu trong SRS</summary><div class="hhj-notebook-list">${saved.map(item=>{const reviewState=state.reviews[item.id]||{};return `<article><div><strong>${esc(item.word)}</strong><span>${esc(item.kana)} · ${esc(item.meaning)}</span></div><progress max="100" value="${Number(reviewState.mastery||0)}"></progress><small>${Number(reviewState.mastery||0)}% · ${srsStatus(state,item.id)}</small><button data-hhj-word-detail="${item.id}">Mở</button></article>`;}).join("")||""}</div></details>${savedGrammar.length?`<section class="hhj-saved-grammar"><h3>Ngữ pháp đã lưu</h3>${savedGrammar.map(item=>`<article><b>${item.level}</b><strong>${esc(item.pattern)}</strong><span>${esc(item.meaning)}</span><button data-hhj-save-grammar="${item.id}">Xóa</button></article>`).join("")}</section>`:""}</section>`;
  }
  function conversationView() {
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>SPEAKING & WRITING LAB</small><h1>Hội thoại tiếng Nhật</h1><p>Luyện phản xạ bằng tình huống, nghe giọng Nhật và nhận phản hồi cục bộ; có thể dùng HH AI khi được cấu hình.</p></div></header><div class="hhj-conversation-grid"><section><header><span>駅で · Ở nhà ga</span><button data-hhj-speak="すみません、東京駅はどこですか。">▶ Nghe mẫu</button></header><div class="hhj-chat"><p><b>駅員</b>はい、どうしましたか。</p><p><b>あなた</b><span data-hhj-user-line>...</span></p></div><form data-hhj-conversation><label>Viết câu trả lời<textarea name="message" required placeholder="Ví dụ: すみません、東京駅はどこですか。"></textarea></label><div><button type="button" data-hhj-dictate>🎙 Nói</button><button class="primary">Kiểm tra phản hồi</button><button type="button" data-hhj-ai-feedback>HH AI góp ý</button></div><output data-hhj-conversation-feedback></output></form></section><aside><h3>Mẫu câu gợi ý</h3>${["すみません。","～はどこですか。","どうやって行きますか。","ありがとうございます。"].map(text=>`<button data-hhj-fill-conversation="${text}">${text}<span>＋</span></button>`).join("")}<p>Nhận dạng giọng nói có thể do nhà cung cấp trình duyệt xử lý. HH chỉ bật sau khi bạn nhấn nút.</p></aside></div></section>`;
  }
  function toolsView() {
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>JAPANESE TOOLBOX</small><h1>Tra cứu và công cụ</h1><p>Các công cụ nâng cao được gom tại đây để trang Hôm nay luôn đơn giản.</p></div></header><div class="hhj-tool-grid"><form data-hhj-kana-convert><header><b>あ</b><div><h3>Romaji → Kana</h3><p>Chuyển đổi cục bộ, không gửi dữ liệu.</p></div></header><textarea name="source" placeholder="nihongo wo benkyou shimasu"></textarea><button>Chuyển đổi</button><output data-hhj-kana-output></output></form><form data-hhj-conjugate><header><b>動</b><div><h3>Chia động từ</h3><p>Các dạng thường dùng.</p></div></header><input name="verb" placeholder="食べる / 飲む / する" required><button>Chia động từ</button><output data-hhj-conjugation></output></form><form data-hhj-translate><header><b>訳</b><div><h3>Dịch và kiểm tra câu</h3><p>Dịch từ cục bộ hoặc gửi HH AI khi có cấu hình.</p></div></header><textarea name="text" placeholder="日本語を勉強しています。" required></textarea><div><button>Dịch nhanh</button><button type="button" data-hhj-ai-translate>Dịch bằng HH AI</button></div><output data-hhj-translation></output></form><section class="hhj-kana-chart"><header><b>五</b><div><h3>Bảng Hiragana</h3><p>Bấm chữ để nghe.</p></div></header><div>${KANA_ROWS.flat().map(char=>char?`<button data-hhj-speak="${char}">${char}</button>`:`<span></span>`).join("")}</div></section></div><section class="hhj-subtitle-miner"><header><div><small>VIDEO & SUBTITLE MINING</small><h2>Tạo bộ từ từ phụ đề</h2><p>Dán tối đa 5.000 ký tự phụ đề Nhật. Việc phân tích chạy trên thiết bị và chỉ dùng dữ liệu từ điển hiện có.</p></div></header><form data-hhj-subtitle-miner><textarea name="subtitle" maxlength="5000" required placeholder="今日は日本語を勉強します。"></textarea><button class="primary">Phân tích từ vựng</button></form><output data-hhj-subtitle-output></output></section><section class="hhj-sources"><h3>Nguồn mở và phạm vi dữ liệu</h3><p>Kho 10.000 từ gồm 360 mục HH có nghĩa Việt và 9.640 mục JMdict Common có nghĩa Anh được gắn nhãn rõ ràng. Không gắn nhãn “đã kiểm duyệt” cho nghĩa máy. Dữ liệu JMdict tuân theo giấy phép EDRDG; cấu trúc luyện thi tham chiếu mô tả công khai của JLPT.</p><a href="https://www.edrdg.org/" target="_blank" rel="noopener">EDRDG · JMdict/KANJIDIC ↗</a><a href="assets/japanese/NOTICE-JMDICT.md" target="_blank" rel="noopener">Thông báo dữ liệu 10K ↗</a><a href="https://kanjiapi.dev/" target="_blank" rel="noopener">KanjiAPI.dev ↗</a><a href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noopener">JLPT · Cấu trúc bài thi ↗</a></section></section>`;
  }
  function progressView(state) {
    const wordBank=allWords(state); const levelCounts=LEVELS.map(level=>({level,words:wordBank.filter(item=>item.level===level&&state.saved[item.id]).length,total:wordBank.filter(item=>item.level===level).length,grammar:GRAMMAR.filter(item=>item.level===level).length}));
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>LEARNING ANALYTICS</small><h1>Tiến độ cá nhân</h1><p>Chỉ số được tính từ hoạt động thật lưu riêng theo tài khoản HH trên thiết bị.</p></div><div class="hhj-data-actions"><label>Mục tiêu<select data-hhj-daily-goal>${[10,20,30,50,80].map(value=>`<option value="${value}" ${Number(state.dailyGoal)===value?"selected":""}>${value} XP/ngày</option>`).join("")}</select></label><button data-hhj-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json" data-hhj-import></label></div></header><div class="hhj-progress-hero"><article><span>XP hôm nay</span><strong>${todayXp(state)}/${state.dailyGoal}</strong></article><article><span>Chuỗi ngày</span><strong>${state.streak}</strong></article><article><span>Từ đã lưu</span><strong>${savedWordCount(state)}</strong></article><article><span>Bài đọc</span><strong>${Object.keys(state.completedReadings).length}</strong></article></div><section class="hhj-level-progress"><h3>Tiến độ theo JLPT</h3>${levelCounts.map(item=>`<article><b>${item.level}</b><div><span style="--p:${item.total?item.words/item.total*100:0}%"></span></div><strong>${item.words}/${item.total} từ</strong><small>${item.grammar} mẫu ngữ pháp khả dụng</small></article>`).join("")}</section><section class="hhj-history"><header><h3>Lịch sử bài luyện</h3><button class="danger" data-hhj-reset>Xóa dữ liệu học</button></header>${state.testHistory.slice(0,12).map(item=>`<article><time>${new Date(item.at).toLocaleString("vi-VN")}</time><strong>JLPT ${item.level}</strong><span>${item.score}% · ${item.correct}/${item.total}</span></article>`).join("")||`<div class="hhj-empty">Chưa có bài luyện nào.</div>`}</section></section>`;
  }
  function activeView(state) {
    if (!state.onboardingComplete) return onboardingView(state);
    return ({dashboard:dashboardView,learn:learnView,lesson:lessonView,dictionary:dictionaryView,word:wordDetailView,kanji:kanjiView,grammar:grammarView,reader:readerView,jlpt:jlptView,notebook:notebookView,conversation:conversationView,tools:toolsView,progress:progressView}[state.view]||dashboardView)(state);
  }
  function render() {
    if (!instance?.host) return;
    instance.host.innerHTML = shell(activeView(instance.state));
    if (instance.state.view === "kanji") requestAnimationFrame(setupWritingPad);
  }
  function navigate(view, push = true) {
    if (!VIEW_IDS.has(view)) view="dashboard";
    instance.state.view=view; writeState(instance.state); render();
    if (push && global.location?.hash !== routeFor(view)) history.pushState({}, "", routeFor(view));
  }
  function setupWritingPad() {
    const canvas=instance?.host?.querySelector("[data-hhj-writing-pad]"); if(!canvas)return;
    const ctx=canvas.getContext("2d"); ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=8;ctx.strokeStyle="#171717";
    let drawing=false; const point=(event)=>{const rect=canvas.getBoundingClientRect();const touch=event.touches?.[0]||event;return{x:(touch.clientX-rect.left)*canvas.width/rect.width,y:(touch.clientY-rect.top)*canvas.height/rect.height};};
    const start=(event)=>{event.preventDefault();drawing=true;const p=point(event);ctx.beginPath();ctx.moveTo(p.x,p.y);}; const move=(event)=>{if(!drawing)return;event.preventDefault();const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke();}; const stop=()=>{drawing=false;};
    canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointerleave",stop);
  }
  async function useSpeechRecognition(target) {
    const Recognition=global.SpeechRecognition||global.webkitSpeechRecognition; if(!Recognition)throw new Error("Trình duyệt này chưa hỗ trợ nhận dạng giọng nói.");
    const recognition=new Recognition();recognition.lang="ja-JP";recognition.interimResults=false;recognition.maxAlternatives=1;
    return new Promise((resolve,reject)=>{recognition.onresult=(event)=>{const text=event.results?.[0]?.[0]?.transcript||"";if(target)target.value=text;resolve(text);};recognition.onerror=(event)=>reject(new Error(`Không nhận dạng được giọng nói: ${event.error||"unknown"}`));recognition.start();});
  }
  async function lookupKanjiOnline(char) {
    const output=instance.host.querySelector("[data-hhj-online-result]"); output.hidden=false; output.innerHTML="Đang tra KanjiAPI…";
    const response=await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`); if(!response.ok)throw new Error(`KanjiAPI HTTP ${response.status}`); const data=await response.json();
    output.innerHTML=`<h3>${esc(data.kanji)}</h3><p><b>Nghĩa tiếng Anh:</b> ${(data.meanings||[]).map(esc).join(" · ")||"—"}</p><p><b>On:</b> ${(data.on_readings||[]).map(esc).join("、")||"—"}</p><p><b>Kun:</b> ${(data.kun_readings||[]).map(esc).join("、")||"—"}</p><small>Nguồn trực tuyến: KanjiAPI.dev · chưa có bản dịch tiếng Việt cho mục này.</small>`;
  }
  async function lookupDictionaryOnline(query) {
    const status=instance.host.querySelector("[data-hhj-online-status]"); const grid=instance.host.querySelector("[data-hhj-online-words]");
    if(!status||!grid)return; status.textContent="Đang tra kho JMdict…";grid.innerHTML="";
    const response=await fetch(`/api/search/japanese?q=${encodeURIComponent(String(query||"").slice(0,80))}`,{headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Dictionary API HTTP ${response.status}`);
    instance.onlineResults=Array.isArray(data.items)?data.items.slice(0,12):[];
    grid.innerHTML=instance.onlineResults.map(onlineWordCard).join("");
    status.textContent=instance.onlineResults.length?`${instance.onlineResults.length} kết quả · ${data.source||"JMdict"}. Nghĩa hiện bằng tiếng Anh.`:"Kho trực tuyến không có kết quả phù hợp.";
  }
  function importOnlineWord(index) {
    const source=instance.onlineResults?.[Number(index)]; if(!source)return false;
    const candidate=normalizeCustomWord({word:source.word,kana:source.reading,meaning:(source.definitions||[]).join("; ")||"Chưa có nghĩa",pos:(source.partsOfSpeech||[]).join(" · "),level:LEVELS.includes(source.jlpt?.[0])?source.jlpt[0]:instance.state.level,source:source.source||"JMdict via Jisho"});
    if(!candidate)return false;
    const existing=allWords(instance.state).find(item=>item.word===candidate.word&&item.kana===candidate.kana);
    const item=existing||candidate;
    if(!existing){instance.state.customWords=[...(instance.state.customWords||[]).filter(row=>row.id!==candidate.id),candidate].slice(-200);}
    if(!instance.state.saved[item.id])saveWord(instance.state,item.id);
    markStudy(instance.state,2);writeState(instance.state);return true;
  }
  function localTranslate(text) {
    let output=String(text||""); let replacements=0;
    [...WORDS].sort((a,b)=>b.word.length-a.word.length).forEach(item=>{if(output.includes(item.word)){output=output.split(item.word).join(`[${item.meaning}]`);replacements++;}});
    return replacements?output:"Không đủ dữ liệu cục bộ để dịch câu này. Hãy tra từng từ hoặc dùng HH AI nếu đã cấu hình.";
  }

  async function handleClick(event) {
    const button=event.target.closest("button,[data-hhj-view]"); if(!button)return;
    if(button.dataset.hhjView){if(button.dataset.hhjReading)instance.state.selectedReading=button.dataset.hhjReading;return navigate(button.dataset.hhjView);}
    if(button.matches("[data-hhj-menu]")){instance.host.querySelector("[data-hhj-sidebar]")?.classList.toggle("open");return;}
    if(button.matches("[data-hhj-theme]")){instance.state.theme=instance.state.theme==="light"?"dark":"light";writeState(instance.state);render();return;}
    if(button.matches("[data-hhj-reopen-onboarding]")){instance.state.onboardingComplete=false;writeState(instance.state);render();return;}
    if(button.dataset.hhjUnit){const unit=COURSE_UNITS.find(item=>item.id===button.dataset.hhjUnit);if(!unit||!isUnitUnlocked(instance.state,unit))return toast("Hãy hoàn thành bài trước để mở bài này.","error");instance.state.lesson={unitId:unit.id,stage:"intro",index:0,correct:0,wrongIds:[],feedback:null};return navigate("lesson");}
    if(button.matches("[data-hhj-lesson-start]")){instance.state.lesson={...instance.state.lesson,stage:"practice",index:0,correct:0,wrongIds:[],feedback:null};writeState(instance.state);render();return;}
    if(button.matches("[data-hhj-lesson-next]")){const unit=COURSE_UNITS.find(item=>item.id===instance.state.lesson?.unitId);const total=lessonWords(unit).length;const next=Number(instance.state.lesson?.index||0)+1;instance.state.lesson={...instance.state.lesson,index:next,stage:next>=total?"summary":"practice",feedback:null};writeState(instance.state);render();return;}
    if(button.matches("[data-hhj-lesson-complete]")){const unit=COURSE_UNITS.find(item=>item.id===instance.state.lesson?.unitId);if(unit){instance.state.completedLessons[unit.id]={at:new Date().toISOString(),score:Number(instance.state.lesson.correct||0),total:lessonWords(unit).length};for(const id of instance.state.lesson.wrongIds||[]){if(!instance.state.saved[id])saveWord(instance.state,id);}markStudy(instance.state,20);}instance.state.lesson=null;writeState(instance.state);navigate("learn");return toast("Đã lưu bài học và lịch ôn từ khó.","success");}
    if(button.dataset.hhjWordDetail||button.dataset.hhjReaderWord){instance.state.selectedWordId=button.dataset.hhjWordDetail||button.dataset.hhjReaderWord;return navigate("word");}
    if(button.dataset.hhjJlptSection){instance.state.jlptSection=button.dataset.hhjJlptSection;writeState(instance.state);render();return;}
    if(button.dataset.hhjOfflineReading){instance.state.offlinePacks[button.dataset.hhjOfflineReading]={savedAt:new Date().toISOString(),kind:"text"};writeState(instance.state);render();return toast("Đã lưu nội dung bài đọc offline. Âm thanh phụ thuộc giọng đọc của thiết bị.","success");}
    if(button.dataset.hhjShadowing!==undefined){const output=instance.host.querySelector("[data-hhj-shadowing-output]");try{const spoken=await useSpeechRecognition();const score=scoreDictation(button.dataset.hhjShadowing,spoken);if(output)output.textContent=`Khớp ${score}% · Bạn nói: ${spoken}`;if(score<80)recordMistake(instance.state,{type:"dictation",id:instance.state.selectedReading,prompt:"Shadowing",answer:spoken,correct:button.dataset.hhjShadowing});else markStudy(instance.state,10);writeState(instance.state);}catch(error){if(output)output.textContent=error.message;}return;}
    if(button.dataset.hhjResolveMistake){const row=(instance.state.mistakes||[]).find(item=>item.key===button.dataset.hhjResolveMistake);if(row)row.resolved=true;writeState(instance.state);render();return;}
    if(button.dataset.hhjReportWord){instance.state.history.unshift({type:"word-report",wordId:button.dataset.hhjReportWord,at:new Date().toISOString()});writeState(instance.state);return toast("Đã ghi nhận mục cần kiểm tra trong dữ liệu cá nhân.","success");}
    if(button.matches("[data-hhj-save-subtitle]")){let added=0;for(const item of instance.subtitleResults||[]){if(!instance.state.saved[item.id]){saveWord(instance.state,item.id);added++;}}if(added)markStudy(instance.state,Math.min(20,added));writeState(instance.state);return toast(`Đã thêm ${added} từ mới vào SRS.`,"success");}
    if(button.dataset.hhjSpeak!==undefined){if(!speak(button.dataset.hhjSpeak))toast("Thiết bị chưa hỗ trợ giọng đọc.","error");return;}
    if(button.dataset.hhjSaveWord){saveWord(instance.state,button.dataset.hhjSaveWord);markStudy(instance.state,2);writeState(instance.state);render();return toast("Đã cập nhật Sổ tay.","success");}
    if(button.matches("[data-hhj-save-topic]")){const topic=VOCABULARY_TOPICS.includes(instance.state.selectedVocabularyTopic)?instance.state.selectedVocabularyTopic:"all";const source=instance.state.searchQuery?searchStateWords(instance.state,instance.state.searchQuery):topic==="JMdict 10K"?allWords(instance.state).filter(item=>item.topic===topic):allWords(instance.state).filter(item=>item.level===instance.state.level);const rows=source.filter(item=>(topic==="all"||item.topic===topic)&&!instance.state.saved[item.id]).slice(0,10);rows.forEach(item=>saveWord(instance.state,item.id));if(rows.length){markStudy(instance.state,Math.min(20,rows.length*2));writeState(instance.state);render();toast(`Đã thêm ${rows.length} từ vào SRS.`,"success");}return;}
    if(button.dataset.hhjSaveGrammar){const key=`grammar:${button.dataset.hhjSaveGrammar}`;if(instance.state.saved[key])delete instance.state.saved[key];else instance.state.saved[key]={savedAt:new Date().toISOString(),type:"grammar"};markStudy(instance.state,2);writeState(instance.state);render();return toast("Đã cập nhật ngữ pháp đã lưu.","success");}
    if(button.dataset.hhjKanji){instance.state.selectedKanji=button.dataset.hhjKanji;return navigate("kanji");}
    if(button.dataset.hhjReading){instance.state.selectedReading=button.dataset.hhjReading;instance.state.view="reader";writeState(instance.state);render();return;}
    if(button.matches("[data-hhj-furigana]")){instance.state.furigana=!instance.state.furigana;writeState(instance.state);render();return;}
    if(button.dataset.hhjReview){const[id,grade]=button.dataset.hhjReview.split(":");reviewWord(instance.state,id,grade);writeState(instance.state);render();return;}
    if(button.dataset.hhjSearchAgain!==undefined){instance.state.searchQuery=button.dataset.hhjSearchAgain;instance.state.view="dictionary";writeState(instance.state);render();return;}
    if(button.matches("[data-hhj-clear-search-history]")){instance.state.history=(instance.state.history||[]).filter(item=>item.type!=="search");writeState(instance.state);render();return;}
    if(button.dataset.hhjOnlineDictionary!==undefined){try{await lookupDictionaryOnline(button.dataset.hhjOnlineDictionary);}catch(error){const status=instance.host.querySelector("[data-hhj-online-status]");if(status)status.textContent=`Không thể tra trực tuyến: ${error.message}. Dữ liệu cục bộ vẫn dùng bình thường.`;toast("Kho từ trực tuyến chưa sẵn sàng.","error");}return;}
    if(button.dataset.hhjImportOnline!==undefined){if(importOnlineWord(button.dataset.hhjImportOnline)){render();toast("Đã thêm từ trực tuyến vào SRS cá nhân.","success");}return;}
    if(button.dataset.hhjFillConversation){const input=instance.host.querySelector("[data-hhj-conversation] textarea");if(input){input.value=`${input.value}${input.value?" ":""}${button.dataset.hhjFillConversation}`;input.focus();}return;}
    if(button.matches("[data-hhj-voice-search]")){try{const input=button.closest("form")?.querySelector("input[name=query]")||instance.host.querySelector(".hhj-global-search input");const text=await useSpeechRecognition(input);instance.state.searchQuery=text;instance.state.view="dictionary";writeState(instance.state);render();}catch(error){toast(error.message,"error");}return;}
    if(button.matches("[data-hhj-dictate]")){try{const input=instance.host.querySelector("[data-hhj-conversation] textarea");await useSpeechRecognition(input);}catch(error){toast(error.message,"error");}return;}
    if(button.dataset.hhjKanjiApi){try{await lookupKanjiOnline(button.dataset.hhjKanjiApi);}catch(error){toast(error.message,"error");}return;}
    if(button.matches("[data-hhj-pad-clear]")){const canvas=instance.host.querySelector("[data-hhj-writing-pad]");canvas?.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);return;}
    if(button.matches("[data-hhj-pad-download]")){const canvas=instance.host.querySelector("[data-hhj-writing-pad]");if(!canvas)return;const link=document.createElement("a");link.download=`kanji-${instance.state.selectedKanji}.png`;link.href=canvas.toDataURL("image/png");link.click();return;}
    if(button.matches("[data-hhj-ai-translate]")){const form=button.closest("form");const text=form?.elements?.text?.value?.trim();if(!text)return toast("Nhập câu cần dịch.","error");const output=form.querySelector("output");if(!instance.options.runAI){output.textContent="HH AI chưa được cấu hình. Bạn vẫn có thể dùng Dịch nhanh cục bộ.";return;}output.textContent="Đang gửi HH AI…";try{const result=await instance.options.runAI({task:"japanese-translate",text,instruction:"Dịch câu tiếng Nhật sang tiếng Việt, giải thích từ vựng và ngữ pháp ngắn gọn."});output.textContent=String(result?.text||result?.output||result||"Không có kết quả.");}catch(error){output.textContent=`Không thể dùng HH AI: ${error.message}`;}return;}
    if(button.matches("[data-hhj-ai-feedback]")){const form=instance.host.querySelector("[data-hhj-conversation]");const text=form?.elements?.message?.value?.trim();const output=form?.querySelector("output");if(!text)return toast("Nhập câu hội thoại trước.","error");if(!instance.options.runAI){output.textContent="HH AI chưa được cấu hình; hãy dùng nút Kiểm tra phản hồi cục bộ.";return;}output.textContent="Đang phân tích…";try{const result=await instance.options.runAI({task:"japanese-conversation-feedback",text,instruction:"Sửa câu tiếng Nhật, giải thích lỗi bằng tiếng Việt và đề xuất một câu tự nhiên hơn."});output.textContent=String(result?.text||result?.output||result||"Không có kết quả.");}catch(error){output.textContent=`Không thể dùng HH AI: ${error.message}`;}return;}
    if(button.matches("[data-hhj-export]")){const blob=new Blob([JSON.stringify(instance.state,null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`hh-japanese-${today()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);return;}
    if(button.matches("[data-hhj-reset]")){if(!confirm("Xóa toàn bộ tiến độ HH Japanese của tài khoản này trên thiết bị?"))return;localStorage.removeItem(stateKey());instance.state=defaults();render();return;}
  }
  function handleChange(event) {
    if(event.target.matches("[data-hhj-level]")){instance.state.level=LEVELS.includes(event.target.value)?event.target.value:"N5";writeState(instance.state);render();return;}
    if(event.target.matches("[data-hhj-vocabulary-topic]")){instance.state.selectedVocabularyTopic=VOCABULARY_TOPICS.includes(event.target.value)?event.target.value:"all";writeState(instance.state);render();return;}
    if(event.target.matches("[data-hhj-daily-goal]")){instance.state.dailyGoal=[10,20,30,50,80].includes(Number(event.target.value))?Number(event.target.value):20;writeState(instance.state);render();return;}
    if(event.target.matches("[data-hhj-grammar-level]")){instance.state.selectedGrammarLevel=event.target.value;writeState(instance.state);render();return;}
    if(event.target.matches("[data-hhj-kanji-level]")){const level=event.target.value;instance.host.querySelectorAll("[data-hhj-kanji]").forEach(node=>{node.hidden=level!=="all"&&node.dataset.level!==level;});return;}
    if(event.target.matches("[data-hhj-ocr]")){handleOcr(event.target.files?.[0]).catch(error=>toast(error.message,"error"));}
    if(event.target.matches("[data-hhj-import]")){importStateFile(event.target.files?.[0]).catch(error=>toast(`Không thể nhập dữ liệu: ${error.message}`,"error"));}
  }
  async function importStateFile(file) {
    if(!file)return; if(file.size>2*1024*1024)throw new Error("Tệp JSON vượt quá 2 MB.");
    const data=JSON.parse(await file.text()); if(!data||typeof data!=="object"||![1,VERSION].includes(Number(data.version)))throw new Error("Sai định dạng hoặc phiên bản dữ liệu.");
    instance.state={...defaults(),...data,version:VERSION,dailyGoal:[10,20,30,50,80].includes(Number(data.dailyGoal))?Number(data.dailyGoal):20,saved:data.saved&&typeof data.saved==="object"?data.saved:{},reviews:data.reviews&&typeof data.reviews==="object"?data.reviews:{},customWords:Array.isArray(data.customWords)?data.customWords.slice(0,200).map(normalizeCustomWord).filter(Boolean):[],dailyActivity:data.dailyActivity&&typeof data.dailyActivity==="object"?Object.fromEntries(Object.entries(data.dailyActivity).slice(-90)):{},history:Array.isArray(data.history)?data.history.slice(0,100):[],mistakes:Array.isArray(data.mistakes)?data.mistakes.slice(0,200):[],testHistory:Array.isArray(data.testHistory)?data.testHistory.slice(0,100):[],completedReadings:data.completedReadings&&typeof data.completedReadings==="object"?data.completedReadings:{},completedLessons:data.completedLessons&&typeof data.completedLessons==="object"?data.completedLessons:{},offlinePacks:data.offlinePacks&&typeof data.offlinePacks==="object"?data.offlinePacks:{}};
    writeState(instance.state);render();toast("Đã nhập dữ liệu HH Japanese.","success");
  }
  async function handleOcr(file) {
    const status=instance.host.querySelector("[data-hhj-input-status]");if(!file)return;
    if(!global.TextDetector){status.textContent="Trình duyệt chưa hỗ trợ TextDetector OCR. Ảnh không được gửi đi và không tạo kết quả giả.";status.dataset.tone="warning";return;}
    const bitmap=await createImageBitmap(file);const detector=new TextDetector();const rows=await detector.detect(bitmap);bitmap.close?.();const text=rows.map(row=>row.rawValue).join(" ").trim();
    if(!text)throw new Error("Không nhận dạng được chữ trong ảnh.");instance.state.searchQuery=text;instance.state.view="dictionary";writeState(instance.state);render();
  }
  async function handleSubmit(event) {
    event.preventDefault(); const form=event.target;
    if(form.matches("[data-hhj-onboarding]")){const data=new FormData(form);const chosen=String(data.get("level")||"auto");let level=LEVELS.includes(chosen)?chosen:"N5";if(chosen==="auto"){const answers=["Nhật Bản","kinh nghiệm","giải quyết","xu hướng","hoàn thành nhiệm vụ"];const score=answers.reduce((total,answer,index)=>total+(normalizeSearch(data.get(`placement${index}`)||"").includes(normalizeSearch(answer))?1:0),0);level=LEVELS[Math.min(4,score)];}instance.state.level=level;instance.state.selectedGoal=String(data.get("goal")||"foundation");instance.state.dailyGoal=[10,20,30,50].includes(Number(data.get("dailyGoal")))?Number(data.get("dailyGoal")):20;instance.state.onboardingComplete=true;instance.state.view="dashboard";writeState(instance.state);render();return toast(`Đã tạo lộ trình ${level} phù hợp mục tiêu của bạn.`,"success");}
    if(form.matches("[data-hhj-lesson-answer]")){if(instance.state.lesson?.feedback)return;const answer=String(form.elements.answer?.value||"").trim();const expected=String(form.dataset.answer||"");const ok=normalizeJapaneseAnswer(answer)===normalizeJapaneseAnswer(expected);const itemId=form.dataset.id;const item=allWords(instance.state).find(word=>word.id===itemId);instance.state.lesson.feedback={ok,message:ok?"✓ Chính xác":`Chưa đúng · Đáp án: ${expected}`};if(ok){instance.state.lesson.correct=Number(instance.state.lesson.correct||0)+1;markStudy(instance.state,3);}else{instance.state.lesson.wrongIds=[...new Set([...(instance.state.lesson.wrongIds||[]),itemId])];recordMistake(instance.state,{type:"lesson",id:itemId,prompt:item?.word||"Từ vựng",answer,correct:expected});}writeState(instance.state);render();return;}
    if(form.matches("[data-hhj-subtitle-miner]")){const text=String(form.elements.subtitle.value||"").slice(0,5000);instance.subtitleResults=VOCABULARY.filter(item=>item.word.length>1&&text.includes(item.word)).map(item=>({item,count:text.split(item.word).length-1})).sort((a,b)=>b.count-a.count||b.item.word.length-a.item.word.length).slice(0,30).map(row=>row.item);const output=form.parentElement.querySelector("[data-hhj-subtitle-output]");output.innerHTML=instance.subtitleResults.length?`${instance.subtitleResults.map(item=>`<button type="button" data-hhj-word-detail="${item.id}"><strong>${esc(item.word)} · ${esc(item.kana)}</strong><span>${esc(item.meaning)}</span></button>`).join("")}<footer><button type="button" data-hhj-save-subtitle>＋ Thêm tất cả vào SRS</button></footer>`:`<div class="hhj-empty">Chưa tìm thấy từ phù hợp trong kho 10.000 từ.</div>`;return;}
    if(form.matches("[data-hhj-search]")){const query=form.elements.query.value.trim();instance.state.searchQuery=query;instance.state.history.unshift({type:"search",query,at:new Date().toISOString()});instance.state.history=instance.state.history.slice(0,100);return navigate("dictionary");}
    if(form.matches("[data-hhj-reading-check]")){const item=READINGS.find(row=>row.id===form.dataset.hhjReadingCheck);const answer=form.elements.answer.value.trim();const correct=answer.includes(item.answer)||item.answer.includes(answer);const output=form.querySelector("output");output.textContent=correct?"✓ Chính xác. Bài đọc đã được ghi hoàn thành.":`Chưa đúng. Đáp án trọng tâm: ${item.answer}`;output.dataset.tone=correct?"success":"error";if(correct){instance.state.completedReadings[item.id]={at:new Date().toISOString()};markStudy(instance.state,20);}else recordMistake(instance.state,{type:"reading",id:item.id,prompt:item.question,answer,correct:item.answer});writeState(instance.state);return;}
    if(form.matches("[data-hhj-dictation]")){const expected=form.dataset.answer||"";const answer=form.elements.answer.value;const score=scoreDictation(expected,answer);const output=form.querySelector("output");output.textContent=score>=90?`✓ Khớp ${score}% · Nhịp nghe rất tốt.`:score>=70?`Khớp ${score}% · Nghe lại và chú ý trợ từ, trường âm.`:`Khớp ${score}% · Đáp án: ${expected}`;output.dataset.tone=score>=80?"success":"error";if(score>=80)markStudy(instance.state,10);else recordMistake(instance.state,{type:"dictation",id:instance.state.selectedReading,prompt:"Nghe chép chính tả",answer,correct:expected});writeState(instance.state);return;}
    if(form.matches("[data-hhj-jlpt-test]")){const fields=[...form.querySelectorAll("fieldset")];let correct=0;fields.forEach((field,index)=>{const value=form.elements[`q${index}`].value;const ok=value===field.dataset.answer;if(ok)correct++;else recordMistake(instance.state,{type:"jlpt",id:`${form.dataset.section}:${field.dataset.id}`,prompt:field.querySelector("legend span")?.textContent||"JLPT",answer:value,correct:field.dataset.answer});const output=field.querySelector("output");output.textContent=ok?"✓ Đúng":`✕ ${field.dataset.explanation}`;output.dataset.tone=ok?"success":"error";});const score=Math.round(correct/Math.max(1,fields.length)*100);form.querySelector("[data-hhj-jlpt-result]").innerHTML=`<strong>${score}%</strong><span>${correct}/${fields.length} câu đúng</span>`;instance.state.testHistory.unshift({level:form.dataset.level,section:form.dataset.section,score,correct,total:fields.length,at:new Date().toISOString()});markStudy(instance.state,correct*5);writeState(instance.state);return;}
    if(form.matches("[data-hhj-kana-convert]")){const hira=romajiToHiragana(form.elements.source.value);form.querySelector("output").innerHTML=`<b>Hiragana</b><span>${esc(hira)}</span><b>Katakana</b><span>${esc(hiraganaToKatakana(hira))}</span>`;return;}
    if(form.matches("[data-hhj-conjugate]")){const result=conjugateVerb(form.elements.verb.value);form.querySelector("output").innerHTML=result?Object.entries(result).map(([key,value])=>`<span><b>${esc(({dictionary:"Từ điển",polite:"Lịch sự",negative:"Phủ định",past:"Quá khứ",te:"Thể て",potential:"Khả năng",passive:"Bị động",causative:"Sai khiến"})[key]||key)}</b>${esc(value)}</span>`).join(""):`<em>Không nhận diện được động từ. Hãy nhập dạng từ điển.</em>`;return;}
    if(form.matches("[data-hhj-translate]")){form.querySelector("output").textContent=localTranslate(form.elements.text.value);return;}
    if(form.matches("[data-hhj-conversation]")){const text=form.elements.message.value.trim();const japanese=(text.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;const feedback=japanese<3?"Câu có rất ít ký tự tiếng Nhật; hãy thử dùng mẫu gợi ý.":text.length<8?"Câu đúng ngữ cảnh nhưng còn ngắn. Có thể thêm どうやって行きますか。":"Câu đủ rõ cho tình huống hỏi đường. Hãy nghe lại và luyện nhịp nói.";form.querySelector("[data-hhj-conversation-feedback]").textContent=feedback;instance.host.querySelector("[data-hhj-user-line]").textContent=text;markStudy(instance.state,8);writeState(instance.state);return;}
  }
  function mount(host, options={}) {
    unmount(); if(!host)return;
    const routeView=String(options.view||location.hash.replace(/^#\/japanese\/?/,"")||"dashboard").split("/")[0]||"dashboard";
    instance={host,options,state:readState(),controller:new AbortController(),toastTimer:0,onlineResults:[],subtitleResults:[]};instance.state.view=VIEW_IDS.has(routeView)?routeView:"dashboard";
    const listenerOptions={signal:instance.controller.signal};host.addEventListener("click",event=>handleClick(event).catch(error=>toast(error.message,"error")),listenerOptions);host.addEventListener("change",handleChange,listenerOptions);host.addEventListener("submit",event=>handleSubmit(event).catch(error=>toast(error.message,"error")),listenerOptions);render();
  }
  function unmount(){if(!instance)return;instance.controller?.abort();clearTimeout(instance.toastTimer);global.speechSynthesis?.cancel?.();instance=null;}

  global.HHJapanese=Object.freeze({mount,unmount,views:VIEWS.map(([id,label])=>({id,label})),dictionarySearch,romajiToHiragana,hiraganaToKatakana,conjugateVerb,scoreDictation,dailyPlan,srsStatus,recordMistake,lessonWords,courseUnits:COURSE_UNITS,words:VOCABULARY,topics:VOCABULARY_TOPICS,kanji:KANJI,grammar:GRAMMAR,readings:READINGS});
})();
