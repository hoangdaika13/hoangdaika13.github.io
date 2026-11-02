'use strict';
// Fetch a review candidate from every page of the official Law category and
// public search index. Keep both inventories: their indexing is not identical.
const fs=require('node:fs'),path=require('node:path'),S=require('../utils/vietnam-law-source');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'.study-local/vietnam-law-1081/candidate');
async function refresh(){
 const prior=require('../data/hh-vietnam-law/source-audit.json'),catalogue=require('../data/hh-vietnam-law/catalogue.json'),documents=new Map(),queries=[...prior.queries],failures=[],categoryPages=[];
 fs.mkdirSync(path.join(folder,'documents'),{recursive:true});
 for(const d of catalogue.documents){const file=path.join(root,d.pack.url.split('?')[0]),value=JSON.parse(fs.readFileSync(file));documents.set(d.id,value);fs.copyFileSync(file,path.join(folder,'documents',d.id+'.json'));}
 const options=await S.options(),first=await S.cataloguePage(1),categoryIds=new Set(first.ids);categoryPages.push(first);
 for(let page=2;page<=first.pageCount;page++){const result=await S.cataloguePage(page);if(result.pageCount!==first.pageCount)throw Error('Official category changed during import; rerun the candidate.');categoryPages.push(result);result.ids.forEach(id=>categoryIds.add(id));if(page%5===0)console.log(JSON.stringify({categoryPages:page,totalPages:first.pageCount,categoryRecords:categoryIds.size}));}
 const sourceIds=new Set();
 for(const input of [{type:'Luật',query:''},{query:'Hiến pháp'},{query:'Bộ luật'}]){
  const initial=await S.search({...input,pageSize:40}),pages=initial.pagination.total_pages;
  if(pages>100)throw Error('Query grew beyond reviewed100page boundary.');
  for(let page=1;page<=Math.max(1,pages);page++){const result=page===1?initial:await S.search({...input,page,pageSize:40});queries.push({query:input.query||'type:Luật',type:input.type||'',page,total:result.total,returned:result.documents.length,sourceHash:result.sourceHash,checkedAt:result.checkedAt});for(const d of result.documents){sourceIds.add(d.id);if(!documents.has(d.id))documents.set(d.id,d);}}
 }
 // Always include the official2013Constitution, whose source type is blank.
 categoryIds.add('11012');
 const ids=[...new Set([...categoryIds,...sourceIds,'45146'])];let cursor=0,done=0;
 async function worker(){while(cursor<ids.length){const id=ids[cursor++],file=path.join(folder,'documents',id+'.json');try{const old=documents.get(id),metadata=await S.detail(id,{refresh:true});const value=old?.articles?.length?{...old,...metadata,versionHash:old.versionHash,metadataVersionHash:metadata.versionHash,sourceWarning:'Phần chữ là bản trích có dấu thời gian; thuộc tính đã được kiểm tra lại.'}:{...old,...metadata};documents.set(id,value);fs.writeFileSync(file,JSON.stringify(value)+'\n');}catch(error){failures.push({id,error:error.message});if(documents.has(id))fs.writeFileSync(file,JSON.stringify(documents.get(id))+'\n');}done++;if(done%50===0)console.log(JSON.stringify({metadata:done,total:ids.length,failures:failures.length}));}}
 await Promise.all(Array.from({length:3},worker));
 for(const id of ['11012','470458','45146','45714'])try{const value=await S.document(id,{timeBudgetMs:22000});documents.set(id,value);fs.writeFileSync(path.join(folder,'documents',id+'.json'),JSON.stringify(value)+'\n');}catch(error){failures.push({id,stage:'text',error:error.message});}
 const storedIds=[...documents.keys()].filter(id=>fs.existsSync(path.join(folder,'documents',id+'.json')));
 const inventory={category:'Luật',categoryUrl:first.url,categoryPages:categoryPages.map(p=>({...p,ids:p.ids})),categoryRecords:categoryIds.size-1,categoryStored:[...categoryIds].filter(id=>id!=='11012'&&storedIds.includes(id)).length,searchLawTotal:queries.findLast(q=>q.type==='Luật')?.total||0,categoryMissing:[...categoryIds].filter(id=>!storedIds.includes(id)),nationalCorpusComplete:false,indexesDiffer:true};
 const audit={...prior,schemaVersion:1,checkedAt:new Date().toISOString(),options,queries,documentIds:storedIds,fullIds:[...new Set([...prior.fullIds,'11012','470458','45146','45714'])],failures:[...prior.failures,...failures],inventory,scope:'Every page of the official Công báo Law category and all results returned by the public Law/Constitution/Code queries were imported at the stated time. National corpus completeness and current legal validity are not inferred.',nationalPortalApiConnected:false};
 fs.writeFileSync(path.join(folder,'audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({candidate:path.relative(root,folder),documents:storedIds.length,inventory,failures:failures.length}));
}
if(require.main===module){if(!process.argv.includes('--refresh'))console.log('Use --refresh to create a review candidate. This does not publish data.');else refresh().catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={refresh};
