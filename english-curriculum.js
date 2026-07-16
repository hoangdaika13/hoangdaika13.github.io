(() => {
  "use strict";

  const vocabulary = (...items) => items;
  const lesson = (title, canDo, focus, text, check) => ({ title, canDo, focus, text, check });
  const unit = (id, title, vi, primarySkill, words, lessons) => ({ id, title, vi, primarySkill, vocabulary: words, lessons });

  const rawLevels = [
    {
      id: "A1", name: "Cơ bản", band: "Basic User", color: "#63e8ff",
      description: "Giao tiếp bằng câu ngắn về bản thân, sinh hoạt và những nhu cầu quen thuộc.",
      canDo: "Hiểu và sử dụng các diễn đạt quen thuộc, giới thiệu bản thân và trao đổi thông tin cá nhân đơn giản.",
      writing: { title: "My weekly routine", description: "Viết 60–80 từ về lịch học hoặc lịch làm việc trong một tuần.", hints: ["I usually…", "On Monday…", "After class…", "At the weekend…"] },
      speaking: { phrase: "I usually study in the library after class, but today I am studying at home.", ipa: "/aɪ ˈjuːʒuəli ˈstʌdi ɪn ðə ˈlaɪbreri ˈæftər klæs/" },
      units: [
        unit("daily-routines", "Daily routines & time", "Sinh hoạt và thời gian", "speaking", vocabulary(
          ["wake up", "/weɪk ʌp/", "thức dậy", "I wake up at six thirty."],
          ["breakfast", "/ˈbrekfəst/", "bữa sáng", "We have breakfast before school."],
          ["commute", "/kəˈmjuːt/", "đi lại hằng ngày", "My commute takes twenty minutes."],
          ["usually", "/ˈjuːʒuəli/", "thường xuyên", "I usually walk to class."],
          ["before", "/bɪˈfɔːr/", "trước khi", "Wash your hands before lunch."],
          ["after", "/ˈæftər/", "sau khi", "We talk after the lesson."],
          ["weekday", "/ˈwiːkdeɪ/", "ngày trong tuần", "I study on weekdays."],
          ["schedule", "/ˈskedʒuːl/", "lịch trình", "My schedule is busy today."]
        ), [
          lesson("A typical weekday", "Mô tả một ngày học hoặc làm việc bằng hiện tại đơn.", "Dùng hiện tại đơn cho thói quen: I study; she studies.", "Linh: What time do you wake up?\nMinh: I wake up at six. I have breakfast and leave home at seven.\nLinh: Do you walk to school?\nMinh: No, I take the bus.", { prompt: "Which sentence describes a routine?", options: ["I take the bus every weekday.", "I am taking the bus now.", "I took the bus yesterday."], answer: "I take the bus every weekday.", explanation: "Hiện tại đơn diễn tả thói quen lặp lại." }),
          lesson("Ask about routines", "Hỏi và trả lời về thói quen của người khác.", "Dùng do/does trong câu hỏi: Do you…? Does she…?", "Nam: Does your sister study in the evening?\nHoa: Yes, she does. She usually starts at eight.\nNam: What does she study?\nHoa: English and maths.", { prompt: "Complete the question: ___ he commute by train?", options: ["Does", "Do", "Is"], answer: "Does", explanation: "Chủ ngữ he đi với trợ động từ does." }),
          lesson("Time and frequency", "Nói thời điểm và mức độ thường xuyên của hoạt động.", "Đặt usually/often trước động từ thường nhưng sau động từ be.", "My weekday schedule is simple. I am usually at school before eight. I often review vocabulary after lunch, and I sometimes practise speaking with a friend in the evening.", { prompt: "Where does usually go in: She ___ studies after dinner?", options: ["usually", "is usually", "does usually"], answer: "usually", explanation: "Với động từ thường studies, trạng từ tần suất đứng trước động từ." })
        ]),
        unit("food-shopping", "Food, cafés & shopping", "Ăn uống và mua sắm", "listening", vocabulary(
          ["menu", "/ˈmenjuː/", "thực đơn", "Could I see the menu?"],
          ["order", "/ˈɔːrdər/", "gọi món; đơn hàng", "I would like to order soup."],
          ["bill", "/bɪl/", "hóa đơn", "Can we have the bill, please?"],
          ["ingredient", "/ɪnˈɡriːdiənt/", "nguyên liệu", "Rice is the main ingredient."],
          ["hungry", "/ˈhʌŋɡri/", "đói", "I am hungry after class."],
          ["portion", "/ˈpɔːrʃn/", "khẩu phần", "This portion is quite large."],
          ["change", "/tʃeɪndʒ/", "tiền thừa", "Here is your change."],
          ["receipt", "/rɪˈsiːt/", "biên lai", "Please keep the receipt."]
        ), [
          lesson("Read a simple menu", "Hiểu tên món, giá và thông tin cơ bản trên thực đơn.", "Dùng some với danh từ không đếm được và a/an với món đếm được.", "Today's lunch menu has a chicken sandwich, vegetable soup and some fruit. The soup is three dollars, and the sandwich is five dollars. Water is free.", { prompt: "How much is the sandwich?", options: ["Five dollars", "Three dollars", "Free"], answer: "Five dollars", explanation: "Bài đọc ghi rõ the sandwich is five dollars." }),
          lesson("Order politely", "Gọi món và đưa ra yêu cầu lịch sự ở quán ăn.", "Dùng I would like… và Could I have… thay cho mệnh lệnh trực tiếp.", "Server: Are you ready to order?\nMai: Yes. I would like the vegetable soup, please.\nServer: Would you like bread with that?\nMai: Yes, please. Could I also have some water?", { prompt: "Which request is the most polite?", options: ["Could I have some water, please?", "Give me water.", "Water now."], answer: "Could I have some water, please?", explanation: "Could I have… please? là mẫu yêu cầu lịch sự." }),
          lesson("Pay and check the bill", "Hỏi giá, thanh toán và kiểm tra hóa đơn đơn giản.", "Dùng How much is…? cho một món và How much are…? cho nhiều món.", "Cashier: Your total is twelve dollars.\nBen: Here is twenty. Can I have a receipt, please?\nCashier: Of course. Here is your change and receipt.", { prompt: "What does the cashier give Ben?", options: ["Change and a receipt", "A new menu", "Another meal"], answer: "Change and a receipt", explanation: "Dòng cuối nói rõ change and receipt." })
        ]),
        unit("places-directions", "Places & directions", "Địa điểm và chỉ đường", "reading", vocabulary(
          ["corner", "/ˈkɔːrnər/", "góc đường", "The café is on the corner."],
          ["opposite", "/ˈɑːpəzɪt/", "đối diện", "The bank is opposite the park."],
          ["crossroads", "/ˈkrɔːsroʊdz/", "ngã tư", "Turn left at the crossroads."],
          ["pharmacy", "/ˈfɑːrməsi/", "nhà thuốc", "There is a pharmacy nearby."],
          ["station", "/ˈsteɪʃn/", "nhà ga", "The station is two blocks away."],
          ["turn", "/tɜːrn/", "rẽ", "Turn right after the bridge."],
          ["straight", "/streɪt/", "thẳng", "Go straight for five minutes."],
          ["nearby", "/ˌnɪrˈbaɪ/", "gần đây", "Is there a supermarket nearby?"]
        ), [
          lesson("Places in town", "Mô tả vị trí các địa điểm quen thuộc.", "Dùng there is/there are để nói nơi chốn tồn tại.", "There is a small library next to the station. There are two cafés opposite the library, and there is a pharmacy on the corner.", { prompt: "What is next to the station?", options: ["A library", "A pharmacy", "Two cafés"], answer: "A library", explanation: "Câu đầu cho biết a small library next to the station." }),
          lesson("Give directions", "Chỉ đường bằng các mệnh lệnh ngắn, rõ ràng.", "Dùng go, turn, cross ở dạng nguyên mẫu trong câu mệnh lệnh.", "Go straight for two blocks. Turn left at the crossroads and walk past the bank. The museum is on your right, opposite the park.", { prompt: "What should the listener do at the crossroads?", options: ["Turn left", "Turn right", "Stop at the bank"], answer: "Turn left", explanation: "Chỉ dẫn nói Turn left at the crossroads." }),
          lesson("Ask for help", "Hỏi đường lịch sự và xác nhận mình đã hiểu.", "Mở đầu bằng Excuse me và xác nhận bằng So I… right?", "Visitor: Excuse me, is there a pharmacy nearby?\nLocal: Yes. Go straight and turn right after the café.\nVisitor: So I turn right after the café?\nLocal: That's right.", { prompt: "Why does the visitor repeat the direction?", options: ["To confirm understanding", "To change the destination", "To order coffee"], answer: "To confirm understanding", explanation: "Lặp lại ý chính giúp xác nhận chỉ dẫn." })
        ])
      ]
    },
    {
      id: "A2", name: "Sơ trung cấp", band: "Basic User", color: "#80f4b4",
      description: "Xử lý các tình huống quen thuộc, kể trải nghiệm và trao đổi thông tin trực tiếp.",
      canDo: "Trao đổi đơn giản trong các tình huống thường gặp và mô tả quá khứ, kế hoạch, nhu cầu trước mắt.",
      writing: { title: "A memorable trip", description: "Viết 90–120 từ kể lại một chuyến đi hoặc trải nghiệm đáng nhớ.", hints: ["Last year…", "While we were…", "The best part was…", "I learned that…"] },
      speaking: { phrase: "I have visited Hội An twice, and I am planning to return there next summer.", ipa: "/aɪ hæv ˈvɪzɪtɪd hɔɪ æn twaɪs/" },
      units: [
        unit("past-experiences", "Past experiences", "Trải nghiệm trong quá khứ", "speaking", vocabulary(
          ["experience", "/ɪkˈspɪriəns/", "trải nghiệm", "It was an exciting experience."],
          ["journey", "/ˈdʒɜːrni/", "hành trình", "The journey took four hours."],
          ["arrive", "/əˈraɪv/", "đến nơi", "We arrived before sunset."],
          ["miss", "/mɪs/", "lỡ; nhớ", "I missed the last bus."],
          ["visit", "/ˈvɪzɪt/", "thăm", "They visited the old town."],
          ["memorable", "/ˈmemərəbl/", "đáng nhớ", "The meal was memorable."],
          ["suddenly", "/ˈsʌdənli/", "đột nhiên", "It suddenly started to rain."],
          ["while", "/waɪl/", "trong khi", "I read while I was waiting."]
        ), [
          lesson("Tell a past story", "Kể một chuỗi sự kiện đã kết thúc trong quá khứ.", "Dùng quá khứ đơn cho các sự kiện nối tiếp: arrived, visited, returned.", "Last Saturday, I visited Ninh Bình with my classmates. We arrived early, rented bicycles and explored a quiet village. We returned home after sunset.", { prompt: "Which event happened first?", options: ["They arrived early.", "They rented bicycles.", "They returned home."], answer: "They arrived early.", explanation: "Trình tự bài đọc bắt đầu bằng arrived early." }),
          lesson("Share life experiences", "Nói về trải nghiệm mà không nêu thời điểm cụ thể.", "Dùng hiện tại hoàn thành have/has + past participle cho trải nghiệm.", "Anna: Have you ever missed a flight?\nHuy: No, I haven't, but I have missed a train.\nAnna: When did that happen?\nHuy: It happened last winter.", { prompt: "Why is present perfect used in the first question?", options: ["It asks about experience at any time.", "It describes a fixed future plan.", "It gives a daily routine."], answer: "It asks about experience at any time.", explanation: "Have you ever… hỏi trải nghiệm không gắn thời điểm cụ thể." }),
          lesson("Set the scene", "Kết hợp hành động đang diễn ra và sự kiện xen vào.", "Dùng past continuous cho bối cảnh và past simple cho sự kiện ngắn xen vào.", "We were walking beside the river when the weather suddenly changed. While everyone was looking for shelter, a shop owner invited us inside.", { prompt: "What was happening when the weather changed?", options: ["They were walking beside the river.", "They were travelling home.", "They were eating dinner."], answer: "They were walking beside the river.", explanation: "Past continuous were walking tạo bối cảnh cho sự kiện changed." })
        ]),
        unit("plans-travel", "Plans & travel", "Kế hoạch và du lịch", "listening", vocabulary(
          ["reservation", "/ˌrezərˈveɪʃn/", "đặt chỗ", "I confirmed the reservation."],
          ["itinerary", "/aɪˈtɪnəreri/", "lịch trình chuyến đi", "Our itinerary includes Huế."],
          ["departure", "/dɪˈpɑːrtʃər/", "khởi hành", "Departure is at nine."],
          ["accommodation", "/əˌkɑːməˈdeɪʃn/", "chỗ ở", "The accommodation is near the beach."],
          ["luggage", "/ˈlʌɡɪdʒ/", "hành lý", "My luggage is quite heavy."],
          ["available", "/əˈveɪləbl/", "còn trống; có sẵn", "Is this room available?"],
          ["postpone", "/poʊstˈpoʊn/", "hoãn", "We may postpone the trip."],
          ["destination", "/ˌdestɪˈneɪʃn/", "điểm đến", "Đà Lạt is our destination."]
        ), [
          lesson("Make a travel plan", "Nói kế hoạch đã có chủ ý từ trước.", "Dùng be going to cho dự định: We are going to travel.", "We are going to spend three days in Đà Lạt. We are going to visit a flower garden on Friday and walk around the lake on Saturday.", { prompt: "What are they going to do on Saturday?", options: ["Walk around the lake", "Visit a flower garden", "Return home"], answer: "Walk around the lake", explanation: "Bài đọc ghi hoạt động Saturday là walk around the lake." }),
          lesson("Arrange the details", "Nói về lịch hẹn và sắp xếp đã xác nhận.", "Dùng hiện tại tiếp diễn cho sắp xếp tương lai đã chốt.", "Linh: I'm meeting the travel group at seven tomorrow.\nBao: Are you taking the early train?\nLinh: Yes. We're leaving at seven thirty.", { prompt: "Which plan is already arranged?", options: ["They are leaving at seven thirty.", "They might travel someday.", "They often take trains."], answer: "They are leaving at seven thirty.", explanation: "Present continuous mô tả sắp xếp tương lai đã xác nhận." }),
          lesson("Handle a change", "Phản ứng với thay đổi và đưa ra quyết định ngay lúc nói.", "Dùng will cho quyết định tức thời, lời hứa và dự đoán.", "Agent: The morning flight is full.\nMai: Then I'll take the afternoon flight.\nAgent: A seat is available at three.\nMai: Great. I'll update my itinerary.", { prompt: "When does Mai decide to take the afternoon flight?", options: ["During the conversation", "Several months earlier", "After the flight lands"], answer: "During the conversation", explanation: "I'll take thể hiện quyết định ngay tại thời điểm nói." })
        ]),
        unit("health-problems", "Health & everyday problems", "Sức khỏe và vấn đề thường ngày", "reading", vocabulary(
          ["appointment", "/əˈpɔɪntmənt/", "cuộc hẹn", "I made a doctor's appointment."],
          ["symptom", "/ˈsɪmptəm/", "triệu chứng", "Describe each symptom clearly."],
          ["recover", "/rɪˈkʌvər/", "hồi phục", "She recovered after a week."],
          ["prescription", "/prɪˈskrɪpʃn/", "đơn thuốc", "The doctor wrote a prescription."],
          ["sore", "/sɔːr/", "đau rát", "I have a sore throat."],
          ["advice", "/ədˈvaɪs/", "lời khuyên", "Thank you for your advice."],
          ["rest", "/rest/", "nghỉ ngơi", "You need more rest."],
          ["emergency", "/ɪˈmɜːrdʒənsi/", "tình huống khẩn cấp", "Call for help in an emergency."]
        ), [
          lesson("Describe symptoms", "Mô tả triệu chứng và thời gian bị bệnh.", "Dùng have/has got hoặc have/has để nói triệu chứng.", "Doctor: What seems to be the problem?\nTuan: I have a sore throat and a headache.\nDoctor: How long have you had them?\nTuan: Since yesterday morning.", { prompt: "Which symptom does Tuan mention?", options: ["A sore throat", "A broken arm", "A painful knee"], answer: "A sore throat", explanation: "Tuan trực tiếp nói I have a sore throat." }),
          lesson("Give sensible advice", "Đưa ra lời khuyên và nói điều bắt buộc.", "Dùng should cho lời khuyên; must/mustn't cho yêu cầu mạnh.", "You should drink warm water and get plenty of rest. You must follow the prescription, and you mustn't take more medicine than the doctor recommends.", { prompt: "Which sentence is advice rather than a strict rule?", options: ["You should drink warm water.", "You must follow the prescription.", "You mustn't take extra medicine."], answer: "You should drink warm water.", explanation: "Should diễn tả lời khuyên; must/mustn't mạnh hơn." }),
          lesson("Explain cause and result", "Nói điều có thể xảy ra nếu một điều kiện được đáp ứng.", "Dùng first conditional: If + present simple, will + verb.", "If you rest today, you will probably feel better tomorrow. If the symptoms continue, you will need another appointment.", { prompt: "What will happen if the symptoms continue?", options: ["Another appointment will be needed.", "The prescription will disappear.", "No action will be possible."], answer: "Another appointment will be needed.", explanation: "Mệnh đề kết quả nói you will need another appointment." })
        ])
      ]
    },
    {
      id: "B1", name: "Trung cấp", band: "Independent User", color: "#ffe66d",
      description: "Hiểu ý chính của ngôn ngữ chuẩn, xử lý phần lớn tình huống và trình bày ý kiến có liên kết.",
      canDo: "Giao tiếp trong học tập, công việc và du lịch; kể trải nghiệm và giải thích ngắn gọn quan điểm, kế hoạch.",
      writing: { title: "A change worth making", description: "Viết 140–170 từ đề xuất một thay đổi cho trường học, nơi làm việc hoặc cộng đồng.", hints: ["The current situation…", "I suggest that…", "One benefit would be…", "For this reason…"] },
      speaking: { phrase: "Although the deadline was demanding, our team managed to submit a clear and reliable report.", ipa: "/ɔːlˈðoʊ ðə ˈdedlaɪn wəz dɪˈmændɪŋ/" },
      units: [
        unit("study-work", "Study & work", "Học tập và công việc", "writing", vocabulary(
          ["deadline", "/ˈdedlaɪn/", "hạn chót", "The deadline is next Friday."],
          ["assignment", "/əˈsaɪnmənt/", "bài tập", "I submitted the assignment online."],
          ["feedback", "/ˈfiːdbæk/", "phản hồi", "Her feedback was practical."],
          ["colleague", "/ˈkɑːliːɡ/", "đồng nghiệp", "A colleague helped me."],
          ["responsibility", "/rɪˌspɑːnsəˈbɪləti/", "trách nhiệm", "This task is my responsibility."],
          ["apply", "/əˈplaɪ/", "ứng tuyển; áp dụng", "He applied for an internship."],
          ["improve", "/ɪmˈpruːv/", "cải thiện", "Practice will improve your writing."],
          ["manage", "/ˈmænɪdʒ/", "xoay xở; quản lý", "We managed to finish on time."]
        ), [
          lesson("Review your progress", "So sánh trải nghiệm đã hoàn thành với sự kiện có thời điểm rõ.", "Phân biệt present perfect và past simple theo mốc thời gian.", "I have completed three assignments this term. I submitted the latest one on Monday, and my teacher has already sent detailed feedback.", { prompt: "Why is submitted in the past simple?", options: ["Monday is a finished time reference.", "The action happens every day.", "The action is only planned."], answer: "Monday is a finished time reference.", explanation: "Past simple đi với thời điểm quá khứ đã kết thúc như on Monday." }),
          lesson("Describe people and roles", "Bổ sung thông tin về người, vật và vai trò trong một câu.", "Dùng relative clauses với who, which và that.", "Our project leader is the colleague who organises weekly meetings. The shared document that we use contains every deadline and responsibility.", { prompt: "Which word refers to a person?", options: ["who", "which", "where"], answer: "who", explanation: "Who thay thế cho danh từ chỉ người." }),
          lesson("Discuss study strategies", "Nói hoạt động mình thích, cần hoặc dự định thực hiện.", "Một số động từ đi với gerund; một số đi với to-infinitive.", "Lan enjoys reviewing vocabulary in short sessions, but she plans to spend more time writing. She avoids studying too late because she needs to sleep well.", { prompt: "Which pattern is correct after enjoy?", options: ["enjoy reviewing", "enjoy to review", "enjoy review"], answer: "enjoy reviewing", explanation: "Enjoy được theo sau bởi gerund -ing." })
        ]),
        unit("stories-media", "Stories & media", "Câu chuyện và truyền thông", "reading", vocabulary(
          ["headline", "/ˈhedlaɪn/", "tiêu đề tin", "The headline caught my attention."],
          ["source", "/sɔːrs/", "nguồn tin", "Check the original source."],
          ["plot", "/plɑːt/", "cốt truyện", "The plot becomes more complex."],
          ["character", "/ˈkærəktər/", "nhân vật", "The main character changes."],
          ["broadcast", "/ˈbrɔːdkæst/", "chương trình phát sóng", "The broadcast starts at six."],
          ["reliable", "/rɪˈlaɪəbl/", "đáng tin cậy", "Use a reliable news source."],
          ["review", "/rɪˈvjuː/", "bài đánh giá", "She wrote a film review."],
          ["audience", "/ˈɔːdiəns/", "khán giả", "The audience asked questions."]
        ), [
          lesson("Report what people said", "Thuật lại phát biểu mà không lặp nguyên văn.", "Dùng reported speech và lùi thì khi ngữ cảnh yêu cầu.", "The presenter said that the broadcast would begin later. She explained that the team was checking a new source before sharing the story.", { prompt: "Direct speech was probably: The broadcast ___ begin later.", options: ["will", "would", "has"], answer: "will", explanation: "Trong lời tường thuật quá khứ, will thường lùi thành would." }),
          lesson("Build a clear narrative", "Kể chuyện với bối cảnh, sự kiện chính và sự kiện xảy ra trước đó.", "Kết hợp past simple, past continuous và past perfect.", "The audience was waiting when the lights went out. The technician discovered that a cable had come loose, fixed it quickly and restarted the show.", { prompt: "Which event happened before the discovery?", options: ["A cable had come loose.", "The show restarted.", "The technician fixed the cable."], answer: "A cable had come loose.", explanation: "Past perfect had come loose chỉ sự kiện xảy ra trước một mốc quá khứ khác." }),
          lesson("Focus on information", "Viết câu bị động khi hành động hoặc kết quả quan trọng hơn người làm.", "Dùng be + past participle trong câu bị động.", "The article was published on Tuesday. Its main claims were checked by two editors, and the original sources were linked below the text.", { prompt: "Why is passive voice useful here?", options: ["The process and result are the focus.", "The writer wants to describe a habit.", "The sentence is a direct command."], answer: "The process and result are the focus.", explanation: "Câu bị động nhấn vào article, claims và sources thay vì người thực hiện." })
        ]),
        unit("opinions-solutions", "Opinions & solutions", "Quan điểm và giải pháp", "speaking", vocabulary(
          ["evidence", "/ˈevɪdəns/", "bằng chứng", "The evidence supports the idea."],
          ["solution", "/səˈluːʃn/", "giải pháp", "We need a practical solution."],
          ["consequence", "/ˈkɑːnsəkwens/", "hệ quả", "Consider each consequence."],
          ["suggest", "/səˈdʒest/", "đề xuất", "I suggest a shorter meeting."],
          ["benefit", "/ˈbenɪfɪt/", "lợi ích", "One benefit is lower cost."],
          ["drawback", "/ˈdrɔːbæk/", "hạn chế", "The main drawback is time."],
          ["persuade", "/pərˈsweɪd/", "thuyết phục", "Facts can persuade an audience."],
          ["compromise", "/ˈkɑːmprəmaɪz/", "thỏa hiệp", "Both sides accepted a compromise."]
        ), [
          lesson("Explain an opinion", "Nêu quan điểm và hỗ trợ bằng lý do, ví dụ.", "Dùng because, therefore, for example và in my view để nối ý.", "In my view, students should have more quiet study areas because many shared spaces are noisy. For example, the library is often full after lunch. Therefore, an unused classroom could become a study room.", { prompt: "What supports the writer's opinion?", options: ["A reason and an example", "Only a personal name", "A list without explanation"], answer: "A reason and an example", explanation: "Đoạn văn dùng because để nêu lý do và for example để minh họa." }),
          lesson("Consider possibilities", "Thảo luận kết quả có thể có trong hiện tại và tương lai.", "Dùng first và second conditional theo mức độ thực tế.", "If the school opens another study room, more students will use it. If we had a larger budget, we could also improve the lighting and furniture.", { prompt: "Which idea is less certain or hypothetical?", options: ["Improving lighting with a larger budget", "Opening the room after approval", "Students using an open room"], answer: "Improving lighting with a larger budget", explanation: "Second conditional If we had… could… diễn tả tình huống giả định." }),
          lesson("Reach a compromise", "Đồng ý, phản đối lịch sự và đề xuất phương án dung hòa.", "Dùng I see your point, however… và What if we…? để thương lượng.", "An: We should keep the room open until ten.\nMai: I see your point. However, that may cost too much.\nAn: What if we keep it open late only during exams?\nMai: That sounds like a fair compromise.", { prompt: "What compromise do they reach?", options: ["Open late only during exams", "Close the room permanently", "Open every night until midnight"], answer: "Open late only during exams", explanation: "Phương án dung hòa xuất hiện trong câu What if…" })
        ])
      ]
    },
    {
      id: "B2", name: "Trên trung cấp", band: "Independent User", color: "#ff9f68",
      description: "Hiểu văn bản phức tạp, tương tác khá trôi chảy và trình bày lập luận chi tiết.",
      canDo: "Tham gia thảo luận chuyên sâu, đọc ý tưởng trừu tượng và viết văn bản rõ ràng với ưu nhược điểm.",
      writing: { title: "Evaluate two possible solutions", description: "Viết 190–220 từ so sánh hai giải pháp và đưa ra kết luận có căn cứ.", hints: ["While both options…", "A significant advantage…", "Nevertheless…", "On balance…"] },
      speaking: { phrase: "While the proposal is ambitious, the available evidence suggests that a phased approach would be more sustainable.", ipa: "/waɪl ðə prəˈpoʊzl ɪz æmˈbɪʃəs/" },
      units: [
        unit("debate-evidence", "Debate & evidence", "Tranh luận và bằng chứng", "speaking", vocabulary(
          ["claim", "/kleɪm/", "luận điểm", "The report makes a strong claim."],
          ["counterargument", "/ˈkaʊntərˌɑːrɡjəmənt/", "phản biện", "Address the counterargument fairly."],
          ["bias", "/ˈbaɪəs/", "thiên kiến", "The sample may contain bias."],
          ["credible", "/ˈkredəbl/", "đáng tin", "Is the source credible?"],
          ["assumption", "/əˈsʌmpʃn/", "giả định", "Question the main assumption."],
          ["justify", "/ˈdʒʌstɪfaɪ/", "biện minh; chứng minh hợp lý", "Use data to justify the decision."],
          ["perspective", "/pərˈspektɪv/", "góc nhìn", "Consider another perspective."],
          ["rebuttal", "/rɪˈbʌtl/", "lời bác bỏ", "Her rebuttal was concise."]
        ), [
          lesson("Separate claim from evidence", "Xác định luận điểm, bằng chứng và giả định trong một lập luận.", "Dùng reporting verbs như suggest, demonstrate, claim với mức độ chắc chắn khác nhau.", "The survey suggests that flexible classes may improve attendance. However, the sample included only sixty students, so the evidence does not demonstrate that the policy will work everywhere.", { prompt: "What limits the strength of the evidence?", options: ["The small sample", "The flexible schedule", "The use of the word survey"], answer: "The small sample", explanation: "Chỉ 60 người tham gia nên khó khái quát rộng." }),
          lesson("Acknowledge another view", "Trình bày phản biện trước khi bảo vệ quan điểm.", "Dùng although, while, admittedly và nevertheless để nhượng bộ.", "Admittedly, online classes offer greater flexibility. Nevertheless, face-to-face discussion may provide richer feedback, particularly when students are learning to debate complex ideas.", { prompt: "What is the writer's final position?", options: ["Face-to-face discussion has an important benefit.", "Online learning has no value.", "All classes should be cancelled."], answer: "Face-to-face discussion has an important benefit.", explanation: "Nevertheless chuyển sang luận điểm chính mà người viết ủng hộ." }),
          lesson("Use cautious language", "Điều chỉnh mức độ chắc chắn để tránh khẳng định quá mức.", "Dùng may, might, appears to, tends to và is likely to để hedging.", "The results appear to support the proposal, but the effect may depend on class size. Smaller groups are likely to benefit more than very large groups.", { prompt: "Which phrase shows caution?", options: ["appear to support", "prove forever", "always guarantee"], answer: "appear to support", explanation: "Appear to cho thấy kết luận có cơ sở nhưng chưa tuyệt đối." })
        ]),
        unit("professional-communication", "Professional communication", "Giao tiếp học thuật và nghề nghiệp", "writing", vocabulary(
          ["agenda", "/əˈdʒendə/", "chương trình họp", "The agenda has four items."],
          ["proposal", "/prəˈpoʊzl/", "đề xuất", "We revised the proposal."],
          ["stakeholder", "/ˈsteɪkhoʊldər/", "bên liên quan", "Each stakeholder was consulted."],
          ["outcome", "/ˈaʊtkʌm/", "kết quả", "The outcome was positive."],
          ["negotiate", "/nɪˈɡoʊʃieɪt/", "đàm phán", "They negotiated a new deadline."],
          ["clarify", "/ˈklærəfaɪ/", "làm rõ", "Could you clarify that point?"],
          ["allocate", "/ˈæləkeɪt/", "phân bổ", "We allocated funds to training."],
          ["concise", "/kənˈsaɪs/", "ngắn gọn, súc tích", "Keep the summary concise."]
        ), [
          lesson("Write a concise update", "Tóm tắt tiến độ, vấn đề và bước tiếp theo trong email chuyên nghiệp.", "Dùng headings, parallel structure và động từ chủ động để viết rõ.", "Subject: Project update\nProgress: The research team has completed the survey.\nIssue: Two stakeholders have requested additional data.\nNext step: We will revise the proposal by Thursday.", { prompt: "Why is this update easy to scan?", options: ["It uses clear labels and parallel information.", "It avoids all specific details.", "It contains one very long sentence."], answer: "It uses clear labels and parallel information.", explanation: "Nhãn Progress, Issue, Next step giúp người đọc tìm ý nhanh." }),
          lesson("Negotiate diplomatically", "Làm rõ ưu tiên và đề xuất lựa chọn thay thế trong thương lượng.", "Dùng would, could và conditional phrases để giảm độ trực diện.", "Minh: We would prefer a Friday deadline.\nSara: That could be difficult for our design team. Would Monday be acceptable if we sent a draft on Friday?\nMinh: Yes, that would work.", { prompt: "What solution do they accept?", options: ["A Friday draft and Monday deadline", "No draft and a Thursday deadline", "An immediate final version"], answer: "A Friday draft and Monday deadline", explanation: "Sara đề xuất gửi draft thứ Sáu và hoàn tất thứ Hai; Minh đồng ý." }),
          lesson("Condense complex information", "Rút gọn mệnh đề để văn bản trang trọng và súc tích hơn.", "Dùng participle clauses khi hai mệnh đề có cùng chủ ngữ.", "Having reviewed the budget, the committee allocated more funding to training. Concerned about delays, it also introduced a monthly progress check.", { prompt: "What happened before the committee allocated funding?", options: ["It reviewed the budget.", "It cancelled the project.", "It hired another committee."], answer: "It reviewed the budget.", explanation: "Having reviewed biểu thị hành động hoàn tất trước hành động chính." })
        ]),
        unit("culture-complex-texts", "Culture & complex texts", "Văn hóa và văn bản phức tạp", "reading", vocabulary(
          ["nuance", "/ˈnuːɑːns/", "sắc thái", "The translation loses some nuance."],
          ["convention", "/kənˈvenʃn/", "quy ước", "Social conventions vary."],
          ["identity", "/aɪˈdentəti/", "bản sắc", "Language shapes identity."],
          ["interpretation", "/ɪnˌtɜːrprəˈteɪʃn/", "cách diễn giải", "Her interpretation is convincing."],
          ["stereotype", "/ˈsteriətaɪp/", "khuôn mẫu", "The story challenges a stereotype."],
          ["context", "/ˈkɑːntekst/", "bối cảnh", "Meaning depends on context."],
          ["metaphor", "/ˈmetəfɔːr/", "ẩn dụ", "The bridge is a metaphor for trust."],
          ["ambiguity", "/ˌæmbɪˈɡjuːəti/", "sự mơ hồ đa nghĩa", "The ending contains ambiguity."]
        ), [
          lesson("Read beyond the literal meaning", "Nhận ra ẩn dụ, thái độ và ý nghĩa hàm ẩn.", "Theo dõi từ khóa đánh giá và hình ảnh ẩn dụ để suy luận stance.", "The article describes the city as a conversation between old stone and new glass. The metaphor suggests that modern development has not completely erased local memory.", { prompt: "What does the metaphor mainly suggest?", options: ["Old and new elements coexist.", "The buildings can speak aloud.", "The city has no history."], answer: "Old and new elements coexist.", explanation: "Conversation giữa old stone và new glass tượng trưng cho sự cùng tồn tại." }),
          lesson("Track complex noun phrases", "Tách cấu trúc danh từ dài để hiểu thông tin học thuật.", "Tìm head noun trước, sau đó đọc các modifier trước và sau nó.", "The rapid growth of community-led digital archives has created new opportunities for preserving stories that were previously excluded from official collections.", { prompt: "What is the head noun of the subject phrase?", options: ["growth", "community", "archives"], answer: "growth", explanation: "Cụm chủ ngữ chính là The rapid growth; phần còn lại bổ nghĩa." }),
          lesson("Interpret contrasting viewpoints", "So sánh cách hai người diễn giải cùng một hiện tượng.", "Dùng whereas, by contrast và from this perspective để tổ chức đối chiếu.", "One critic sees the exhibition as a celebration of shared identity, whereas another argues that it simplifies regional differences. From the second perspective, unity is presented at the cost of nuance.", { prompt: "What does the second critic object to?", options: ["Loss of regional nuance", "The size of the exhibition", "The absence of any shared identity"], answer: "Loss of regional nuance", explanation: "Người thứ hai cho rằng sự thống nhất làm mất sắc thái khác biệt vùng miền." })
        ])
      ]
    },
    {
      id: "C1", name: "Nâng cao", band: "Proficient User", color: "#a98cff",
      description: "Hiểu văn bản dài khó, nhận ra nghĩa hàm ẩn và dùng ngôn ngữ linh hoạt trong học thuật, xã hội, nghề nghiệp.",
      canDo: "Trình bày ý tưởng phức tạp trôi chảy, viết mạch lạc có kiểm soát và điều chỉnh giọng điệu theo mục đích.",
      writing: { title: "Synthesize and evaluate an argument", description: "Viết 230–270 từ tổng hợp hai góc nhìn, đánh giá bằng chứng và bảo vệ kết luận.", hints: ["Both accounts acknowledge…", "The evidence is limited by…", "A more convincing interpretation…", "Taken together…"] },
      speaking: { phrase: "What initially appears to be a straightforward policy choice is, on closer inspection, a question of competing priorities.", ipa: "/wʌt ɪˈnɪʃəli əˈpɪrz tə biː ə ˌstreɪtˈfɔːrwərd ˈpɑːləsi tʃɔɪs/" },
      units: [
        unit("academic-argument", "Academic argument", "Lập luận học thuật", "writing", vocabulary(
          ["thesis", "/ˈθiːsɪs/", "luận đề", "The thesis is clearly stated."],
          ["methodology", "/ˌmeθəˈdɑːlədʒi/", "phương pháp luận", "The methodology is transparent."],
          ["implication", "/ˌɪmplɪˈkeɪʃn/", "hàm ý; hệ quả", "Consider the wider implication."],
          ["synthesis", "/ˈsɪnθəsɪs/", "sự tổng hợp", "The conclusion offers a synthesis."],
          ["validity", "/vəˈlɪdəti/", "tính hợp lệ", "The sample affects validity."],
          ["framework", "/ˈfreɪmwɜːrk/", "khung phân tích", "We applied a new framework."],
          ["empirical", "/ɪmˈpɪrɪkl/", "thực nghiệm", "The claim lacks empirical support."],
          ["critique", "/krɪˈtiːk/", "bài phê bình", "Her critique is balanced."]
        ), [
          lesson("Frame a research claim", "Đặt luận đề trong phạm vi và mức độ chắc chắn phù hợp.", "Kết hợp stance markers với giới hạn phạm vi: arguably, within this sample, appears to.", "Within this sample, peer feedback appears to improve revision quality, particularly when reviewers use a shared framework. The finding is promising, although it should not be generalised beyond similar courses.", { prompt: "How does the writer limit the claim?", options: ["By defining the sample and warning against broad generalisation", "By claiming the result is universally true", "By removing all evidence"], answer: "By defining the sample and warning against broad generalisation", explanation: "Within this sample và should not be generalised giới hạn phạm vi kết luận." }),
          lesson("Turn actions into concepts", "Dùng nominalisation để tổ chức văn bản học thuật cô đọng.", "Chuyển động từ thành danh từ có chọn lọc: analyse → analysis; evaluate → evaluation.", "The team evaluated the programme and found that participation had declined. The evaluation revealed a decline in participation, prompting a revision of the recruitment strategy.", { prompt: "Which phrase is a nominalisation?", options: ["The evaluation", "The team evaluated", "had declined"], answer: "The evaluation", explanation: "Evaluation là danh từ được tạo từ động từ evaluate." }),
          lesson("Synthesize two sources", "Kết hợp điểm chung, khác biệt và giới hạn của nhiều nguồn.", "Tổ chức theo ý tưởng thay vì lần lượt tóm tắt từng nguồn.", "Both studies associate regular feedback with stronger performance. However, the first attributes the effect to motivation, whereas the second emphasises clearer task expectations. Together, they suggest that feedback may operate through more than one mechanism.", { prompt: "What synthesis does the writer reach?", options: ["Feedback may work through several mechanisms.", "Only motivation matters.", "The studies completely contradict each other."], answer: "Feedback may work through several mechanisms.", explanation: "Câu cuối tích hợp hai cách giải thích thành một kết luận rộng hơn." })
        ]),
        unit("leadership-negotiation", "Leadership & negotiation", "Lãnh đạo và thương lượng", "speaking", vocabulary(
          ["consensus", "/kənˈsensəs/", "đồng thuận", "The group reached consensus."],
          ["leverage", "/ˈlevərɪdʒ/", "tận dụng; đòn bẩy", "We can leverage existing tools."],
          ["delegation", "/ˌdelɪˈɡeɪʃn/", "sự phân công", "Effective delegation builds trust."],
          ["accountability", "/əˌkaʊntəˈbɪləti/", "trách nhiệm giải trình", "The plan improves accountability."],
          ["contingency", "/kənˈtɪndʒənsi/", "phương án dự phòng", "We need a contingency plan."],
          ["resolve", "/rɪˈzɑːlv/", "giải quyết", "They resolved the disagreement."],
          ["incentive", "/ɪnˈsentɪv/", "động lực khuyến khích", "The incentive changed behaviour."],
          ["align", "/əˈlaɪn/", "điều chỉnh cho thống nhất", "Align the plan with our goals."]
        ), [
          lesson("Signal disagreement tactfully", "Phản đối ý tưởng mà vẫn duy trì quan hệ hợp tác.", "Dùng distancing và softeners: I wonder whether…, I am not entirely convinced…", "I can see why the proposal is attractive. That said, I am not entirely convinced that the timeline is realistic. I wonder whether a pilot phase might address some of the risk.", { prompt: "What alternative does the speaker suggest?", options: ["A pilot phase", "Immediate full expansion", "Cancelling every deadline"], answer: "A pilot phase", explanation: "I wonder whether a pilot phase… là đề xuất thay thế được diễn đạt mềm." }),
          lesson("Emphasise a key condition", "Nhấn mạnh điều kiện hoặc giới hạn trong phát biểu trang trọng.", "Dùng inversion sau only, rarely, not until khi cần nhấn mạnh.", "Only after the responsibilities had been clarified did the team reach consensus. Rarely had a short planning session resolved so many practical concerns.", { prompt: "What happened before consensus?", options: ["Responsibilities were clarified.", "The project was abandoned.", "The team hired new members."], answer: "Responsibilities were clarified.", explanation: "Only after… did… nhấn mạnh điều kiện xảy ra trước." }),
          lesson("Reframe competing priorities", "Tóm tắt nhu cầu của các bên và chuyển tranh luận sang mục tiêu chung.", "Dùng cleft sentences và reframing: What both sides need is…", "What both sides need is a reliable delivery date. The question is not whether quality or speed matters more, but how the schedule can protect both. A staged release may align those priorities.", { prompt: "How does the speaker reframe the dispute?", options: ["As a shared need for a reliable date", "As a personal conflict", "As a choice to ignore quality"], answer: "As a shared need for a reliable date", explanation: "Câu mở đầu xác định nhu cầu chung thay vì tập trung vào đối đầu." })
        ]),
        unit("style-discourse", "Style, nuance & discourse", "Phong cách và sắc thái diễn ngôn", "reading", vocabulary(
          ["cohesion", "/koʊˈhiːʒn/", "tính liên kết", "Pronouns improve cohesion."],
          ["register", "/ˈredʒɪstər/", "văn phong", "Choose an appropriate register."],
          ["idiom", "/ˈɪdiəm/", "thành ngữ", "The idiom sounds informal."],
          ["connotation", "/ˌkɑːnəˈteɪʃn/", "sắc thái liên tưởng", "The word has a negative connotation."],
          ["stance", "/stæns/", "lập trường", "Her stance remains cautious."],
          ["paraphrase", "/ˈpærəfreɪz/", "diễn đạt lại", "Paraphrase the central idea."],
          ["cadence", "/ˈkeɪdns/", "nhịp điệu câu chữ", "The speech has a steady cadence."],
          ["inference", "/ˈɪnfərəns/", "suy luận", "That inference is reasonable."]
        ), [
          lesson("Adjust register", "Diễn đạt cùng một thông điệp theo văn phong thân mật hoặc trang trọng.", "Chọn từ vựng, contractions và mức trực tiếp theo người đọc.", "Informal: Can you send me the figures by Friday?\nFormal: I would be grateful if you could forward the figures by Friday.\nBoth requests are clear, but their register suits different relationships.", { prompt: "Which feature makes the second request more formal?", options: ["I would be grateful if…", "The word Friday", "The request for figures"], answer: "I would be grateful if…", explanation: "Cấu trúc gián tiếp và lịch sự tạo văn phong trang trọng." }),
          lesson("Create cohesion without repetition", "Dùng tham chiếu, thay thế và lược bỏ để liên kết ý tự nhiên.", "Dùng this, such an approach, do so và ellipsis khi nghĩa đã rõ.", "Several departments introduced mentoring schemes. Those that did so reported better retention, while those without one saw little change. This contrast deserves further investigation.", { prompt: "What does did so replace?", options: ["introduced mentoring schemes", "reported better retention", "deserves investigation"], answer: "introduced mentoring schemes", explanation: "Do so thay thế cụm động từ đã xuất hiện để tránh lặp." }),
          lesson("Read tone and connotation", "Nhận ra thái độ qua lựa chọn từ và nhịp câu.", "So sánh nghĩa từ điển với connotation tích cực, tiêu cực hoặc mỉa mai.", "The reviewer calls the design 'ambitious' before listing a series of impractical decisions. In this context, the apparently positive adjective carries a mildly ironic connotation.", { prompt: "What tone does ambitious carry here?", options: ["Mild irony", "Unqualified praise", "Complete neutrality"], answer: "Mild irony", explanation: "Phần phê bình sau đó khiến từ tích cực ambitious mang sắc thái mỉa nhẹ." })
        ])
      ]
    },
    {
      id: "C2", name: "Thành thạo", band: "Proficient User", color: "#ff6ccf",
      description: "Hiểu gần như mọi dạng ngôn ngữ, tổng hợp nhiều nguồn và diễn đạt tự nhiên với độ chính xác, sắc thái cao.",
      canDo: "Tổng hợp lập luận phức tạp, điều chỉnh sắc thái tinh tế và giao tiếp chính xác trong những bối cảnh chuyên môn khó.",
      writing: { title: "Critical synthesis for an expert audience", description: "Viết 280–320 từ tái cấu trúc nhiều lập luận, xử lý giới hạn và tạo kết luận có sắc thái.", hints: ["A superficial reading might suggest…", "This interpretation is complicated by…", "The apparent discrepancy can be reconciled…", "The more salient conclusion…"] },
      speaking: { phrase: "The apparent contradiction can be reconciled once we distinguish the evidence itself from the assumptions imposed upon it.", ipa: "/ði əˈpærənt ˌkɑːntrəˈdɪkʃn kən biː ˈrekənsaɪld/" },
      units: [
        unit("critical-synthesis", "Critical synthesis", "Tổng hợp phản biện", "writing", vocabulary(
          ["premise", "/ˈpremɪs/", "tiền đề", "The premise remains untested."],
          ["corroborate", "/kəˈrɑːbəreɪt/", "xác nhận bằng chứng", "Later records corroborate the account."],
          ["discrepancy", "/dɪˈskrepənsi/", "sự không nhất quán", "The discrepancy requires explanation."],
          ["paradigm", "/ˈpærədaɪm/", "hệ hình", "The discovery challenged the paradigm."],
          ["extrapolate", "/ɪkˈstræpəleɪt/", "ngoại suy", "Do not extrapolate from one case."],
          ["reconcile", "/ˈrekənsaɪl/", "dung hòa", "The model reconciles both findings."],
          ["caveat", "/ˈkæviæt/", "điều cần dè dặt", "The conclusion includes a caveat."],
          ["salient", "/ˈseɪliənt/", "nổi bật, cốt yếu", "Focus on the most salient factor."]
        ), [
          lesson("Interrogate a premise", "Phát hiện tiền đề ẩn và đánh giá ảnh hưởng của nó lên kết luận.", "Tách dữ kiện, suy luận và giả định; dùng if anything, insofar as, to the extent that.", "The argument assumes that faster decisions are necessarily better decisions. Yet speed is only advantageous insofar as the relevant evidence has already been examined. If anything, urgency may magnify the cost of an untested premise.", { prompt: "Which hidden premise does the writer challenge?", options: ["Faster decisions are always better.", "Evidence can never be examined.", "Urgency has no effect on decisions."], answer: "Faster decisions are always better.", explanation: "Câu đầu nêu rõ giả định bị chất vấn." }),
          lesson("Reconcile conflicting sources", "Giải thích mâu thuẫn biểu kiến bằng phạm vi, phương pháp hoặc định nghĩa khác nhau.", "Dùng whereas, not so much… as…, viewed in this light để tái cấu trúc đối chiếu.", "The first study records immediate satisfaction, whereas the second measures retention after a year. Their findings conflict not so much in substance as in timescale. Viewed in this light, short-term enthusiasm and long-term impact need not coincide.", { prompt: "How are the conflicting findings reconciled?", options: ["They measure different timescales.", "One study contains no data.", "Both studies define satisfaction identically."], answer: "They measure different timescales.", explanation: "Khác biệt về timescale giải thích mâu thuẫn biểu kiến." }),
          lesson("Reorganise dense evidence", "Tái cấu trúc nhiều nguồn theo mức độ liên quan với đối tượng đọc.", "Ưu tiên salient evidence, signpost caveats và tránh tóm tắt nguồn theo thứ tự máy móc.", "For policy makers, the salient point is not the modest average effect but its uneven distribution. Three studies corroborate gains for small institutions; the national dataset shows no overall change. The caveat is therefore one of scale, not necessarily of validity.", { prompt: "What is the central caveat?", options: ["The effect may depend on institutional scale.", "Every study is invalid.", "No institution showed gains."], answer: "The effect may depend on institutional scale.", explanation: "Câu cuối xác định caveat là scale." })
        ]),
        unit("rhetoric-literary", "Rhetoric & literary voice", "Tu từ và giọng văn", "reading", vocabulary(
          ["allusion", "/əˈluːʒn/", "ám chỉ", "The title contains an allusion."],
          ["irony", "/ˈaɪrəni/", "mỉa mai; nghịch lý", "The final sentence relies on irony."],
          ["subtext", "/ˈsʌbtekst/", "ý ngầm", "The polite exchange has tense subtext."],
          ["motif", "/moʊˈtiːf/", "mô-típ lặp lại", "Water becomes a recurring motif."],
          ["diction", "/ˈdɪkʃn/", "cách lựa chọn từ", "The diction is deliberately plain."],
          ["juxtaposition", "/ˌdʒʌkstəpəˈzɪʃn/", "sự đặt cạnh tương phản", "The juxtaposition creates tension."],
          ["ambiguity", "/ˌæmbɪˈɡjuːəti/", "đa nghĩa", "The ambiguity remains unresolved."],
          ["resonance", "/ˈrezənəns/", "sức gợi; âm hưởng", "The image gains emotional resonance."]
        ), [
          lesson("Trace an implied voice", "Nhận ra khoảng cách giữa lời kể bề mặt và thái độ ngầm.", "Theo dõi free indirect style, lexical echo và sự lệch giữa diction với tình huống.", "He congratulated himself on arriving only forty minutes late, a triumph of organisation that the empty conference room seemed reluctant to celebrate. The narration borrows his confidence while quietly exposing its absurdity.", { prompt: "What creates the irony?", options: ["His self-praise contrasts with the empty room.", "He arrives before everyone else.", "The room openly congratulates him."], answer: "His self-praise contrasts with the empty room.", explanation: "Juxtaposition giữa triumph và empty room tạo giọng mỉa." }),
          lesson("Analyse a recurring motif", "Giải thích cách hình ảnh lặp lại thay đổi ý nghĩa trong toàn văn.", "Liên kết motif với biến đổi nhân vật, cấu trúc và chủ đề thay vì chỉ đếm sự xuất hiện.", "At first, the locked window represents the speaker's frustration. Later, its reflection becomes a way of observing herself. When it finally opens, the moment resonates because the image has shifted from barrier to perspective to choice.", { prompt: "How does the window motif develop?", options: ["From barrier to perspective to choice", "From celebration to punishment", "It keeps exactly one literal meaning"], answer: "From barrier to perspective to choice", explanation: "Đoạn văn nêu ba giai đoạn phát triển của motif." }),
          lesson("Distinguish fine shades of tone", "Phân biệt sắc thái gần nhau như sceptical, sardonic, resigned và detached.", "Kết hợp diction, cadence, punctuation và context để gọi tên tone chính xác.", "The writer does not angrily reject the promise; instead, the clipped phrase 'another solution, naturally' conveys weary scepticism. Its restrained cadence makes the criticism more sardonic than openly hostile.", { prompt: "Which tone best describes the phrase?", options: ["Weary and sardonic", "Joyfully enthusiastic", "Completely innocent"], answer: "Weary and sardonic", explanation: "Clipped phrase và naturally trong ngữ cảnh tạo mỉa mai mệt mỏi." })
        ]),
        unit("expert-mediation", "Expert communication & mediation", "Giao tiếp chuyên gia và điều giải", "speaking", vocabulary(
          ["mediation", "/ˌmiːdiˈeɪʃn/", "điều giải; trung gian ý nghĩa", "Mediation helped both teams understand."],
          ["interlocutor", "/ˌɪntərˈlɑːkjətər/", "người đối thoại", "Adapt to each interlocutor."],
          ["trade-off", "/ˈtreɪd ɔːf/", "sự đánh đổi", "Every option involves a trade-off."],
          ["equivocal", "/ɪˈkwɪvəkl/", "mơ hồ, nước đôi", "The response was deliberately equivocal."],
          ["articulate", "/ɑːrˈtɪkjəleɪt/", "diễn đạt rõ", "She articulated the concern precisely."],
          ["reformulate", "/ˌriːˈfɔːrmjəleɪt/", "diễn đạt lại", "Reformulate the technical point."],
          ["precision", "/prɪˈsɪʒn/", "độ chính xác", "The task demands precision."],
          ["rapport", "/ræˈpɔːr/", "quan hệ hòa hợp", "Humour helped establish rapport."]
        ), [
          lesson("Mediate specialist knowledge", "Diễn giải nội dung chuyên môn cho người không chuyên mà không làm sai lệch ý.", "Giữ logic cốt lõi, giải thích thuật ngữ và đánh dấu phần giản lược.", "In technical terms, the model reduces variance through regularisation. Put more simply, it is designed to avoid treating every fluctuation as a meaningful pattern. That simplification omits some mathematical detail but preserves the practical implication.", { prompt: "What does the reformulation preserve?", options: ["The practical implication", "Every mathematical detail", "Only the technical terminology"], answer: "The practical implication", explanation: "Người nói công khai lược chi tiết nhưng giữ practical implication." }),
          lesson("Navigate a delicate trade-off", "Diễn đạt đánh đổi và giới hạn mà không làm căng thẳng cuộc trao đổi.", "Dùng calibrated language: the difficulty lies in…, a defensible balance might…", "The difficulty lies in preserving transparency without disclosing personal data. A defensible balance might involve publishing the decision criteria while restricting access to individual records.", { prompt: "What balance is proposed?", options: ["Publish criteria but protect individual records", "Publish every private record", "Hide both criteria and decisions"], answer: "Publish criteria but protect individual records", explanation: "Giải pháp tách minh bạch quy trình khỏi dữ liệu cá nhân." }),
          lesson("Respond with spontaneous precision", "Làm rõ, sửa ý và phân biệt sắc thái ngay trong hội thoại phức tạp.", "Dùng self-repair tự nhiên: more precisely, or rather, to put it another way.", "The policy is ineffective—or rather, it is effective only under conditions that the current proposal does not create. More precisely, the incentive changes short-term behaviour without establishing long-term commitment.", { prompt: "Why does the speaker use or rather?", options: ["To refine an overbroad first statement", "To abandon the topic", "To repeat the same claim without change"], answer: "To refine an overbroad first statement", explanation: "Or rather sửa ineffective thành kết luận chính xác và có điều kiện hơn." })
        ])
      ]
    }
  ];

  const rotate = (items, offset) => items.slice(offset).concat(items.slice(0, offset));
  const buildExercises = (lessonId, words, check, lessonIndex) => {
    const rotated = rotate(words, lessonIndex * 2 % words.length);
    const vocabularyExercises = rotated.slice(0, 4).map((entry, index) => {
      if (index === 3) {
        return {
          id: `${lessonId}-q${index + 1}`, type: "fill-in-the-blank",
          prompt: `Điền từ tiếng Anh phù hợp với nghĩa “${entry[2]}”.`, answer: entry[0], options: [],
          explanation: `${entry[0]} ${entry[1]} nghĩa là “${entry[2]}”. Ví dụ: ${entry[3]}`, points: 20
        };
      }
      const distractors = rotated.filter((candidate) => candidate[0] !== entry[0]).slice(index + 1, index + 3).map((candidate) => candidate[2]);
      const options = rotate([entry[2], ...distractors], index % 3);
      return {
        id: `${lessonId}-q${index + 1}`, type: "multiple-choice", prompt: `“${entry[0]}” gần nghĩa nhất với lựa chọn nào?`,
        answer: entry[2], options, explanation: `${entry[0]} ${entry[1]} nghĩa là “${entry[2]}”. Ví dụ: ${entry[3]}`, points: 20
      };
    });
    return [...vocabularyExercises, { id: `${lessonId}-q5`, type: "multiple-choice", ...check, points: 20 }];
  };

  const levels = rawLevels.map((level, levelIndex) => ({
    ...level,
    units: level.units.map((sourceUnit, unitIndex) => ({
      ...sourceUnit,
      level: level.id,
      color: [level.color, "#63e8ff", "#ff6ccf", "#ffe66d", "#80f4b4"][(unitIndex + levelIndex) % 5],
      lessons: sourceUnit.lessons.map((sourceLesson, lessonIndex) => {
        const id = `${level.id.toLowerCase()}-${unitIndex + 1}-${lessonIndex + 1}`;
        return {
          id, level: level.id, unitId: sourceUnit.id, primarySkill: sourceUnit.primarySkill,
          title: sourceLesson.title, canDo: sourceLesson.canDo, grammar: sourceLesson.focus,
          dialogue: sourceLesson.text, vocabulary: sourceUnit.vocabulary,
          exercises: buildExercises(id, sourceUnit.vocabulary, sourceLesson.check, lessonIndex),
          minutes: 14 + levelIndex * 2 + lessonIndex, xp: 60 + levelIndex * 10
        };
      })
    }))
  }));

  const curriculum = { levels };
  if (typeof window !== "undefined") window.HHEnglishCurriculum = curriculum;
  if (typeof module !== "undefined" && module.exports) module.exports = curriculum;
})();
