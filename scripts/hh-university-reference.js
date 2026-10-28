'use strict';
const {schoolName,similarity,institutionLevel}=require('./import-hh-university');
function curate(schools,reference,curation){
 const excluded=new Set(curation.excludedInstitutions.map(row=>row.id)),removed=schools.filter(s=>excluded.has(s.id));
 const result=schools.filter(s=>!excluded.has(s.id)).map(s=>({...s,aliases:[...s.aliases],sourceIds:[...s.sourceIds],sources:[...s.sources]}));
 const byId=new Map();for(const row of [...reference.institutions,...reference.programmes]){if(!/^\d+$/.test(row.institutionId)||!row.institutionName)throw Error('Invalid official institution reference.');if(!byId.has(row.institutionId))byId.set(row.institutionId,row);}
 const matches=[];
 for(const row of byId.values()){
  const level=institutionLevel(row.institutionName),exact=result.filter(s=>s.level===level&&schoolName(s.name)===schoolName(row.institutionName));
  const code=result.filter(s=>row.code&&s.code===row.code&&s.level===level&&similarity(s.name,row.institutionName)>=.65);
  let school=exact.length===1?exact[0]:code.length===1?code[0]:null,matchBasis=exact.length===1?'unique-normalized-name':code.length===1?'unique-code-and-name-similarity':null;
  if(!school){school={id:'vn-moet-'+row.institutionId,tsId:null,code:row.code,name:row.institutionName,aliases:[],level,province:'',sourceIds:[],sources:[],cutoffUrl:null,officialWebsite:null,hocmaiUrl:null};result.push(school);matchBasis='separate-official-reference';}
  // One primary ID never implicitly coalesces two different institutions.
  if(school.officialReference&&school.officialReference.institutionId!==row.institutionId)throw Error('Ambiguous official reference '+school.id);
  school.officialReference={sourceId:'moet-quality',institutionId:row.institutionId,sourceName:row.institutionName,sourceUrl:'https://kdcldh.moet.gov.vn/kqkiemdinhcsgd',programmeSourceUrl:'https://kdcldh.moet.gov.vn/kqkiemdinhctdt',checkedAt:reference.checkedAt,matchBasis,status:'historical-public-reference; current operating and accreditation status not inferred'};
  school.sourceIds=[...new Set([...school.sourceIds,'moet-quality'])];school.sources.push({id:'moet-quality',url:school.officialReference.sourceUrl});matches.push({officialInstitutionId:row.institutionId,schoolId:school.id,matchBasis});
 }
 return{schools:result.sort((a,b)=>a.name.localeCompare(b.name,'vi')),review:{removed:removed.map(s=>({id:s.id,name:s.name,decision:curation.excludedInstitutions.find(row=>row.id===s.id)})),matches}};
}
function programmes(reference,id){
 const grouped=new Map();for(const row of reference.programmes.filter(r=>r.institutionId===id)){if(!row.programmeId||!row.programmeName)continue;const key=row.programmeId;if(!grouped.has(key))grouped.set(key,{id:'moet-programme-'+key,name:row.programmeName,sourceUrl:'https://kdcldh.moet.gov.vn/kqkiemdinhctdt',scope:'Historical accreditation reference only; degree level, present status and full syllabus not inferred.',records:[]});grouped.get(key).records.push({id:row.id,periodFrom:row.periodFrom,periodTo:row.periodTo,agency:row.agency,documents:row.documents});}return[...grouped.values()];
}
module.exports={curate,programmes};
