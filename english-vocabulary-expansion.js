(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HHEnglishVocabularyExpansion=api;})(globalThis,function(){
  'use strict';
  const provenance=Object.freeze({author:'HH English · original AI-assisted content',license:'Project-owned text; no external material copied',reviewStatus:'draft',reviewedAt:null,createdAt:'2026-10-09',levelStatus:'suggested-not-certified'});
  const variants={summarise:["summarize"],memorise:["memorize"],apologise:["apologize"],neighbourhood:["neighborhood"],instalment:["installment"],savoury:["savory"],pavement:["sidewalk"]};
  // term | Vietnamese sense | original context | useful collocation | part of speech
  const definitions=[
    ['routine','Nhịp sống hằng ngày','A1','daily',`wake up|thức dậy|I usually wake up at seven.|wake up early|phrase
get dressed|mặc quần áo|I get dressed before breakfast.|get dressed quickly|phrase
brush your teeth|đánh răng|Remember to brush your teeth before bed.|brush your teeth carefully|phrase
tidy up|dọn gọn lại|Let's tidy up the room before lunch.|tidy up a room|phrase
do the laundry|giặt quần áo|We do the laundry on Sunday.|do the laundry regularly|phrase
run errands|làm các việc vặt bên ngoài|I need to run errands this afternoon.|run errands nearby|phrase
prepare|chuẩn bị|Please prepare your bag tonight.|prepare a meal|verb
stretch|duỗi người, giãn cơ|I like to stretch after sitting for a while.|stretch gently|verb
unwind|thư giãn sau khi bận rộn|I read a book to unwind after work.|unwind after work|verb
bedtime|giờ đi ngủ|My usual bedtime is ten o'clock.|a regular bedtime|noun`],
    ['study','Học tập & ôn bài','A2','study',`revision|việc ôn lại kiến thức|I set aside time for revision before the test.|exam revision|noun
timetable|thời khóa biểu|Our timetable has changed this week.|a school timetable|noun
assignment|bài được giao|This assignment is due on Friday.|submit an assignment|noun
feedback|nhận xét giúp cải thiện|The teacher gave helpful feedback on my paragraph.|constructive feedback|noun
deadline|hạn chót|We agreed on a deadline for the project.|meet a deadline|noun
highlight|đánh dấu phần quan trọng|Please highlight the key words in the passage.|highlight a point|verb
summarise|tóm tắt|Can you summarise the article in three sentences?|summarise an argument|verb
memorise|ghi nhớ bằng việc học thuộc|I find it easier to memorise words in context.|memorise a phrase|verb
explanation|lời giải thích|Your explanation helped me understand the rule.|a clear explanation|noun
reference|nguồn hoặc chỗ dùng để tham khảo|Keep this chart as a reference for later.|a useful reference|noun`],
    ['habits','Thói quen học hiệu quả','B1','study',`consistency|sự đều đặn, nhất quán|For me, consistency matters more than one long session.|maintain consistency|noun
distraction|điều làm xao nhãng|My phone is a distraction when I study.|reduce distractions|noun
concentration|sự chú ý vào một việc|A quiet room helps my concentration.|improve concentration|noun
procrastination|việc trì hoãn điều cần làm|I notice more procrastination when a task feels unclear.|avoid procrastination|noun
manageable|có thể xử lý được|We divided the work into manageable tasks.|manageable steps|adjective
priority|việc được ưu tiên|Finishing the draft is my priority today.|set a priority|noun
routine|thói quen làm việc theo trình tự|A short evening routine helps me organise tomorrow.|build a routine|noun
reward|phần thưởng|I chose a small reward after finishing my notes.|a small reward|noun
resilience|khả năng phục hồi sau khó khăn|Her resilience helped her try again after a setback.|build resilience|noun
motivation|động lực|Learning with friends gives me motivation.|maintain motivation|noun`],
    ['conversation','Giao tiếp & phản hồi','A2','daily',`greet|chào một người|Please greet our visitors when they arrive.|greet a guest|verb
introduce|giới thiệu|Let me introduce my colleague, Minh.|introduce yourself|verb
repeat|nói hoặc làm lại|Could you repeat the last sentence, please?|repeat a question|verb
clarify|làm rõ điều chưa hiểu|Could you clarify what you mean by flexible?|clarify a point|verb
mention|nhắc đến ngắn gọn|Please mention any questions at the end.|mention a detail|verb
apologise|xin lỗi|I want to apologise for being late.|apologise for a mistake|verb
invite|mời|We would like to invite you to our study group.|invite a friend|verb
agree|đồng ý|I agree with the main idea, but I have a question.|agree with someone|verb
disagree|không đồng ý|We can disagree without being rude.|disagree respectfully|verb
reply|trả lời|I will reply to your message this evening.|reply to a message|verb`],
    ['feelings','Cảm xúc & thái độ','B1','daily',`relieved|nhẹ nhõm|I felt relieved when I found my missing notes.|feel relieved|adjective
anxious|lo lắng|She felt anxious before her first presentation.|feel anxious|adjective
confident|tự tin|I feel more confident after practising the introduction.|feel confident|adjective
overwhelmed|thấy quá tải|I felt overwhelmed by the number of tasks.|feel overwhelmed|adjective
curious|tò mò muốn tìm hiểu|I am curious about how this tool works.|curious about something|adjective
frustrated|bực bội vì khó khăn hoặc trở ngại|He felt frustrated when the file would not open.|feel frustrated|adjective
grateful|biết ơn|I am grateful for your patient explanation.|grateful for help|adjective
hopeful|có hy vọng|We remain hopeful about the next attempt.|remain hopeful|adjective
patient|kiên nhẫn|Please be patient while the page loads.|be patient|adjective
calm|bình tĩnh|Her calm response helped the group think clearly.|stay calm|adjective`],
    ['travel','Du lịch & di chuyển','A2','travel',`itinerary|lịch trình chuyến đi|Our itinerary includes two days in the old town.|a travel itinerary|noun
luggage|hành lý|Please keep your luggage with you.|carry luggage|noun
boarding pass|thẻ lên máy bay|I saved my boarding pass on my phone.|show a boarding pass|noun
departure|sự khởi hành|The departure time is printed on the ticket.|a departure time|noun
arrival|sự đến nơi|Please send a message after your arrival.|confirm an arrival|noun
platform|sân ga nơi lên tàu|Our train leaves from platform three.|a station platform|noun
transfer|việc chuyển sang phương tiện khác|We have one transfer on this journey.|a bus transfer|noun
reservation|việc đặt chỗ trước|I would like to check my reservation.|confirm a reservation|noun
landmark|địa điểm nổi bật dùng để nhận biết|The bridge is a famous landmark in this city.|a local landmark|noun
delay|sự chậm trễ|There is a short delay because of the rain.|a travel delay|noun`],
    ['food','Quán ăn & gọi món','A2','daily',`portion|khẩu phần|This portion is large enough for two people.|a small portion|noun
ingredients|nguyên liệu|The ingredients are listed on the menu.|fresh ingredients|noun
allergy|tình trạng dị ứng|Please tell the staff if you have an allergy.|a food allergy|noun
recipe|công thức nấu ăn|My friend shared a simple recipe for soup.|follow a recipe|noun
savoury|có vị mặn, không phải món ngọt|I prefer a savoury snack in the afternoon.|a savoury dish|adjective
spicy|cay|Is this dish very spicy?|spicy food|adjective
mild|nhẹ, không đậm hoặc cay mạnh|I would like a mild sauce, please.|a mild flavour|adjective
takeaway|đồ ăn mua mang đi|We ordered a takeaway after the meeting.|order a takeaway|noun
refill|lần rót hoặc đổ đầy lại|Could I have a refill of water, please?|a free refill|noun
bill|hóa đơn cần thanh toán|Could we have the bill, please?|pay the bill|noun`],
    ['services','Dịch vụ hằng ngày','A2','daily',`appointment|cuộc hẹn đã sắp xếp|I have an appointment tomorrow morning.|make an appointment|noun
queue|hàng người đang chờ|Please join the queue at the entrance.|wait in a queue|noun
counter|quầy phục vụ|You can collect your order at the counter.|a service counter|noun
receipt|biên nhận sau khi thanh toán|Please keep the receipt for your records.|keep a receipt|noun
refund|khoản tiền được hoàn lại|The shop offered a refund for the damaged item.|request a refund|noun
warranty|cam kết bảo hành|The device comes with a one-year warranty.|a product warranty|noun
delivery|việc giao hàng|The delivery is expected on Tuesday.|a delivery date|noun
subscription|gói đăng ký sử dụng định kỳ|My subscription ends next month.|renew a subscription|noun
renew|gia hạn hoặc làm mới|I need to renew my library card.|renew a membership|verb
cancel|hủy|Can I cancel the order before it is sent?|cancel an order|verb`],
    ['money','Mua sắm & quản lý chi tiêu','B1','daily',`budget|ngân sách được dự tính|We set a budget before planning the trip.|set a budget|noun
expense|khoản chi phí|Transport is our biggest expense this month.|track an expense|noun
discount|khoản giảm giá|This shop offers a student discount.|a student discount|noun
affordable|có giá trong khả năng chi trả|We are looking for an affordable room.|an affordable option|adjective
deposit|tiền đặt cọc|The booking requires a small deposit.|pay a deposit|noun
balance|số tiền còn lại trong tài khoản|You can check the balance in your account.|check a balance|noun
invoice|hóa đơn yêu cầu thanh toán|Please send the invoice to our office.|issue an invoice|noun
instalment|một lần thanh toán trong nhiều đợt|The final instalment is due next week.|pay an instalment|noun
exchange rate|tỷ giá giữa hai đồng tiền|The board shows the exchange rate for today.|check an exchange rate|noun
savings|tiền đã tiết kiệm|She used part of her savings for the course.|personal savings|noun`],
    ['home','Nhà cửa & đồ dùng','A1','daily',`balcony|ban công|There are plants on the balcony.|a small balcony|noun
corridor|hành lang|Our room is at the end of the corridor.|a long corridor|noun
shelf|kệ, giá để đồ|Put the books on the shelf.|a wooden shelf|noun
cupboard|tủ đựng đồ có cánh|The cups are in the cupboard.|a kitchen cupboard|noun
kettle|ấm đun nước|The kettle is next to the sink.|an electric kettle|noun
curtain|rèm|Please close the curtain at night.|a window curtain|noun
drawer|ngăn kéo|I keep my pens in this drawer.|a desk drawer|noun
socket|ổ cắm|There is a socket under the desk.|a wall socket|noun
ceiling|trần nhà|The ceiling is painted white.|a high ceiling|noun
leak|chỗ rò rỉ|There is a small leak under the sink.|a water leak|noun`],
    ['city','Thành phố & đường đi','B1','travel',`pavement|vỉa hè|Please stay on the pavement near the road.|a wide pavement|noun
intersection|giao lộ|Turn left at the next intersection.|a busy intersection|noun
pedestrian|người đi bộ|The bridge is open to every pedestrian.|a pedestrian crossing|noun
commute|đi lại thường xuyên giữa nhà và nơi làm việc|I commute by train three days a week.|commute to work|verb
neighbourhood|khu vực quanh nơi ở|Our neighbourhood has a small library.|a quiet neighbourhood|noun
parking|việc hoặc chỗ đỗ xe|There is parking behind the building.|public parking|noun
shortcut|đường tắt|This path is a shortcut to the station.|take a shortcut|noun
rush hour|giờ cao điểm|The buses are crowded during rush hour.|avoid rush hour|noun
venue|địa điểm tổ chức sự kiện|The venue is close to the station.|an event venue|noun
suburb|khu dân cư ngoài trung tâm thành phố|They live in a suburb north of the city.|a residential suburb|noun`],
    ['digital','Thói quen số','A2','technology',`password|mật khẩu|You need a password to open your account.|a strong password|noun
privacy|sự riêng tư|This setting helps you control your privacy.|privacy settings|noun
notification|thông báo|I turned off the notification during class.|a message notification|noun
attachment|tệp đính kèm|The email has an attachment with the timetable.|open an attachment|noun
backup|bản sao lưu|I keep a backup of my study notes.|make a backup|noun
update|bản cập nhật|The latest update changes the menu.|install an update|noun
permission|sự cho phép|The app asks for permission before using the camera.|ask for permission|noun
download|tải từ mạng về thiết bị|You can download the notes after class.|download a file|verb
upload|tải từ thiết bị lên mạng|Please upload your assignment before Friday.|upload a document|verb
storage|không gian lưu dữ liệu|There is not enough storage for this video.|device storage|noun`],
    ['software','Công nghệ & xử lý vấn đề','B2','technology',`troubleshoot|tìm và xử lý nguyên nhân của lỗi|We need to troubleshoot the connection problem.|troubleshoot an issue|verb
compatibility|khả năng hoạt động phù hợp cùng nhau|Check compatibility before changing the software.|software compatibility|noun
workaround|cách xử lý tạm để tránh một vấn đề|We found a workaround while waiting for the fix.|a temporary workaround|noun
latency|độ trễ trong truyền hoặc xử lý dữ liệu|High latency makes the conversation feel slow.|reduce latency|noun
bandwidth|khả năng truyền dữ liệu của kết nối|This call needs more bandwidth for video.|available bandwidth|noun
deploy|đưa phần mềm vào môi trường sử dụng|We plan to deploy the tested version tomorrow.|deploy a service|verb
rollback|việc quay về phiên bản trước|The team prepared a rollback before the release.|a safe rollback|noun
authenticate|xác minh danh tính|The server must authenticate the user first.|authenticate a request|verb
version|phiên bản|Please check which version you are using.|a stable version|noun
configuration|các thiết lập cho hệ thống|The configuration file contains no private keys.|a system configuration|noun`],
    ['team','Làm việc nhóm','B1','work',`collaborate|hợp tác|We collaborate on the presentation every week.|collaborate with a team|verb
delegate|giao việc kèm trách nhiệm|A leader can delegate tasks without losing oversight.|delegate a task|verb
contribute|đóng góp|Everyone can contribute an idea to the discussion.|contribute to a project|verb
coordinate|điều phối để các phần ăn khớp|Please coordinate the schedule with the other group.|coordinate a meeting|verb
consensus|sự đồng thuận chung|The group reached a consensus after the discussion.|reach a consensus|noun
responsibility|trách nhiệm|Each member has a clear responsibility.|take responsibility|noun
proposal|đề xuất|We discussed a proposal for a new study club.|submit a proposal|noun
agenda|danh sách nội dung của cuộc họp|The agenda includes time for questions.|set an agenda|noun
follow up|tiếp tục liên hệ hoặc xử lý sau bước đầu|I will follow up after the meeting.|follow up on a request|phrase
stakeholder|bên có liên quan đến một việc|Each stakeholder should understand the main change.|a project stakeholder|noun`],
    ['interview','Phỏng vấn & nghề nghiệp','B2','work',`qualification|bằng cấp hoặc năng lực phù hợp|This qualification is relevant to the role.|a relevant qualification|noun
achievement|thành quả đã đạt được|Describe one achievement and explain your contribution.|a personal achievement|noun
strength|điểm mạnh|She considers clear communication a strength.|a key strength|noun
weakness|điểm cần cải thiện|I can discuss a weakness and how I am improving it.|identify a weakness|noun
initiative|sự chủ động|She showed initiative by proposing a clearer process.|show initiative|noun
adaptable|có thể thích nghi|We need an adaptable approach when plans change.|an adaptable team|adjective
competence|năng lực thực hiện một việc|The interview explores your competence with practical examples.|professional competence|noun
experience|kinh nghiệm|Tell us about your experience with group projects.|relevant experience|noun
expectation|điều được mong đợi|We should discuss each expectation before starting.|a reasonable expectation|noun
availability|thời gian có thể tham gia hoặc làm việc|Please confirm your availability for next week.|confirm availability|noun`],
    ['projects','Dự án & kế hoạch','B2','work',`milestone|mốc quan trọng của dự án|The first milestone is a working prototype.|reach a milestone|noun
scope|phạm vi công việc|We agreed on the scope before estimating the cost.|define the scope|noun
constraint|giới hạn cần tính đến|Time is our main constraint this week.|a time constraint|noun
deliverable|sản phẩm cần bàn giao|Each deliverable needs a clear acceptance rule.|a project deliverable|noun
estimate|ước tính|Can you estimate how long the task will take?|estimate a duration|verb
allocate|phân bổ|We will allocate more time to testing.|allocate resources|verb
dependency|sự phụ thuộc vào một phần khác|The next task has a dependency on the first result.|a task dependency|noun
risk|khả năng xảy ra điều bất lợi|We discussed the risk of a late delivery.|assess a risk|noun
contingency|phương án hoặc tình huống dự phòng|Our plan includes a contingency for bad weather.|a contingency plan|noun
feasibility|khả năng thực hiện được|The team is checking the feasibility of the proposal.|a feasibility study|noun`],
    ['media','Tin tức & đọc có kiểm chứng','B1','society',`audience|người xem hoặc người nghe|The article was written for a young audience.|a target audience|noun
headline|tiêu đề nổi bật của bản tin|The headline does not tell the whole story.|a news headline|noun
caption|lời chú thích hình ảnh|Please add a clear caption to the photograph.|write a caption|noun
source|nguồn cung cấp thông tin|Always identify the source of a quoted figure.|a primary source|noun
reliable|đáng tin cậy|We need a reliable source for this claim.|reliable information|adjective
bias|sự thiên lệch|The report discusses possible bias in the sample.|recognise bias|noun
evidence|thông tin dùng để kiểm chứng một nhận định|What evidence supports this conclusion?|supporting evidence|noun
context|bối cảnh giúp hiểu một thông tin|The sentence makes more sense in context.|understand the context|noun
verify|kiểm tra để xác nhận|Please verify the date before sharing the message.|verify a claim|verb
misleading|dễ khiến hiểu sai|A cropped image can be misleading.|a misleading headline|adjective`],
    ['research','Khoa học & nghiên cứu','B2','science',`hypothesis|giả thuyết cần kiểm tra|The experiment tests a specific hypothesis.|test a hypothesis|noun
variable|đại lượng hoặc yếu tố có thể thay đổi|We changed only one variable in the experiment.|an independent variable|noun
sample|mẫu được chọn để quan sát|The sample was too small for a firm conclusion.|a representative sample|noun
correlation|mối liên hệ thay đổi cùng nhau|A correlation does not necessarily show a cause.|a strong correlation|noun
causation|quan hệ nguyên nhân và kết quả|The study does not establish causation.|establish causation|noun
replicate|thực hiện lại để kiểm tra kết quả|Another group will replicate the experiment.|replicate a study|verb
observation|điều được ghi nhận qua quan sát|Each observation was recorded with a date.|a careful observation|noun
measurement|kết quả hoặc việc đo|The measurement has a small margin of error.|an accurate measurement|noun
findings|các kết quả tìm được|The findings are consistent with the earlier report.|research findings|noun
peer review|việc chuyên gia cùng lĩnh vực đánh giá|The paper is undergoing peer review.|a peer review process|noun`],
    ['environment','Môi trường & tự nhiên','B2','science',`emissions|các chất được thải ra|The report compares emissions from two factories.|reduce emissions|noun
renewable|có thể tái tạo|The project studies renewable energy sources.|renewable energy|adjective
conservation|việc bảo tồn|The centre supports the conservation of local wildlife.|wildlife conservation|noun
biodiversity|sự đa dạng sinh học|The survey records biodiversity in the forest.|protect biodiversity|noun
habitat|môi trường sống của sinh vật|This wetland is an important habitat for birds.|a natural habitat|noun
recycle|tái chế|Our school encourages students to recycle paper.|recycle materials|verb
drought|thời kỳ khô hạn kéo dài|The region experienced a long drought last year.|a severe drought|noun
flood|trận hoặc tình trạng ngập lụt|The village rebuilt the bridge after the flood.|a major flood|noun
sustainable|có thể duy trì lâu dài mà ít gây tổn hại|We discussed a more sustainable way to travel.|a sustainable approach|adjective
ecosystem|hệ gồm sinh vật và môi trường của chúng|A small change can affect the whole ecosystem.|a healthy ecosystem|noun`],
    ['creative','Thiết kế & sáng tạo','B1','creative',`composition|cách sắp xếp các phần của một hình hoặc tác phẩm|The composition draws attention to the centre.|a balanced composition|noun
contrast|sự khác biệt làm nổi bật các phần|The contrast makes the text easier to read.|strong contrast|noun
palette|bảng màu được sử dụng|We chose a calm palette for the classroom.|a colour palette|noun
texture|đặc điểm bề mặt hoặc hình thể hiện bề mặt|The photograph shows the texture of the wood.|a rough texture|noun
perspective|góc nhìn hoặc cách nhìn|This perspective changes how the room appears.|a new perspective|noun
draft|bản nháp|This draft still needs a clearer introduction.|a first draft|noun
refine|chỉnh để tốt hoặc chính xác hơn|We can refine the layout after testing it.|refine a design|verb
inspiration|ý tưởng hoặc cảm hứng thúc đẩy sáng tạo|The garden gave her inspiration for the painting.|find inspiration|noun
originality|tính độc đáo, không chỉ lặp lại|The judges praised the originality of the proposal.|creative originality|noun
layout|bố cục|The new layout leaves more room for the document.|a clear layout|noun`],
    ['phrasal','Cụm động từ trong ngữ cảnh','B1','daily',`put off|trì hoãn|Please do not put off the task until Sunday.|put off a task|phrase
carry out|thực hiện|The group will carry out a short survey.|carry out a survey|phrase
look into|tìm hiểu, xem xét kỹ|We need to look into the connection issue.|look into a problem|phrase
come across|tình cờ gặp hoặc tìm thấy|You may come across a useful example in this article.|come across an idea|phrase
run out of|hết một thứ gì đó|We might run out of time before the last question.|run out of time|phrase
figure out|hiểu ra hoặc tìm ra cách giải quyết|Can you figure out why the example is wrong?|figure out a solution|phrase
turn down|từ chối|She decided to turn down the offer politely.|turn down an offer|phrase
keep up with|theo kịp|I use notes to keep up with the discussion.|keep up with changes|phrase
work out|tìm ra bằng suy nghĩ hoặc tính toán|Let's work out the total cost together.|work out a plan|phrase
bring up|đề cập đến một vấn đề|You can bring up this question at the meeting.|bring up a topic|phrase`],
    ['collocations','Cụm diễn đạt dùng cùng nhau','B2','work',`take into account|cân nhắc, tính đến|We should take into account the needs of new learners.|take into account a factor|phrase
make an effort|cố gắng có chủ đích|I will make an effort to practise every day.|make an effort to improve|phrase
reach an agreement|đạt được thỏa thuận|Both teams hope to reach an agreement this week.|reach an agreement on a plan|phrase
draw a conclusion|rút ra kết luận|Do not draw a conclusion from one example.|draw a conclusion from evidence|phrase
set a goal|đặt ra mục tiêu|Let's set a goal that we can review next week.|set a goal for the week|phrase
keep a promise|giữ lời hứa|It is important to keep a promise you have made.|keep a promise to someone|phrase
pay attention to|chú ý đến|Please pay attention to the ending of each word.|pay attention to a detail|phrase
raise a concern|nêu lên điều lo ngại|Anyone can raise a concern about the plan.|raise a concern about safety|phrase
take responsibility for|nhận trách nhiệm về|I will take responsibility for updating the notes.|take responsibility for a task|phrase
make a difference|tạo ra sự thay đổi có ý nghĩa|A clear explanation can make a difference.|make a difference to learning|phrase`],
    ['academic','Liên kết & lập luận học thuật','C1','study',`nevertheless|tuy vậy|The sample is small; nevertheless, the result is worth studying.|nevertheless the result matters|adverb
whereas|trong khi, dùng để đối chiếu|One group used paper notes, whereas the other used a shared document.|whereas the other group differs|conjunction
consequently|vì thế, do đó|The deadline changed; consequently, we revised the timetable.|consequently we revised the plan|adverb
notwithstanding|mặc dù, bất chấp một yếu tố|Notwithstanding the delay, both teams completed the review.|notwithstanding a delay|preposition
tentative|chưa chắc chắn, còn tạm thời|We have a tentative plan, not a final decision.|a tentative conclusion|adjective
substantiate|đưa ra bằng chứng hỗ trợ|We need data to substantiate this claim.|substantiate a claim|verb
coherent|mạch lạc, các phần liên kết với nhau|The revised essay presents a coherent argument.|a coherent argument|adjective
plausible|có vẻ hợp lý nhưng chưa hẳn đã đúng|This is a plausible explanation, but it needs testing.|a plausible explanation|adjective
ambiguous|có thể hiểu theo nhiều cách|The instruction is ambiguous about the number of examples.|an ambiguous statement|adjective
nuance|sắc thái hoặc khác biệt tinh tế|The translation misses an important nuance in the original.|a subtle nuance|noun`],
    ['nuance','Sắc thái & đánh giá bằng chứng','C2','study',`ostensibly|theo vẻ bề ngoài hoặc lý do được nêu|The change was ostensibly simple, but it affected several teams.|ostensibly a simple change|adverb
unequivocal|rõ ràng, không nhập nhằng|The report does not provide an unequivocal answer.|an unequivocal statement|adjective
discrepancy|sự khác nhau giữa những điều lẽ ra khớp|We found a discrepancy between the two records.|a significant discrepancy|noun
inadvertent|vô ý, không chủ định|The missing reference was an inadvertent error.|an inadvertent omission|adjective
corroborate|xác nhận hoặc hỗ trợ bằng bằng chứng độc lập|A second record can corroborate the observation.|corroborate an account|verb
concede|thừa nhận một điểm dù không thuận lợi cho mình|I concede that the first explanation was unclear.|concede a point|verb
mitigate|làm giảm mức nghiêm trọng|A backup may mitigate the impact of a lost file.|mitigate a risk|verb
elaborate|giải thích thêm chi tiết|Could you elaborate on the reason for this choice?|elaborate on an idea|verb
discern|nhận ra một điều không dễ thấy|It is difficult to discern a pattern in so few examples.|discern a pattern|verb
underlying|nằm bên dưới hoặc làm cơ sở|The discussion explored the underlying assumption.|an underlying assumption|adjective`]
  ];
  const sets=Object.freeze(definitions.map(([id,title,level,topic,rows])=>Object.freeze({id,title,level,topic,provenance,entries:Object.freeze(rows.split('\n').map((row,i)=>{const[term,meaning,example,collocation,pos]=row.split('|');return Object.freeze({id:'hhvx-'+id+'-'+i,term,meaning,example,collocations:[collocation],pos,level,topic,variants:variants[term]||[],source:'hh-original-draft',reviewStatus:'draft',verification:'hh-draft',provenance});}))})));
  const entries=Object.freeze(sets.flatMap(s=>s.entries)),modes=Object.freeze([['cards','Thẻ hai chiều'],['meaning','Chọn nghĩa'],['recall','Nhớ và gõ từ'],['audio','Nghe rồi gõ'],['cloze','Điền vào ngữ cảnh'],['match','Ghép 4 cặp'],['order','Sắp xếp câu'],['collocation','Nhớ cụm từ'],['production','Tự đặt câu'],['mixed','Phiên phối hợp']].map(([id,label])=>({id,label})));
  const normalize=v=>String(v??'').normalize('NFKC').replace(/[‘’]/g,"'").trim().toLowerCase().replace(/[.!?,;:"]/g,'').replace(/\s+/g,' ');
  function shuffle(items,seed){let n=0;for(const c of String(seed))n=(Math.imul(n,31)+c.charCodeAt(0))>>>0;const a=[...items];for(let i=a.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
  const escapeRE=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function task(word,pool,mode,index,seed){const chosen=mode==='mixed'?['meaning','recall','cloze','order','audio','collocation'][index%6]:mode;const base={id:seed+':'+index,mode:chosen,word};
    if(chosen==='cards'||chosen==='production')return{...base,graded:false};
    if(chosen==='match'){const pairs=[word,...shuffle(pool.filter(w=>w.id!==word.id),seed+index)].slice(0,4);return{...base,graded:true,pairs,options:shuffle(pairs,seed+'pairs')};}
    if(chosen==='order')return{...base,graded:true,expected:word.example,tiles:shuffle(word.example.split(/\s+/).map((value,i)=>({id:i,value})),seed+index)};
    if(chosen==='cloze')return{...base,graded:true,expected:word.term,prompt:word.example.replace(new RegExp(escapeRE(word.term),'i'),'_____')};
    if(chosen==='collocation')return{...base,graded:true,expected:word.collocations[0],prompt:'Gõ cụm đã học gắn với từ “'+word.term+'”. Bài đối chiếu một cụm mẫu, không chấm mọi biến thể ngôn ngữ.'};
    if(chosen==='meaning'){const choices=[word.meaning,...new Set(shuffle(pool.filter(w=>w.meaning!==word.meaning),seed+index).map(w=>w.meaning))].slice(0,4);return{...base,graded:true,expected:word.meaning,options:shuffle(choices,seed+'mean')};}
    return{...base,graded:true,expected:word.term};
  }
  function evaluate(t,value){if(!t.graded)return{graded:false,correct:null};const correct=t.mode==='match'?Array.isArray(value)&&value.length===t.pairs.length&&t.pairs.every(p=>value.find(v=>v.id===p.id)?.value===p.id):[t.expected,...(["recall","audio","cloze"].includes(t.mode)?t.word.variants||[]:[])].some(v=>normalize(value)===normalize(v));return{graded:true,correct,expected:t.expected||t.pairs.map(p=>p.term+' → '+p.meaning).join('; '),method:'authored-context-answer-v1'};}
  function normalizeState(state){const source=state.vocabularyStudio?.extension||{},session=source.session&&typeof source.session==='object'?source.session:null;const ext={version:1,setId:sets.some(s=>s.id===source.setId)?source.setId:sets[0].id,query:String(source.query||'').slice(0,100),level:['all','A1','A2','B1','B2','C1','C2'].includes(source.level)?source.level:'all',mode:modes.some(m=>m.id===source.mode)?source.mode:'meaning',favorites:Array.isArray(source.favorites)?[...new Set(source.favorites.filter(id=>sets.some(s=>s.id===id)))]:[],session:session?{...session,ids:Array.isArray(session.ids)?session.ids.filter(id=>entries.some(w=>w.id===id)).slice(0,20):[],index:Math.max(0,Math.min(20,Number(session.index)||0)),drafts:session.drafts&&typeof session.drafts==='object'?session.drafts:{},results:session.results&&typeof session.results==='object'?session.results:{}}:null,attempts:Array.isArray(source.attempts)?source.attempts.slice(-200):[]};state.vocabularyStudio=state.vocabularyStudio||{};state.vocabularyStudio.extension=ext;return ext;}
  function pool(session){return(session?.ids||[]).map(id=>entries.find(w=>w.id===id)).filter(Boolean);}
  function sessionTask(session){if(!session)return null;const words=pool(session),word=words[session.index];return word?task(word,words,session.mode,session.index,session.id):null;}
  function record(state,result,answer,now=new Date().toISOString()){const ext=normalizeState(state),session=ext.session,t=sessionTask(session);if(!t||session.results[t.id]?.correct===true||session.results[t.id]?.graded===false)return false;session.counter=Math.max(0,Number(session.counter)||0)+1;const attempt={id:'hhvx-'+session.id+'-'+session.index+'-'+session.counter,word:t.word.term,mode:t.mode,answer:typeof answer==='string'?answer.slice(0,2000):answer,graded:result.graded,correct:result.correct,expected:result.expected||'',method:result.method||'self-report',at:now};ext.attempts.push(attempt);ext.attempts=ext.attempts.slice(-200);session.results[t.id]=attempt;state.learningOS=state.learningOS||{};state.learningOS.reviewAttempts=[attempt,...(state.learningOS.reviewAttempts||[])].slice(0,1000);
    if(result.graded){state.wordMastery=state.wordMastery||{};for(const word of t.mode==='match'?t.pairs:[t.word]){const right=t.mode==='match'?Array.isArray(answer)&&answer.find(a=>a.id===word.id)?.value===word.id:result.correct,previous=state.wordMastery[word.term]||{},oldAttempts=Math.max(0,Number(previous.attempts)||0),attempts=oldAttempts+1,correct=(Number(previous.correct)||0)+(right?1:0),recall=right&&['recall','audio','cloze'].includes(t.mode),delayed=recall&&Date.parse(previous.lastAssessedAt)<Date.parse(now)-86400000;let score=Math.round(((Number(previous.score)||0)*oldAttempts+(right?100:0))/attempts);if(attempts<5||!(Number(previous.productionSuccesses)>0&&Number(previous.delayedRecalls)>0))score=Math.min(80,score);state.wordMastery[word.term]={...previous,attempts,correct,score,lastAssessedAt:now,updatedAt:now,delayedRecalls:(previous.delayedRecalls||0)+(delayed?1:0),recognitionSuccesses:(previous.recognitionSuccesses||0)+(right&&['meaning','match'].includes(t.mode)?1:0),recallSuccesses:(previous.recallSuccesses||0)+(recall?1:0)};}}
    return true;}
  return Object.freeze({VERSION:1,provenance,sets,entries,modes,normalize,shuffle,task,evaluate,normalizeState,pool,sessionTask,record});
});
