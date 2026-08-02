(() => {
  "use strict";

  const global = typeof window !== "undefined" ? window : globalThis;
  const VERSION = 1;
  const BASE_KEY = "hh.japanese.state.v1";
  const VIEWS = Object.freeze([
    ["dashboard", "Tổng quan", "⌂"], ["dictionary", "Từ điển", "辞"], ["kanji", "Kanji", "漢"],
    ["grammar", "Ngữ pháp", "文"], ["reader", "Đọc hiểu", "読"], ["jlpt", "Luyện JLPT", "試"],
    ["notebook", "Sổ tay & SRS", "★"], ["conversation", "Hội thoại", "話"], ["tools", "Công cụ", "具"],
    ["progress", "Tiến độ", "↗"]
  ]);
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
  const defaults = () => ({ version: VERSION, view: "dashboard", level: "N5", dailyGoal: 20, streak: 0, lastStudyDay: "", xp: 0, dailyActivity: {}, saved: {}, reviews: {}, customWords: [], history: [], completedReadings: {}, testHistory: [], searchQuery: "", selectedVocabularyTopic: "all", selectedKanji: "日", selectedGrammarLevel: "all", selectedReading: "r-n5", furigana: true, theme: "light" });
  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(stateKey()) || "null");
      return { ...defaults(), ...(saved && typeof saved === "object" ? saved : {}), saved: saved?.saved || {}, reviews: saved?.reviews || {}, customWords: Array.isArray(saved?.customWords) ? saved.customWords.slice(0, 200).map(normalizeCustomWord).filter(Boolean) : [], dailyActivity: saved?.dailyActivity && typeof saved.dailyActivity === "object" ? saved.dailyActivity : {}, history: Array.isArray(saved?.history) ? saved.history.slice(0, 100) : [], completedReadings: saved?.completedReadings || {}, testHistory: Array.isArray(saved?.testHistory) ? saved.testHistory.slice(0, 100) : [] };
    } catch { return defaults(); }
  }
  function writeState(state) {
    const activity = Object.fromEntries(Object.entries(state.dailyActivity || {}).slice(-90));
    localStorage.setItem(stateKey(), JSON.stringify({ ...state, version: VERSION, customWords: (state.customWords || []).slice(0, 200), dailyActivity: activity, history: (state.history || []).slice(0, 100), testHistory: (state.testHistory || []).slice(0, 100) }));
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
    return [
      { id: "review", label: due.length ? `Ôn ${Math.min(10, due.length)} từ đến hạn` : "Lưu 5 từ mới", detail: due.length ? "SRS theo lịch ghi nhớ" : "Xây bộ từ cá nhân", view: due.length ? "notebook" : "dictionary", done: due.length === 0 && savedWordCount(state) >= 5 },
      { id: "reading", label: `Đọc ${reading.title}`, detail: `${reading.level} · ${reading.minutes} phút`, view: "reader", readingId: reading.id, done: Boolean(state.completedReadings[reading.id]) },
      { id: "test", label: `Luyện nhanh JLPT ${state.level}`, detail: "Từ vựng và ngữ pháp", view: "jlpt", done: Boolean(state.testHistory.some((item) => item.level === state.level && String(item.at || "").slice(0, 10) === today())) }
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
    return `<section class="hhj-app" data-theme="${esc(state.theme)}"><header class="hhj-topbar"><button class="hhj-mobile-menu" type="button" data-hhj-menu aria-label="Mở menu">☰</button><div class="hhj-brand"><span>日</span><div><small>HỌC TIẾNG NHẬT TOÀN DIỆN</small><strong>HH Japanese</strong></div></div><form class="hhj-global-search" data-hhj-search><label><span>⌕</span><input name="query" value="${esc(state.searchQuery)}" placeholder="Nhập Kanji, Kana, Romaji hoặc tiếng Việt" autocomplete="off"></label><button>Tìm kiếm</button><button type="button" data-hhj-voice-search title="Tìm bằng giọng nói">🎙</button></form><div class="hhj-top-stats"><span><b>${state.streak}</b> ngày</span><span><b>${state.xp}</b> XP</span><button type="button" data-hhj-theme>${state.theme === "light" ? "◐ Tối" : "☀ Sáng"}</button></div></header><div class="hhj-layout"><aside class="hhj-sidebar" data-hhj-sidebar><nav>${VIEWS.map(([id,label,icon])=>`<button type="button" data-hhj-view="${id}" class="${view===id?"active":""}"><i>${icon}</i><span>${label}</span>${id==="notebook"&&dueWords(state).length?`<b>${dueWords(state).length}</b>`:""}</button>`).join("")}</nav><section><small>CẤP ĐỘ ĐANG HỌC</small><strong>${state.level}</strong><select data-hhj-level>${LEVELS.map(level=>`<option ${level===state.level?"selected":""}>${level}</option>`).join("")}</select><span>${progressPercent(state)}% hành trình cá nhân</span></section></aside><main class="hhj-main">${content}</main></div><div class="hhj-toast" data-hhj-toast hidden role="status"></div></section>`;
  }

  function dashboardView(state) {
    const due = dueWords(state); const nextReading = READINGS.find((item)=>item.level===state.level&&!state.completedReadings[item.id]) || READINGS.find((item)=>item.level===state.level) || READINGS[0]; const plan=dailyPlan(state); const earned=todayXp(state);
    return `<section class="hhj-dashboard"><section class="hhj-hero"><div><small>${state.level} · LỘ TRÌNH HÔM NAY</small><h1>日本語を、<br><em>mỗi ngày một chút.</em></h1><p>Từ điển, Kanji, ngữ pháp, đọc–nghe và JLPT trong một không gian học có tiến trình thật.</p><div><button class="primary" data-hhj-view="${due.length?"notebook":"dictionary"}">${due.length?`Ôn ${due.length} từ đến hạn`:"Tra từ đầu tiên"} →</button><button data-hhj-view="jlpt">Luyện ${state.level}</button></div></div><aside><b>${progressPercent(state)}%</b><span>TIẾN ĐỘ</span><i style="--p:${progressPercent(state)}%"></i></aside></section><div class="hhj-metrics"><article><span>Từ đã lưu</span><strong>${savedWordCount(state)}</strong><small>${due.length} từ đến hạn ôn</small></article><article><span>Kho từ offline</span><strong>${VOCABULARY.length}</strong><small>${VOCABULARY_TOPICS.length} chủ đề · N5 → N1</small></article><article><span>Ngữ pháp</span><strong>${GRAMMAR.length}</strong><small>Cấu trúc và ví dụ gốc</small></article><article><span>Bài đã làm</span><strong>${state.testHistory.length}</strong><small>${state.testHistory[0]?.score ?? "—"}% gần nhất</small></article></div><section class="hhj-daily-plan"><header><div><small>KẾ HOẠCH THÍCH ỨNG</small><h2>Ba việc nên học hôm nay</h2></div><strong>${earned}/${state.dailyGoal} XP</strong></header><div class="hhj-goal-track"><span style="--p:${Math.min(100,Math.round(earned/Math.max(1,state.dailyGoal)*100))}%"></span></div><div>${plan.map(item=>`<button data-hhj-view="${item.view}" ${item.readingId?`data-hhj-reading="${item.readingId}"`:""} class="${item.done?"done":""}"><i>${item.done?"✓":"○"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span><b>→</b></button>`).join("")}</div></section><section class="hhj-daily-grid"><article><small>ĐỌC HÔM NAY · ${nextReading.level}</small><h3>${esc(nextReading.title)}</h3><p>${esc(nextReading.text)}</p><button data-hhj-reading="${nextReading.id}">Mở bài đọc ${nextReading.minutes} phút</button></article><article><small>TRỌNG TÂM ${state.level}</small><h3>${esc(GRAMMAR.find(item=>item.level===state.level)?.pattern || GRAMMAR[0].pattern)}</h3><p>${esc(GRAMMAR.find(item=>item.level===state.level)?.meaning || GRAMMAR[0].meaning)}</p><button data-hhj-view="grammar">Học ngữ pháp</button></article><article><small>CÔNG CỤ NHANH</small><h3>Kana & chia động từ</h3><p>Chuyển Romaji sang Kana, nghe giọng Nhật và tra các dạng động từ.</p><button data-hhj-view="tools">Mở bộ công cụ</button></article></section><section class="hhj-feature-map"><header><div><small>10 WORKSPACE</small><h2>Một quy trình học liền mạch</h2></div></header><div>${VIEWS.slice(1).map(([id,label,icon])=>`<button data-hhj-view="${id}"><i>${icon}</i><strong>${label}</strong><span>${({dictionary:"Tra Nhật–Việt đa kiểu nhập",kanji:"Âm On/Kun, bộ và nét",grammar:"Mẫu câu N5–N1",reader:"Bài đọc có dịch và nghe",jlpt:"Bài thi chấm điểm",notebook:"Flashcard lặp ngắt quãng",conversation:"Hội thoại và luyện nói",tools:"Kana, OCR, chia động từ",progress:"Lịch sử và dữ liệu"})[id]}</span></button>`).join("")}</div></section></section>`;
  }

  function wordCard(item, state) {
    return `<article class="hhj-word-card"><header><div><h3>${esc(item.word)}</h3><span>${esc(item.kana)}${item.romaji?` · ${esc(item.romaji)}`:""}</span></div><b>${item.level}</b></header><strong>${esc(item.meaning)}</strong><small>${esc(item.pos)}${item.topic?` · ${esc(item.topic)}`:""}${item.meaningLanguage==="en"?" · Nghĩa Anh":" · Nghĩa Việt"}</small>${item.example?`<p>${esc(item.example)}</p>`:""}${item.exampleVi?`<em>${esc(item.exampleVi)}</em>`:""}<footer><button data-hhj-speak="${esc(item.word)}">▶ Nghe</button><button data-hhj-save-word="${item.id}" class="${state.saved[item.id]?"saved":""}">${state.saved[item.id]?"★ Đã lưu":"☆ Lưu từ"}</button></footer></article>`;
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
  function readerView(state) {
    const selected = READINGS.find(item=>item.id===state.selectedReading)||READINGS[0]; const dictation=`${selected.text.split("。")[0]}。`;
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>READING IMMERSION</small><h1>Đọc hiểu tiếng Nhật</h1><p>Bài đọc nguyên bản theo N5–N1, có nghe, bản dịch, chép chính tả và câu hỏi kiểm tra.</p></div><button data-hhj-furigana>${state.furigana?"Ẩn":"Hiện"} hỗ trợ đọc</button></header><div class="hhj-reader-layout"><aside>${READINGS.map(item=>`<button data-hhj-reading="${item.id}" class="${item.id===selected.id?"active":""}"><b>${item.level}</b><span><strong>${esc(item.title)}</strong><small>${item.minutes} phút ${state.completedReadings[item.id]?"· ✓":""}</small></span></button>`).join("")}</aside><article><header><span>${selected.level}</span><h2>${esc(selected.title)}</h2><button data-hhj-speak="${esc(selected.text)}">▶ Nghe toàn bài</button></header><p class="hhj-japanese-text ${state.furigana?"with-help":""}">${esc(selected.text)}</p><details><summary>Xem bản dịch tiếng Việt</summary><p>${esc(selected.translation)}</p></details><form data-hhj-reading-check="${selected.id}"><label>${esc(selected.question)}<input name="answer" required placeholder="Trả lời bằng tiếng Nhật"></label><button class="primary">Kiểm tra</button><output></output></form><section class="hhj-dictation"><header><div><small>LISTENING DICTATION</small><h3>Nghe và chép lại câu đầu</h3></div><button data-hhj-speak="${esc(dictation)}">▶ Nghe câu</button></header><form data-hhj-dictation data-answer="${esc(dictation)}"><label>Nhập chính xác điều bạn nghe được<input name="answer" required autocomplete="off" lang="ja" placeholder="日本語で入力してください"></label><button>Chấm độ khớp</button><output></output></form></section></article></div></section>`;
  }
  function jlptQuestions(level) {
    const pool = VOCABULARY.filter(item=>item.level===level); const grammar = GRAMMAR.filter(item=>item.level===level); const questions=[];
    pool.slice(0,5).forEach((item,index)=>{ const distract=VOCABULARY.filter(row=>row.id!==item.id).slice(index,index+3).map(row=>row.meaning); questions.push({prompt:`「${item.word}」の意味は何ですか。`,answer:item.meaning,options:[item.meaning,...distract].sort(()=>.5-Math.random()),explanation:`${item.word}（${item.kana}）: ${item.meaning}`}); });
    grammar.slice(0,3).forEach((item,index)=>{ const distract=GRAMMAR.filter(row=>row.id!==item.id).slice(index,index+3).map(row=>row.meaning); questions.push({prompt:`${item.pattern} có nghĩa gần nhất là gì?`,answer:item.meaning,options:[item.meaning,...distract].sort(()=>.5-Math.random()),explanation:`${item.structure} · ${item.example}`}); });
    return questions.slice(0,8);
  }
  function jlptView(state) {
    const level=state.level; const questions=jlptQuestions(level); const latest=state.testHistory.find(item=>item.level===level);
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>JLPT PRACTICE</small><h1>Luyện thi N5 → N1</h1><p>Mô phỏng kiến thức ngôn ngữ theo cấu trúc năng lực JLPT; đây là bài luyện nội bộ, không phải đề thi chính thức.</p></div><select data-hhj-level>${LEVELS.map(item=>`<option ${item===level?"selected":""}>${item}</option>`).join("")}</select></header><div class="hhj-jlpt-summary"><article><span>Cấp hiện tại</span><strong>${level}</strong></article><article><span>Số câu</span><strong>${questions.length}</strong></article><article><span>Kết quả gần nhất</span><strong>${latest?`${latest.score}%`:"—"}</strong></article><article><span>Phần luyện</span><strong>Từ vựng · Ngữ pháp</strong></article></div><form class="hhj-jlpt-test" data-hhj-jlpt-test data-level="${level}">${questions.map((q,index)=>`<fieldset data-answer="${esc(q.answer)}" data-explanation="${esc(q.explanation)}"><legend><b>${index+1}</b>${esc(q.prompt)}</legend>${q.options.map(answer=>`<label><input type="radio" name="q${index}" value="${esc(answer)}" required><span>${esc(answer)}</span></label>`).join("")}<output></output></fieldset>`).join("")}<button class="primary">Nộp bài và chấm điểm</button><output data-hhj-jlpt-result></output></form></section>`;
  }
  function notebookView(state) {
    const saved=WORDS.filter(item=>state.saved[item.id]); const savedGrammar=GRAMMAR.filter(item=>state.saved[`grammar:${item.id}`]); const due=dueWords(state); const review=due[0];
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>PERSONAL NOTEBOOK · SRS</small><h1>Sổ tay và Flashcard</h1><p>Tự lưu theo tài khoản HH trên thiết bị; lịch ôn dùng lặp ngắt quãng minh bạch.</p></div><span>${due.length} đến hạn</span></header>${review?`<section class="hhj-flashcard"><small>FLASHCARD ${1}/${due.length} · ${review.level}</small><div><h2>${esc(review.word)}</h2><p>${esc(review.kana)} · ${esc(review.romaji)}</p><details><summary>Hiện đáp án</summary><strong>${esc(review.meaning)}</strong><blockquote>${esc(review.example)}<br>${esc(review.exampleVi)}</blockquote></details></div><footer><button data-hhj-review="${review.id}:again">Học lại</button><button data-hhj-review="${review.id}:hard">Khó</button><button data-hhj-review="${review.id}:good">Nhớ</button><button data-hhj-review="${review.id}:easy">Rất dễ</button></footer></section>`:`<div class="hhj-empty"><b>Đã hoàn thành lượt ôn hiện tại</b><p>Lưu thêm từ trong Từ điển hoặc quay lại khi đến hạn.</p><button data-hhj-view="dictionary">Mở Từ điển</button></div>`}<div class="hhj-notebook-list">${saved.map(item=>{const reviewState=state.reviews[item.id]||{};return `<article><div><strong>${esc(item.word)}</strong><span>${esc(item.kana)} · ${esc(item.meaning)}</span></div><progress max="100" value="${Number(reviewState.mastery||0)}"></progress><small>${Number(reviewState.mastery||0)}% · ôn ${new Date(reviewState.dueAt||0).toLocaleDateString("vi-VN")}</small><button data-hhj-save-word="${item.id}">Xóa</button></article>`;}).join("")||""}</div>${savedGrammar.length?`<section class="hhj-saved-grammar"><h3>Ngữ pháp đã lưu</h3>${savedGrammar.map(item=>`<article><b>${item.level}</b><strong>${esc(item.pattern)}</strong><span>${esc(item.meaning)}</span><button data-hhj-save-grammar="${item.id}">Xóa</button></article>`).join("")}</section>`:""}</section>`;
  }
  function conversationView() {
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>SPEAKING & WRITING LAB</small><h1>Hội thoại tiếng Nhật</h1><p>Luyện phản xạ bằng tình huống, nghe giọng Nhật và nhận phản hồi cục bộ; có thể dùng HH AI khi được cấu hình.</p></div></header><div class="hhj-conversation-grid"><section><header><span>駅で · Ở nhà ga</span><button data-hhj-speak="すみません、東京駅はどこですか。">▶ Nghe mẫu</button></header><div class="hhj-chat"><p><b>駅員</b>はい、どうしましたか。</p><p><b>あなた</b><span data-hhj-user-line>...</span></p></div><form data-hhj-conversation><label>Viết câu trả lời<textarea name="message" required placeholder="Ví dụ: すみません、東京駅はどこですか。"></textarea></label><div><button type="button" data-hhj-dictate>🎙 Nói</button><button class="primary">Kiểm tra phản hồi</button><button type="button" data-hhj-ai-feedback>HH AI góp ý</button></div><output data-hhj-conversation-feedback></output></form></section><aside><h3>Mẫu câu gợi ý</h3>${["すみません。","～はどこですか。","どうやって行きますか。","ありがとうございます。"].map(text=>`<button data-hhj-fill-conversation="${text}">${text}<span>＋</span></button>`).join("")}<p>Nhận dạng giọng nói có thể do nhà cung cấp trình duyệt xử lý. HH chỉ bật sau khi bạn nhấn nút.</p></aside></div></section>`;
  }
  function toolsView() {
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>JAPANESE TOOLBOX</small><h1>Bộ công cụ tiếng Nhật</h1><p>Kana, chia động từ, dịch nhanh, giọng đọc, camera OCR và bảng chữ cái.</p></div></header><div class="hhj-tool-grid"><form data-hhj-kana-convert><header><b>あ</b><div><h3>Romaji → Kana</h3><p>Chuyển đổi cục bộ, không gửi dữ liệu.</p></div></header><textarea name="source" placeholder="nihongo wo benkyou shimasu"></textarea><button>Chuyển đổi</button><output data-hhj-kana-output></output></form><form data-hhj-conjugate><header><b>動</b><div><h3>Chia động từ</h3><p>Các dạng thường dùng.</p></div></header><input name="verb" placeholder="食べる / 飲む / する" required><button>Chia động từ</button><output data-hhj-conjugation></output></form><form data-hhj-translate><header><b>訳</b><div><h3>Dịch và kiểm tra câu</h3><p>Dịch từ cục bộ hoặc gửi HH AI khi có cấu hình.</p></div></header><textarea name="text" placeholder="日本語を勉強しています。" required></textarea><div><button>Dịch nhanh</button><button type="button" data-hhj-ai-translate>Dịch bằng HH AI</button></div><output data-hhj-translation></output></form><section class="hhj-kana-chart"><header><b>五</b><div><h3>Bảng Hiragana</h3><p>Bấm chữ để nghe.</p></div></header><div>${KANA_ROWS.flat().map(char=>char?`<button data-hhj-speak="${char}">${char}</button>`:`<span></span>`).join("")}</div></section></div><section class="hhj-sources"><h3>Nguồn mở và phạm vi dữ liệu</h3><p>Kho 10.000 từ gồm 360 mục HH có nghĩa Việt và 9.640 mục JMdict Common có nghĩa Anh được gắn nhãn rõ ràng. Dữ liệu JMdict tuân theo giấy phép EDRDG; cấu trúc luyện thi tham chiếu mô tả công khai của JLPT.</p><a href="https://www.edrdg.org/" target="_blank" rel="noopener">EDRDG · JMdict/KANJIDIC ↗</a><a href="assets/japanese/NOTICE-JMDICT.md" target="_blank" rel="noopener">Thông báo dữ liệu 10K ↗</a><a href="https://kanjiapi.dev/" target="_blank" rel="noopener">KanjiAPI.dev ↗</a><a href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noopener">JLPT · Cấu trúc bài thi ↗</a></section></section>`;
  }
  function progressView(state) {
    const wordBank=allWords(state); const levelCounts=LEVELS.map(level=>({level,words:wordBank.filter(item=>item.level===level&&state.saved[item.id]).length,total:wordBank.filter(item=>item.level===level).length,grammar:GRAMMAR.filter(item=>item.level===level).length}));
    return `<section class="hhj-page"><header class="hhj-page-head"><div><small>LEARNING ANALYTICS</small><h1>Tiến độ cá nhân</h1><p>Chỉ số được tính từ hoạt động thật lưu riêng theo tài khoản HH trên thiết bị.</p></div><div class="hhj-data-actions"><label>Mục tiêu<select data-hhj-daily-goal>${[10,20,30,50,80].map(value=>`<option value="${value}" ${Number(state.dailyGoal)===value?"selected":""}>${value} XP/ngày</option>`).join("")}</select></label><button data-hhj-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json" data-hhj-import></label></div></header><div class="hhj-progress-hero"><article><span>XP hôm nay</span><strong>${todayXp(state)}/${state.dailyGoal}</strong></article><article><span>Chuỗi ngày</span><strong>${state.streak}</strong></article><article><span>Từ đã lưu</span><strong>${savedWordCount(state)}</strong></article><article><span>Bài đọc</span><strong>${Object.keys(state.completedReadings).length}</strong></article></div><section class="hhj-level-progress"><h3>Tiến độ theo JLPT</h3>${levelCounts.map(item=>`<article><b>${item.level}</b><div><span style="--p:${item.total?item.words/item.total*100:0}%"></span></div><strong>${item.words}/${item.total} từ</strong><small>${item.grammar} mẫu ngữ pháp khả dụng</small></article>`).join("")}</section><section class="hhj-history"><header><h3>Lịch sử bài luyện</h3><button class="danger" data-hhj-reset>Xóa dữ liệu học</button></header>${state.testHistory.slice(0,12).map(item=>`<article><time>${new Date(item.at).toLocaleString("vi-VN")}</time><strong>JLPT ${item.level}</strong><span>${item.score}% · ${item.correct}/${item.total}</span></article>`).join("")||`<div class="hhj-empty">Chưa có bài luyện nào.</div>`}</section></section>`;
  }
  function activeView(state) {
    return ({dashboard:dashboardView,dictionary:dictionaryView,kanji:kanjiView,grammar:grammarView,reader:readerView,jlpt:jlptView,notebook:notebookView,conversation:conversationView,tools:toolsView,progress:progressView}[state.view]||dashboardView)(state);
  }
  function render() {
    if (!instance?.host) return;
    instance.host.innerHTML = shell(activeView(instance.state));
    if (instance.state.view === "kanji") requestAnimationFrame(setupWritingPad);
  }
  function navigate(view, push = true) {
    if (!VIEWS.some(([id])=>id===view)) view="dashboard";
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
    if(button.dataset.hhjSpeak!==undefined){if(!speak(button.dataset.hhjSpeak))toast("Thiết bị chưa hỗ trợ giọng đọc.","error");return;}
    if(button.dataset.hhjSaveWord){saveWord(instance.state,button.dataset.hhjSaveWord);markStudy(instance.state,2);writeState(instance.state);render();return toast("Đã cập nhật Sổ tay.","success");}
    if(button.matches("[data-hhj-save-topic]")){const topic=VOCABULARY_TOPICS.includes(instance.state.selectedVocabularyTopic)?instance.state.selectedVocabularyTopic:"all";const source=instance.state.searchQuery?searchStateWords(instance.state,instance.state.searchQuery):topic==="JMdict 10K"?allWords(instance.state).filter(item=>item.topic===topic):allWords(instance.state).filter(item=>item.level===instance.state.level);const rows=source.filter(item=>(topic==="all"||item.topic===topic)&&!instance.state.saved[item.id]).slice(0,10);rows.forEach(item=>saveWord(instance.state,item.id));if(rows.length){markStudy(instance.state,Math.min(20,rows.length*2));writeState(instance.state);render();toast(`Đã thêm ${rows.length} từ vào SRS.`,"success");}return;}
    if(button.dataset.hhjSaveGrammar){const key=`grammar:${button.dataset.hhjSaveGrammar}`;if(instance.state.saved[key])delete instance.state.saved[key];else instance.state.saved[key]={savedAt:new Date().toISOString(),type:"grammar"};markStudy(instance.state,2);writeState(instance.state);render();return toast("Đã cập nhật ngữ pháp đã lưu.","success");}
    if(button.dataset.hhjKanji){instance.state.selectedKanji=button.dataset.hhjKanji;writeState(instance.state);render();return;}
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
    const data=JSON.parse(await file.text()); if(!data||typeof data!=="object"||Number(data.version)!==VERSION)throw new Error("Sai định dạng hoặc phiên bản dữ liệu.");
    instance.state={...defaults(),...data,dailyGoal:[10,20,30,50,80].includes(Number(data.dailyGoal))?Number(data.dailyGoal):20,saved:data.saved&&typeof data.saved==="object"?data.saved:{},reviews:data.reviews&&typeof data.reviews==="object"?data.reviews:{},customWords:Array.isArray(data.customWords)?data.customWords.slice(0,200).map(normalizeCustomWord).filter(Boolean):[],dailyActivity:data.dailyActivity&&typeof data.dailyActivity==="object"?Object.fromEntries(Object.entries(data.dailyActivity).slice(-90)):{},history:Array.isArray(data.history)?data.history.slice(0,100):[],testHistory:Array.isArray(data.testHistory)?data.testHistory.slice(0,100):[],completedReadings:data.completedReadings&&typeof data.completedReadings==="object"?data.completedReadings:{}};
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
    if(form.matches("[data-hhj-search]")){const query=form.elements.query.value.trim();instance.state.searchQuery=query;instance.state.view="dictionary";instance.state.history.unshift({type:"search",query,at:new Date().toISOString()});instance.state.history=instance.state.history.slice(0,100);writeState(instance.state);render();return;}
    if(form.matches("[data-hhj-reading-check]")){const item=READINGS.find(row=>row.id===form.dataset.hhjReadingCheck);const answer=form.elements.answer.value.trim();const correct=answer.includes(item.answer)||item.answer.includes(answer);const output=form.querySelector("output");output.textContent=correct?"✓ Chính xác. Bài đọc đã được ghi hoàn thành.":`Chưa đúng. Đáp án trọng tâm: ${item.answer}`;output.dataset.tone=correct?"success":"error";if(correct){instance.state.completedReadings[item.id]={at:new Date().toISOString()};markStudy(instance.state,20);writeState(instance.state);}return;}
    if(form.matches("[data-hhj-dictation]")){const expected=form.dataset.answer||"";const score=scoreDictation(expected,form.elements.answer.value);const output=form.querySelector("output");output.textContent=score>=90?`✓ Khớp ${score}% · Nhịp nghe rất tốt.`:score>=70?`Khớp ${score}% · Nghe lại và chú ý trợ từ, trường âm.`:`Khớp ${score}% · Đáp án: ${expected}`;output.dataset.tone=score>=80?"success":"error";if(score>=80){markStudy(instance.state,10);writeState(instance.state);}return;}
    if(form.matches("[data-hhj-jlpt-test]")){const fields=[...form.querySelectorAll("fieldset")];let correct=0;fields.forEach((field,index)=>{const value=form.elements[`q${index}`].value;const ok=value===field.dataset.answer;if(ok)correct++;const output=field.querySelector("output");output.textContent=ok?"✓ Đúng":`✕ ${field.dataset.explanation}`;output.dataset.tone=ok?"success":"error";});const score=Math.round(correct/Math.max(1,fields.length)*100);form.querySelector("[data-hhj-jlpt-result]").innerHTML=`<strong>${score}%</strong><span>${correct}/${fields.length} câu đúng</span>`;instance.state.testHistory.unshift({level:form.dataset.level,score,correct,total:fields.length,at:new Date().toISOString()});markStudy(instance.state,correct*5);writeState(instance.state);return;}
    if(form.matches("[data-hhj-kana-convert]")){const hira=romajiToHiragana(form.elements.source.value);form.querySelector("output").innerHTML=`<b>Hiragana</b><span>${esc(hira)}</span><b>Katakana</b><span>${esc(hiraganaToKatakana(hira))}</span>`;return;}
    if(form.matches("[data-hhj-conjugate]")){const result=conjugateVerb(form.elements.verb.value);form.querySelector("output").innerHTML=result?Object.entries(result).map(([key,value])=>`<span><b>${esc(({dictionary:"Từ điển",polite:"Lịch sự",negative:"Phủ định",past:"Quá khứ",te:"Thể て",potential:"Khả năng",passive:"Bị động",causative:"Sai khiến"})[key]||key)}</b>${esc(value)}</span>`).join(""):`<em>Không nhận diện được động từ. Hãy nhập dạng từ điển.</em>`;return;}
    if(form.matches("[data-hhj-translate]")){form.querySelector("output").textContent=localTranslate(form.elements.text.value);return;}
    if(form.matches("[data-hhj-conversation]")){const text=form.elements.message.value.trim();const japanese=(text.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;const feedback=japanese<3?"Câu có rất ít ký tự tiếng Nhật; hãy thử dùng mẫu gợi ý.":text.length<8?"Câu đúng ngữ cảnh nhưng còn ngắn. Có thể thêm どうやって行きますか。":"Câu đủ rõ cho tình huống hỏi đường. Hãy nghe lại và luyện nhịp nói.";form.querySelector("[data-hhj-conversation-feedback]").textContent=feedback;instance.host.querySelector("[data-hhj-user-line]").textContent=text;markStudy(instance.state,8);writeState(instance.state);return;}
  }
  function mount(host, options={}) {
    unmount(); if(!host)return;
    const routeView=String(options.view||location.hash.replace(/^#\/japanese\/?/,"")||"dashboard").split("/")[0]||"dashboard";
    instance={host,options,state:readState(),controller:new AbortController(),toastTimer:0,onlineResults:[]};instance.state.view=VIEWS.some(([id])=>id===routeView)?routeView:"dashboard";
    const listenerOptions={signal:instance.controller.signal};host.addEventListener("click",event=>handleClick(event).catch(error=>toast(error.message,"error")),listenerOptions);host.addEventListener("change",handleChange,listenerOptions);host.addEventListener("submit",event=>handleSubmit(event).catch(error=>toast(error.message,"error")),listenerOptions);render();
  }
  function unmount(){if(!instance)return;instance.controller?.abort();clearTimeout(instance.toastTimer);global.speechSynthesis?.cancel?.();instance=null;}

  global.HHJapanese=Object.freeze({mount,unmount,views:VIEWS.map(([id,label])=>({id,label})),dictionarySearch,romajiToHiragana,hiraganaToKatakana,conjugateVerb,scoreDictation,dailyPlan,words:VOCABULARY,topics:VOCABULARY_TOPICS,kanji:KANJI,grammar:GRAMMAR,readings:READINGS});
})();
