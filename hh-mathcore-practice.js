/* Original practice variants: difficulty changes the reasoning, not only the numbers. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hh-mathcore-core'):root.HHMathCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HHMathCorePractice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const levels={basic:'Cơ bản',standard:'Vận dụng',advanced:'Thử thách'};
  const descriptions={basic:'Nhận diện công thức và thực hiện một bước chính.',standard:'Biến đổi, chọn dữ kiện và phối hợp hai bước.',advanced:'Kết hợp nhiều kiến thức, điều kiện hoặc cách lập luận.'};
  const topics=['linear','systems','inequality','quadratic','fractions','powers','logarithm','sequences','trigonometry','derivative','integral','geometry','probability','statistics'];
  const rng=seed=>{let value=Number(seed)>>>0;return()=>{value=(1664525*value+1013904223)>>>0;return value/4294967296;};};
  const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a),fraction=(a,b)=>{const d=gcd(a,b);return (a/d)+(b/d===1?'':'/'+(b/d));};
  function generate(topic='linear',difficulty='basic',count=5,seed=Date.now()){
    if(!topics.includes(topic))topic='linear';if(!Object.hasOwn(levels,difficulty))difficulty='basic';const random=rng(seed),int=(a,b)=>Math.floor(random()*(b-a+1))+a,result=[],level=['basic','standard','advanced'].indexOf(difficulty);
    for(let i=0;i<Math.max(1,Math.min(20,Math.floor(Number(count)||5)));i++){
      const a=int(2,8),b=int(1,7),c=int(2,7),d=int(2,7),facts={a,b,c,d};let text='',answer=0,explanation='',skill='',unit='',wrong=[];
      switch(topic){
        case 'linear':
          if(level===0){text='Giải '+a+'x + '+b+' = '+(a*c+b)+'. Giá trị x là?';answer=c;skill='Tách ẩn bằng hai phép toán';explanation='Trừ '+b+' rồi chia cho '+a+' ở cả hai vế.';}
          else if(level===1){text='Giải '+a+'(x − '+b+') = '+(a*c)+'. Giá trị x là?';answer=b+c;skill='Xử lý ngoặc và phép chia';explanation='Chia hai vế cho '+a+' để được x − '+b+' = '+c+', rồi cộng '+b+'.';}
          else{text='Giải '+(a+b)+'(x − '+b+') = '+a+'x + ('+(b*c-(a+b)*b)+'). Giá trị x là?';answer=c;skill='Biến đổi phương trình có ẩn ở hai vế';explanation='Khai triển rồi đưa các số hạng chứa x về cùng vế: '+b+'x = '+(b*c)+'.';}break;
        case 'systems':
          if(level===0){text='Hệ x + y = '+(a+b)+'; x − y = '+(a-b)+'. Giá trị x là?';answer=a;skill='Cộng hai phương trình để khử y';explanation='Cộng hai dòng: 2x = '+(2*a)+'.';}
          else if(level===1){text='Hệ 2x + y = '+(2*a+b)+'; x − y = '+(a-b)+'. Giá trị y là?';answer=b;skill='Khử một ẩn rồi thế ngược';explanation='Cộng hai dòng tìm x = '+a+', sau đó thế lại để tìm y = '+b+'.';}
          else{text='Mua 2 quyển vở và 1 bút hết '+(2*a+b)+' nghìn; 1 quyển vở và 2 bút hết '+(a+2*b)+' nghìn. Một vở và một bút hết bao nhiêu nghìn?';answer=a+b;skill='Lập hệ từ tình huống và tìm tổng';unit='nghìn đồng';explanation='Cộng hai phương trình chi phí: 3(vở + bút) = '+(3*(a+b))+'.';}break;
        case 'inequality':
          if(level===0){text='Bất phương trình −'+a+'x < −'+(a*b)+' tương đương x > m. Giá trị m là?';answer=b;skill='Đổi chiều khi chia số âm';explanation='Chia hai vế cho −'+a+' và đổi < thành >.';}
          else if(level===1){text='Số nguyên nhỏ nhất thỏa '+a+'(x − '+b+') > '+(a*c)+' là?';answer=b+c+1;skill='Bất phương trình nghiêm ngặt và nghiệm nguyên';explanation='x > '+(b+c)+'; số nguyên nhỏ nhất lớn hơn mốc đó là '+(b+c+1)+'.';}
          else{text='Có bao nhiêu số nguyên x thỏa (x − '+a+')(x − '+(a+c)+') ≤ 0?';answer=c+1;skill='Bảng dấu và đếm các mốc có lấy bằng';explanation='Tập nghiệm ['+a+'; '+(a+c)+']; kể cả hai đầu mút có '+(c+1)+' số nguyên.';}break;
        case 'quadratic':{
          const q=a+b+c;facts.q=q;if(level===0){text='Tổng hai nghiệm của x² − '+(a+q)+'x + '+(a*q)+' = 0 là?';answer=a+q;skill='Đọc hệ thức Viète';explanation='Tổng nghiệm bằng −b/a = '+answer+'.';}
          else if(level===1){text='Phương trình x² − '+(a+q)+'x + '+(a*q)+' = 0 có hai nghiệm. Nghiệm lớn hơn là?';answer=q;skill='Phân tích nhân tử rồi so sánh nghiệm';explanation='Phân tích (x − '+a+')(x − '+q+') = 0; chọn nghiệm lớn hơn.';}
          else{text='Biết một nghiệm của x² − '+(a+q)+'x + '+(a*q)+' = 0 là '+a+'. Tổng bình phương hai nghiệm là?';answer=a*a+q*q;skill='Kết hợp Viète và hằng đẳng thức';explanation='x₁² + x₂² = (x₁ + x₂)² − 2x₁x₂ = '+answer+'.';}break;}
        case 'fractions':{
          const n=level===1?a*d-c*b:a*d+c*b,den=b*d*(level===2?2:1);text=level===2?'Tính ('+a+'/'+b+' + '+c+'/'+d+') ÷ 2.':'Tính '+a+'/'+b+(level===1?' − ':' + ')+c+'/'+d+'.';answer=fraction(n,den);skill=level===0?'Quy đồng và cộng phân số':level===1?'Quy đồng và giữ đúng dấu':'Phối hợp cộng và chia phân số';explanation='Quy đồng mẫu thành '+(b*d)+', tính tử số rồi '+(level===2?'chia cho 2 và ':'')+'rút gọn.';break;}
        case 'powers':
          if(level===0){text='Tính '+a+'² − '+b+'².';answer=a*a-b*b;skill='Hiệu hai bình phương';explanation='Dùng (a − b)(a + b).';}
          else if(level===1){text='Tính ('+a+' + '+b+')².';answer=(a+b)**2;skill='Khai triển đủ số hạng chéo';explanation='a² + 2ab + b² = '+answer+'.';}
          else{text='Rút gọn rồi tính ('+a+' + '+b+')² − ('+a+' − '+b+')².';answer=4*a*b;skill='Kết hợp hai hằng đẳng thức';explanation='Các số hạng bình phương triệt tiêu, còn 4ab = '+answer+'.';}break;
        case 'logarithm':
          if(level===0){text='Tính log₂('+2**a+').';answer=a;skill='Chuyển giữa logarit và lũy thừa';explanation='2^'+a+' = '+2**a+'.';}
          else if(level===1){text='Giải log₂(x − '+b+') = '+a+'. Giá trị x là?';answer=b+2**a;skill='Đặt điều kiện và đổi dạng mũ';explanation='Điều kiện x > '+b+'. Ta có x − '+b+' = 2^'+a+'.';}
          else{text='Giải log₂(x) + log₂('+2**b+') = '+(a+b)+'. Giá trị x là?';answer=2**a;skill='Tổng logarit và điều kiện dương';explanation='x > 0; log₂x + '+b+' = '+(a+b)+' ⇒ log₂x = '+a+'.';}break;
        case 'sequences':
          if(level===0){text='Cấp số cộng có u₁ = '+a+', công sai '+b+'. Tìm u_'+c+'.';answer=a+(c-1)*b;skill='Chỉ số n − 1 trong số hạng tổng quát';explanation='uₙ = u₁ + (n − 1)d.';}
          else if(level===1){text='Cấp số cộng có u₁ = '+a+', công sai '+b+'. Tính tổng '+c+' số hạng đầu.';answer=c*(2*a+(c-1)*b)/2;skill='Tìm số hạng cuối rồi tính tổng';explanation='Sₙ = n(2u₁ + (n − 1)d)/2.';}
          else{text='Cấp số cộng có u₃ = '+(a+2*b)+' và u₇ = '+(a+6*b)+'. Tìm u₁₀.';answer=a+9*b;skill='Suy ra công sai từ hai số hạng';explanation='u₇ − u₃ = 4d nên d = '+b+'. Suy ra u₁ = '+a+', rồi u₁₀ = '+answer+'.';}break;
        case 'trigonometry':
          if(level===0){text='Tam giác vuông có hai cạnh góc vuông '+3*a+' và '+4*a+'. Cạnh huyền bằng bao nhiêu?';answer=5*a;skill='Định lý Pythagore';explanation='c² = a² + b²; lấy căn dương.';}
          else if(level===1){text='Tam giác vuông có cạnh đối của góc α là '+3*a+', cạnh huyền '+5*a+'. Tính sin α.';answer='3/5';skill='Chọn đúng tỉ số cạnh';explanation='sin α = đối/huyền = 3/5.';wrong=['4/5','3/4','5/3'];}
          else{text='Góc α nhọn có sin α = 3/5. Tính sin(2α).';answer='24/25';skill='Điều kiện góc nhọn và công thức góc đôi';explanation='cos α = 4/5 vì α nhọn. sin(2α) = 2 sin α cos α = 24/25.';wrong=['7/25','6/5','12/25'];}break;
        case 'derivative':
          if(level===0){text='Tính f′('+c+') với f(x) = '+a+'x².';answer=2*a*c;skill='Quy tắc đạo hàm lũy thừa';explanation='f′(x) = '+2*a+'x.';}
          else if(level===1){text='Tính f′('+c+') với f(x) = '+a+'x³ + '+b+'x.';answer=3*a*c*c+b;skill='Tổng các đạo hàm và thế giá trị';explanation='f′(x) = '+3*a+'x² + '+b+'.';}
          else{text='Tính f′('+c+') với f(x) = '+a+'(x + '+b+')³.';answer=3*a*(c+b)**2;skill='Đạo hàm hàm hợp';explanation='f′(x) = '+3*a+'(x + '+b+')²; đạo hàm hàm trong bằng 1.';}break;
        case 'integral':
          if(level===0){text='Tính tích phân từ 0 đến 1 của ('+2*a+'x + '+b+').';answer=a+b;skill='Nguyên hàm và thế hai cận';explanation='F(x) = '+a+'x² + '+b+'x. Lấy F(1) − F(0).';}
          else if(level===1){text='Tính tích phân từ 0 đến '+c+' của ('+2*a+'x + '+b+').';answer=a*c*c+b*c;skill='Thay cận tổng quát';explanation='F(x) = '+a+'x² + '+b+'x. Lấy F('+c+') − F(0).';}
          else{text='Tính tích phân từ '+b+' đến '+(b+c)+' của ('+3*a+'x² + 2x).';answer=a*((b+c)**3-b**3)+(b+c)**2-b*b;skill='Đa thức bậc hai và hai cận khác 0';explanation='F(x) = '+a+'x³ + x². Thay cận trên rồi trừ cận dưới.';}break;
        case 'geometry':
          if(level===0){text='Hộp chữ nhật có ba kích thước '+a+', '+b+', '+c+'. Thể tích là?';answer=a*b*c;skill='Thể tích hình hộp';explanation='Nhân dài, rộng và cao.';}
          else if(level===1){text='Hình chóp có đáy chữ nhật '+a+' × '+b+', chiều cao '+3*c+'. Thể tích là?';answer=a*b*c;skill='Phân biệt thể tích chóp và hộp';explanation='V = diện tích đáy × chiều cao / 3.';}
          else{text='Hình trụ bán kính '+a+', chiều cao '+b+'. Tính thể tích.';answer=a*a*b+'pi';skill='Đổi từ bán kính sang diện tích đáy';explanation='V = πr²h = '+a*a*b+'π.';wrong=[a*b+'pi',(a*a*b+1)+'pi',2*a*b+'pi'];}unit='đơn vị³';break;
        case 'probability':{
          const n=a+b;facts.n=n;if(level===0){text='Hộp có '+a+' bi xanh, '+b+' bi đỏ, chọn đều một bi. Xác suất bi xanh?';answer=fraction(a,n);skill='Biến cố và không gian mẫu';explanation='Số bi xanh / tổng số bi.';}
          else if(level===1){text='Hộp có '+a+' bi xanh, '+b+' bi đỏ. Rút ngẫu nhiên 2 bi liên tiếp, không hoàn lại. Xác suất cả hai xanh?';answer=fraction(a*(a-1),n*(n-1));skill='Hai lần chọn không hoàn lại';explanation='Lần đầu a/n; sau một bi xanh còn (a − 1)/(n − 1). Nhân hai xác suất.';}
          else{text='Hộp có '+a+' bi xanh, '+b+' bi đỏ. Rút 2 lần có hoàn lại. Xác suất ít nhất một bi xanh?';answer=fraction(n*n-b*b,n*n);skill='Biến cố đối và hai phép thử độc lập';explanation='1 − P(cả hai đỏ) = 1 − ('+b+'/'+n+')².';}wrong=[fraction(a,n),fraction(b,n),fraction(a-1,n-1),'0','1'];break;}
        case 'statistics':
          if(level===0){text='Trung bình cộng của '+a+', '+(a+b)+', '+(a+2*b)+' là?';answer=a+b;skill='Trung bình cộng';explanation='Cộng ba giá trị rồi chia 3.';}
          else if(level===1){text='Trung vị của '+[a+3*b+3*c,a,a+2*b+2*c,a+b,a+b+c].join(', ')+' là?';answer=a+b+c;skill='Sắp xếp dữ liệu trước khi tìm trung vị';explanation='Sau khi sắp xếp, lấy số đứng thứ 3 trong 5 số.';}
          else{text='Dữ liệu '+[a-b,a,a+b].join(', ')+'. Tính phương sai mô tả (chia cho n, không phải n − 1).';answer=fraction(2*b*b,3);skill='Trung bình và bình phương độ lệch';explanation='Trung bình là '+a+'. Phương sai = (b² + 0 + b²)/3.';}break;
      }
      const correct=String(answer),value=C.calculator(correct),options=[correct];const candidates=[...wrong.map(String),String(value+1),String(value-1),String(-value),String(value+2)];
      for(let j=0;options.length<4&&j<30;j++){const candidate=candidates[j]??String(value+(j+1)/(a+b+1));let n;try{n=C.calculator(candidate);}catch{continue;}if(options.every(v=>Math.abs(C.calculator(v)-n)>1e-10*Math.max(1,Math.abs(n))))options.push(candidate);}
      if(options.length!==4)throw Error('Chưa tạo được bốn lựa chọn phân biệt.');for(let j=options.length-1;j>0;j--){const k=int(0,j);[options[j],options[k]]=[options[k],options[j]];}
      result.push({id:'mc-'+topic+'-'+difficulty+'-'+(Number(seed)>>>0)+'-'+i,topic,difficulty,text,options,correct:options.indexOf(correct),explanation,unit,skill,variant:topic+'-'+difficulty,facts});
    }return result;
  }
  return Object.freeze({topics,levels,descriptions,generate});
});
