import assert from 'node:assert/strict';
const url='http://127.0.0.1:3000/api/store';
async function post(action,data,status=200){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:3000'},body:JSON.stringify({action,data})});const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body;}
let store=await (await fetch(url)).json();
let order=store.orders.find(o=>o.name==='Pelanggan Demo');
if(!order){const data={name:'Pelanggan Demo',phone:'081200000000',service:'complete',kg:5,express:false,address:'Alamat demo — Cabang Cinere, bukan penjemputan asli',lat:-6.3286,lng:106.7844,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()),slot:'09.00–12.00',notes:'Data pengujian lokal',photo:'',source:'web'};const result=await post('order',data);order=result.store.orders.find(o=>o.id===result.id);assert.equal(order.total,40000);}
const update=await post('update',{id:order.id,actualKg:6,status:4,paid:true});
order=update.store.orders.find(o=>o.id===order.id);
assert.equal(order.total,44000);assert.equal(order.paid,true);assert.equal(order.status,4);
await post('update',{id:order.id,status:1},400);
await post('update',{id:order.id,actualKg:-1},400);
await post('order',{name:'Invalid'},400);
const prices=store.services.map(s=>({id:s.id,price:s.price}));
await post('prices',prices.map(p=>p.id==='complete'?{...p,price:1000}:p),400);
let persisted=await (await fetch(url)).json();
assert.equal(persisted.services.find(s=>s.id==='complete').price,store.services.find(s=>s.id==='complete').price);
assert.equal(persisted.orders.find(o=>o.id===order.id).total,44000);
const altered=await post('prices',prices.map(p=>p.id==='complete'?{...p,price:p.price+1000}:p));
assert.equal(altered.store.orders.find(o=>o.id===order.id).unitPrice,order.unitPrice);
await post('prices',prices);
const rejected=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({action:'promo',data:store.promo})});assert.equal(rejected.status,403);
console.log('PASS: create/read, actual-weight pricing, payment, tracking status, backward-status rejection, invalid-weight rejection, invalid-order rejection, price transaction rollback, historical-price snapshot, origin rejection.');
console.log('Demo order:',order.id,'total:',order.total,'status:',order.status);
