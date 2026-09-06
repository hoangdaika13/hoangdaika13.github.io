const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../utils/galaxy-community-service');
function memoryDB(){
 const tables=new Map();const clone=value=>structuredClone(value);
 function matches(row,query){return Object.entries(query).every(([key,value])=>{if(key==='$or')return value.some(q=>matches(row,q));if(key==='$and')return value.every(q=>matches(row,q));if(value&&typeof value==='object'&&!(value instanceof Date)){if('$exists'in value)return (row[key]!==undefined)===value.$exists;if('$lt'in value)return row[key]<value.$lt;}return value instanceof Date?+row[key]===+value:row[key]===value;});}
 return {tables,collection(name){if(!tables.has(name))tables.set(name,[]);const rows=tables.get(name);return {async findOne(query){return clone(rows.find(row=>matches(row,query))||null);},async insertOne(record){if(rows.some(row=>row._id===record._id))throw Object.assign(Error('duplicate'),{code:11000});rows.push(clone(record));return {insertedId:record._id};},find(query){let result=rows.filter(row=>matches(row,query));return {sort(order){result.sort((a,b)=>{for(const [key,direction]of Object.entries(order)){if(a[key]<b[key])return -direction;if(a[key]>b[key])return direction;}return 0;});return this;},limit(n){result=result.slice(0,n);return this;},async toArray(){return clone(result);}};},async updateOne(query,patch){const row=rows.find(row=>matches(row,query));if(!row)return {matchedCount:0};Object.assign(row,clone(patch.$set||{}));for(const [key,value]of Object.entries(patch.$inc||{}))row[key]=(row[key]||0)+value;for(const [key,value]of Object.entries(patch.$addToSet||{})){row[key] ||= [];if(!row[key].includes(value))row[key].push(value);}for(const [key,value]of Object.entries(patch.$pull||{}))row[key]=(row[key]||[]).filter(x=>x!==value);return {matchedCount:1};}};}};
}
const alice={_id:'alice',name:'Alice'},bob={_id:'bob',name:'Bob'};
const sample={title:'Hello',body:'Post body',privacy:'public',requestId:'request-00000001'};
test('two independent identities see public data but never private posts or owner identifiers',async()=>{
 const db=memoryDB();await service.execute(db,alice,'create',sample);const privatePost=await service.execute(db,alice,'create',{...sample,privacy:'private',requestId:'request-private01'});
 assert.equal((await service.execute(db,alice,'list')).posts.length,2);const result=await service.execute(db,bob,'list');assert.equal(result.posts.length,1);assert.equal(result.posts[0].own,false);assert.equal(Object.hasOwn(result.posts[0],'ownerId'),false);
 await assert.rejects(service.execute(db,bob,'comments',{id:privatePost.post.id}),{statusCode:404});
 assert.deepEqual([...db.tables.keys()].sort(),[service.COMMENTS,service.COLLECTION].sort());
});
test('creation is idempotent and conflicting reuse is rejected',async()=>{
 const db=memoryDB(),first=await service.execute(db,alice,'create',sample),second=await service.execute(db,alice,'create',sample);
 assert.equal(first.post.id,second.post.id);assert.equal(second.replayed,true);assert.equal(db.tables.get(service.COLLECTION).length,1);
 await assert.rejects(service.execute(db,alice,'create',{...sample,body:'different'}),{statusCode:409});
});
test('only the owner can edit/delete and optimistic versions prevent stale updates',async()=>{
 const db=memoryDB(),{post}=await service.execute(db,alice,'create',sample);
 await assert.rejects(service.execute(db,bob,'update',{id:post.id,version:1,title:'bad',body:'bad'}),{statusCode:403});
 const next=await service.execute(db,alice,'update',{id:post.id,version:1,title:'New',body:'New body'});assert.equal(next.post.version,2);
 await assert.rejects(service.execute(db,alice,'delete',{id:post.id,version:1}),{statusCode:409});
 assert.equal((await service.execute(db,alice,'delete',{id:post.id,version:2})).deleted,true);assert.equal((await service.execute(db,bob,'list')).posts.length,0);
});
test('reactions are idempotent set operations and comments preserve authorship',async()=>{
 const db=memoryDB(),{post}=await service.execute(db,alice,'create',sample);
 await service.execute(db,bob,'react',{id:post.id,liked:true});await service.execute(db,bob,'react',{id:post.id,liked:true});assert.equal((await service.execute(db,alice,'list')).posts[0].likes,1);
 const comment={id:post.id,body:'Reply',requestId:'reply-00000001'};await service.execute(db,bob,'comment',comment);await service.execute(db,bob,'comment',comment);
 const rows=(await service.execute(db,alice,'comments',{id:post.id})).comments;assert.equal(rows.length,1);assert.equal(rows[0].author,'Bob');assert.equal(rows[0].own,false);
});
test('auth, size, id and unsupported group restrictions fail closed',async()=>{
 const db=memoryDB();await assert.rejects(service.execute(db,null,'list'),{statusCode:401});await assert.rejects(service.execute(db,alice,'create',{...sample,privacy:'group'}),{code:'PRIVACY_UNSUPPORTED'});
 await assert.rejects(service.execute(db,alice,'create',{...sample,body:'x'.repeat(8001)}),{code:'INVALID_CONTENT'});await assert.rejects(service.execute(db,alice,'update',{id:'bad'}),{code:'INVALID_ID'});
});
test('cursor pagination does not drop posts with the same timestamp',async()=>{
 const db=memoryDB(),now=new Date('2026-09-06T00:00:00.000Z');for(let i=0;i<25;i++)await service.execute(db,alice,'create',{...sample,requestId:'same-time-'+String(i).padStart(8,'0')},now);
 const first=await service.execute(db,bob,'list'),second=await service.execute(db,bob,'list',{cursor:first.nextCursor});assert.equal(first.posts.length,20);assert.equal(second.posts.length,5);assert.equal(new Set([...first.posts,...second.posts].map(p=>p.id)).size,25);
});
