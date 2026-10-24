(function(scope){'use strict';
  const get=(name,file)=>scope[name]||(typeof require==='function'?require('./'+file):null);
  const sources=[get('HHAllGameExpArtPlay','all-game-exp-art-play.js'),get('HHAllGameExpArtLab','all-game-exp-art-lab.js'),get('HHAllGameExpArtStory','all-game-exp-art-story.js')];
  const api=Object.freeze({illustration(id){for(const source of sources){const art=source?.illustration(id);if(art)return art;}return '';}});
  scope.HHAllGameExpansionArt=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
