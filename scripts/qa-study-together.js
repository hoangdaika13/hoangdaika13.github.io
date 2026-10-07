"use strict";
// Real local LiveKit transport + labeled QA identity/database doubles. Never production authentication.
const fs=require("node:fs/promises"),path=require("node:path"),http=require("node:http"),os=require("node:os"),assert=require("node:assert/strict");
const {RoomServiceClient}=require("livekit-server-sdk");
const {handle,configuration}=require("../utils/study-together").__test;
const {MemoryDb}=require("../tests/helpers/study-room-db");
const {chromium}=require(process.env.HH_PLAYWRIGHT_PATH||"playwright");
const root=path.resolve(__dirname,"..");
let stage="startup";
async function run(){
  let credentials;
  if(process.env.HH_STUDY_QA_CLOUD_PROJECT_ID){
    const {spawnSync}=require("node:child_process"),auth=spawnSync(path.join(root,".study-local/livekit-cli-2.18.8/lk.exe"),["project","list","--json"],{encoding:"utf8",windowsHide:true});
    if(auth.status!==0)throw Error("Private LiveKit project lookup failed");let projects;try{projects=JSON.parse(auth.stdout)}catch{throw Error("Invalid private CLI response")}
    const selected=projects.filter(p=>p.ProjectId===process.env.HH_STUDY_QA_CLOUD_PROJECT_ID);if(selected.length!==1)throw Error("Expected exactly the explicitly selected QA Cloud project");
    credentials={LIVEKIT_URL:selected[0].URL,LIVEKIT_API_KEY:selected[0].APIKey,LIVEKIT_API_SECRET:selected[0].APISecret};console.log("QA doubles with real LiveKit Cloud transport; no production HH identities.");
  }else credentials=JSON.parse((await fs.readFile(path.join(root,".study-local/credentials.json"),"utf8")).replace(/^\uFEFF/,""));
  const config=configuration(credentials),client=new RoomServiceClient(config.httpUrl,config.key,config.secret,{requestTimeout:8}),db=new MemoryDb(),created=[];
  const users={host:{_id:"650000000000000000000001",name:"QA Host"},learner:{_id:"650000000000000000000002",name:"QA Learner"},visitor:{_id:"650000000000000000000003",name:"QA Visitor"}};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,"http://localhost");
    if(url.pathname==="/api/study-together"){
      const response={status(n){res.statusCode=n;return this;},json(data){res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));if(data.room?.host&&!created.includes(data.room.id))created.push(data.room.id);return data;}};
      if(url.searchParams.get("action")==="config")return response.status(200).json({configured:req.headers["x-qa-mode"]!=="unconfigured",authenticationRequired:false,hostAuthenticationRequired:true,guestInvites:true});
      const role=String(req.headers.authorization||"").replace("Bearer qa-","");
      let raw="";for await(const chunk of req)raw+=chunk;
      try{return await handle({method:req.method,headers:req.headers,socket:req.socket,query:Object.fromEntries(url.searchParams)},response,{db,body:raw?JSON.parse(raw):{},user:users[role]||null,config,client,rateLimit:async()=>{}});}
      catch(e){return response.status(e.statusCode||500).json({error:e.statusCode?e.message:"QA server error"});}
    }
    if(url.pathname.startsWith("/api/")){res.setHeader("Content-Type","application/json");if(url.pathname==="/api/auth/providers")return res.end(JSON.stringify({google:false,email:false}));res.statusCode=401;return res.end(JSON.stringify({error:"QA ONLY: no production HH authentication",code:"AUTH_REQUIRED"}));}
    try{const pathname=url.pathname==="/"?"/index.html":decodeURIComponent(url.pathname),file=path.resolve(root,"."+pathname),ext=path.extname(file);if(!file.startsWith(root+path.sep)||pathname.split("/").some(p=>p.startsWith(".")||p==="node_modules")||!/[.](html|js|css|json|png|jpg|jpeg|webp|svg|woff2?|ogg|mp3|wav|ico)$/.test(ext)){res.writeHead(404);return res.end();}res.setHeader("Content-Type",{".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"}[ext]||"application/octet-stream");res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,...(process.env.HH_BROWSER_EXECUTABLE?{executablePath:process.env.HH_BROWSER_EXECUTABLE}:{}),args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--enable-usermedia-screen-capturing","--auto-select-desktop-capture-source=Entire screen"]});
  const base="http://127.0.0.1:"+server.address().port+"/tests/fixtures/study-together.html";
  const captures=await fs.mkdtemp(path.join(os.tmpdir(),"hh-study-together-qa-"));
  const errors=[];
  async function checkShell(guestCode) {
    stage="full shell guest entry";
    const shellContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),shell=await shellContext.newPage();shell.on('pageerror',e=>errors.push(e.message));
    try {
      await shell.goto(new URL(base).origin+'/?api=local#/learn/study-together?invite='+guestCode,{waitUntil:'domcontentloaded'});
      await shell.locator('[data-guest-login]').click();await shell.locator('[data-hh-study-together-host] .hst').waitFor({timeout:30000});
      assert.ok((await shell.url()).includes('invite='+guestCode));assert.equal(await shell.locator('.hst [data-hst-join] [name="code"]').inputValue(),guestCode);assert.equal(await shell.locator('.hst [data-hst-create] button[type=submit]').isDisabled(),true);assert.ok(await shell.locator('.app-sidebar').isVisible());
      assert.ok(!(await shell.locator('.app-breadcrumb').innerText()).includes(guestCode));assert.ok((await shell.locator('.app-breadcrumb').innerText()).includes('Học cùng nhau'));
      const studyNav=shell.locator('.app-sidebar__submenu [data-app-route="/learn/study-together"]');assert.equal(await studyNav.count(),1);assert.equal(await studyNav.getAttribute('aria-current'),'page');assert.equal(await shell.locator('.app-sidebar__submenu [data-app-route="/learn"]').getAttribute('aria-current'),null);
      if(await shell.locator('[data-sidebar-section-toggle="learning"]').getAttribute('aria-expanded')!=='true')await shell.locator('[data-sidebar-section-toggle="learning"]').click();await studyNav.waitFor({state:'visible'});
      const shellHandle=await shell.locator('#appShell').elementHandle();await shell.locator('.app-sidebar__home').click();await shell.locator('[data-php-card="/learn/study-together"]').waitFor({timeout:30000});await shell.locator('[data-php-card="/learn/study-together"] [data-php-route="/learn/study-together"]').click();await shell.locator('.hst').waitFor();assert.equal(await shellHandle.evaluate(node=>node===document.querySelector('#appShell')),true);
      stage="shell Back/Forward/reload";
      await shell.goBack({waitUntil:'domcontentloaded'});await shell.locator('.php').waitFor();await shell.goForward({waitUntil:'domcontentloaded'});await shell.locator('.hst').waitFor();await shell.reload({waitUntil:'domcontentloaded'});await shell.locator('.hst').waitFor();assert.equal(await shell.locator('.app-sidebar__submenu [data-app-route="/learn/study-together"]').getAttribute('aria-current'),'page');
      await shell.locator('.app-global-search').click();await shell.locator('#commandPaletteInput').fill('Học cùng nhau');await shell.locator('#commandPaletteResults [data-app-route="/learn/study-together"]').first().waitFor();await shell.keyboard.press('Escape');
      stage="shell open HH School";
      if(await shell.locator('[data-sidebar-section-toggle="learning"]').getAttribute('aria-expanded')!=='true')await shell.locator('[data-sidebar-section-toggle="learning"]').click();await shell.locator('.app-sidebar__submenu [data-app-route="/learn"]').click();await shell.locator('.hh-school').waitFor();
      stage="shell return from HH School";
      await shell.locator('.app-sidebar__submenu [data-app-route="/learn/study-together"]').click();await shell.locator('.hst').waitFor();assert.equal(await shell.locator('#appPageHeader').isVisible(),true);assert.equal(await shell.locator('#appBreadcrumb').isVisible(),true);assert.equal(await shell.evaluate(()=>document.body.classList.contains('app-learning-route')),false);
      await shell.screenshot({path:path.join(captures,'full-shell-guest-invite.png'),timeout:5000});
    } catch(e) {
      console.log(JSON.stringify(await shell.evaluate(()=>({route:location.hash,bodyClasses:document.body.className,studyMounted:!!window.HHStudyTogether?.activeHost?.(),workspace:document.querySelector('#appWorkspace')?.innerText.slice(0,600)})),null,2));
      await shell.screenshot({path:path.join(captures,'shell-failure.png'),timeout:5000}).catch(()=>{});
      console.log('QA captures: '+captures);throw e;
    } finally {await shellContext.close();}
  }
  try{
    if(process.env.HH_STUDY_QA_SHELL_ONLY==='1'){await checkShell('0123456789ABCDEF');assert.deepEqual(errors,[]);console.log(JSON.stringify({shellOnly:true,pageErrors:0,captures},null,2));return;}
    for(const width of[1440,768,375]){
      const ctx=await browser.newContext({viewport:{width,height:950},extraHTTPHeaders:{"X-QA-Mode":"unconfigured"},reducedMotion:"reduce"});
      const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(base);
      await page.waitForFunction(()=>document.querySelector("[data-hst-connection]").textContent==="Chưa cấu hình LiveKit");
      assert.equal(await page.locator("[data-hst-create] button[type=submit]").isDisabled(),true);
      assert.equal(await page.evaluate(()=>qaStudy.preview),null);
      await page.locator('[data-hst-preset]').selectOption('quiet');assert.equal(await page.locator('[data-hst-create] [name="allowMicrophone"]').isChecked(),false);
      await page.locator('[data-hst-create] [name="title"]').fill('QA saved setup');await page.reload();assert.equal(await page.locator('[data-hst-create] [name="title"]').inputValue(),'QA saved setup');assert.equal(await page.locator('[data-hst-create] [name="allowMicrophone"]').isChecked(),false);
      await page.locator("#large").click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(captures,"lobby-"+width+"-200pct.png")});await ctx.close();
    }
    stage="connect";
    const c1=await browser.newContext({viewport:{width:1280,height:950},permissions:["camera","microphone"]}),c2=await browser.newContext({viewport:{width:375,height:950},permissions:["camera","microphone"]});
    const host=await c1.newPage(),peer=await c2.newPage();for(const p of[host,peer])p.on("pageerror",e=>errors.push(e.message));
    await host.goto(base+"?as=host");await host.locator("[data-hst-create] button[type=submit]").waitFor({state:"visible"});
    await host.waitForFunction(()=>!document.querySelector("[data-hst-create] button[type=submit]").disabled);
    await host.locator('[data-hst-preset]').selectOption('presentation');assert.equal(await host.locator('[data-hst-create] [name="allowScreenShare"]').isChecked(),false);assert.equal(await host.locator('[data-hst-create] [name="waitingRoom"]').isChecked(),true);
    await host.locator('[data-hst-preset]').selectOption('group');
    await host.locator('[data-hst-create] [name="title"]').fill('QA host room draft');
    await host.locator('[data-hst-create] [name="waitingRoom"]').check();
    await host.locator("[data-hst-create] button[type=submit]").click();
    stage="host connect";
    await host.waitForFunction(()=>document.querySelector("[data-hst-connection]").textContent==="Đã kết nối LiveKit",{timeout:20000});
    const code=await host.evaluate(()=>qaStudy.code);
    assert.equal(await host.evaluate(()=>qaStudy.room.localParticipant.isMicrophoneEnabled),false);
    assert.equal(await host.evaluate(()=>qaStudy.room.localParticipant.isCameraEnabled),false);
    await peer.goto(base+"?as=learner");await peer.waitForFunction(()=>!document.querySelector("[data-hst-join] button[type=submit]").disabled);
    await peer.locator('[data-hst-join] [name="code"]').fill(code);await peer.locator("[data-hst-join] button[type=submit]").click();await peer.locator("[data-hst-waiting]").waitFor({state:"visible"});
    await peer.locator('[data-hst-auto-admission]').uncheck();assert.equal(await peer.evaluate(()=>qaStudy.poll),0);
    stage="admission";
    await host.locator('[data-hst-action="refresh"]').click();await host.locator("[data-hst-admit]").click();await peer.locator('[data-hst-action="check-admission"]').click();
    stage="peer connect";
    await peer.waitForFunction(()=>qaStudy.room?.state==="connected",null,{timeout:20000});await host.waitForFunction(()=>qaStudy.room.remoteParticipants.size===1);
    stage="camera/audio";
    await host.locator('[data-hst-action="camera"]').click();await host.waitForFunction(()=>document.querySelector('[data-hst-action="camera"]').getAttribute('aria-pressed')==='true');
    await host.locator('[data-hst-action="mic"]').click();await host.waitForFunction(()=>document.querySelector('[data-hst-action="mic"]').getAttribute('aria-pressed')==='true');
    await peer.waitForFunction(()=>document.querySelector('.hst-tile:not(.is-local)[data-source="camera"] video')?.readyState>=2,null,{timeout:20000}).catch(async e=>{
      const diagnostic=await peer.evaluate(()=>({
        notice:document.querySelector('[data-hst-notice]').textContent,connection:qaStudy.room?.state,
        video:[...document.querySelectorAll('.hst-tile video')].map(v=>({hidden:v.hidden,ready:v.readyState,paused:v.paused,autoplay:v.autoplay,source:!!v.srcObject,local:v.closest('.hst-tile').classList.contains('is-local')})),
        remote:[...qaStudy.room.remoteParticipants.values()].map(p=>({video:[...p.videoTrackPublications.values()].map(t=>({subscribed:t.isSubscribed,muted:t.isMuted,track:!!t.track,enabled:t.isEnabled}))}))
      }));
      console.log(JSON.stringify(diagnostic,null,2));await peer.screenshot({path:path.join(captures,'camera-failure.png')});throw e;
    });
    stage="audio received";
    await peer.waitForFunction(()=>document.querySelector("[data-hst-audio] audio")?.srcObject?.getAudioTracks().length>0);
    stage="chat/hand";
    await host.locator('[data-hst-pane="chat"]').click();await host.locator('[data-hst-chat] [name="text"]').fill('QA <img src=x onerror="bad">');await host.locator("[data-hst-chat] button").click();
    await peer.locator('[data-hst-pane="chat"]').click();await peer.locator("[data-hst-messages]").getByText('QA <img src=x onerror="bad">',{exact:true}).waitFor();assert.equal(await peer.locator("[data-hst-messages] img").count(),0);
    await peer.locator('[data-hst-action="hand"]').click();await host.waitForFunction(()=>qaStudy.hands.has("u_650000000000000000000002"));
    stage="timer";
    await host.locator('[data-hst-pane="focus"]').click();await host.locator('[data-hst-timer-action="start"]').click();await peer.locator('[data-hst-pane="focus"]').click();await peer.waitForFunction(()=>qaStudy.info.timer?.running===true);
    await peer.locator("[data-hst-notes]").fill("QA private note");assert.equal(await peer.locator("[data-hst-note-state]").innerText(),"Đã lưu ghi chú riêng trên thiết bị.");assert.equal(await host.locator("[data-hst-notes]").inputValue(),"");
    stage="screen";
    // A generated canvas proves the screen-share source is sent through the real SFU without selecting a personal desktop.
    await host.evaluate(async()=>{const canvas=document.createElement("canvas");canvas.width=320;canvas.height=180;const ctx=canvas.getContext("2d");let frame=0;const draw=()=>{ctx.fillStyle="#3158a5";ctx.fillRect(0,0,320,180);ctx.fillStyle="#fff";ctx.fillText("QA synthetic screen "+frame++,20,50);};draw();window.qaCanvas=canvas;window.qaScreenFrame=setInterval(draw,100);const track=canvas.captureStream(10).getVideoTracks()[0];window.qaScreenTrack=new LivekitClient.LocalVideoTrack(track);await qaStudy.room.localParticipant.publishTrack(qaScreenTrack,{source:LivekitClient.Track.Source.ScreenShare});});
    const screen=peer.locator('.hst-tile[data-source="screen"]');await screen.scrollIntoViewIfNeeded();
    await peer.waitForFunction(()=>document.querySelector('.hst-tile[data-source="screen"] video')?.readyState>=2,null,{timeout:20000});
    await peer.waitForFunction(()=>document.querySelector('[data-hst-timer]').textContent!=='Chưa bắt đầu');
    assert.ok(await peer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await host.screenshot({path:path.join(captures,"connected-host.png")});await peer.screenshot({path:path.join(captures,"connected-mobile.png")});
    stage="permissions/cancellation";
    await peer.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{throw new DOMException('QA user cancelled share','NotAllowedError');};});
    await peer.locator('[data-hst-action="screen"]').click();await peer.locator('[data-hst-notice]').getByText('Bạn chưa cho phép thiết bị hoặc đã hủy chia sẻ.',{exact:true}).waitFor();
    assert.equal(await peer.evaluate(()=>qaStudy.room.localParticipant.isScreenShareEnabled),false);
    await peer.locator('[data-hst-pane="settings"]').click();await peer.locator('[data-hst-talk]').check();
    await peer.waitForFunction(()=>!document.querySelector('.hst').hasAttribute('aria-busy'));
    await peer.locator('[data-hst-action="hand"]').focus();await peer.keyboard.down('v');await peer.waitForFunction(()=>qaStudy.room.localParticipant.isMicrophoneEnabled);await peer.keyboard.up('v');await peer.waitForFunction(()=>!qaStudy.room.localParticipant.isMicrophoneEnabled);
    await peer.locator('#large').click();assert.ok(await peer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await peer.locator('#large').click();
    stage="close";
    const hostTracks=await host.evaluateHandle(()=>[...qaStudy.room.localParticipant.trackPublications.values()].map(p=>p.track?.mediaStreamTrack).filter(Boolean));
    await host.waitForFunction(()=>!qaStudy.busy);
    await host.locator('[data-hst-action="confirm-close"]').click();await host.locator('[data-hst-close-dialog] [data-hst-action="close"]').click();await peer.waitForFunction(()=>qaStudy.room===null);assert.equal(await host.evaluate(()=>qaStudy.room),null);
    await host.evaluate(()=>clearInterval(qaScreenFrame));
    assert.equal(await hostTracks.evaluate(tracks=>tracks.every(t=>t.readyState==='ended')),true);
    stage="restore/cleanup";
    await peer.reload();assert.equal(await peer.locator('[data-hst-notes]').inputValue(),'QA private note');assert.equal(await peer.evaluate(()=>qaStudy.room),null);
    await peer.locator('[data-hst-action="test-camera"]').click();await peer.waitForFunction(()=>qaStudy.preview!==null);
    const preview=await peer.evaluateHandle(()=>qaStudy.preview.getTracks());await peer.locator('#exit').click();assert.equal(await preview.evaluate(tracks=>tracks.every(t=>t.readyState==='ended')),true);assert.equal(await peer.evaluate(()=>qaStudy.alive),false);
    const visitor=await c1.newPage();await visitor.goto(base+'?as=visitor');assert.equal(await visitor.locator('[data-hst-notes]').inputValue(),'');assert.equal(await visitor.locator('[data-hst-create] [name="title"]').inputValue(),'Phòng học của tôi');
    stage="guest invitation";
    await host.waitForFunction(()=>!qaStudy.busy);await host.locator('[data-hst-create] button[type=submit]').click();await host.waitForFunction(()=>qaStudy.room?.state==='connected');
    const guestCode=await host.evaluate(()=>qaStudy.code),guestRoom=await host.evaluate(()=>qaStudy.info.id);
    await host.locator('[data-hst-invite-panel] summary').click();await host.addScriptTag({url:new URL(base).origin+'/vendor/jsqr.js'});
    const inviteLink=await host.locator('[data-hst-invite-link]').inputValue();assert.ok(inviteLink.endsWith('#/learn/study-together?invite='+guestCode));
    assert.equal(await host.evaluate(async()=>{const img=document.querySelector('[data-hst-invite-qr] img');await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height).data;}),inviteLink);
    const c3=await browser.newContext({viewport:{width:375,height:950},permissions:['camera','microphone']}),guest=await c3.newPage();guest.on('pageerror',e=>errors.push(e.message));
    await guest.goto(base+'?as=guest#/learn/study-together?invite='+guestCode);await guest.waitForFunction(()=>!document.querySelector('[data-hst-join] button[type=submit]').disabled);
    assert.equal(await guest.locator('[data-hst-create] button[type=submit]').isDisabled(),true);assert.equal(await guest.locator('[data-hst-join] [name="code"]').inputValue(),guestCode);
    await guest.locator('[name="displayName"]').fill('QA <Guest>');await guest.locator('[data-hst-join] [name="code"]').fill(inviteLink);await guest.locator('[data-hst-join] button[type=submit]').click();await guest.locator('[data-hst-waiting]').waitFor({state:'visible'});
    const guestId=await guest.evaluate(()=>qaStudy.guest.id);assert.match(guestId,/^g_[a-f0-9]{32}$/);assert.equal(await guest.evaluate(()=>localStorage.getItem('hh.studyTogether.guestSession.v1')),null);
    assert.ok(await guest.evaluate(()=>qaStudy.poll>0));await guest.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await guest.evaluate(()=>qaStudy.poll),0);await guest.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.ok(await guest.evaluate(()=>qaStudy.poll>0));
    await host.locator('[data-hst-pane="people"]').click();await host.waitForFunction(()=>!qaStudy.busy);await host.locator('[data-hst-admit="'+guestId+'"]').waitFor({timeout:20000});await host.locator('[data-hst-admit="'+guestId+'"]').click();await guest.waitForFunction(()=>qaStudy.room?.state==='connected',null,{timeout:20000});
    assert.equal(await guest.evaluate(()=>qaStudy.poll),0);assert.equal(await guest.evaluate(()=>qaStudy.room.localParticipant.isMicrophoneEnabled||qaStudy.room.localParticipant.isCameraEnabled),false);
    assert.equal(await guest.evaluate(()=>qaStudy.room.localParticipant.identity),guestId);assert.equal(await guest.evaluate(()=>qaStudy.info.host),false);
    await guest.locator('[data-hst-pane="chat"]').click();await guest.locator('[data-hst-chat] [name="text"]').fill('Guest QA message');await guest.locator('[data-hst-chat] button').click();await host.locator('[data-hst-pane="chat"]').click();await host.locator('[data-hst-messages]').getByText('Guest QA message',{exact:true}).waitFor();
    await guest.locator('[data-hst-pane="focus"]').click();await guest.locator('[data-hst-notes]').fill('Guest private note');await guest.reload();assert.equal(await guest.locator('[data-hst-notes]').inputValue(),'Guest private note');assert.equal(await guest.evaluate(()=>qaStudy.room),null);
    await guest.locator('[data-hst-action="resume-guest"]').click();await guest.waitForFunction(()=>qaStudy.room?.state==='connected');
    await guest.locator('#large').click();assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await guest.locator('#large').click();
    await host.locator('[data-hst-pane="people"]').click();await host.waitForFunction(()=>!qaStudy.busy);await host.locator('[data-hst-kick="'+guestId+'"]').click();await guest.waitForFunction(()=>qaStudy.room===null);
    await guest.locator('[data-hst-action="resume-guest"]').click();await guest.locator('[data-hst-notice]').getByText('Bạn không có quyền xem phòng này.',{exact:true}).waitFor();
    await checkShell(guestCode);
    await host.waitForFunction(()=>!qaStudy.busy);await host.locator('[data-hst-action="confirm-close"]').click();await host.locator('[data-hst-close-dialog] [data-hst-action="close"]').click();await host.waitForFunction(()=>qaStudy.room===null);
    await c3.close();
    await c1.close();await c2.close();assert.deepEqual(errors,[]);
    console.log(JSON.stringify({responsive:[1440,768,375],textZoom:"200%",unconfiguredState:true,waitingRoom:true,twoRealLiveKitClients:true,cameraVideoReceived:true,microphoneAudioReceived:true,chatAndHand:true,sharedTimer:true,privateNotesReloadAndIsolation:true,syntheticScreenVideoReceived:true,simulatedShareCancellation:true,pushToTalk:true,hostCloseAndTracksStopped:true,previewUnmountCleanup:true,guestInviteAndSignedSession:true,qrDecoded:true,guestAdmissionChatReloadRejoinAndKick:true,fullShellGuestDeepLink:true,dedicatedSidebarCatalogAndHistory:true,presetPoliciesAndAccountDraftReload:true,invitationLinkPaste:true,automaticQueueAndAdmission:true,visibilityAwarePolling:true,pageErrors:0,captures},null,2));
  }finally{for(const room of created)await client.deleteRoom(room).catch(()=>{});await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error("Study Together browser QA failed at "+stage+": "+String(e.message||e.name).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g,"[redacted]").slice(0,1500));process.exitCode=1;});
