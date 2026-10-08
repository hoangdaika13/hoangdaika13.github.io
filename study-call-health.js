(function(root){
  "use strict";
  function mount(host,options){
    let alive=true,room=null,timer=0,listeners=[],recoveries=0,degraded=false,lastQuality='',audioOnly=false,busy=false;
    host.innerHTML='<details class="hsh"><summary>Sức khỏe cuộc gọi <span data-hsh-summary>Chưa vào phòng</span></summary><dl><div><dt>Cuộc gọi RTC</dt><dd data-hsh-rtc></dd></div><div><dt>Mạng tới LiveKit</dt><dd data-hsh-network></dd></div><div><dt>Thiết bị</dt><dd data-hsh-devices></dd></div><div><dt>Backend lưu dữ liệu</dt><dd data-hsh-backend></dd></div><div><dt>Đồng bộ LiveKit</dt><dd data-hsh-sync></dd></div></dl><label class="hst-check"><input data-hsh-adaptive type="checkbox" checked>Tự ưu tiên âm thanh khi mạng yếu</label><label class="hst-check"><input data-hsh-listen type="checkbox">Chỉ nghe · tắt thiết bị phát, không nhận video</label><p data-hsh-policy role="status"></p><p class="hst-help">Không đo tốc độ Internet tổng thể. Không tự bật mic/camera khi reload. Chế độ Chỉ nghe không tự bật lại thiết bị khi tắt.</p></details>';
    const q=s=>host.querySelector(s),sdk=root.LivekitClient;
    const label={excellent:'Tốt',good:'Khá',poor:'Yếu',lost:'Mất kết nối',unknown:'Chưa có số đo'};
    function apply(){
      if(!room||room.state!=='connected')return;
      const quality=room.localParticipant.connectionQuality||'unknown',weak=['poor','lost'].includes(quality);
      if(weak){recoveries=0;degraded=true;}else if(['good','excellent'].includes(quality)&&++recoveries>=3)degraded=false;
      const low=q('[data-hsh-adaptive]').checked&&degraded,desired=low?'low':options.state().quality;
      if(desired!==lastQuality){const track=room.localParticipant.getTrackPublication(sdk.Track.Source.Camera)?.videoTrack;track?.setPublishingQuality(desired==='low'?sdk.VideoQuality.LOW:sdk.VideoQuality.HIGH);lastQuality=desired;}
      for(const p of room.remoteParticipants.values())for(const pub of p.videoTrackPublications.values()){if(audioOnly){if(pub.isSubscribed)pub.setSubscribed(false);}else{if(!pub.isSubscribed)pub.setSubscribed(true);pub.setVideoQuality(low?sdk.VideoQuality.LOW:sdk.VideoQuality.HIGH);}}
      q('[data-hsh-policy]').textContent=audioOnly?'Chỉ nhận âm thanh. Mic/camera/share đã được yêu cầu tắt.':low?'Đang giới hạn video để ưu tiên âm thanh; không thay đổi quyền hoặc bật thiết bị.':'LiveKit tự thích nghi mạng; chất lượng video theo lựa chọn của bạn.';
    }
    function sync(){
      if(!alive)return;const s=options.state();if(s.room!==room){listeners.forEach(off=>off());listeners=[];room=s.room;lastQuality='';recoveries=0;degraded=false;if(room){for(const event of [sdk.RoomEvent.ConnectionQualityChanged,sdk.RoomEvent.ConnectionStateChanged,sdk.RoomEvent.LocalTrackPublished,sdk.RoomEvent.TrackPublished]){const fn=()=>{lastQuality='';sync();};room.on(event,fn);listeners.push(()=>room?.off(event,fn));}}}
      const p=room?.localParticipant,quality=p?.connectionQuality||'unknown',rtc=room?.state||'disconnected',b=s.backend||{};
      q('[data-hsh-rtc]').textContent=({connected:'Đã kết nối',reconnecting:'Đang kết nối lại',connecting:'Đang kết nối',disconnected:'Chưa kết nối'}[rtc]||rtc);
      q('[data-hsh-summary]').textContent=room?' · '+(label[quality]||'Chưa có số đo'):' · Chưa vào phòng';q('[data-hsh-network]').textContent=label[quality]||'Chưa có số đo';
      q('[data-hsh-devices]').textContent=room?['Mic '+(p.isMicrophoneEnabled?'bật':'tắt'),'Camera '+(p.isCameraEnabled?'bật':'tắt'),'Share '+(p.isScreenShareEnabled?'bật':'tắt')].join(' · '):'Chưa phát thiết bị.';
      q('[data-hsh-backend]').textContent=b.error?'Yêu cầu cuối lỗi: '+b.error:b.at?'Yêu cầu thành công lúc '+new Date(b.at).toLocaleTimeString('vi-VN'):'Chưa có yêu cầu được xác nhận.';
      q('[data-hsh-sync]').textContent=b.syncPending?'Đã lưu; còn cập nhật trực tiếp chưa được xác nhận.':room?'Không có cập nhật chờ được ghi nhận.':'Chưa có phiên đồng bộ.';
      q('[data-hsh-listen]').disabled=!room||busy;
      if(!document.hidden)apply();
      clearTimeout(timer);timer=0;if(room&&!document.hidden)timer=setTimeout(sync,4000);
    }
    const change=async event=>{
      if(event.target.hasAttribute('data-hsh-listen')){audioOnly=event.target.checked;if(audioOnly&&room){busy=true;sync();try{await options.stopMedia(room);}catch(e){q('[data-hsh-policy]').textContent='Không tắt được hết thiết bị: '+e.message;}finally{busy=false;sync();}}else sync();}
      if(event.target.hasAttribute('data-hsh-adaptive')){lastQuality='';sync();}
    };
    host.addEventListener('change',change);document.addEventListener('visibilitychange',sync);sync();
    return {sync,destroy(){alive=false;clearTimeout(timer);listeners.forEach(off=>off());host.removeEventListener('change',change);document.removeEventListener('visibilitychange',sync);host.replaceChildren();}};
  }
  root.HHStudyCallHealth=Object.freeze({mount});
})(window);
