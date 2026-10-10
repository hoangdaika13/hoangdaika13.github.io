/* Read-only source audit; no downloaded media, cookies, credentials or YouTube API key. */
const fs=require('node:fs'),path=require('node:path'),D=require('../patin-data');
async function main(){
 const results=await Promise.all(D.videos.map(async v=>{
  try{const response=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(v.watchUrl)+'&format=json',{signal:AbortSignal.timeout(15000)});if(!response.ok)return {id:v.id,status:response.status};const info=await response.json();return {id:v.id,status:response.status,title:info.title,publisher:info.author_name,titleMatches:info.title.replace(/\s+/g,' ').trim()===v.originalTitle.replace(/\s+/g,' ').trim(),publisherMatches:info.author_name===v.publisher};}catch(err){return {id:v.id,error:err.message};}
 }));
 const out=path.resolve(__dirname,'../.study-local/patin-video-qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-audit.json'),JSON.stringify({checkedAt:new Date().toISOString(),meaning:'oEmbed metadata only, not proof of playback/embeddability/captions',results},null,2));for(const r of results)console.log(JSON.stringify(r));if(results.some(r=>r.status!==200||!r.titleMatches||!r.publisherMatches))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
