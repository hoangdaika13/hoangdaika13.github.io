(() => {
  "use strict";

  const categories = [
    { id: "digital", name: "Công nghệ số", color: "#63e8ff" },
    { id: "health", name: "Y tế & con người", color: "#80f4b4" },
    { id: "education", name: "Giáo dục & nghiên cứu", color: "#9a86ff" },
    { id: "business", name: "Kinh doanh & tài chính", color: "#ffe66d" },
    { id: "service", name: "Marketing & dịch vụ", color: "#ff8ccf" },
    { id: "hospitality", name: "Du lịch & vận tải", color: "#67dbc8" },
    { id: "engineering", name: "Kỹ thuật & công nghiệp", color: "#ff9c66" },
    { id: "environment", name: "Môi trường & nông nghiệp", color: "#a8ef72" },
    { id: "society", name: "Luật & xã hội", color: "#7bb7ff" },
    { id: "creative", name: "Truyền thông & sáng tạo", color: "#ef78ff" }
  ];

  const words = (source) => source.trim().split("\n").map((line) => {
    const [term, meaning] = line.split("|").map((part) => part.trim());
    return [term, "Thuật ngữ", meaning];
  });

  const track = (id, category, code, name, viName, level, description, task, project, vocabulary) => ({
    id, category, code, name, viName, level, description, task, project, vocabulary: words(vocabulary)
  });

  const rawTracks = [
    track("software-development", "digital", "DEV", "Software Development", "Phát triển phần mềm", "A2-C1",
      "Viết mã, cộng tác theo Git, kiểm thử và đưa một tính năng lên môi trường thật.",
      "deliver a stable software feature", "Trình bày kế hoạch phát hành một tính năng, nêu rủi ro, kiểm thử và phương án quay lui.", `
repository|kho mã nguồn
branch|nhánh mã
commit|bản ghi thay đổi
pull request|yêu cầu hợp nhất mã
issue|vấn đề cần xử lý
bug|lỗi phần mềm
feature|tính năng
framework|khung phát triển
library|thư viện mã
dependency|gói phụ thuộc
API|giao diện lập trình ứng dụng
endpoint|điểm cuối dịch vụ
database|cơ sở dữ liệu
query|truy vấn
deployment|quá trình triển khai
build|bản dựng
test suite|bộ kiểm thử
code review|quá trình rà soát mã
refactor|tái cấu trúc mã
authentication|xác thực danh tính
authorization|phân quyền truy cập
scalability|khả năng mở rộng
latency|độ trễ
documentation|tài liệu kỹ thuật`),
    track("data-ai", "digital", "AI", "Data & Artificial Intelligence", "Dữ liệu & trí tuệ nhân tạo", "B1-C2",
      "Làm việc với dữ liệu, mô hình, chỉ số đánh giá và giao tiếp có trách nhiệm về AI.",
      "evaluate and explain an AI model", "Tóm tắt kết quả một mô hình AI cho cả nhóm kỹ thuật và người không chuyên.", `
dataset|tập dữ liệu
feature|biến đầu vào
label|nhãn dữ liệu
model|mô hình
training|quá trình huấn luyện
validation|quá trình kiểm định
inference|quá trình suy luận
algorithm|thuật toán
accuracy|độ chính xác tổng thể
precision|độ chính xác dự đoán dương
recall|độ bao phủ trường hợp đúng
bias|thiên lệch
variance|phương sai
overfitting|hiện tượng quá khớp
pipeline|quy trình xử lý dữ liệu
preprocessing|tiền xử lý
annotation|gán nhãn dữ liệu
benchmark|chuẩn so sánh
prompt|câu lệnh cho mô hình
embedding|vector biểu diễn
hallucination|nội dung mô hình tạo sai
explainability|khả năng giải thích
dashboard|bảng điều khiển dữ liệu
insight|phát hiện hữu ích`),
    track("cybersecurity", "digital", "SEC", "Cybersecurity", "An ninh mạng", "B1-C1",
      "Nhận diện mối đe dọa, mô tả sự cố, hướng dẫn bảo vệ tài khoản và báo cáo rủi ro.",
      "contain and report a security incident", "Soạn bản tóm tắt sự cố, mức ảnh hưởng, hành động khắc phục và bài học phòng ngừa.", `
threat|mối đe dọa
vulnerability|lỗ hổng
exploit|kỹ thuật khai thác lỗ hổng
malware|phần mềm độc hại
phishing|lừa đảo đánh cắp thông tin
firewall|tường lửa
encryption|mã hóa
credential|thông tin đăng nhập
breach|vụ xâm phạm dữ liệu
incident|sự cố
patch|bản vá
backup|bản sao lưu
access control|kiểm soát truy cập
multi-factor authentication|xác thực đa yếu tố
audit log|nhật ký kiểm toán
endpoint|thiết bị đầu cuối
network traffic|lưu lượng mạng
intrusion detection|phát hiện xâm nhập
risk assessment|đánh giá rủi ro
mitigation|biện pháp giảm thiểu
zero trust|mô hình không tin cậy mặc định
social engineering|thao túng tâm lý
recovery plan|kế hoạch khôi phục
compliance|tuân thủ quy định`),
    track("it-support", "digital", "IT", "IT Support", "Hỗ trợ công nghệ thông tin", "A2-B2",
      "Tiếp nhận yêu cầu, chẩn đoán lỗi thiết bị và hướng dẫn người dùng rõ ràng.",
      "diagnose and resolve a user problem", "Thực hiện cuộc gọi hỗ trợ từ lúc tiếp nhận đến khi xác nhận lỗi đã được giải quyết.", `
ticket|phiếu yêu cầu hỗ trợ
help desk|bộ phận hỗ trợ kỹ thuật
device|thiết bị
operating system|hệ điều hành
driver|trình điều khiển thiết bị
installation|quá trình cài đặt
configuration|cấu hình
account|tài khoản
permission|quyền truy cập
password reset|đặt lại mật khẩu
network|mạng máy tính
router|bộ định tuyến
connectivity|khả năng kết nối
troubleshoot|chẩn đoán và xử lý lỗi
reproduce|tái hiện lỗi
error message|thông báo lỗi
remote access|truy cập từ xa
update|bản cập nhật
backup|bản sao lưu
restore|khôi phục
escalation|chuyển vấn đề lên cấp cao hơn
service level|mức dịch vụ cam kết
resolution|cách giải quyết
knowledge base|kho kiến thức hỗ trợ`),
    track("nursing-healthcare", "health", "MED", "Healthcare & Nursing", "Y tế & điều dưỡng", "A2-C1",
      "Giao tiếp với bệnh nhân, ghi nhận triệu chứng và bàn giao thông tin chăm sóc an toàn.",
      "support a patient and communicate clinical information", "Mô phỏng tiếp nhận bệnh nhân, giải thích quy trình và bàn giao ca trực.", `
patient|bệnh nhân
symptom|triệu chứng
diagnosis|chẩn đoán
treatment|điều trị
medication|thuốc điều trị
dosage|liều dùng
vital signs|dấu hiệu sinh tồn
blood pressure|huyết áp
temperature|nhiệt độ cơ thể
pulse|mạch
appointment|lịch hẹn
ward|khoa điều trị
discharge|xuất viện
admission|nhập viện
allergy|dị ứng
consent|sự đồng ý
procedure|thủ thuật
wound|vết thương
infection|nhiễm trùng
specimen|mẫu xét nghiệm
monitor|theo dõi
handover|bàn giao ca
caregiver|người chăm sóc
emergency|tình huống cấp cứu`),
    track("pharmacy-laboratory", "health", "LAB", "Pharmacy & Laboratory", "Dược & phòng thí nghiệm", "B1-C1",
      "Đọc đơn thuốc, hướng dẫn sử dụng và mô tả quy trình kiểm soát chất lượng phòng lab.",
      "dispense safely and explain a laboratory result", "Giải thích cách dùng thuốc hoặc kết quả xét nghiệm bằng ngôn ngữ dễ hiểu và có cảnh báo phù hợp.", `
prescription|đơn thuốc
pharmacist|dược sĩ
tablet|viên nén
capsule|viên nang
side effect|tác dụng phụ
contraindication|chống chỉ định
interaction|tương tác thuốc
expiry date|hạn sử dụng
storage|điều kiện bảo quản
compound|pha chế
sample|mẫu
reagent|thuốc thử
microscope|kính hiển vi
assay|phép xét nghiệm
concentration|nồng độ
sterile|vô trùng
contamination|sự nhiễm bẩn
result|kết quả
reference range|khoảng tham chiếu
batch|lô sản phẩm
quality control|kiểm soát chất lượng
label|nhãn
dispense|cấp phát thuốc
laboratory report|báo cáo xét nghiệm`),
    track("dentistry", "health", "DEN", "Dentistry", "Nha khoa", "A2-B2",
      "Hỏi bệnh sử, mô tả điều trị nha khoa và hướng dẫn chăm sóc sau thủ thuật.",
      "explain a dental problem and treatment", "Thực hiện tư vấn ngắn từ kiểm tra răng đến hướng dẫn chăm sóc sau điều trị.", `
tooth|răng
gum|nướu
cavity|lỗ sâu răng
filling|miếng trám
crown|mão răng
root canal|điều trị tủy
extraction|nhổ răng
plaque|mảng bám
tartar|cao răng
floss|chỉ nha khoa
braces|niềng răng
X-ray|ảnh X-quang
anaesthetic|thuốc gây tê
sensitivity|tình trạng ê buốt
appointment|lịch hẹn
dental chart|hồ sơ răng
bite|khớp cắn
impression|dấu răng
implant|trụ cấy ghép
hygiene|vệ sinh
swelling|sưng
bleeding|chảy máu
decay|sâu răng
follow-up|lịch tái khám`),
    track("psychology-social-work", "health", "PSY", "Psychology & Social Work", "Tâm lý & công tác xã hội", "B1-C1",
      "Lắng nghe chủ động, đặt câu hỏi nhạy cảm và ghi chép hỗ trợ có trách nhiệm.",
      "conduct a supportive and confidential conversation", "Xây dựng kế hoạch hỗ trợ ngắn với mục tiêu, nguồn lực và bước theo dõi rõ ràng.", `
client|thân chủ
counselling|tham vấn
assessment|đánh giá
behaviour|hành vi
emotion|cảm xúc
trauma|sang chấn
stress|căng thẳng
anxiety|lo âu
depression|trầm cảm
coping strategy|chiến lược ứng phó
support network|mạng lưới hỗ trợ
confidentiality|tính bảo mật
referral|chuyển gửi chuyên môn
intervention|biện pháp can thiệp
wellbeing|trạng thái khỏe mạnh
resilience|khả năng phục hồi
boundary|ranh giới nghề nghiệp
safeguarding|bảo vệ người dễ tổn thương
case note|ghi chép hồ sơ ca
session|buổi làm việc
goal setting|thiết lập mục tiêu
active listening|lắng nghe chủ động
empathy|sự đồng cảm
crisis plan|kế hoạch xử lý khủng hoảng`),
    track("teaching-education", "education", "EDU", "Teaching & Education", "Giảng dạy & giáo dục", "A2-C1",
      "Lập kế hoạch bài học, hướng dẫn hoạt động và phản hồi tiến bộ của người học.",
      "plan and deliver an inclusive lesson", "Trình bày một kế hoạch bài học có mục tiêu, hoạt động, đánh giá và hỗ trợ khác biệt.", `
curriculum|chương trình giáo dục
syllabus|đề cương môn học
lesson plan|giáo án
learning objective|mục tiêu học tập
classroom|lớp học
assignment|bài tập
rubric|bảng tiêu chí chấm
feedback|phản hồi
assessment|đánh giá
attendance|điểm danh
participation|sự tham gia
instruction|lời hướng dẫn
explanation|phần giải thích
example|ví dụ
group work|hoạt động nhóm
differentiation|dạy học phân hóa
accessibility|khả năng tiếp cận
homework|bài tập về nhà
deadline|hạn nộp
grade|điểm số
revision|ôn tập
parent meeting|họp phụ huynh
learning outcome|kết quả học tập
academic integrity|liêm chính học thuật`),
    track("science-research", "education", "SCI", "Science & Research", "Khoa học & nghiên cứu", "B1-C2",
      "Mô tả phương pháp, đánh giá bằng chứng và trình bày giới hạn nghiên cứu.",
      "design and communicate a research study", "Trình bày tóm tắt nghiên cứu gồm câu hỏi, phương pháp, kết quả và giới hạn.", `
hypothesis|giả thuyết
experiment|thí nghiệm
variable|biến số
control group|nhóm đối chứng
observation|quan sát
measurement|phép đo
sample|mẫu nghiên cứu
method|phương pháp
evidence|bằng chứng
result|kết quả
analysis|phân tích
conclusion|kết luận
replicate|lặp lại nghiên cứu
peer review|phản biện đồng cấp
citation|trích dẫn
abstract|tóm tắt nghiên cứu
literature review|tổng quan tài liệu
methodology|phương pháp luận
limitation|giới hạn
correlation|mối tương quan
causation|quan hệ nhân quả
ethics approval|phê duyệt đạo đức
publication|công bố
conference|hội nghị`),
    track("business-management", "business", "MGT", "Business & Management", "Kinh doanh & quản trị", "A2-C1",
      "Điều hành cuộc họp, phân tích mục tiêu và thống nhất hành động với các bên liên quan.",
      "coordinate a business plan and team decision", "Thuyết trình kế hoạch quý với ngân sách, rủi ro, chỉ số và người phụ trách.", `
strategy|chiến lược
objective|mục tiêu
stakeholder|bên liên quan
revenue|doanh thu
cost|chi phí
profit|lợi nhuận
budget|ngân sách
forecast|dự báo
operation|hoạt động vận hành
workflow|luồng công việc
productivity|năng suất
performance indicator|chỉ số hiệu suất
meeting agenda|chương trình họp
action item|đầu việc cần thực hiện
deadline|hạn chót
proposal|đề xuất
negotiation|đàm phán
contract|hợp đồng
supplier|nhà cung cấp
customer|khách hàng
market share|thị phần
risk|rủi ro
decision|quyết định
implementation|quá trình triển khai`),
    track("accounting", "business", "ACC", "Accounting", "Kế toán", "B1-C1",
      "Giải thích báo cáo tài chính, đối chiếu số liệu và trao đổi về kiểm toán.",
      "prepare and explain accurate financial records", "Tóm tắt tình hình tài chính tháng, giải thích chênh lệch và đề xuất bước kiểm tra.", `
asset|tài sản
liability|nợ phải trả
equity|vốn chủ sở hữu
income|thu nhập
expense|chi phí
balance sheet|bảng cân đối kế toán
income statement|báo cáo kết quả kinh doanh
cash flow|dòng tiền
invoice|hóa đơn
receipt|biên lai
ledger|sổ cái
journal entry|bút toán
debit|ghi nợ
credit|ghi có
tax|thuế
audit|kiểm toán
payroll|bảng lương
depreciation|khấu hao
inventory|hàng tồn kho
reconciliation|đối chiếu
fiscal year|năm tài chính
variance|chênh lệch
compliance|tuân thủ
financial statement|báo cáo tài chính`),
    track("banking-insurance", "business", "BNK", "Banking & Insurance", "Ngân hàng & bảo hiểm", "A2-C1",
      "Tư vấn giao dịch, khoản vay, bảo hiểm và giải thích rủi ro tài chính rõ ràng.",
      "explain a financial product and its risks", "Mô phỏng tư vấn sản phẩm tài chính phù hợp với nhu cầu và mức chấp nhận rủi ro.", `
account|tài khoản
deposit|tiền gửi
withdrawal|rút tiền
transfer|chuyển khoản
interest rate|lãi suất
loan|khoản vay
mortgage|khoản vay thế chấp
credit score|điểm tín dụng
collateral|tài sản bảo đảm
instalment|khoản trả góp
premium|phí bảo hiểm
policy|hợp đồng bảo hiểm
claim|yêu cầu bồi thường
coverage|phạm vi bảo hiểm
deductible|mức khấu trừ
beneficiary|người thụ hưởng
fraud|gian lận
transaction|giao dịch
statement|sao kê
exchange rate|tỷ giá
investment|khoản đầu tư
portfolio|danh mục đầu tư
risk profile|hồ sơ rủi ro
financial advice|tư vấn tài chính`),
    track("human-resources", "business", "HR", "Human Resources", "Nhân sự & tuyển dụng", "A2-C1",
      "Viết thông báo tuyển dụng, phỏng vấn ứng viên và trao đổi chính sách nhân sự.",
      "recruit, onboard and support an employee", "Thiết kế quy trình tuyển và hội nhập cho một vị trí mới, kèm tiêu chí đánh giá.", `
vacancy|vị trí tuyển dụng
candidate|ứng viên
application|hồ sơ ứng tuyển
résumé|sơ yếu nghề nghiệp
interview|phỏng vấn
qualification|trình độ chuyên môn
experience|kinh nghiệm
reference|người tham chiếu
onboarding|quá trình hội nhập
orientation|buổi định hướng
probation|thời gian thử việc
performance review|đánh giá hiệu suất
training|đào tạo
benefit|phúc lợi
salary|mức lương
leave|nghỉ phép
promotion|thăng chức
grievance|khiếu nại nội bộ
policy|chính sách
diversity|sự đa dạng
inclusion|sự hòa nhập
retention|giữ chân nhân sự
dismissal|chấm dứt việc làm
succession plan|kế hoạch kế nhiệm`),
    track("entrepreneurship-ecommerce", "business", "ECM", "Entrepreneurship & E-commerce", "Khởi nghiệp & thương mại điện tử", "A2-C1",
      "Mô tả sản phẩm, vận hành cửa hàng số và theo dõi hành trình mua hàng.",
      "launch and improve an online business", "Tạo bản giới thiệu cửa hàng gồm khách hàng mục tiêu, giá, thanh toán, giao hàng và chỉ số tăng trưởng.", `
business model|mô hình kinh doanh
value proposition|giá trị đề xuất
target customer|khách hàng mục tiêu
product listing|trang thông tin sản phẩm
shopping cart|giỏ hàng
checkout|bước thanh toán
payment gateway|cổng thanh toán
conversion rate|tỷ lệ chuyển đổi
traffic|lưu lượng truy cập
campaign|chiến dịch
inventory|hàng tồn kho
fulfilment|quá trình hoàn tất đơn
shipping fee|phí vận chuyển
return policy|chính sách đổi trả
customer acquisition|thu hút khách hàng
profit margin|biên lợi nhuận
supplier|nhà cung cấp
marketplace|sàn giao dịch
subscription|gói đăng ký
analytics|phân tích số liệu
landing page|trang đích
pricing|định giá
refund|hoàn tiền
growth|tăng trưởng`),
    track("marketing-sales", "service", "MKT", "Marketing & Sales", "Marketing & bán hàng", "A2-C1",
      "Xây dựng thông điệp, nghiên cứu khách hàng và xử lý phản đối trong bán hàng.",
      "plan a campaign and persuade a customer ethically", "Trình bày chiến dịch với đối tượng, kênh, thông điệp, chỉ số và cách theo dõi.", `
brand|thương hiệu
audience|đối tượng
campaign|chiến dịch
content|nội dung
channel|kênh
lead|khách hàng tiềm năng
prospect|đối tượng có khả năng mua
conversion|chuyển đổi
engagement|mức tương tác
reach|lượng tiếp cận
impression|lượt hiển thị
click-through rate|tỷ lệ nhấp
call to action|lời kêu gọi hành động
keyword|từ khóa
search engine optimization|tối ưu công cụ tìm kiếm
market research|nghiên cứu thị trường
competitor|đối thủ
positioning|định vị
segment|phân khúc
offer|ưu đãi
sales pitch|bài chào bán
objection|ý kiến phản đối
follow-up|liên hệ tiếp
customer journey|hành trình khách hàng`),
    track("customer-service-retail", "service", "CSR", "Customer Service & Retail", "Chăm sóc khách hàng & bán lẻ", "A1-B2",
      "Tư vấn sản phẩm, xử lý khiếu nại và xác nhận giải pháp với khách hàng.",
      "resolve a customer request politely", "Mô phỏng một ca khiếu nại từ lúc lắng nghe đến khi xác nhận khách hàng hài lòng.", `
customer|khách hàng
enquiry|yêu cầu thông tin
complaint|khiếu nại
refund|hoàn tiền
exchange|đổi hàng
receipt|biên lai
stock|hàng trong kho
aisle|lối hàng
checkout|quầy thanh toán
discount|giảm giá
promotion|khuyến mãi
loyalty card|thẻ khách hàng thân thiết
size|kích cỡ
warranty|bảo hành
queue|hàng chờ
delivery|giao hàng
damaged item|sản phẩm hư hỏng
supervisor|người giám sát
solution|giải pháp
apology|lời xin lỗi
satisfaction|sự hài lòng
product recommendation|gợi ý sản phẩm
return policy|chính sách trả hàng
feedback|phản hồi`),
    track("real-estate", "service", "EST", "Real Estate", "Bất động sản", "A2-C1",
      "Giới thiệu bất động sản, tổ chức buổi xem nhà và giải thích điều khoản thuê mua.",
      "present and negotiate a property agreement", "Thực hiện bài giới thiệu một bất động sản và xử lý ba câu hỏi của khách hàng.", `
property|bất động sản
listing|tin đăng
tenant|người thuê
landlord|chủ nhà
buyer|người mua
seller|người bán
agent|môi giới
viewing|buổi xem nhà
lease|hợp đồng thuê
rent|tiền thuê
deposit|tiền đặt cọc
mortgage|khoản vay thế chấp
valuation|định giá
floor plan|sơ đồ mặt bằng
location|vị trí
amenity|tiện ích
renovation|cải tạo
inspection|kiểm tra
contract|hợp đồng
commission|hoa hồng
negotiation|đàm phán
maintenance|bảo trì
utility|dịch vụ điện nước
handover|bàn giao`),
    track("tourism-hospitality", "hospitality", "TRV", "Tourism & Hospitality", "Du lịch & khách sạn", "A1-B2",
      "Đón khách, xử lý đặt phòng và giới thiệu trải nghiệm địa phương.",
      "support a guest throughout a trip", "Mô phỏng hành trình khách từ đặt phòng, nhận phòng đến xử lý một yêu cầu đặc biệt.", `
guest|khách lưu trú
reservation|đặt chỗ
check-in|nhận phòng
check-out|trả phòng
reception|quầy lễ tân
room service|dịch vụ phòng
itinerary|lịch trình
tour guide|hướng dẫn viên
attraction|điểm tham quan
destination|điểm đến
accommodation|chỗ ở
vacancy|phòng còn trống
luggage|hành lý
passport|hộ chiếu
cancellation|hủy đặt chỗ
upgrade|nâng hạng
complaint|khiếu nại
facility|cơ sở tiện ích
housekeeping|bộ phận buồng phòng
concierge|nhân viên hỗ trợ khách
excursion|chuyến tham quan ngắn
booking reference|mã đặt chỗ
local cuisine|ẩm thực địa phương
hospitality|dịch vụ hiếu khách`),
    track("culinary-food-service", "hospitality", "CUL", "Culinary & Food Service", "Ẩm thực & dịch vụ ăn uống", "A1-B2",
      "Đọc công thức, phối hợp trong bếp và trao đổi về dị ứng, vệ sinh, chất lượng món.",
      "prepare and serve food safely", "Trình bày một món ăn từ nguyên liệu, quy trình, yêu cầu ăn kiêng đến cách phục vụ.", `
ingredient|nguyên liệu
recipe|công thức
portion|khẩu phần
preparation|khâu sơ chế
seasoning|gia vị
flavour|hương vị
texture|kết cấu món
appetizer|món khai vị
main course|món chính
dessert|món tráng miệng
allergy|dị ứng
dietary requirement|yêu cầu ăn kiêng
kitchen station|khu vực bếp
utensil|dụng cụ bếp
oven|lò nướng
simmer|nấu liu riu
grill|nướng
garnish|trang trí món
hygiene|vệ sinh
cross-contamination|nhiễm chéo
stock|nước dùng
order ticket|phiếu gọi món
service|khâu phục vụ
waste|thực phẩm lãng phí`),
    track("logistics-supply-chain", "hospitality", "LOG", "Logistics & Supply Chain", "Logistics & chuỗi cung ứng", "A2-C1",
      "Theo dõi lô hàng, phối hợp kho vận và xử lý chậm trễ hoặc hư hỏng.",
      "coordinate a shipment from supplier to customer", "Báo cáo trạng thái một lô hàng, nguyên nhân chậm trễ và kế hoạch khắc phục.", `
shipment|lô hàng
cargo|hàng hóa vận chuyển
warehouse|kho
inventory|hàng tồn kho
supplier|nhà cung cấp
purchase order|đơn mua hàng
delivery note|phiếu giao hàng
freight|hàng vận chuyển
carrier|đơn vị vận chuyển
route|tuyến đường
customs|hải quan
clearance|thông quan
container|công-ten-nơ
pallet|kiện kê hàng
tracking number|mã theo dõi
lead time|thời gian từ đặt đến nhận
dispatch|gửi hàng
receiving|nhận hàng
picking|lấy hàng trong kho
packing|đóng gói
stock level|mức tồn kho
delay|sự chậm trễ
damage|hư hỏng
supply chain|chuỗi cung ứng`),
    track("aviation-airport", "hospitality", "AIR", "Aviation & Airport", "Hàng không & sân bay", "A2-C1",
      "Hướng dẫn hành khách, thực hiện thông báo và giao tiếp trong tình huống an toàn.",
      "assist passengers and communicate flight operations", "Thực hiện chuỗi thông báo cho một chuyến bay bị chậm và hỗ trợ hành khách nối chuyến.", `
flight|chuyến bay
passenger|hành khách
boarding pass|thẻ lên máy bay
gate|cửa ra máy bay
runway|đường băng
cockpit|buồng lái
cabin crew|phi hành đoàn khoang khách
aircraft|máy bay
departure|khởi hành
arrival|đến nơi
delay|chậm chuyến
turbulence|nhiễu động
safety briefing|hướng dẫn an toàn
seat belt|dây an toàn
baggage allowance|hạn mức hành lý
check-in desk|quầy làm thủ tục
boarding|quá trình lên máy bay
landing|hạ cánh
take-off|cất cánh
air traffic control|kiểm soát không lưu
itinerary|lịch trình
connection|chuyến nối
emergency exit|cửa thoát hiểm
announcement|thông báo`),
    track("maritime-shipping", "hospitality", "SEA", "Maritime & Shipping", "Hàng hải & vận tải biển", "B1-C1",
      "Mô tả hoạt động tàu, cảng, hàng hóa và quy trình an toàn trên biển.",
      "coordinate a safe voyage and port operation", "Báo cáo kế hoạch chuyến đi, hàng hóa, thời tiết và bước kiểm tra an toàn.", `
vessel|tàu
port|cảng
harbour|bến cảng
cargo|hàng hóa
container|công-ten-nơ
deck|boong tàu
bridge|buồng chỉ huy
crew|thủy thủ đoàn
captain|thuyền trưởng
navigation|hàng hải
route|tuyến đường
tide|thủy triều
weather forecast|dự báo thời tiết
anchor|neo
berth|vị trí neo đậu
manifest|bản kê hàng
customs|hải quan
freight|hàng vận chuyển
loading|xếp hàng
unloading|dỡ hàng
safety equipment|thiết bị an toàn
life jacket|áo phao
inspection|kiểm tra
voyage|hành trình biển`),
    track("engineering-manufacturing", "engineering", "ENG", "Engineering & Manufacturing", "Kỹ thuật & sản xuất", "B1-C1",
      "Đọc thông số, mô tả quy trình sản xuất và báo cáo lỗi chất lượng.",
      "improve a production process safely", "Trình bày nguyên nhân lỗi sản phẩm, hành động sửa chữa và cách phòng ngừa tái diễn.", `
specification|thông số kỹ thuật
blueprint|bản vẽ kỹ thuật
prototype|nguyên mẫu
component|linh kiện
material|vật liệu
tolerance|dung sai
measurement|phép đo
assembly|lắp ráp
production line|dây chuyền sản xuất
machine|máy móc
calibration|hiệu chuẩn
maintenance|bảo trì
defect|khuyết tật
quality assurance|đảm bảo chất lượng
safety standard|tiêu chuẩn an toàn
output|sản lượng
efficiency|hiệu suất
downtime|thời gian dừng máy
root cause|nguyên nhân gốc
corrective action|hành động khắc phục
process|quy trình
operator|người vận hành
inspection|kiểm tra
continuous improvement|cải tiến liên tục`),
    track("construction-architecture", "engineering", "BLD", "Construction & Architecture", "Xây dựng & kiến trúc", "A2-C1",
      "Đọc bản vẽ, phối hợp công trường và giải thích yêu cầu an toàn, tiến độ.",
      "coordinate a building project", "Báo cáo tiến độ công trường, vật liệu, nguy cơ, ngân sách và bước nghiệm thu.", `
site|công trường
architect|kiến trúc sư
engineer|kỹ sư
contractor|nhà thầu
subcontractor|nhà thầu phụ
blueprint|bản vẽ kỹ thuật
foundation|móng
structure|kết cấu
beam|dầm
column|cột
concrete|bê tông
brickwork|khối xây gạch
scaffolding|giàn giáo
measurement|phép đo
material|vật liệu
schedule|tiến độ
budget|ngân sách
permit|giấy phép
inspection|kiểm tra
safety helmet|mũ bảo hộ
hazard|mối nguy
renovation|cải tạo
handover|bàn giao
building code|quy chuẩn xây dựng`),
    track("automotive-maintenance", "engineering", "CAR", "Automotive & Maintenance", "Ô tô & bảo dưỡng", "A2-B2",
      "Tiếp nhận xe, mô tả triệu chứng, chẩn đoán và giải thích phương án sửa chữa.",
      "inspect and repair a vehicle", "Mô phỏng tư vấn sửa xe gồm lỗi, phụ tùng, chi phí, thời gian và kiểm tra sau sửa.", `
vehicle|phương tiện
engine|động cơ
brake|phanh
tyre|lốp xe
battery|ắc quy
transmission|hộp số
fuel|nhiên liệu
oil|dầu máy
coolant|nước làm mát
diagnostic|chẩn đoán
fault code|mã lỗi
service|bảo dưỡng
repair|sửa chữa
replacement|thay thế
inspection|kiểm tra
mileage|số ki-lô-mét đã đi
steering|hệ thống lái
suspension|hệ thống treo
exhaust|ống xả
workshop|xưởng
mechanic|thợ máy
spare part|phụ tùng
maintenance schedule|lịch bảo dưỡng
road test|chạy thử`),
    track("energy-utilities", "engineering", "PWR", "Energy & Utilities", "Năng lượng & tiện ích", "B1-C1",
      "Mô tả hệ thống điện, nhu cầu tải, sự cố và giải pháp năng lượng tái tạo.",
      "operate and explain an energy system", "Trình bày phương án giảm tiêu thụ và tăng độ tin cậy cho một cơ sở.", `
power plant|nhà máy điện
grid|lưới điện
electricity|điện năng
voltage|điện áp
current|dòng điện
generator|máy phát điện
transformer|máy biến áp
meter|công tơ
outage|mất điện
demand|nhu cầu
supply|nguồn cung
renewable energy|năng lượng tái tạo
solar panel|tấm pin mặt trời
wind turbine|tuabin gió
battery storage|hệ lưu trữ pin
efficiency|hiệu suất
consumption|mức tiêu thụ
emission|phát thải
maintenance|bảo trì
safety procedure|quy trình an toàn
utility|đơn vị tiện ích
load|phụ tải
capacity|công suất
distribution|phân phối`),
    track("agriculture-food-production", "environment", "AGR", "Agriculture & Food Production", "Nông nghiệp & sản xuất thực phẩm", "A2-B2",
      "Mô tả mùa vụ, vật nuôi, chất lượng và chuỗi truy xuất thực phẩm.",
      "plan safe and productive farm operations", "Trình bày kế hoạch một mùa vụ gồm đất, nước, sâu bệnh, thu hoạch và bảo quản.", `
crop|cây trồng
soil|đất
seed|hạt giống
fertilizer|phân bón
pesticide|thuốc bảo vệ thực vật
irrigation|tưới tiêu
harvest|thu hoạch
livestock|vật nuôi
feed|thức ăn chăn nuôi
greenhouse|nhà kính
farm equipment|thiết bị nông nghiệp
yield|năng suất
disease|bệnh
pest|sinh vật gây hại
weather|thời tiết
organic|hữu cơ
food safety|an toàn thực phẩm
processing|chế biến
packaging|đóng gói
storage|bảo quản
quality|chất lượng
traceability|khả năng truy xuất
supply|nguồn cung
season|mùa vụ`),
    track("environment-sustainability", "environment", "ECO", "Environment & Sustainability", "Môi trường & phát triển bền vững", "B1-C2",
      "Đánh giá tác động, giải thích dữ liệu môi trường và đề xuất hành động bền vững.",
      "assess and communicate an environmental plan", "Soạn đề xuất giảm tác động môi trường với mục tiêu, chỉ số và đánh đổi.", `
ecosystem|hệ sinh thái
biodiversity|đa dạng sinh học
conservation|bảo tồn
pollution|ô nhiễm
waste|chất thải
recycling|tái chế
emission|phát thải
carbon footprint|dấu chân carbon
climate|khí hậu
renewable resource|tài nguyên tái tạo
water quality|chất lượng nước
air quality|chất lượng không khí
habitat|môi trường sống
sustainability|tính bền vững
environmental impact|tác động môi trường
regulation|quy định
monitoring|quan trắc
restoration|phục hồi
circular economy|kinh tế tuần hoàn
energy efficiency|hiệu quả năng lượng
climate adaptation|thích ứng khí hậu
mitigation|giảm nhẹ
assessment|đánh giá
target|mục tiêu`),
    track("law-public-service", "society", "LAW", "Law & Public Service", "Luật & hành chính công", "B1-C2",
      "Giải thích quyền, nghĩa vụ, thủ tục và điều khoản bằng ngôn ngữ chính xác, dễ hiểu.",
      "explain a legal or public procedure responsibly", "Tóm tắt một hồ sơ công gồm căn cứ, quy trình, lựa chọn và bước khiếu nại.", `
law|luật
regulation|quy định
policy|chính sách
right|quyền
duty|nghĩa vụ
evidence|bằng chứng
witness|nhân chứng
case|vụ việc
court|tòa án
hearing|phiên điều trần
appeal|kháng nghị
contract|hợp đồng
clause|điều khoản
liability|trách nhiệm pháp lý
offence|hành vi vi phạm
penalty|hình phạt
legal advice|tư vấn pháp lý
public service|dịch vụ công
application|đơn đề nghị
permit|giấy phép
record|hồ sơ
procedure|thủ tục
authority|cơ quan có thẩm quyền
compliance|tuân thủ`),
    track("public-safety-emergency", "society", "EMS", "Public Safety & Emergency", "An toàn công cộng & khẩn cấp", "A2-C1",
      "Báo cáo sự cố, đưa hướng dẫn khẩn cấp và phối hợp ứng phó rõ ràng.",
      "coordinate an emergency response", "Thực hiện báo cáo tình huống từ cảnh báo ban đầu đến sơ tán, hỗ trợ và phục hồi.", `
emergency|tình huống khẩn cấp
incident|sự cố
hazard|mối nguy
evacuation|sơ tán
first aid|sơ cứu
responder|nhân viên ứng phó
fire alarm|chuông báo cháy
extinguisher|bình chữa cháy
rescue|cứu hộ
casualty|người bị nạn
shelter|nơi trú ẩn
warning|cảnh báo
dispatch|điều phối lực lượng
radio|bộ đàm
scene|hiện trường
perimeter|vành đai an toàn
report|báo cáo
evidence|bằng chứng
safety equipment|thiết bị an toàn
risk|rủi ro
procedure|quy trình
drill|diễn tập
recovery|phục hồi
coordination|sự phối hợp`),
    track("media-design-content", "creative", "DSN", "Media, Design & Content", "Thiết kế, media & nội dung", "A2-C1",
      "Nhận brief, giải thích lựa chọn thiết kế và bàn giao tài sản số đúng yêu cầu.",
      "develop and present a creative deliverable", "Trình bày một sản phẩm sáng tạo từ brief, ý tưởng, phiên bản chỉnh sửa đến xuất file.", `
brief|bản yêu cầu sáng tạo
concept|ý tưởng chủ đạo
audience|đối tượng
layout|bố cục
composition|sự sắp xếp thị giác
typography|nghệ thuật chữ
colour palette|bảng màu
contrast|độ tương phản
hierarchy|thứ bậc thị giác
logo|biểu trưng
brand guideline|hướng dẫn thương hiệu
mock-up|bản mô phỏng
prototype|nguyên mẫu
resolution|độ phân giải
crop|cắt ảnh
layer|lớp
mask|mặt nạ
vector|đồ họa vector
raster|đồ họa điểm ảnh
export|xuất tệp
file format|định dạng tệp
revision|lần chỉnh sửa
approval|phê duyệt
deliverable|sản phẩm bàn giao`),
    track("journalism-communications", "creative", "JRN", "Journalism & Communications", "Báo chí & truyền thông", "B1-C2",
      "Phỏng vấn, kiểm chứng nguồn và viết nội dung chính xác cho nhiều kênh.",
      "research and publish a responsible story", "Xây dựng bản tin gồm góc tiếp cận, nguồn, kiểm chứng, tiêu đề và đính chính nếu cần.", `
headline|tiêu đề
article|bài báo
reporter|phóng viên
editor|biên tập viên
source|nguồn tin
interview|phỏng vấn
quote|trích dẫn
fact-check|kiểm chứng thông tin
deadline|hạn chót
breaking news|tin nóng
feature|bài chuyên đề
press release|thông cáo báo chí
newsroom|tòa soạn
audience|công chúng
angle|góc tiếp cận
bias|thiên lệch
verification|xác minh
caption|chú thích
broadcast|phát sóng
script|kịch bản
correspondent|phóng viên thường trú
publication|ấn phẩm
correction|đính chính
ethics|đạo đức nghề nghiệp`),
    track("sports-fitness", "creative", "FIT", "Sports & Fitness", "Thể thao & thể hình", "A1-B2",
      "Hướng dẫn động tác, xây kế hoạch tập và trao đổi về mục tiêu, phục hồi.",
      "coach a safe and effective training session", "Thiết kế buổi tập gồm khởi động, bài chính, cường độ, nghỉ và phục hồi.", `
warm-up|khởi động
workout|buổi tập
repetition|lần lặp
set|hiệp tập
endurance|sức bền
strength|sức mạnh
flexibility|độ dẻo
balance|thăng bằng
coach|huấn luyện viên
athlete|vận động viên
training plan|kế hoạch tập luyện
recovery|phục hồi
injury|chấn thương
nutrition|dinh dưỡng
hydration|bổ sung nước
heart rate|nhịp tim
goal|mục tiêu
performance|thành tích
technique|kỹ thuật
equipment|thiết bị
competition|thi đấu
referee|trọng tài
score|điểm số
fitness assessment|đánh giá thể lực`),
    track("beauty-wellness", "creative", "BTY", "Beauty & Wellness", "Làm đẹp & chăm sóc sức khỏe", "A1-B2",
      "Tư vấn nhu cầu, mô tả dịch vụ và hướng dẫn chăm sóc sau liệu trình.",
      "provide a safe and personalised beauty service", "Mô phỏng buổi tư vấn gồm nhu cầu, chống chỉ định, dịch vụ và chăm sóc sau đó.", `
consultation|buổi tư vấn
skin type|loại da
treatment|liệu trình
product|sản phẩm
ingredient|thành phần
allergy|dị ứng
hygiene|vệ sinh
sterilize|khử trùng
appointment|lịch hẹn
client|khách hàng
hairstyle|kiểu tóc
haircut|cắt tóc
colour|nhuộm màu
manicure|chăm sóc móng tay
skincare|chăm sóc da
massage|mát-xa
aftercare|chăm sóc sau dịch vụ
sensitivity|độ nhạy cảm
recommendation|khuyến nghị
salon|cơ sở làm đẹp
booking|đặt lịch
service|dịch vụ
result|kết quả
contraindication|chống chỉ định`),
    track("fashion-textile", "creative", "FSH", "Fashion & Textile", "Thời trang & dệt may", "A2-C1",
      "Mô tả vật liệu, thiết kế bộ sưu tập và phối hợp sản xuất, kiểm tra chất lượng.",
      "develop and present a fashion product", "Trình bày một sản phẩm từ ý tưởng, vải, rập, thử đồ đến kế hoạch ra mắt.", `
fabric|vải
textile|hàng dệt
pattern|rập
garment|trang phục
measurement|số đo
size chart|bảng kích cỡ
seam|đường may
stitch|mũi may
sample|mẫu thử
collection|bộ sưu tập
trend|xu hướng
designer|nhà thiết kế
supplier|nhà cung cấp
production|sản xuất
quality check|kiểm tra chất lượng
fitting|buổi thử đồ
alteration|chỉnh sửa trang phục
label|nhãn
sustainable material|vật liệu bền vững
inventory|hàng tồn kho
wholesale|bán buôn
retail|bán lẻ
launch|ra mắt
lookbook|bộ ảnh giới thiệu`)
  ];

  const dayTemplates = [
    {
      title: "Role & workplace", vi: "Vai trò và nơi làm việc", skill: "speaking",
      canDo: (item) => `Giới thiệu vai trò, trách nhiệm và mục tiêu chính trong ngành ${item.viName.toLowerCase()}.`,
      focus: "Dùng hiện tại đơn để mô tả công việc thường lệ và be responsible for + noun/V-ing để nêu trách nhiệm."
    },
    {
      title: "People & requests", vi: "Con người và yêu cầu", skill: "listening",
      canDo: (item) => `Đặt câu hỏi, xác nhận nhu cầu và đưa yêu cầu lịch sự khi làm việc trong ${item.viName.toLowerCase()}.`,
      focus: "Dùng Could you...?, Would you mind...?, Let me confirm... để yêu cầu và xác nhận mà không quá trực tiếp."
    },
    {
      title: "Process & safety", vi: "Quy trình và an toàn", skill: "reading",
      canDo: (item) => `Mô tả các bước của một quy trình và nhấn mạnh điểm an toàn trong ${item.viName.toLowerCase()}.`,
      focus: "Dùng first, next, before, after, finally và câu bị động để mô tả quy trình theo thứ tự."
    },
    {
      title: "Tools, data & documents", vi: "Công cụ, dữ liệu và tài liệu", skill: "vocabulary",
      canDo: (item) => `Đọc, ghi và giải thích công cụ, dữ liệu hoặc tài liệu thường gặp trong ${item.viName.toLowerCase()}.`,
      focus: "Dùng refer to, according to, be recorded in và các danh từ ghép chuyên môn để dẫn nguồn thông tin."
    },
    {
      title: "Problems & solutions", vi: "Vấn đề và giải pháp", skill: "interaction",
      canDo: (item) => `Báo cáo vấn đề, phân tích nguyên nhân và đề xuất giải pháp trong ${item.viName.toLowerCase()}.`,
      focus: "Dùng if, unless, may, might, should và because of/due to để diễn đạt nguyên nhân, khả năng và khuyến nghị."
    },
    {
      title: "Meetings & reporting", vi: "Họp và báo cáo", skill: "writing",
      canDo: (item) => `Tóm tắt tiến độ, bằng chứng và đầu việc tiếp theo cho nhóm ${item.viName.toLowerCase()}.`,
      focus: "Dùng reporting verbs: report, confirm, recommend, note và cấu trúc The next step is to... để viết báo cáo ngắn."
    },
    {
      title: "Capstone simulation", vi: "Mô phỏng dự án cuối tuần", skill: "mediation",
      canDo: (item) => `Kết hợp từ vựng và kỹ năng của cả tuần để ${item.task}.`,
      focus: "Kết hợp mô tả, tương tác và trung gian thông tin: nêu bối cảnh, bằng chứng, lựa chọn, rủi ro và hành động tiếp theo."
    }
  ];

  const rotate = (items, offset) => items.slice(offset).concat(items.slice(0, offset));
  const categoryById = (id) => categories.find((item) => item.id === id);

  const buildExercises = (lessonId, allWords, lessonWords, item, dayIndex) => {
    const questions = lessonWords.slice(0, 4).map((entry, index) => {
      const distractors = rotate(allWords.filter((candidate) => candidate[0] !== entry[0]), dayIndex + index)
        .slice(0, 2).map((candidate) => candidate[2]);
      return {
        id: `${lessonId}-q${index + 1}`,
        type: "multiple-choice",
        prompt: `Trong ${item.viName.toLowerCase()}, “${entry[0]}” có nghĩa gần nhất là gì?`,
        answer: entry[2],
        options: rotate([entry[2], ...distractors], index),
        explanation: `“${entry[0]}” được dùng với nghĩa “${entry[2]}”. Hãy nghe phát âm và đặt thêm một câu theo tình huống nghề nghiệp.`,
        points: 20
      };
    });
    questions.push({
      id: `${lessonId}-q5`,
      type: "multiple-choice",
      prompt: "Cách giao tiếp nào phù hợp nhất với nhiệm vụ nghề nghiệp trong bài?",
      answer: "Nêu rõ bối cảnh, xác nhận thông tin và thống nhất bước tiếp theo.",
      options: rotate([
        "Nêu rõ bối cảnh, xác nhận thông tin và thống nhất bước tiếp theo.",
        "Dùng thật nhiều thuật ngữ nhưng không giải thích.",
        "Bỏ qua rủi ro và kết thúc trao đổi ngay."
      ], dayIndex % 3),
      explanation: "Giao tiếp nghề nghiệp hiệu quả cần rõ bối cảnh, kiểm tra hiểu biết chung và xác định hành động tiếp theo.",
      points: 20
    });
    return questions;
  };

  const tracks = rawTracks.map((item, trackIndex) => {
    const color = categoryById(item.category)?.color || "#63e8ff";
    const preparedWords = item.vocabulary.map((entry) => [
      entry[0], entry[1], entry[2],
      `In ${item.name}, “${entry[0]}” is useful when a team needs to ${item.task}.`
    ]);
    const lessons = dayTemplates.map((day, dayIndex) => {
      const vocabulary = rotate(preparedWords, dayIndex * 3).slice(0, 8);
      const id = `career-${item.id}-day-${dayIndex + 1}`;
      const keyTerms = vocabulary.slice(0, 3).map((entry) => entry[0]);
      const dialogue = dayIndex === 6
        ? `Project lead: Our final task is to ${item.task}.\nLearner: I will organise the ${keyTerms[0]}, verify the ${keyTerms[1]} and explain the ${keyTerms[2]}.\nProject lead: Good. Please present the evidence, the main risk and the next action.`
        : `Colleague: We need to ${item.task} today.\nLearner: I will check the ${keyTerms[0]} and confirm the ${keyTerms[1]} before we continue.\nColleague: Please document the ${keyTerms[2]} and tell the team what should happen next.`;
      return {
        id,
        level: item.level.split("-")[0],
        levelRange: item.level,
        trackId: item.id,
        trackName: item.name,
        isCareer: true,
        day: dayIndex + 1,
        unitId: item.id,
        primarySkill: day.skill,
        title: `${day.vi}: ${item.name}`,
        canDo: day.canDo(item),
        grammar: day.focus,
        dialogue,
        vocabulary,
        exercises: buildExercises(id, preparedWords, vocabulary, item, dayIndex),
        minutes: 16 + dayIndex,
        xp: 70 + Math.min(30, trackIndex % 4 * 10),
        project: dayIndex === 6 ? item.project : ""
      };
    });
    return { ...item, color, vocabulary: preparedWords, lessons };
  });

  const curriculum = {
    categories,
    tracks,
    lessonCount: tracks.reduce((sum, item) => sum + item.lessons.length, 0),
    vocabularyCount: tracks.reduce((sum, item) => sum + item.vocabulary.length, 0)
  };

  if (typeof window !== "undefined") window.HHEnglishCareerCurriculum = curriculum;
  if (typeof module !== "undefined" && module.exports) module.exports = curriculum;
})();
