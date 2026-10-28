'use strict';
// Public MoET reference records only. They are not a complete national register.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='https://apikdcldh.moet.gov.vn',root=path.resolve(__dirname,'..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
function project(row,kind){
 const documents=[...(row.lstFileDinhKemQĐ||[]),...(row.lstFileDinhKemQD||[]),...(row.lstFileDinhKemCN||[])].map(d=>({title:clean(d.title),url:new URL('/api/'+String(d.url||'').replace(/^\//,''),base).href})).filter(d=>d.title&&d.url.startsWith(base+'/api/fileupload/'));
 return{id:String(row.id),institutionId:String(row.coSoGiaoDuc_Id),institutionName:clean(row.coSoGiaoDuc),code:clean(row.coSoGiaoDucGroup).replace(/_\d+$/,''),programmeId:kind==='programmes'?String(row.ctChuongTrinhDaoTao_Id):null,programmeName:kind==='programmes'?clean(row.chuongTrinhDaoTao):null,periodFrom:row.tuKyDanhGia??null,periodTo:row.denKyDanhGia??null,agency:clean(row.toChucKiemDinh),documents};
}
async function refresh(){
 const requests=[],output=path.join(root,'.study-local/university-1069/candidate/official-reference.json'),result={schemaVersion:1,checkedAt:new Date().toISOString(),sourceId:'moet-quality',sourceUrl:'https://kdcldh.moet.gov.vn/',scope:'Public historical accreditation references. Not a current national institution register, admission licence, complete curriculum, or guarantee of present accreditation.',institutions:[],programmes:[],requests};
 for(const [kind,endpoint]of [['institutions','kqkiemdinhcsgd'],['programmes','kqkiemdinhctdt']]){
  let total=Infinity,page=1;
  while((page-1)*100<total){
   const url=base+'/api/webclient/'+endpoint+'?page='+page+'&itemsPerPage=100&sortBy=tuKyDanhGia&sortDesc=false&FilterText=';
   const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('HTTP '+response.status+' '+url);
   const raw=await response.text();if(Buffer.byteLength(raw)>8*1048576)throw Error('Reference response too large.');const data=JSON.parse(raw);
   if(!Number.isInteger(data.totalRows)||data.totalRows>10000||!Array.isArray(data.data)||data.currentPage!==page)throw Error('Unexpected public reference schema.');
   if(total!==Infinity&&total!==data.totalRows)throw Error('Source changed during collection; collect a new snapshot.');total=data.totalRows;
   result[kind].push(...data.data.map(row=>project(row,kind)));requests.push({url,http:response.status,sha256:hash(raw),rows:data.data.length,checkedAt:new Date().toISOString()});page++;
  }
  if(result[kind].length!==total||new Set(result[kind].map(r=>r.id)).size!==total)throw Error('Reference pagination incomplete or duplicated.');
 }
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({candidate:path.relative(root,output),institutionRecords:result.institutions.length,programmeRecords:result.programmes.length,requests:requests.length}));
}
if(require.main===module){if(!process.argv.includes('--refresh'))console.log('Use --refresh to create a MoET public reference candidate. Review before copying to data/hh-university/official-reference.json.');else refresh().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={project};
