(function(scope){
 'use strict';
 const VERSION=1;
 const FIELDS=Object.freeze([
  {id:'criminal',name:'Hình sự',query:'hình sự'},
  {id:'civil',name:'Dân sự',query:'dân sự'},
  {id:'land',name:'Đất đai & nhà ở',query:'đất đai'},
  {id:'business',name:'Doanh nghiệp & đầu tư',query:'doanh nghiệp'},
  {id:'tax',name:'Thuế & tài chính',query:'thuế'},
  {id:'labour',name:'Lao động & bảo hiểm',query:'lao động'},
  {id:'traffic',name:'Giao thông',query:'giao thông'},
  {id:'family',name:'Hôn nhân & gia đình',query:'hôn nhân gia đình'},
  {id:'technology',name:'Công nghệ & dữ liệu',query:'công nghệ thông tin'},
  {id:'administrative',name:'Hành chính & tổ chức',query:'hành chính'},
  {id:'environment',name:'Môi trường',query:'môi trường'},
  {id:'education',name:'Giáo dục',query:'giáo dục'}
 ]);
 const STATUSES=Object.freeze({unknown:'Chưa xác minh tình trạng hiện tại',active:'Còn hiệu lực theo nguồn',partial:'Hiệu lực một phần theo nguồn',expired:'Hết hiệu lực theo nguồn',upcoming:'Sắp có hiệu lực theo nguồn'});
 const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
 const clean=(value,max=1000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
 const safeId=value=>typeof value==='string'&&/^\d{1,9}$/.test(value);
 const officialHosts=new Set(['congbao.chinhphu.vn','congbaocdn.chinhphu.vn','vanban.chinhphu.vn','datafiles.chinhphu.vn','phapluat.gov.vn','vbpl.vn']);
 function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&officialHosts.has(u.hostname)&&(!u.port||u.port==='443')?u.href:'';}catch{return '';}}
 function date(value){const raw=String(value||'').trim();let parts=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/),y,m,d;if(parts)[,y,m,d]=parts;else{parts=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!parts)return null;[,d,m,y]=parts;}const check=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));return check.getUTCFullYear()===Number(y)&&check.getUTCMonth()+1===Number(m)&&check.getUTCDate()===Number(d)?y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):null;}
 function sourceStatus(label){const s=fold(label);if(/(?:het|co) hieu luc (?:mot|1) phan/.test(s))return'partial';if(/^het hieu luc(?: toan bo)?$/.test(s))return'expired';if(/^(?:chua|sap) co hieu luc$/.test(s))return'upcoming';if(/^(?:con|dang co) hieu luc$/.test(s))return'active';return'unknown';}
 function effectiveStatus(document,asOf=new Date().toISOString().slice(0,10)){
  if(document.statusEvidence?.sourceUrl&&safeURL(document.statusEvidence.sourceUrl)&&Object.hasOwn(STATUSES,document.statusEvidence.status))return{status:document.statusEvidence.status,label:STATUSES[document.statusEvidence.status],basis:'explicit-source',checkedAt:document.statusEvidence.checkedAt};
  if(date(document.expiredAt)&&document.expiredAt<=asOf)return{status:'expired',label:'Đã đến ngày hết hiệu lực được nguồn ghi',basis:'source-expiry-date'};
  if(date(document.effectiveAt)&&document.effectiveAt>asOf)return{status:'upcoming',label:'Chưa đến ngày hiệu lực được nguồn ghi',basis:'source-effective-date'};
  return{status:'unknown',label:STATUSES.unknown,basis:document.effectiveAt?'effective-date-only':'missing-status'};
 }
 function normalizeSearch(input={}){
  const invalid=message=>Object.assign(Error(message),{statusCode:400,code:'LEGAL_FILTER_INVALID'});
  const value={query:clean(input.query,220),field:clean(input.field,40),type:clean(input.type,100),issuer:clean(input.issuer,180),status:clean(input.status,30)||'all',page:Math.max(1,Math.min(1000,Math.floor(Number(input.page)||1))),pageSize:Math.max(5,Math.min(40,Math.floor(Number(input.pageSize)||20)))};
  if(value.field&&!FIELDS.some(f=>f.id===value.field))throw invalid('Lĩnh vực chưa được hỗ trợ.');
  if(value.status!=='all'&&!Object.hasOwn(STATUSES,value.status))throw invalid('Trạng thái hiệu lực chưa hợp lệ.');
  for(const key of ['issuedFrom','issuedTo','effectiveFrom','effectiveTo']){value[key]=input[key]?date(input[key]):null;if(input[key]&&!value[key])throw invalid('Ngày tìm kiếm chưa hợp lệ.');}
  if(value.issuedFrom&&value.issuedTo&&value.issuedFrom>value.issuedTo||value.effectiveFrom&&value.effectiveTo&&value.effectiveFrom>value.effectiveTo)throw invalid('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');return value;
 }
 function filterDocuments(rows,input){const q=normalizeSearch(input),terms=fold(q.query).split(' ').filter(Boolean),field=FIELDS.find(f=>f.id===q.field);return rows.filter(d=>(!q.type||d.type===q.type)&&(!q.issuer||d.issuers?.includes(q.issuer))&&(!q.issuedFrom||d.issuedAt&&d.issuedAt>=q.issuedFrom)&&(!q.issuedTo||d.issuedAt&&d.issuedAt<=q.issuedTo)&&(!q.effectiveFrom||d.effectiveAt&&d.effectiveAt>=q.effectiveFrom)&&(!q.effectiveTo||d.effectiveAt&&d.effectiveAt<=q.effectiveTo)&&(q.status==='all'||effectiveStatus(d).status===q.status)&&(!field||fold([d.title,d.code,d.summary,d.searchText].join(' ')).includes(fold(field.query)))&&terms.every(term=>fold([d.title,d.code,d.summary].join(' ')).includes(term)));}
 function preferences(input){if(input?.version!==undefined&&input.version!==VERSION)throw Object.assign(Error('Bản lưu thuộc phiên bản mới hơn; giữ bản gốc.'),{code:'VERSION_UNSUPPORTED'});if(input!==undefined&&input!==null&&(typeof input!=='object'||Array.isArray(input))||input?.saved!==undefined&&!Array.isArray(input.saved)||input?.notes!==undefined&&(!input.notes||typeof input.notes!=='object'||Array.isArray(input.notes)))throw Object.assign(Error('Bản lưu chưa đúng cấu trúc; giữ bản gốc.'),{code:'PREFERENCES_CORRUPT'});const notes={};for(const [id,v]of Object.entries(input?.notes||{}).slice(-500))if(/^\d{1,9}(?:-a-[a-z0-9-]+)?$/.test(id)&&typeof v?.text==='string')notes[id]={text:clean(v.text,6000),updatedAt:clean(v.updatedAt,40)};return{version:VERSION,saved:[...new Set((input?.saved||[]).filter(safeId))].slice(-200),notes};}
 const preferenceKey=user=>'hh.vietnam-law.v1:'+encodeURIComponent(String(user?.id||user?._id||'guest'));
 function parseArticles(pages){
  const articles=[],counts=new Map();let active=null;
  for(const page of pages){for(const raw of String(page.text||'').normalize('NFC').split(/\r?\n/)){const line=raw.replace(/\s+/g,' ').trim();if(!line||/^(?:\d+\s+)?CÔNG BÁO\/Số.*Ngày/i.test(line))continue;
   const match=line.match(/^Điều\s+(\d+[a-zđ]?)\.\s*(.*)$/i);
   if(match){const number=match[1].toLowerCase(),count=(counts.get(number)||0)+1;counts.set(number,count);active={id:'a-'+number+(count>1?'-repeat-'+count:''),number,title:line,body:[],page:page.pageNumber,attachmentId:page.attachmentId,pdfUrl:page.pdfUrl,locatorSource:'pdf-heading-extraction',ambiguous:count>1};articles.push(active);continue;}
   if(/^(?:Chương\s+[IVXLCDM\d]+|Phần thứ\s+\S+)$/i.test(line)){active=null;continue;}if(active)active.body.push(line);
  }}
  for(const a of articles){a.ambiguous=counts.get(a.number)>1;a.text=[a.title,...a.body].join('\n');a.parts=[];let clause=null,point=null;
   for(const line of a.body){const k=line.match(/^(\d+)\.\s+(.*)$/),p=line.match(/^([a-zđ])\)\s+(.*)$/i);if(k){clause={id:a.id+'-k-'+k[1],article:a.number,clause:k[1],point:null,lines:[line]};a.parts.push(clause);point=null;}else if(p&&clause){point={id:clause.id+'-d-'+p[1].toLowerCase(),article:a.number,clause:clause.clause,point:p[1].toLowerCase(),lines:[line]};a.parts.push(point);clause.lines.push(line);}else{if(clause)clause.lines.push(line);if(point)point.lines.push(line);}}
   a.parts=a.parts.map(p=>({...p,text:p.lines.join('\n'),lines:undefined}));delete a.body;
  }
  return{articles,structure:articles.some(a=>a.ambiguous)?'ambiguous-headings':'extracted-headings',sourcePages:pages.length};
 }
 function findArticles(document,options={}){const term=fold(options.query),number=clean(options.article,20),clause=clean(options.clause,12),point=fold(options.point);const result=[];for(const a of document.articles||[]){if(number&&a.number!==number)continue;const rows=clause||point?a.parts.filter(p=>(!clause||p.clause===clause)&&(!point||p.point===point)):[{id:a.id,text:a.text,article:a.number,clause:null,point:null}];for(const row of rows)if(!term||fold(row.text).includes(term))result.push({...row,title:a.title,ambiguous:a.ambiguous,page:a.page,attachmentId:a.attachmentId,pdfUrl:a.pdfUrl});}return result;}
 function evidence(document,options={}){return findArticles(document,options).filter(a=>!a.ambiguous).slice(0,12).map(a=>({...a,id:document.id+'-'+a.id,documentId:document.id,documentCode:document.code,sourceUrl:safeURL(a.pdfUrl)?a.pdfUrl+'#page='+a.page:document.sourceUrl,version:document.versionHash,checkedAt:document.checkedAt,status:effectiveStatus(document).status,text:a.text.slice(0,14000)}));}
 function validateAnswer(answer,records){if(!answer||typeof answer!=='object'||!Array.isArray(answer.sections)||!answer.sections.length||answer.sections.length>8)throw Error('AI chưa trả câu trả lời có căn cứ hợp lệ.');const byId=new Map(records.map(r=>[r.id,r])),sections=[];for(const section of answer.sections){if(typeof section.text!=='string'||!section.text.trim()||section.text.length>8000||!Array.isArray(section.citations)||!section.citations.length||section.citations.length>6)throw Error('Mỗi phần giải thích phải có trích dẫn nguồn.');const citations=section.citations.map(c=>{const r=byId.get(c.id),quote=clean(c.quote,1800),normalize=s=>String(s).normalize('NFC').replace(/\s+/g,' ').trim();if(!r||quote.length<12||!normalize(r.text).includes(normalize(quote)))throw Error('AI trích dẫn nội dung không có trong bản nguồn đã đọc.');return{...r,text:undefined,quote};});sections.push({text:section.text.trim(),citations});}return{sections,limitations:clean(answer.limitations,2500),validatedQuotes:true};}
 const api=Object.freeze({VERSION,FIELDS,STATUSES,fold,clean,safeId,safeURL,date,sourceStatus,effectiveStatus,normalizeSearch,filterDocuments,preferences,preferenceKey,parseArticles,findArticles,evidence,validateAnswer});scope.HHVietnamLawCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
