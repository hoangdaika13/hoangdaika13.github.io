/* Same-origin, dependency-free PCM worker. No access to DOM or user storage. */
"use strict";
importScripts("galaxy-workbench-core.js?v=3");
self.onmessage = function(event) {
  try {
    const job=event.data;
    if(!job||!["trim","mix"].includes(job.type)||!Array.isArray(job.buffers)||job.buffers.length>8)throw Error("Tác vụ PCM không hợp lệ.");
    let total=0;
    const buffers=job.buffers.map(item=>{
      if(!Array.isArray(item.channels)||!item.channels.length||item.channels.length>2)throw Error("Số kênh PCM không hợp lệ.");
      const channels=item.channels.map(channel=>new Float32Array(channel));
      total+=channels.reduce((sum,channel)=>sum+channel.length,0);
      if(total>48000000)throw Error("Tổng PCM vượt giới hạn worker.");
      return {sampleRate:item.sampleRate,length:channels[0].length,numberOfChannels:channels.length,getChannelData:i=>channels[i]};
    });
    const core=self.HHGalaxyWorkbenchCore;
    const result=job.type==="mix"?core.mixAudio(buffers,job.options):core.trimAudio(buffers[0],job.options);
    const wav=core.encodeWav(result);
    self.postMessage({ok:true,wav,length:result.length,sampleRate:result.sampleRate,channels:result.numberOfChannels},[wav]);
  }catch(error){self.postMessage({ok:false,error:String(error.message||error)});}
};
