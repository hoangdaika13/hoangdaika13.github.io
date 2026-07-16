(() => {
  "use strict";

  const categoryProfiles = {
    digital: {
      roles: ["Sinh viên công nghệ", "Nhân sự triển khai", "Chuyên viên kỹ thuật", "Trưởng nhóm sản phẩm"],
      skillProfile: { listening: 2, speaking: 3, reading: 5, writing: 4, vocabulary: 5 }
    },
    health: {
      roles: ["Sinh viên khối sức khỏe", "Nhân sự chăm sóc tuyến đầu", "Chuyên viên lâm sàng", "Điều phối viên y tế"],
      skillProfile: { listening: 5, speaking: 5, reading: 4, writing: 3, vocabulary: 5 }
    },
    education: {
      roles: ["Người học/nghiên cứu sinh", "Trợ giảng", "Giáo viên/chuyên viên", "Quản lý giáo dục"],
      skillProfile: { listening: 3, speaking: 4, reading: 5, writing: 5, vocabulary: 4 }
    },
    business: {
      roles: ["Sinh viên kinh tế", "Nhân sự nghiệp vụ", "Chuyên viên phân tích", "Quản lý/điều hành"],
      skillProfile: { listening: 4, speaking: 5, reading: 4, writing: 5, vocabulary: 4 }
    },
    service: {
      roles: ["Người mới vào nghề", "Nhân sự tuyến đầu", "Chuyên viên dịch vụ", "Quản lý trải nghiệm"],
      skillProfile: { listening: 5, speaking: 5, reading: 2, writing: 3, vocabulary: 4 }
    },
    hospitality: {
      roles: ["Sinh viên dịch vụ", "Nhân sự vận hành", "Chuyên viên điều phối", "Quản lý khai thác"],
      skillProfile: { listening: 5, speaking: 5, reading: 3, writing: 3, vocabulary: 4 }
    },
    engineering: {
      roles: ["Sinh viên kỹ thuật", "Kỹ thuật viên", "Kỹ sư/chuyên viên", "Quản lý kỹ thuật"],
      skillProfile: { listening: 3, speaking: 3, reading: 5, writing: 4, vocabulary: 5 }
    },
    environment: {
      roles: ["Sinh viên tài nguyên", "Nhân sự hiện trường", "Chuyên gia kỹ thuật", "Điều phối chương trình"],
      skillProfile: { listening: 3, speaking: 4, reading: 5, writing: 4, vocabulary: 5 }
    },
    society: {
      roles: ["Sinh viên ngành xã hội", "Nhân sự cộng đồng", "Chuyên viên nghiệp vụ", "Quản lý chương trình"],
      skillProfile: { listening: 5, speaking: 5, reading: 5, writing: 5, vocabulary: 4 }
    },
    creative: {
      roles: ["Người học sáng tạo", "Nhân sự sản xuất", "Chuyên viên sáng tạo", "Đạo diễn/giám đốc sáng tạo"],
      skillProfile: { listening: 4, speaking: 5, reading: 3, writing: 4, vocabulary: 5 }
    }
  };

  const categoryVocabulary = {
    digital: `
workflow|luồng công việc|foundation,reading
technical requirement|yêu cầu kỹ thuật|foundation,reading
user story|mô tả nhu cầu người dùng|foundation,reading
acceptance criteria|tiêu chí nghiệm thu|specialist,reading
release cycle|chu kỳ phát hành|specialist,writing
root cause|nguyên nhân gốc|specialist,speaking
service outage|sự cố gián đoạn dịch vụ|specialist,listening
performance metric|chỉ số hiệu năng|specialist,reading
change request|yêu cầu thay đổi|leadership,writing
technical debt|nợ kỹ thuật|leadership,speaking
stakeholder update|cập nhật cho bên liên quan|leadership,speaking
implementation plan|kế hoạch triển khai|leadership,writing`,
    health: `
medical history|tiền sử bệnh|foundation,listening
chief complaint|lý do khám chính|foundation,listening
clinical finding|phát hiện lâm sàng|specialist,reading
care plan|kế hoạch chăm sóc|specialist,writing
patient education|hướng dẫn người bệnh|foundation,speaking
adverse reaction|phản ứng bất lợi|specialist,listening
infection control|kiểm soát nhiễm khuẩn|specialist,reading
follow-up instruction|hướng dẫn tái khám|foundation,speaking
multidisciplinary team|nhóm đa chuyên môn|leadership,speaking
clinical guideline|hướng dẫn lâm sàng|specialist,reading
risk factor|yếu tố nguy cơ|specialist,vocabulary
continuity of care|tính liên tục trong chăm sóc|leadership,writing`,
    education: `
learning need|nhu cầu học tập|foundation,listening
prior knowledge|kiến thức nền|foundation,reading
guided practice|thực hành có hướng dẫn|foundation,speaking
formative assessment|đánh giá quá trình|specialist,reading
summative assessment|đánh giá tổng kết|specialist,reading
scaffolding|hỗ trợ học tập từng bước|specialist,speaking
learner autonomy|khả năng tự chủ của người học|specialist,vocabulary
inclusive practice|thực hành giáo dục hòa nhập|specialist,writing
academic support|hỗ trợ học thuật|foundation,speaking
progress report|báo cáo tiến bộ|leadership,writing
curriculum alignment|sự liên kết chương trình|leadership,reading
learning pathway|lộ trình học tập|leadership,writing`,
    business: `
business objective|mục tiêu kinh doanh|foundation,speaking
operating cost|chi phí vận hành|foundation,reading
revenue stream|nguồn doanh thu|specialist,reading
cash flow|dòng tiền|specialist,vocabulary
key performance indicator|chỉ số hiệu suất chính|specialist,reading
market position|vị thế thị trường|specialist,speaking
business case|luận chứng kinh doanh|leadership,writing
decision maker|người ra quyết định|foundation,listening
action item|đầu việc cần thực hiện|foundation,writing
quarterly target|mục tiêu theo quý|leadership,speaking
cost-benefit analysis|phân tích chi phí lợi ích|leadership,reading
contingency plan|kế hoạch dự phòng|leadership,writing`,
    service: `
customer expectation|kỳ vọng khách hàng|foundation,listening
service request|yêu cầu dịch vụ|foundation,listening
response time|thời gian phản hồi|foundation,vocabulary
customer journey|hành trình khách hàng|specialist,reading
service recovery|khôi phục trải nghiệm dịch vụ|specialist,speaking
complaint handling|xử lý khiếu nại|specialist,listening
quality standard|tiêu chuẩn chất lượng|specialist,reading
personalised service|dịch vụ cá nhân hóa|foundation,speaking
customer retention|giữ chân khách hàng|leadership,reading
experience metric|chỉ số trải nghiệm|leadership,reading
escalation path|luồng chuyển cấp xử lý|specialist,writing
service improvement|cải tiến dịch vụ|leadership,writing`,
    hospitality: `
guest request|yêu cầu của khách|foundation,listening
booking reference|mã đặt chỗ|foundation,vocabulary
departure time|giờ khởi hành|foundation,speaking
service schedule|lịch phục vụ|foundation,reading
operational delay|chậm trễ vận hành|specialist,listening
safety briefing|hướng dẫn an toàn|specialist,speaking
travel document|giấy tờ đi lại|foundation,reading
special assistance|hỗ trợ đặc biệt|specialist,listening
capacity planning|lập kế hoạch công suất|leadership,reading
route disruption|gián đoạn hành trình|specialist,speaking
service coordination|điều phối dịch vụ|leadership,writing
passenger experience|trải nghiệm hành khách|leadership,speaking`,
    engineering: `
technical drawing|bản vẽ kỹ thuật|foundation,reading
design specification|đặc tả thiết kế|specialist,reading
material property|đặc tính vật liệu|specialist,vocabulary
tolerance|dung sai|specialist,vocabulary
prototype test|thử nghiệm nguyên mẫu|specialist,reading
failure mode|dạng hư hỏng|specialist,reading
preventive maintenance|bảo trì phòng ngừa|foundation,writing
safety margin|hệ số an toàn|specialist,vocabulary
quality inspection|kiểm tra chất lượng|foundation,speaking
engineering change|thay đổi kỹ thuật|leadership,writing
production constraint|ràng buộc sản xuất|leadership,speaking
commissioning plan|kế hoạch chạy thử nghiệm thu|leadership,writing`,
    environment: `
baseline survey|khảo sát hiện trạng ban đầu|foundation,reading
field sample|mẫu hiện trường|foundation,vocabulary
habitat condition|tình trạng sinh cảnh|specialist,reading
resource efficiency|hiệu quả sử dụng tài nguyên|specialist,reading
environmental impact|tác động môi trường|specialist,writing
conservation measure|biện pháp bảo tồn|specialist,speaking
seasonal variation|biến động theo mùa|specialist,reading
community livelihood|sinh kế cộng đồng|foundation,listening
monitoring indicator|chỉ số giám sát|leadership,reading
restoration plan|kế hoạch phục hồi|leadership,writing
climate resilience|khả năng chống chịu khí hậu|leadership,vocabulary
sustainable practice|thực hành bền vững|foundation,speaking`,
    society: `
public interest|lợi ích công cộng|foundation,reading
case record|hồ sơ vụ việc|foundation,writing
due process|trình tự thủ tục đúng luật|specialist,reading
vulnerable group|nhóm dễ bị tổn thương|foundation,listening
community outreach|tiếp cận cộng đồng|foundation,speaking
evidence review|rà soát chứng cứ|specialist,reading
conflict resolution|giải quyết xung đột|specialist,speaking
rights-based approach|cách tiếp cận dựa trên quyền|specialist,reading
public consultation|tham vấn công chúng|leadership,listening
policy recommendation|khuyến nghị chính sách|leadership,writing
accountability mechanism|cơ chế trách nhiệm giải trình|leadership,vocabulary
inter-agency coordination|phối hợp liên cơ quan|leadership,speaking`,
    creative: `
creative direction|định hướng sáng tạo|leadership,speaking
production brief|bản yêu cầu sản xuất|foundation,reading
visual reference|tư liệu tham chiếu hình ảnh|foundation,vocabulary
story structure|cấu trúc câu chuyện|specialist,writing
audience insight|hiểu biết về khán giả|specialist,reading
rough cut|bản dựng thô|foundation,speaking
sound design|thiết kế âm thanh|specialist,vocabulary
art direction|chỉ đạo mỹ thuật|leadership,speaking
content format|định dạng nội dung|foundation,reading
usage right|quyền sử dụng nội dung|specialist,reading
creative review|buổi duyệt sáng tạo|leadership,listening
delivery specification|yêu cầu bàn giao|specialist,writing`
  };

  const tracks = [
    {
      id: "cloud-devops", category: "digital", code: "OPS", name: "Cloud & DevOps", viName: "Cloud & DevOps", level: "B1-C1",
      description: "Triển khai dịch vụ cloud, tự động hóa pipeline, giám sát hệ thống và xử lý sự cố vận hành.",
      task: "deploy and operate a reliable cloud service",
      project: "Trình bày kế hoạch triển khai cloud gồm kiến trúc, pipeline, quan sát hệ thống, dự phòng và cách quay lui.",
      vocabulary: `cloud provider|nhà cung cấp dịch vụ đám mây
virtual machine|máy ảo
container|bộ chứa ứng dụng
orchestration|điều phối tài nguyên tự động
infrastructure as code|hạ tầng dưới dạng mã
continuous integration|tích hợp liên tục
continuous delivery|phân phối liên tục
pipeline|chuỗi tự động hóa
load balancer|bộ cân bằng tải
autoscaling|tự động mở rộng
observability|khả năng quan sát hệ thống
monitoring alert|cảnh báo giám sát
uptime|thời gian hoạt động
rollback|quay lui phiên bản
disaster recovery|khôi phục sau thảm họa
secret management|quản lý thông tin bí mật`
    },
    {
      id: "product-ux", category: "digital", code: "UX", name: "Product & UX Design", viName: "Sản phẩm & trải nghiệm người dùng", level: "A2-C1",
      description: "Nghiên cứu người dùng, xác định vấn đề, thiết kế luồng và kiểm chứng sản phẩm số.",
      task: "research and improve a digital user experience",
      project: "Trình bày một đề xuất cải thiện sản phẩm từ nhu cầu người dùng, prototype, thử nghiệm đến chỉ số thành công.",
      vocabulary: `user research|nghiên cứu người dùng
persona|chân dung người dùng
pain point|điểm gây khó khăn
user journey|hành trình người dùng
task flow|luồng tác vụ
wireframe|khung giao diện
prototype|nguyên mẫu tương tác
usability test|kiểm thử khả dụng
design system|hệ thống thiết kế
interaction pattern|mẫu tương tác
information architecture|kiến trúc thông tin
accessibility|khả năng tiếp cận
product discovery|khám phá cơ hội sản phẩm
feature priority|mức ưu tiên tính năng
success metric|chỉ số thành công
design handoff|bàn giao thiết kế`
    },
    {
      id: "game-development", category: "digital", code: "GAME", name: "Game Development", viName: "Phát triển game", level: "A2-C1",
      description: "Thiết kế gameplay, xây hệ thống game, tối ưu hiệu năng và phối hợp art, audio, code.",
      task: "build and balance an engaging game feature",
      project: "Pitch một tính năng game gồm core loop, luật chơi, cân bằng, tài sản cần thiết, telemetry và kế hoạch thử nghiệm.",
      vocabulary: `gameplay loop|vòng lặp lối chơi
game mechanic|cơ chế trò chơi
player feedback|phản hồi cho người chơi
level design|thiết kế màn chơi
game engine|bộ máy game
asset pipeline|quy trình tài sản game
frame rate|tốc độ khung hình
collision detection|phát hiện va chạm
non-player character|nhân vật không phải người chơi
difficulty curve|đường cong độ khó
game balance|cân bằng trò chơi
playtest|chơi thử kiểm chứng
telemetry|dữ liệu hành vi trong game
matchmaking|ghép trận
save system|hệ thống lưu tiến trình
live operations|vận hành game trực tuyến`
    },
    {
      id: "telecommunications-networking", category: "digital", code: "TEL", name: "Telecommunications & Networking", viName: "Viễn thông & mạng", level: "B1-C1",
      description: "Mô tả hạ tầng mạng, tín hiệu, chất lượng dịch vụ và quá trình xử lý gián đoạn.",
      task: "diagnose and improve a communications network",
      project: "Báo cáo sự cố mạng gồm phạm vi ảnh hưởng, chỉ số, nguyên nhân, giải pháp và phương án ngăn tái diễn.",
      vocabulary: `bandwidth|băng thông
signal strength|cường độ tín hiệu
packet loss|mất gói tin
network topology|cấu trúc liên kết mạng
base station|trạm gốc
fiber optic cable|cáp quang
wireless spectrum|phổ tần không dây
routing protocol|giao thức định tuyến
network switch|bộ chuyển mạch mạng
quality of service|chất lượng dịch vụ
throughput|thông lượng
jitter|độ biến thiên trễ
coverage area|vùng phủ sóng
network congestion|tắc nghẽn mạng
failover|chuyển đổi dự phòng
service restoration|khôi phục dịch vụ`
    },
    {
      id: "physiotherapy-rehabilitation", category: "health", code: "PT", name: "Physiotherapy & Rehabilitation", viName: "Vật lý trị liệu & phục hồi chức năng", level: "A2-C1",
      description: "Đánh giá vận động, hướng dẫn bài tập và theo dõi tiến triển phục hồi của người bệnh.",
      task: "assess mobility and guide a rehabilitation programme",
      project: "Mô phỏng buổi đánh giá và lập kế hoạch phục hồi với mục tiêu, bài tập, cảnh báo và tiêu chí tiến triển.",
      vocabulary: `range of motion|tầm vận động
mobility|khả năng di chuyển
posture|tư thế
muscle strength|sức mạnh cơ
joint stiffness|cứng khớp
pain scale|thang điểm đau
gait|dáng đi
balance training|luyện thăng bằng
therapeutic exercise|bài tập trị liệu
manual therapy|trị liệu bằng tay
assistive device|thiết bị trợ giúp
weight bearing|chịu trọng lượng
home exercise programme|chương trình tập tại nhà
functional goal|mục tiêu chức năng
progress note|ghi chú tiến triển
discharge planning|lập kế hoạch kết thúc điều trị`
    },
    {
      id: "nutrition-dietetics", category: "health", code: "NUT", name: "Nutrition & Dietetics", viName: "Dinh dưỡng & tiết chế", level: "A2-C1",
      description: "Khai thác thói quen ăn uống, giải thích nhu cầu dinh dưỡng và lập kế hoạch ăn phù hợp.",
      task: "assess nutrition needs and explain a practical meal plan",
      project: "Tư vấn một ca dinh dưỡng gồm đánh giá, mục tiêu, khẩu phần, theo dõi và điều chỉnh an toàn.",
      vocabulary: `nutrient|chất dinh dưỡng
calorie intake|lượng calo nạp vào
balanced diet|chế độ ăn cân bằng
portion size|kích thước khẩu phần
dietary history|tiền sử ăn uống
food allergy|dị ứng thực phẩm
food intolerance|không dung nạp thực phẩm
body mass index|chỉ số khối cơ thể
meal plan|kế hoạch bữa ăn
carbohydrate|chất bột đường
protein|chất đạm
dietary fibre|chất xơ
micronutrient|vi chất dinh dưỡng
nutrition label|nhãn dinh dưỡng
dietary restriction|hạn chế ăn uống
nutrition counselling|tư vấn dinh dưỡng`
    },
    {
      id: "veterinary-medicine", category: "health", code: "VET", name: "Veterinary Medicine", viName: "Thú y", level: "A2-C1",
      description: "Thu thập bệnh sử vật nuôi, mô tả khám, điều trị và hướng dẫn chủ nuôi chăm sóc.",
      task: "examine an animal and explain a safe treatment plan",
      project: "Mô phỏng tư vấn thú y từ triệu chứng, khám, xét nghiệm, điều trị đến hướng dẫn theo dõi tại nhà.",
      vocabulary: `animal patient|bệnh nhân động vật
species|loài
breed|giống
vaccination|tiêm phòng
parasite|ký sinh trùng
appetite|khẩu vị
lethargy|trạng thái lờ đờ
physical examination|khám thể chất
veterinary clinic|phòng khám thú y
neutering|triệt sản
microchip|vi mạch nhận dạng
animal welfare|phúc lợi động vật
dosage by weight|liều theo cân nặng
quarantine|cách ly
owner instruction|hướng dẫn chủ nuôi
follow-up examination|khám lại`
    },
    {
      id: "language-teaching-translation", category: "education", code: "LANG", name: "Language Teaching & Translation", viName: "Giảng dạy ngôn ngữ & biên phiên dịch", level: "B1-C2",
      description: "Dạy ngôn ngữ, phân tích nhu cầu, dịch ý chính xác và xử lý khác biệt văn hóa.",
      task: "teach or mediate meaning accurately across languages",
      project: "Thiết kế một hoạt động ngôn ngữ kèm bản dịch, mục tiêu Can Do, khó khăn dự kiến và tiêu chí phản hồi.",
      vocabulary: `target language|ngôn ngữ đích
source language|ngôn ngữ nguồn
communicative task|nhiệm vụ giao tiếp
language function|chức năng ngôn ngữ
register|sắc thái phong cách
collocation|cụm từ kết hợp tự nhiên
idiomatic expression|cách diễn đạt thành ngữ
translation brief|yêu cầu dịch thuật
terminology base|cơ sở thuật ngữ
consecutive interpreting|phiên dịch nối tiếp
simultaneous interpreting|phiên dịch đồng thời
meaning negotiation|thương lượng ý nghĩa
error correction|sửa lỗi
fluency|độ trôi chảy
accuracy|độ chính xác
cultural reference|tham chiếu văn hóa`
    },
    {
      id: "academic-administration", category: "education", code: "ADM", name: "Academic Administration", viName: "Quản trị học vụ", level: "A2-C1",
      description: "Tư vấn thủ tục học tập, quản lý hồ sơ, lịch học và hỗ trợ sinh viên quốc tế.",
      task: "guide a learner through an academic process",
      project: "Xây dựng hướng dẫn nhập học gồm hồ sơ, mốc thời gian, điều kiện, hỗ trợ và kênh giải đáp.",
      vocabulary: `admission requirement|điều kiện tuyển sinh
application form|đơn đăng ký
academic record|hồ sơ học tập
transcript|bảng điểm
enrolment|việc ghi danh
tuition fee|học phí
scholarship|học bổng
course registration|đăng ký môn học
prerequisite|môn/điều kiện tiên quyết
credit transfer|chuyển đổi tín chỉ
academic calendar|lịch học vụ
student status|trạng thái sinh viên
graduation requirement|điều kiện tốt nghiệp
student support|hỗ trợ sinh viên
international office|phòng hợp tác quốc tế
appeal procedure|quy trình khiếu nại`
    },
    {
      id: "library-information", category: "education", code: "LIB", name: "Library & Information Science", viName: "Thư viện & khoa học thông tin", level: "A2-C1",
      description: "Hỗ trợ tìm kiếm tài liệu, quản lý bộ sưu tập và hướng dẫn đánh giá nguồn thông tin.",
      task: "help a user find and evaluate reliable information",
      project: "Thiết kế buổi hướng dẫn tìm tin gồm từ khóa, cơ sở dữ liệu, tiêu chí nguồn và trích dẫn.",
      vocabulary: `catalogue|mục lục thư viện
call number|ký hiệu xếp giá
database search|tìm kiếm cơ sở dữ liệu
search term|từ khóa tìm kiếm
subject heading|đề mục chủ đề
full text|toàn văn
peer-reviewed source|nguồn đã phản biện
reference desk|quầy tham khảo
interlibrary loan|mượn liên thư viện
digital repository|kho lưu trữ số
metadata|siêu dữ liệu
archive|kho lưu trữ
information literacy|năng lực thông tin
source evaluation|đánh giá nguồn
citation style|kiểu trích dẫn
access restriction|hạn chế truy cập`
    },
    {
      id: "fintech-digital-banking", category: "business", code: "FIN", name: "FinTech & Digital Banking", viName: "FinTech & ngân hàng số", level: "B1-C1",
      description: "Giải thích sản phẩm tài chính số, giao dịch, rủi ro gian lận và tuân thủ khách hàng.",
      task: "explain and assess a secure digital financial service",
      project: "Pitch một dịch vụ tài chính số gồm nhu cầu, hành trình giao dịch, kiểm soát rủi ro và chỉ số vận hành.",
      vocabulary: `digital wallet|ví điện tử
payment gateway|cổng thanh toán
transaction fee|phí giao dịch
account verification|xác minh tài khoản
know your customer|quy trình hiểu khách hàng
anti-money laundering|chống rửa tiền
fraud detection|phát hiện gian lận
credit scoring|chấm điểm tín dụng
open banking|ngân hàng mở
application programming interface|giao diện lập trình ứng dụng
financial inclusion|tài chính toàn diện
real-time payment|thanh toán thời gian thực
chargeback|hoàn trả giao dịch tranh chấp
transaction limit|hạn mức giao dịch
data privacy|quyền riêng tư dữ liệu
regulatory sandbox|khung thử nghiệm pháp lý`
    },
    {
      id: "procurement-sourcing", category: "business", code: "BUY", name: "Procurement & Strategic Sourcing", viName: "Mua hàng & tìm nguồn cung", level: "B1-C1",
      description: "Xác định nhu cầu mua, đánh giá nhà cung cấp, đàm phán điều khoản và theo dõi hợp đồng.",
      task: "select a supplier and negotiate a responsible purchase",
      project: "Trình bày hồ sơ chọn nhà cung cấp gồm tiêu chí, báo giá, rủi ro, điều khoản và khuyến nghị.",
      vocabulary: `purchase requisition|đề nghị mua hàng
request for quotation|yêu cầu báo giá
tender|hồ sơ mời thầu
bidder|bên dự thầu
supplier evaluation|đánh giá nhà cung cấp
unit price|đơn giá
lead time|thời gian chờ cung ứng
minimum order quantity|số lượng đặt hàng tối thiểu
contract term|điều khoản hợp đồng
service level agreement|thỏa thuận mức dịch vụ
total cost of ownership|tổng chi phí sở hữu
negotiation point|điểm đàm phán
purchase order|đơn đặt hàng
ethical sourcing|tìm nguồn cung có đạo đức
supplier risk|rủi ro nhà cung cấp
contract renewal|gia hạn hợp đồng`
    },
    {
      id: "project-management", category: "business", code: "PM", name: "Project Management", viName: "Quản lý dự án", level: "A2-C1",
      description: "Lập phạm vi, lịch, nguồn lực, theo dõi rủi ro và điều phối các bên liên quan.",
      task: "plan and deliver a project with clear ownership",
      project: "Trình bày kế hoạch dự án gồm phạm vi, milestone, nguồn lực, rủi ro, truyền thông và tiêu chí hoàn thành.",
      vocabulary: `project scope|phạm vi dự án
deliverable|sản phẩm bàn giao
milestone|cột mốc
work breakdown structure|cấu trúc phân rã công việc
dependency|sự phụ thuộc
project sponsor|nhà bảo trợ dự án
project charter|tuyên bố dự án
resource allocation|phân bổ nguồn lực
risk register|sổ đăng ký rủi ro
status report|báo cáo trạng thái
critical path|đường găng
scope creep|phạm vi tăng ngoài kiểm soát
issue log|nhật ký vấn đề
project closure|kết thúc dự án
lessons learned|bài học kinh nghiệm
governance meeting|cuộc họp quản trị`
    },
    {
      id: "event-management", category: "service", code: "EVT", name: "Event Management", viName: "Tổ chức sự kiện", level: "A2-C1",
      description: "Lập kế hoạch sự kiện, phối hợp nhà cung cấp, khách mời, lịch chạy và xử lý tình huống.",
      task: "plan and operate a safe, memorable event",
      project: "Pitch kế hoạch sự kiện gồm mục tiêu, run sheet, ngân sách, nhà cung cấp, rủi ro và trải nghiệm khách.",
      vocabulary: `event concept|ý tưởng sự kiện
venue|địa điểm tổ chức
guest list|danh sách khách mời
run sheet|kịch bản vận hành theo giờ
registration desk|quầy đăng ký
speaker briefing|hướng dẫn diễn giả
stage setup|thiết lập sân khấu
audio-visual equipment|thiết bị nghe nhìn
catering service|dịch vụ ăn uống
vendor|nhà cung cấp
event capacity|sức chứa sự kiện
contingency venue|địa điểm dự phòng
crowd control|kiểm soát đám đông
event insurance|bảo hiểm sự kiện
post-event survey|khảo sát sau sự kiện
breakdown schedule|lịch tháo dỡ`
    },
    {
      id: "insurance-claims", category: "service", code: "CLM", name: "Insurance Claims", viName: "Bảo hiểm & bồi thường", level: "B1-C1",
      description: "Thu thập thông tin tổn thất, giải thích phạm vi bảo hiểm và xử lý hồ sơ bồi thường rõ ràng.",
      task: "assess and communicate an insurance claim fairly",
      project: "Mô phỏng xử lý hồ sơ bồi thường từ thông báo tổn thất, chứng từ, đánh giá đến quyết định.",
      vocabulary: `policyholder|người được bảo hiểm
insurance policy|hợp đồng bảo hiểm
coverage|phạm vi bảo hiểm
premium|phí bảo hiểm
deductible|mức khấu trừ
claim form|đơn yêu cầu bồi thường
loss event|sự kiện tổn thất
supporting document|chứng từ hỗ trợ
claim assessor|chuyên viên đánh giá bồi thường
exclusion|điều khoản loại trừ
settlement|khoản giải quyết bồi thường
liability|trách nhiệm pháp lý
fraud indicator|dấu hiệu gian lận
repair estimate|dự toán sửa chữa
claim decision|quyết định bồi thường
appeal process|quy trình khiếu nại`
    },
    {
      id: "property-facilities", category: "service", code: "FAC", name: "Property & Facilities Management", viName: "Quản lý tòa nhà & cơ sở vật chất", level: "A2-C1",
      description: "Điều phối bảo trì, nhà thầu, tiện ích và trải nghiệm người sử dụng tòa nhà.",
      task: "operate a safe and efficient facility",
      project: "Lập kế hoạch vận hành tòa nhà gồm bảo trì, năng lượng, nhà thầu, sự cố và phản hồi người dùng.",
      vocabulary: `facility|cơ sở vật chất
tenant|khách thuê
maintenance request|yêu cầu bảo trì
building system|hệ thống tòa nhà
heating and ventilation|hệ thống sưởi và thông gió
utility meter|đồng hồ tiện ích
preventive inspection|kiểm tra phòng ngừa
contractor|nhà thầu
access badge|thẻ ra vào
occupancy|mức sử dụng mặt bằng
cleaning schedule|lịch vệ sinh
energy consumption|mức tiêu thụ năng lượng
emergency exit|lối thoát hiểm
building compliance|tuân thủ quy định tòa nhà
service charge|phí dịch vụ
facility audit|kiểm toán cơ sở vật chất`
    },
    {
      id: "cabin-crew", category: "hospitality", code: "CAB", name: "Cabin Crew", viName: "Tiếp viên hàng không", level: "A2-C1",
      description: "Chào đón hành khách, hướng dẫn an toàn, phục vụ và xử lý tình huống trên chuyến bay.",
      task: "support passengers and manage an in-flight situation",
      project: "Mô phỏng chuyến bay gồm boarding, safety demo, dịch vụ, hỗ trợ đặc biệt và tình huống bất thường.",
      vocabulary: `cabin crew|tiếp viên hàng không
boarding pass|thẻ lên máy bay
overhead compartment|ngăn hành lý phía trên
seat belt|dây an toàn
emergency equipment|thiết bị khẩn cấp
safety demonstration|hướng dẫn an toàn
turbulence|nhiễu động không khí
in-flight service|dịch vụ trên chuyến bay
special meal|suất ăn đặc biệt
passenger announcement|thông báo cho hành khách
medical incident|sự cố y tế
emergency landing|hạ cánh khẩn cấp
brace position|tư thế an toàn khi va chạm
disembarkation|quá trình xuống máy bay
flight deck|buồng lái
crew resource management|quản lý nguồn lực tổ bay`
    },
    {
      id: "rail-transport", category: "hospitality", code: "RAIL", name: "Rail Transport", viName: "Vận tải đường sắt", level: "A2-B2",
      description: "Hướng dẫn hành khách, điều phối hành trình, thông báo chậm tàu và đảm bảo an toàn.",
      task: "coordinate a safe rail journey and inform passengers",
      project: "Xây dựng phương án phục vụ một hành trình đường sắt có thay đổi lịch, chuyển tuyến và hỗ trợ khách.",
      vocabulary: `railway station|ga đường sắt
platform|sân ga
carriage|toa hành khách
train service|chuyến tàu
departure board|bảng giờ khởi hành
track change|thay đổi đường ray
rail pass|thẻ đi tàu
seat reservation|đặt chỗ ngồi
connecting train|tàu nối chuyến
signal failure|lỗi tín hiệu
service delay|chậm chuyến
replacement bus|xe buýt thay thế
railway crossing|đường ngang đường sắt
on-board inspector|nhân viên kiểm tra trên tàu
lost property|tài sản thất lạc
passenger assistance|hỗ trợ hành khách`
    },
    {
      id: "hotel-revenue-management", category: "hospitality", code: "REV", name: "Hotel Revenue Management", viName: "Quản trị doanh thu khách sạn", level: "B1-C1",
      description: "Phân tích nhu cầu, giá phòng, công suất và kênh bán để tối ưu doanh thu khách sạn.",
      task: "forecast hotel demand and recommend a pricing plan",
      project: "Trình bày chiến lược giá theo mùa gồm dự báo, phân khúc, kênh bán, công suất và rủi ro.",
      vocabulary: `room rate|giá phòng
occupancy rate|tỷ lệ lấp đầy
average daily rate|giá phòng trung bình ngày
revenue per available room|doanh thu trên phòng sẵn có
demand forecast|dự báo nhu cầu
booking pace|tốc độ đặt phòng
rate parity|tính nhất quán giá
distribution channel|kênh phân phối
online travel agency|đại lý du lịch trực tuyến
room inventory|quỹ phòng
market segment|phân khúc thị trường
length of stay|thời gian lưu trú
seasonal demand|nhu cầu theo mùa
dynamic pricing|định giá linh hoạt
overbooking strategy|chiến lược bán vượt chỗ
revenue report|báo cáo doanh thu`
    },
    {
      id: "biomedical-engineering", category: "engineering", code: "BME", name: "Biomedical Engineering", viName: "Kỹ thuật y sinh", level: "B1-C1",
      description: "Thiết kế, kiểm tra và quản lý thiết bị y tế theo yêu cầu lâm sàng và an toàn.",
      task: "evaluate and maintain a safe medical device",
      project: "Trình bày kế hoạch đưa một thiết bị y tế vào sử dụng gồm yêu cầu, thử nghiệm, đào tạo và bảo trì.",
      vocabulary: `medical device|thiết bị y tế
biocompatibility|khả năng tương thích sinh học
clinical requirement|yêu cầu lâm sàng
sensor calibration|hiệu chuẩn cảm biến
patient monitor|máy theo dõi bệnh nhân
prosthetic device|thiết bị giả thay thế
diagnostic equipment|thiết bị chẩn đoán
electrical safety|an toàn điện
device validation|xác nhận giá trị thiết bị
human factors|yếu tố con người
maintenance record|hồ sơ bảo trì
sterilisation cycle|chu trình tiệt trùng
alarm system|hệ thống cảnh báo
risk classification|phân loại rủi ro
clinical engineering|kỹ thuật lâm sàng
post-market surveillance|giám sát sau lưu hành`
    },
    {
      id: "robotics-automation", category: "engineering", code: "ROB", name: "Robotics & Automation", viName: "Robot & tự động hóa", level: "B1-C1",
      description: "Tích hợp robot, cảm biến, điều khiển và quy trình tự động an toàn trong sản xuất.",
      task: "design and troubleshoot an automated system",
      project: "Trình bày cell robot gồm tác vụ, cảm biến, logic điều khiển, vùng an toàn và chỉ số vận hành.",
      vocabulary: `industrial robot|robot công nghiệp
robotic arm|cánh tay robot
end effector|cơ cấu chấp hành cuối
programmable logic controller|bộ điều khiển logic lập trình
motion control|điều khiển chuyển động
machine vision|thị giác máy
proximity sensor|cảm biến tiệm cận
automation cell|ô tự động hóa
safety interlock|liên động an toàn
emergency stop|nút dừng khẩn cấp
cycle time|thời gian chu kỳ
teach pendant|thiết bị dạy robot
path planning|lập kế hoạch đường đi
human-robot collaboration|hợp tác người và robot
fault code|mã lỗi
system integration|tích hợp hệ thống`
    },
    {
      id: "electronics-semiconductor", category: "engineering", code: "CHIP", name: "Electronics & Semiconductor", viName: "Điện tử & bán dẫn", level: "B1-C2",
      description: "Đọc sơ đồ, kiểm tra mạch, mô tả quy trình bán dẫn và phân tích lỗi linh kiện.",
      task: "test and explain an electronic or semiconductor process",
      project: "Báo cáo thử nghiệm một bo mạch hoặc quy trình chip gồm thiết kế, đo lường, lỗi và hành động cải thiện.",
      vocabulary: `integrated circuit|mạch tích hợp
semiconductor wafer|tấm bán dẫn
transistor|bóng bán dẫn
printed circuit board|bo mạch in
circuit diagram|sơ đồ mạch
voltage regulator|bộ ổn áp
signal integrity|tính toàn vẹn tín hiệu
solder joint|mối hàn
cleanroom|phòng sạch
photolithography|quang khắc
wafer fabrication|chế tạo tấm bán dẫn
yield rate|tỷ lệ sản phẩm đạt
electrical test|kiểm tra điện
component failure|lỗi linh kiện
electrostatic discharge|phóng tĩnh điện
failure analysis|phân tích hư hỏng`
    },
    {
      id: "food-technology", category: "environment", code: "FOOD", name: "Food Technology", viName: "Công nghệ thực phẩm", level: "A2-C1",
      description: "Kiểm soát nguyên liệu, quy trình chế biến, an toàn thực phẩm và chất lượng sản phẩm.",
      task: "develop and verify a safe food production process",
      project: "Trình bày quy trình sản phẩm thực phẩm gồm nguyên liệu, điểm kiểm soát, thử nghiệm, bao bì và hạn dùng.",
      vocabulary: `raw ingredient|nguyên liệu thô
food formulation|công thức thực phẩm
processing temperature|nhiệt độ chế biến
pasteurisation|thanh trùng
food additive|phụ gia thực phẩm
sensory evaluation|đánh giá cảm quan
shelf life|thời hạn sử dụng
foodborne hazard|mối nguy từ thực phẩm
critical control point|điểm kiểm soát tới hạn
traceability|khả năng truy xuất
packaging material|vật liệu bao bì
nutritional composition|thành phần dinh dưỡng
microbial test|kiểm tra vi sinh
product recall|thu hồi sản phẩm
batch record|hồ sơ lô
food safety plan|kế hoạch an toàn thực phẩm`
    },
    {
      id: "forestry-conservation", category: "environment", code: "FOR", name: "Forestry & Conservation", viName: "Lâm nghiệp & bảo tồn", level: "A2-C1",
      description: "Khảo sát rừng, quản lý sinh cảnh, phục hồi hệ sinh thái và làm việc với cộng đồng.",
      task: "assess and protect a forest ecosystem",
      project: "Xây dựng kế hoạch quản lý khu rừng gồm khảo sát, nguy cơ, phục hồi, sinh kế và chỉ số theo dõi.",
      vocabulary: `forest inventory|kiểm kê rừng
tree species|loài cây
canopy cover|độ che phủ tán
forest plot|ô tiêu chuẩn rừng
biodiversity|đa dạng sinh học
protected area|khu bảo tồn
wildlife corridor|hành lang động vật hoang dã
illegal logging|khai thác gỗ trái phép
forest fire|cháy rừng
reforestation|trồng lại rừng
native species|loài bản địa
invasive species|loài xâm lấn
ecosystem service|dịch vụ hệ sinh thái
community forest|rừng cộng đồng
patrol route|tuyến tuần tra
conservation agreement|thỏa thuận bảo tồn`
    },
    {
      id: "international-development", category: "society", code: "DEVX", name: "International Development", viName: "Phát triển quốc tế", level: "B1-C2",
      description: "Thiết kế chương trình xã hội, làm việc đa văn hóa và báo cáo kết quả cho đối tác tài trợ.",
      task: "design and communicate an inclusive development programme",
      project: "Trình bày đề xuất chương trình gồm nhu cầu, đối tượng, hoạt động, ngân sách, chỉ số và tính bền vững.",
      vocabulary: `needs assessment|đánh giá nhu cầu
target population|nhóm dân số mục tiêu
programme objective|mục tiêu chương trình
theory of change|lý thuyết thay đổi
development partner|đối tác phát triển
grant proposal|đề xuất tài trợ
beneficiary|người thụ hưởng
community participation|sự tham gia cộng đồng
gender equality|bình đẳng giới
social inclusion|hòa nhập xã hội
monitoring framework|khung giám sát
impact evaluation|đánh giá tác động
capacity building|nâng cao năng lực
local ownership|quyền làm chủ địa phương
safeguarding policy|chính sách bảo vệ
donor report|báo cáo nhà tài trợ`
    },
    {
      id: "policing-criminal-justice", category: "society", code: "CJS", name: "Policing & Criminal Justice", viName: "Cảnh sát & tư pháp hình sự", level: "B1-C1",
      description: "Ghi nhận sự việc, phỏng vấn, bảo quản chứng cứ và giao tiếp đúng thủ tục.",
      task: "document and communicate a criminal justice case responsibly",
      project: "Mô phỏng xử lý vụ việc gồm tiếp nhận, lời khai, chứng cứ, quyền của các bên và bàn giao hồ sơ.",
      vocabulary: `incident report|báo cáo sự việc
witness statement|lời khai nhân chứng
suspect|người bị tình nghi
victim support|hỗ trợ nạn nhân
crime scene|hiện trường vụ án
physical evidence|vật chứng
chain of custody|chuỗi bảo quản chứng cứ
interview caution|cảnh báo quyền khi phỏng vấn
reasonable suspicion|nghi ngờ có căn cứ
arrest procedure|thủ tục bắt giữ
case file|hồ sơ vụ án
criminal charge|cáo buộc hình sự
court hearing|phiên tòa
probation|án treo/quản chế
rehabilitation programme|chương trình hoàn lương
professional conduct|chuẩn mực nghề nghiệp`
    },
    {
      id: "film-video-production", category: "creative", code: "FILM", name: "Film & Video Production", viName: "Sản xuất phim & video", level: "A2-C1",
      description: "Phát triển ý tưởng, quay, dựng, làm màu và bàn giao video theo yêu cầu sản xuất.",
      task: "plan, shoot and deliver a polished video story",
      project: "Pitch một video từ logline, shot list, lịch quay, hậu kỳ, âm thanh đến thông số xuất bản.",
      vocabulary: `logline|câu tóm tắt ý tưởng phim
screenplay|kịch bản điện ảnh
storyboard|bảng phân cảnh
shot list|danh sách cảnh quay
camera angle|góc máy
focal length|tiêu cự
frame composition|bố cục khung hình
continuity|tính liên tục cảnh
principal photography|giai đoạn quay chính
editing timeline|dòng thời gian dựng
colour grading|chỉnh màu điện ảnh
visual effect|hiệu ứng hình ảnh
voice-over|lời thuyết minh
subtitle|phụ đề
render preset|thiết lập kết xuất
master file|tệp bản chuẩn`
    },
    {
      id: "music-audio-production", category: "creative", code: "AUD", name: "Music & Audio Production", viName: "Sản xuất âm nhạc & âm thanh", level: "A2-C1",
      description: "Thu âm, biên tập, phối trộn và hoàn thiện âm thanh cho nhạc, podcast và nội dung số.",
      task: "record, mix and deliver a clear audio production",
      project: "Trình bày quy trình sản xuất audio từ session, micro, edit, mix, master đến chuẩn bàn giao.",
      vocabulary: `recording session|buổi thu âm
microphone placement|vị trí đặt micro
audio interface|giao diện âm thanh
sample rate|tần số lấy mẫu
bit depth|độ sâu bit
multitrack recording|thu âm đa rãnh
waveform|dạng sóng
noise floor|mức nhiễu nền
equalisation|cân bằng tần số
compression|nén dải động
reverb|hiệu ứng vang
panning|định vị âm thanh trái phải
mix bus|kênh tổng phối
mastering|hoàn thiện bản âm thanh
loudness level|mức âm lượng cảm nhận
audio export|xuất tệp âm thanh`
    }
  ];

  const expansion = { categoryProfiles, categoryVocabulary, tracks };
  if (typeof window !== "undefined") window.HHEnglishCareerExpansion = expansion;
  if (typeof module !== "undefined" && module.exports) module.exports = expansion;
})();
