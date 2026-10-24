'use strict';
// Browser actions operate the real host. No state injection or fake terminal flags.
const bundles=['sports','precision','vehicles','cards','board','classic','social'];
const games=Object.assign({},...bundles.map(b=>require('../all-game-exp-'+b+'.js').games));
const assert=(v,message)=>{if(!v)throw Error(message);};
const recipes={};
for(const id of Object.keys(games))recipes[id]=async(page,h)=>{
 const before=await h.state();let after;
 const command=id=>h.command(id);
 switch(id){
 case'futsal-match':case'street-hoops':await h.key('ArrowRight',250);after=await h.state();assert(after.players[0].x!==before.players[0].x,'Cầu thủ không di chuyển');break;
 case'court-tennis':await command('hit');after=await h.state();assert(after.phase!=='serve'||after.moves>0,'Giao bóng không thực thi');break;
 case'beach-volley':await command('bump');after=await h.state();assert(after.moves>0,'Đỡ/giao bóng không thực thi');break;
 case'diamond-baseball':await command('pitch');after=await h.state();assert(after.moves===before.moves+1,'Không bắt đầu pitch');break;
 case'tenpin-bowling':await command('roll');after=await h.state();assert(after.ball&&after.phase==='rolling','Bóng bowling không lăn');break;
 case'eight-ball':await h.point(440,240);await command('shoot');after=await h.state();assert(after.moves>0&&after.phase==='moving','Bi cái không được đánh');break;
 case'curling-end':await command('throw');after=await h.state();assert(after.stones.length===1,'Không thả đá');break;
 case'swim-meet':await command('strokeL');after=await h.state();assert(after.stamina<before.stamina&&after.moves>before.moves,'Quạt tay không dùng sức');break;
 case'skate-line':await command('ollie');await command('flip');after=await h.state();assert(after.air&&after.combo>0,'Ollie/kickflip không cập nhật vật lý');break;
 case'sail-regatta':await h.key('ArrowRight',250);after=await h.state();assert(after.boat.a!==before.boat.a,'Thuyền không đổi hướng');break;
 case'trailer-docking':await h.key('ArrowUp',300);after=await h.state();assert(after.tractor.x!==before.tractor.x||after.tractor.v!==before.tractor.v,'Xe kéo không chạy');break;
 case'lunar-lander':await h.key('ArrowUp',250);after=await h.state();assert(after.fuel<before.fuel,'Động cơ không tiêu nhiên liệu');break;
 case'air-traffic-control':await command('approach');after=await h.state();assert(after.planes[0].route.length>0&&after.planes[0].clear,'Không lập tiếp cận');break;
 case'pit-strategy':await command('normal');after=await h.state();assert(after.lap===2&&after.car.fuel<before.car.fuel,'Không mô phỏng vòng đua');break;
 case'klondike-table':await command('foundation');after=await h.state();assert(after.foundation.reduce((a,b)=>a+b,0)>0,'Không di chuyển lá hợp lệ lên nền');break;
 case'rummy-meld':await command('stock');after=await h.state();assert(after.hands[0].length===11&&after.stock.length===before.stock.length-1,'Rút bài không bảo toàn bộ bài');break;
 case'hearts-table':await h.cell(0,13,1);await h.cell(1,13,1);await h.cell(2,13,1);await command('pass');after=await h.state();assert(after.phase==='play'&&after.hands.flat().length+after.trick.length===52,'Chuyền bài không hợp lệ');break;
 case'spades-partners':await command('bid');after=await h.state();assert(after.phase==='play'&&after.bids[0]===3,'Không khóa hợp đồng');break;
 case'chromatic-shedding':{const i=before.hands[0].findIndex(c=>games[id].rules.legal(before,c));if(i>=0)await h.cell(i,Math.max(7,before.hands[0].length),1);else await command('draw');after=await h.state();assert(after.moves>before.moves||after.status!=='playing','Không đánh/rút bài');break;}
 case'domino-chain':await command('rightend');after=await h.state();assert(after.chain.length>0,'Không nối quân domino');break;
 case'backgammon-race':{const m=games[id].rules.legal(before,1)[0];if(m){if(m.from===-1)await command('bar');else await h.cell(m.from,12,2);if(m.to===24)await command('off');else await h.cell(m.to,12,2);after=await h.state();assert(after.moves>before.moves,'Không dùng xúc xắc');}else await command('pass');break;}
 case'carrom-pocket':await command('shoot');after=await h.state();assert(after.moves>0&&after.coins.some(c=>c.kind===3),'Striker không vào mô phỏng');break;
 case'xiangqi-river':case'shogi-drops':{const m=games[id].rules.legal(before,1).find(m=>!m.drop);await h.cell(m.from,9,id==='xiangqi-river'?10:9);await h.cell(m.to,9,id==='xiangqi-river'?10:9);after=await h.state();assert(after.moves>=2,'Nước quân và phản hồi AI không thực thi');break;}
 case'attribute-triads':{const a=games[id].rules.sets(before.table)[0];for(const i of a)await h.cell(i,4,Math.ceil(before.table.length/4));after=await h.state();assert(after.score>=100,'Không nhận bộ ba hợp lệ');break;}
 case'sliding-block-escape':await h.cell(3,6,6);await command('forward');after=await h.state();assert(after.cars[1].y===1,'Khối dọc không trượt theo trục');break;
 case'marble-chain':await h.point(360,150);await h.key('Space');after=await h.state();assert(after.ammo<before.ammo,'Không bắn bi');break;
 case'twist-cube':await command('face0');after=await h.state();assert(JSON.stringify(after.cubies)!==JSON.stringify(before.cubies),'Không hoán vị cubie');break;
 case'blackbox-rays':await h.cell(1,6,6);after=await h.state();assert(Object.keys(after.probes).length===1&&after.budget===before.budget-1,'Không thực hiện phép đo');break;
 case'liars-dice':await command('bid');after=await h.state();assert(after.bid.n>0||after.round>before.round,'Không ra giá / xử lý bot');break;
 case'trust-lab':await command('cooperate');after=await h.state();assert(after.history.length===1&&after.total[0]+after.total[1]>0,'Payoff chưa áp dụng');break;
 case'gesture-tactics':await command('stance0');after=await h.state();assert(after.history.length===1&&after.energy[0]===2,'Chưa reveal đồng thời hoặc trừ năng lượng');break;
 case'festival-draft':await h.cell(0,7,1);after=await h.state();assert(after.tableaux.every(a=>a.length===1)&&after.hands.every(a=>a.length===6),'Chưa draft/chuyền tay');break;
 case'confidence-estimator':await command('observe');await command('submit');after=await h.state();assert(after.round===1&&after.results.length===1,'Chưa chấm khoảng ước lượng');break;
 default:throw Error('Thiếu recipe '+id);
 }
 return{id,verified:'Thao tác chính làm đổi luật/tài nguyên trong host thật'};
};
module.exports=recipes;
