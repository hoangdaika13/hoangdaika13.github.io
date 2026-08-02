(() => {
  "use strict";

  const raw = `
おはよう|おはよう|ohayou|chào buổi sáng|cụm từ|N5|Chào hỏi
こんにちは|こんにちは|konnichiwa|xin chào; chào buổi chiều|cụm từ|N5|Chào hỏi
こんばんは|こんばんは|konbanwa|chào buổi tối|cụm từ|N5|Chào hỏi
おやすみなさい|おやすみなさい|oyasuminasai|chúc ngủ ngon|cụm từ|N5|Chào hỏi
さようなら|さようなら|sayounara|tạm biệt|cụm từ|N5|Chào hỏi
はじめまして|はじめまして|hajimemashite|rất vui được gặp lần đầu|cụm từ|N5|Chào hỏi
よろしくお願いします|よろしくおねがいします|yoroshiku onegaishimasu|mong được giúp đỡ; rất hân hạnh|cụm từ|N5|Chào hỏi
どういたしまして|どういたしまして|dou itashimashite|không có gì|cụm từ|N5|Chào hỏi
失礼します|しつれいします|shitsurei shimasu|xin phép; thất lễ|cụm từ|N5|Chào hỏi
お元気ですか|おげんきですか|ogenki desu ka|bạn có khỏe không|cụm từ|N5|Chào hỏi
元気|げんき|genki|khỏe; tràn đầy sức sống|tính từ na|N5|Chào hỏi
名前|なまえ|namae|tên|danh từ|N5|Chào hỏi
紹介|しょうかい|shoukai|giới thiệu|danh từ; động từ suru|N4|Chào hỏi
挨拶|あいさつ|aisatsu|lời chào|danh từ; động từ suru|N4|Chào hỏi
お願い|おねがい|onegai|lời nhờ; yêu cầu|danh từ|N5|Chào hỏi
返事|へんじ|henji|câu trả lời; hồi đáp|danh từ; động từ suru|N4|Chào hỏi
会話|かいわ|kaiwa|hội thoại|danh từ|N4|Chào hỏi
丁寧|ていねい|teinei|lịch sự; cẩn thận|tính từ na|N4|Chào hỏi
久しぶり|ひさしぶり|hisashiburi|lâu rồi không gặp|cụm từ|N4|Chào hỏi
ごめんなさい|ごめんなさい|gomennasai|xin lỗi|cụm từ|N5|Chào hỏi
家族|かぞく|kazoku|gia đình|danh từ|N5|Gia đình
父|ちち|chichi|bố của mình|danh từ|N5|Gia đình
母|はは|haha|mẹ của mình|danh từ|N5|Gia đình
両親|りょうしん|ryoushin|bố mẹ|danh từ|N4|Gia đình
兄|あに|ani|anh trai của mình|danh từ|N5|Gia đình
姉|あね|ane|chị gái của mình|danh từ|N5|Gia đình
弟|おとうと|otouto|em trai|danh từ|N5|Gia đình
妹|いもうと|imouto|em gái|danh từ|N5|Gia đình
夫|おっと|otto|chồng|danh từ|N4|Gia đình
妻|つま|tsuma|vợ|danh từ|N4|Gia đình
子供|こども|kodomo|trẻ em; con cái|danh từ|N5|Gia đình
祖父|そふ|sofu|ông|danh từ|N4|Gia đình
祖母|そぼ|sobo|bà|danh từ|N4|Gia đình
親戚|しんせき|shinseki|họ hàng|danh từ|N3|Gia đình
友達|ともだち|tomodachi|bạn bè|danh từ|N5|Gia đình
恋人|こいびと|koibito|người yêu|danh từ|N4|Gia đình
結婚|けっこん|kekkon|kết hôn|danh từ; động từ suru|N4|Gia đình
誕生日|たんじょうび|tanjoubi|sinh nhật|danh từ|N5|Gia đình
世代|せだい|sedai|thế hệ|danh từ|N3|Gia đình
関係|かんけい|kankei|mối quan hệ|danh từ|N3|Gia đình
今日|きょう|kyou|hôm nay|danh từ|N5|Thời gian
昨日|きのう|kinou|hôm qua|danh từ|N5|Thời gian
明日|あした|ashita|ngày mai|danh từ|N5|Thời gian
今朝|けさ|kesa|sáng nay|danh từ|N5|Thời gian
今晩|こんばん|konban|tối nay|danh từ|N5|Thời gian
毎日|まいにち|mainichi|mỗi ngày|danh từ|N5|Thời gian
毎週|まいしゅう|maishuu|mỗi tuần|danh từ|N5|Thời gian
毎月|まいつき|maitsuki|mỗi tháng|danh từ|N5|Thời gian
毎年|まいとし|maitoshi|mỗi năm|danh từ|N5|Thời gian
時間|じかん|jikan|thời gian; giờ|danh từ|N5|Thời gian
午前|ごぜん|gozen|buổi sáng; trước trưa|danh từ|N5|Thời gian
午後|ごご|gogo|buổi chiều; sau trưa|danh từ|N5|Thời gian
週末|しゅうまつ|shuumatsu|cuối tuần|danh từ|N4|Thời gian
平日|へいじつ|heijitsu|ngày thường|danh từ|N4|Thời gian
予定|よてい|yotei|dự định; lịch trình|danh từ|N4|Thời gian
約束|やくそく|yakusoku|lời hứa; cuộc hẹn|danh từ; động từ suru|N4|Thời gian
期間|きかん|kikan|thời kỳ; khoảng thời gian|danh từ|N3|Thời gian
締め切り|しめきり|shimekiri|hạn chót|danh từ|N3|Thời gian
瞬間|しゅんかん|shunkan|khoảnh khắc|danh từ|N3|Thời gian
将来|しょうらい|shourai|tương lai|danh từ|N3|Thời gian
食べ物|たべもの|tabemono|đồ ăn|danh từ|N5|Ẩm thực
飲み物|のみもの|nomimono|đồ uống|danh từ|N5|Ẩm thực
ご飯|ごはん|gohan|cơm; bữa ăn|danh từ|N5|Ẩm thực
朝ご飯|あさごはん|asagohan|bữa sáng|danh từ|N5|Ẩm thực
昼ご飯|ひるごはん|hirugohan|bữa trưa|danh từ|N5|Ẩm thực
晩ご飯|ばんごはん|bangohan|bữa tối|danh từ|N5|Ẩm thực
水|みず|mizu|nước|danh từ|N5|Ẩm thực
お茶|おちゃ|ocha|trà|danh từ|N5|Ẩm thực
牛乳|ぎゅうにゅう|gyuunyuu|sữa bò|danh từ|N5|Ẩm thực
野菜|やさい|yasai|rau củ|danh từ|N5|Ẩm thực
果物|くだもの|kudamono|trái cây|danh từ|N5|Ẩm thực
肉|にく|niku|thịt|danh từ|N5|Ẩm thực
魚|さかな|sakana|cá|danh từ|N5|Ẩm thực
卵|たまご|tamago|trứng|danh từ|N5|Ẩm thực
料理|りょうり|ryouri|món ăn; nấu ăn|danh từ; động từ suru|N4|Ẩm thực
注文|ちゅうもん|chuumon|gọi món; đặt hàng|danh từ; động từ suru|N4|Ẩm thực
味|あじ|aji|vị; hương vị|danh từ|N4|Ẩm thực
美味しい|おいしい|oishii|ngon|tính từ i|N5|Ẩm thực
辛い|からい|karai|cay|tính từ i|N4|Ẩm thực
甘い|あまい|amai|ngọt|tính từ i|N4|Ẩm thực
駅|えき|eki|nhà ga|danh từ|N5|Du lịch
空港|くうこう|kuukou|sân bay|danh từ|N4|Du lịch
電車|でんしゃ|densha|tàu điện|danh từ|N5|Du lịch
地下鉄|ちかてつ|chikatetsu|tàu điện ngầm|danh từ|N4|Du lịch
新幹線|しんかんせん|shinkansen|tàu cao tốc Shinkansen|danh từ|N4|Du lịch
飛行機|ひこうき|hikouki|máy bay|danh từ|N5|Du lịch
自転車|じてんしゃ|jitensha|xe đạp|danh từ|N5|Du lịch
切符|きっぷ|kippu|vé tàu; vé xe|danh từ|N5|Du lịch
地図|ちず|chizu|bản đồ|danh từ|N4|Du lịch
道|みち|michi|đường đi|danh từ|N5|Du lịch
交差点|こうさてん|kousaten|ngã tư|danh từ|N4|Du lịch
信号|しんごう|shingou|đèn giao thông; tín hiệu|danh từ|N4|Du lịch
旅行|りょこう|ryokou|du lịch; chuyến đi|danh từ; động từ suru|N4|Du lịch
観光|かんこう|kankou|tham quan|danh từ; động từ suru|N3|Du lịch
予約|よやく|yoyaku|đặt trước|danh từ; động từ suru|N4|Du lịch
旅館|りょかん|ryokan|nhà trọ kiểu Nhật|danh từ|N3|Du lịch
案内|あんない|annai|hướng dẫn; chỉ dẫn|danh từ; động từ suru|N4|Du lịch
到着|とうちゃく|touchaku|đến nơi|danh từ; động từ suru|N3|Du lịch
出発|しゅっぱつ|shuppatsu|khởi hành|danh từ; động từ suru|N4|Du lịch
乗り換え|のりかえ|norikae|chuyển tàu; đổi tuyến|danh từ|N3|Du lịch
学校|がっこう|gakkou|trường học|danh từ|N5|Học tập
大学|だいがく|daigaku|đại học|danh từ|N5|Học tập
教室|きょうしつ|kyoushitsu|phòng học|danh từ|N5|Học tập
授業|じゅぎょう|jugyou|tiết học; bài giảng|danh từ|N4|Học tập
宿題|しゅくだい|shukudai|bài tập về nhà|danh từ|N5|Học tập
試験|しけん|shiken|kỳ thi; kiểm tra|danh từ|N4|Học tập
問題|もんだい|mondai|vấn đề; câu hỏi|danh từ|N4|Học tập
答え|こたえ|kotae|câu trả lời|danh từ|N5|Học tập
質問|しつもん|shitsumon|câu hỏi|danh từ; động từ suru|N4|Học tập
練習|れんしゅう|renshuu|luyện tập|danh từ; động từ suru|N4|Học tập
勉強|べんきょう|benkyou|học tập|danh từ; động từ suru|N5|Học tập
研究|けんきゅう|kenkyuu|nghiên cứu|danh từ; động từ suru|N3|Học tập
知識|ちしき|chishiki|kiến thức|danh từ|N3|Học tập
能力|のうりょく|nouryoku|năng lực|danh từ|N3|Học tập
教育|きょういく|kyouiku|giáo dục|danh từ|N3|Học tập
成績|せいせき|seiseki|thành tích; điểm số|danh từ|N3|Học tập
卒業|そつぎょう|sotsugyou|tốt nghiệp|danh từ; động từ suru|N4|Học tập
入学|にゅうがく|nyuugaku|nhập học|danh từ; động từ suru|N4|Học tập
辞書|じしょ|jisho|từ điển|danh từ|N5|Học tập
教科書|きょうかしょ|kyoukasho|sách giáo khoa|danh từ|N4|Học tập
会社|かいしゃ|kaisha|công ty|danh từ|N5|Công việc
仕事|しごと|shigoto|công việc|danh từ|N5|Công việc
会議|かいぎ|kaigi|cuộc họp|danh từ|N3|Công việc
社員|しゃいん|shain|nhân viên công ty|danh từ|N4|Công việc
上司|じょうし|joushi|cấp trên|danh từ|N3|Công việc
同僚|どうりょう|douryou|đồng nghiệp|danh từ|N3|Công việc
給料|きゅうりょう|kyuuryou|tiền lương|danh từ|N3|Công việc
残業|ざんぎょう|zangyou|làm thêm giờ|danh từ; động từ suru|N3|Công việc
休暇|きゅうか|kyuuka|kỳ nghỉ; ngày phép|danh từ|N3|Công việc
面接|めんせつ|mensetsu|phỏng vấn|danh từ; động từ suru|N3|Công việc
就職|しゅうしょく|shuushoku|tìm được việc; đi làm|danh từ; động từ suru|N3|Công việc
転職|てんしょく|tenshoku|chuyển việc|danh từ; động từ suru|N3|Công việc
担当|たんとう|tantou|phụ trách|danh từ; động từ suru|N3|Công việc
報告|ほうこく|houkoku|báo cáo|danh từ; động từ suru|N3|Công việc
連絡|れんらく|renraku|liên lạc; thông báo|danh từ; động từ suru|N4|Công việc
相談|そうだん|soudan|trao đổi; tham vấn|danh từ; động từ suru|N3|Công việc
契約|けいやく|keiyaku|hợp đồng|danh từ; động từ suru|N2|Công việc
責任|せきにん|sekinin|trách nhiệm|danh từ|N3|Công việc
効率|こうりつ|kouritsu|hiệu suất|danh từ|N2|Công việc
成果|せいか|seika|thành quả|danh từ|N2|Công việc
家|いえ|ie|nhà|danh từ|N5|Đời sống
部屋|へや|heya|căn phòng|danh từ|N5|Đời sống
台所|だいどころ|daidokoro|nhà bếp|danh từ|N5|Đời sống
風呂|ふろ|furo|bồn tắm; phòng tắm|danh từ|N5|Đời sống
玄関|げんかん|genkan|lối vào nhà|danh từ|N4|Đời sống
窓|まど|mado|cửa sổ|danh từ|N5|Đời sống
冷蔵庫|れいぞうこ|reizouko|tủ lạnh|danh từ|N4|Đời sống
洗濯|せんたく|sentaku|giặt giũ|danh từ; động từ suru|N4|Đời sống
掃除|そうじ|souji|dọn dẹp|danh từ; động từ suru|N4|Đời sống
買い物|かいもの|kaimono|mua sắm|danh từ; động từ suru|N5|Đời sống
財布|さいふ|saifu|ví tiền|danh từ|N4|Đời sống
鍵|かぎ|kagi|chìa khóa|danh từ|N4|Đời sống
電話|でんわ|denwa|điện thoại; cuộc gọi|danh từ; động từ suru|N5|Đời sống
手紙|てがみ|tegami|thư|danh từ|N5|Đời sống
荷物|にもつ|nimotsu|hành lý; bưu kiện|danh từ|N4|Đời sống
生活|せいかつ|seikatsu|cuộc sống; sinh hoạt|danh từ|N4|Đời sống
習慣|しゅうかん|shuukan|thói quen|danh từ|N3|Đời sống
必要|ひつよう|hitsuyou|cần thiết|tính từ na|N4|Đời sống
便利|べんり|benri|tiện lợi|tính từ na|N4|Đời sống
不便|ふべん|fuben|bất tiện|tính từ na|N4|Đời sống
天気|てんき|tenki|thời tiết|danh từ|N5|Thiên nhiên
晴れ|はれ|hare|trời nắng; quang đãng|danh từ|N5|Thiên nhiên
曇り|くもり|kumori|trời nhiều mây|danh từ|N5|Thiên nhiên
雨|あめ|ame|mưa|danh từ|N5|Thiên nhiên
雪|ゆき|yuki|tuyết|danh từ|N5|Thiên nhiên
風|かぜ|kaze|gió|danh từ|N5|Thiên nhiên
台風|たいふう|taifuu|bão|danh từ|N4|Thiên nhiên
気温|きおん|kion|nhiệt độ không khí|danh từ|N3|Thiên nhiên
季節|きせつ|kisetsu|mùa|danh từ|N4|Thiên nhiên
春|はる|haru|mùa xuân|danh từ|N5|Thiên nhiên
夏|なつ|natsu|mùa hè|danh từ|N5|Thiên nhiên
秋|あき|aki|mùa thu|danh từ|N5|Thiên nhiên
冬|ふゆ|fuyu|mùa đông|danh từ|N5|Thiên nhiên
山|やま|yama|núi|danh từ|N5|Thiên nhiên
川|かわ|kawa|sông|danh từ|N5|Thiên nhiên
海|うみ|umi|biển|danh từ|N5|Thiên nhiên
森|もり|mori|rừng|danh từ|N4|Thiên nhiên
地震|じしん|jishin|động đất|danh từ|N3|Thiên nhiên
環境|かんきょう|kankyou|môi trường|danh từ|N3|Thiên nhiên
自然|しぜん|shizen|thiên nhiên; tự nhiên|danh từ; tính từ na|N3|Thiên nhiên
体|からだ|karada|cơ thể|danh từ|N5|Sức khỏe
頭|あたま|atama|đầu|danh từ|N5|Sức khỏe
顔|かお|kao|khuôn mặt|danh từ|N5|Sức khỏe
目|め|me|mắt|danh từ|N5|Sức khỏe
耳|みみ|mimi|tai|danh từ|N5|Sức khỏe
口|くち|kuchi|miệng|danh từ|N5|Sức khỏe
手|て|te|tay|danh từ|N5|Sức khỏe
足|あし|ashi|chân|danh từ|N5|Sức khỏe
心|こころ|kokoro|trái tim; tâm hồn|danh từ|N3|Sức khỏe
病院|びょういん|byouin|bệnh viện|danh từ|N5|Sức khỏe
医者|いしゃ|isha|bác sĩ|danh từ|N5|Sức khỏe
薬|くすり|kusuri|thuốc|danh từ|N5|Sức khỏe
病気|びょうき|byouki|bệnh tật|danh từ|N5|Sức khỏe
痛い|いたい|itai|đau|tính từ i|N5|Sức khỏe
熱|ねつ|netsu|sốt; nhiệt|danh từ|N4|Sức khỏe
健康|けんこう|kenkou|sức khỏe; khỏe mạnh|danh từ; tính từ na|N3|Sức khỏe
運動|うんどう|undou|vận động; thể dục|danh từ; động từ suru|N4|Sức khỏe
睡眠|すいみん|suimin|giấc ngủ|danh từ|N3|Sức khỏe
治療|ちりょう|chiryou|điều trị|danh từ; động từ suru|N2|Sức khỏe
症状|しょうじょう|shoujou|triệu chứng|danh từ|N2|Sức khỏe
嬉しい|うれしい|ureshii|vui mừng|tính từ i|N4|Cảm xúc
楽しい|たのしい|tanoshii|vui vẻ|tính từ i|N5|Cảm xúc
悲しい|かなしい|kanashii|buồn|tính từ i|N4|Cảm xúc
寂しい|さびしい|sabishii|cô đơn|tính từ i|N4|Cảm xúc
怖い|こわい|kowai|đáng sợ; sợ|tính từ i|N4|Cảm xúc
恥ずかしい|はずかしい|hazukashii|xấu hổ; ngượng|tính từ i|N3|Cảm xúc
驚く|おどろく|odoroku|ngạc nhiên|động từ nhóm 1|N3|Cảm xúc
怒る|おこる|okoru|tức giận|động từ nhóm 1|N3|Cảm xúc
笑う|わらう|warau|cười|động từ nhóm 1|N4|Cảm xúc
泣く|なく|naku|khóc|động từ nhóm 1|N4|Cảm xúc
安心|あんしん|anshin|an tâm|danh từ; động từ suru|N3|Cảm xúc
心配|しんぱい|shinpai|lo lắng|danh từ; động từ suru|N4|Cảm xúc
緊張|きんちょう|kinchou|căng thẳng|danh từ; động từ suru|N3|Cảm xúc
感動|かんどう|kandou|cảm động|danh từ; động từ suru|N3|Cảm xúc
興味|きょうみ|kyoumi|hứng thú; quan tâm|danh từ|N3|Cảm xúc
希望|きぼう|kibou|hy vọng; nguyện vọng|danh từ; động từ suru|N3|Cảm xúc
自信|じしん|jishin|tự tin|danh từ|N3|Cảm xúc
満足|まんぞく|manzoku|hài lòng|danh từ; động từ suru|N3|Cảm xúc
不安|ふあん|fuan|bất an|danh từ; tính từ na|N3|Cảm xúc
印象|いんしょう|inshou|ấn tượng|danh từ|N3|Cảm xúc
起きる|おきる|okiru|thức dậy; xảy ra|động từ nhóm 2|N5|Động từ
寝る|ねる|neru|ngủ|động từ nhóm 2|N5|Động từ
話す|はなす|hanasu|nói chuyện|động từ nhóm 1|N5|Động từ
聞く|きく|kiku|nghe; hỏi|động từ nhóm 1|N5|Động từ
読む|よむ|yomu|đọc|động từ nhóm 1|N5|Động từ
書く|かく|kaku|viết|động từ nhóm 1|N5|Động từ
買う|かう|kau|mua|động từ nhóm 1|N5|Động từ
売る|うる|uru|bán|động từ nhóm 1|N4|Động từ
作る|つくる|tsukuru|làm; chế tạo|động từ nhóm 1|N5|Động từ
使う|つかう|tsukau|sử dụng|động từ nhóm 1|N5|Động từ
待つ|まつ|matsu|chờ đợi|động từ nhóm 1|N5|Động từ
持つ|もつ|motsu|cầm; sở hữu|động từ nhóm 1|N5|Động từ
立つ|たつ|tatsu|đứng|động từ nhóm 1|N5|Động từ
座る|すわる|suwaru|ngồi|động từ nhóm 1|N5|Động từ
歩く|あるく|aruku|đi bộ|động từ nhóm 1|N5|Động từ
走る|はしる|hashiru|chạy|động từ nhóm 1|N4|Động từ
入る|はいる|hairu|đi vào|động từ nhóm 1|N5|Động từ
出る|でる|deru|đi ra; xuất hiện|động từ nhóm 2|N5|Động từ
開ける|あける|akeru|mở|động từ nhóm 2|N5|Động từ
閉める|しめる|shimeru|đóng|động từ nhóm 2|N5|Động từ
始める|はじめる|hajimeru|bắt đầu|động từ nhóm 2|N4|Động từ
終わる|おわる|owaru|kết thúc|động từ nhóm 1|N5|Động từ
教える|おしえる|oshieru|dạy; chỉ bảo|động từ nhóm 2|N5|Động từ
覚える|おぼえる|oboeru|ghi nhớ|động từ nhóm 2|N4|Động từ
忘れる|わすれる|wasureru|quên|động từ nhóm 2|N4|Động từ
考える|かんがえる|kangaeru|suy nghĩ|động từ nhóm 2|N4|Động từ
決める|きめる|kimeru|quyết định|động từ nhóm 2|N3|Động từ
選ぶ|えらぶ|erabu|lựa chọn|động từ nhóm 1|N3|Động từ
変える|かえる|kaeru|thay đổi|động từ nhóm 2|N3|Động từ
調べる|しらべる|shiraberu|tra cứu; điều tra|động từ nhóm 2|N4|Động từ
情報|じょうほう|jouhou|thông tin|danh từ|N3|Công nghệ
技術|ぎじゅつ|gijutsu|kỹ thuật; công nghệ|danh từ|N3|Công nghệ
機械|きかい|kikai|máy móc|danh từ|N3|Công nghệ
画面|がめん|gamen|màn hình|danh từ|N3|Công nghệ
画像|がぞう|gazou|hình ảnh|danh từ|N3|Công nghệ
動画|どうが|douga|video|danh từ|N3|Công nghệ
音声|おんせい|onsei|âm thanh; giọng nói|danh từ|N2|Công nghệ
入力|にゅうりょく|nyuuryoku|nhập dữ liệu|danh từ; động từ suru|N2|Công nghệ
出力|しゅつりょく|shutsuryoku|xuất dữ liệu|danh từ; động từ suru|N2|Công nghệ
保存|ほぞん|hozon|lưu trữ; bảo quản|danh từ; động từ suru|N3|Công nghệ
削除|さくじょ|sakujo|xóa bỏ|danh từ; động từ suru|N2|Công nghệ
接続|せつぞく|setsuzoku|kết nối|danh từ; động từ suru|N2|Công nghệ
通信|つうしん|tsuushin|truyền thông; liên lạc|danh từ|N2|Công nghệ
設定|せってい|settei|thiết lập|danh từ; động từ suru|N2|Công nghệ
更新|こうしん|koushin|cập nhật; gia hạn|danh từ; động từ suru|N2|Công nghệ
開発|かいはつ|kaihatsu|phát triển|danh từ; động từ suru|N2|Công nghệ
処理|しょり|shori|xử lý|danh từ; động từ suru|N2|Công nghệ
機能|きのう|kinou|chức năng|danh từ|N2|Công nghệ
人工知能|じんこうちのう|jinkou chinou|trí tuệ nhân tạo|danh từ|N1|Công nghệ
自動化|じどうか|jidouka|tự động hóa|danh từ; động từ suru|N1|Công nghệ
社会|しゃかい|shakai|xã hội|danh từ|N3|Xã hội
文化|ぶんか|bunka|văn hóa|danh từ|N3|Xã hội
経済|けいざい|keizai|kinh tế|danh từ|N3|Xã hội
政治|せいじ|seiji|chính trị|danh từ|N2|Xã hội
法律|ほうりつ|houritsu|pháp luật|danh từ|N2|Xã hội
制度|せいど|seido|chế độ; hệ thống|danh từ|N2|Xã hội
地域|ちいき|chiiki|khu vực; địa phương|danh từ|N3|Xã hội
人口|じんこう|jinkou|dân số|danh từ|N3|Xã hội
国際|こくさい|kokusai|quốc tế|danh từ|N3|Xã hội
交流|こうりゅう|kouryuu|giao lưu; trao đổi|danh từ; động từ suru|N2|Xã hội
課題|かだい|kadai|nhiệm vụ; vấn đề cần giải quyết|danh từ|N2|Xã hội
対策|たいさく|taisaku|biện pháp đối phó|danh từ|N2|Xã hội
現象|げんしょう|genshou|hiện tượng|danh từ|N2|Xã hội
価値|かち|kachi|giá trị|danh từ|N2|Xã hội
意識|いしき|ishiki|ý thức; nhận thức|danh từ|N2|Xã hội
立場|たちば|tachiba|lập trường; vị trí|danh từ|N2|Xã hội
権利|けんり|kenri|quyền lợi|danh từ|N2|Xã hội
義務|ぎむ|gimu|nghĩa vụ|danh từ|N2|Xã hội
格差|かくさ|kakusa|chênh lệch; khoảng cách|danh từ|N1|Xã hội
持続可能|じぞくかのう|jizoku kanou|bền vững; có thể duy trì|tính từ na|N1|Xã hội
分析|ぶんせき|bunseki|phân tích|danh từ; động từ suru|N2|Học thuật
比較|ひかく|hikaku|so sánh|danh từ; động từ suru|N3|Học thuật
評価|ひょうか|hyouka|đánh giá|danh từ; động từ suru|N2|Học thuật
判断|はんだん|handan|phán đoán|danh từ; động từ suru|N3|Học thuật
証明|しょうめい|shoumei|chứng minh; giấy chứng nhận|danh từ; động từ suru|N2|Học thuật
仮説|かせつ|kasetsu|giả thuyết|danh từ|N1|Học thuật
根拠|こんきょ|konkyo|căn cứ; cơ sở|danh từ|N1|Học thuật
論文|ろんぶん|ronbun|luận văn; bài nghiên cứu|danh từ|N2|Học thuật
資料|しりょう|shiryou|tài liệu; dữ liệu tham khảo|danh từ|N3|Học thuật
統計|とうけい|toukei|thống kê|danh từ|N2|Học thuật
調査|ちょうさ|chousa|khảo sát; điều tra|danh từ; động từ suru|N2|Học thuật
結果|けっか|kekka|kết quả|danh từ|N3|Học thuật
原因|げんいん|genin|nguyên nhân|danh từ|N3|Học thuật
目的|もくてき|mokuteki|mục đích|danh từ|N3|Học thuật
方法|ほうほう|houhou|phương pháp|danh từ|N3|Học thuật
具体的|ぐたいてき|gutaiteki|cụ thể|tính từ na|N2|Học thuật
客観的|きゃっかんてき|kyakkanteki|khách quan|tính từ na|N1|Học thuật
主観的|しゅかんてき|shukanteki|chủ quan|tính từ na|N1|Học thuật
論理|ろんり|ronri|logic; lý luận|danh từ|N1|Học thuật
結論|けつろん|ketsuron|kết luận|danh từ|N2|Học thuật
改善|かいぜん|kaizen|cải thiện|danh từ; động từ suru|N2|Nâng cao
達成|たっせい|tassei|đạt được; hoàn thành|danh từ; động từ suru|N2|Nâng cao
適応|てきおう|tekiou|thích nghi|danh từ; động từ suru|N1|Nâng cao
貢献|こうけん|kouken|cống hiến; đóng góp|danh từ; động từ suru|N1|Nâng cao
確保|かくほ|kakuho|đảm bảo; giữ được|danh từ; động từ suru|N1|Nâng cao
検討|けんとう|kentou|xem xét; nghiên cứu|danh từ; động từ suru|N2|Nâng cao
把握|はあく|haaku|nắm bắt; hiểu rõ|danh từ; động từ suru|N1|Nâng cao
配慮|はいりょ|hairyo|quan tâm; cân nhắc|danh từ; động từ suru|N1|Nâng cao
尊重|そんちょう|sonchou|tôn trọng|danh từ; động từ suru|N2|Nâng cao
認識|にんしき|ninshiki|nhận thức; công nhận|danh từ; động từ suru|N2|Nâng cao
対応|たいおう|taiou|ứng phó; tương ứng|danh từ; động từ suru|N2|Nâng cao
予測|よそく|yosoku|dự đoán|danh từ; động từ suru|N2|Nâng cao
実現|じつげん|jitsugen|hiện thực hóa|danh từ; động từ suru|N2|Nâng cao
変化|へんか|henka|thay đổi; biến hóa|danh từ; động từ suru|N3|Nâng cao
拡大|かくだい|kakudai|mở rộng|danh từ; động từ suru|N2|Nâng cao
縮小|しゅくしょう|shukushou|thu nhỏ; cắt giảm|danh từ; động từ suru|N2|Nâng cao
防止|ぼうし|boushi|phòng ngừa|danh từ; động từ suru|N2|Nâng cao
促す|うながす|unagasu|thúc đẩy; khuyến khích|động từ nhóm 1|N1|Nâng cao
伴う|ともなう|tomonau|đi kèm; kéo theo|động từ nhóm 1|N1|Nâng cao
取り組む|とりくむ|torikumu|nỗ lực giải quyết|động từ nhóm 1|N1|Nâng cao
`;

  const words = raw.trim().split("\n").map((line, index) => {
    const [word, kana, romaji, meaning, pos, level, topic] = line.split("|");
    return Object.freeze({
      id: `pack-${index + 1}`,
      word,
      kana,
      romaji,
      meaning,
      pos,
      level,
      topic,
      example: "",
      exampleVi: "",
      source: "HH Japanese thematic pack"
    });
  });
  const topics = [...new Set(words.map((item) => item.topic))];

  globalThis.HHJapaneseVocabularyPacks = Object.freeze({ version: 1, words: Object.freeze(words), topics: Object.freeze(topics) });
})();
