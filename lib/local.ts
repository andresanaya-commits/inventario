import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {randomUUID,scryptSync,timingSafeEqual,randomBytes} from 'node:crypto';
import type {Row,Profile,Table} from './types';
const managed=process.env.DATA_BACKEND==='supabase'||process.env.VERCEL==='1';
if(!managed)mkdirSync('.data',{recursive:true});
const db=new DatabaseSync(managed?':memory:':'.data/inventory.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);');
export function rows(t:Table):Row[]{return (db.prepare('SELECT data FROM records WHERE kind=?').all(t) as {data:string}[]).map(x=>JSON.parse(x.data))}
export function put(t:Table,r:Row){db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(r.id,t,JSON.stringify(r));return r}
export function transaction<T>(fn:()=>T):T{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){db.exec('ROLLBACK');throw e}}
export function password(id:string,pw:string){const salt=randomBytes(16).toString('hex');db.prepare('INSERT OR REPLACE INTO credentials VALUES (?,?)').run(id,salt+':'+scryptSync(pw,salt,64).toString('hex'))}
export function login(email:string,pw:string){const p=rows('profiles').find(x=>x.email===email&&x.active);if(!p)return null;const c=db.prepare('SELECT hash FROM credentials WHERE id=?').get(p.id) as {hash:string}|undefined;if(!c)return null;const [salt,hash]=c.hash.split(':');if(!timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(pw,salt,64)))return null;const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token,p.id,Date.now()+3600000);return token}
export function profile(token:string){const s=db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(token,Date.now()) as {user_id:string}|undefined;return s?rows('profiles').find(x=>x.id===s.user_id&&x.active) as unknown as Profile:undefined}
export function logout(token:string){db.prepare('DELETE FROM sessions WHERE token=?').run(token)}
if(!managed&&!rows('settings').length){transaction(()=>{
const now=new Date().toISOString();
const add=(t:Table,v:Record<string,string|number|boolean|null>)=>put(t,{id:randomUUID(),created_at:now,updated_at:now,...v});
const suppliers=['Harvest Pack Solutions','Valley Film & Bag','Orchard Label Co.'].map(name=>add('suppliers',{name,contact_name:'Operations Team',email:name.split(' ')[0].toLowerCase()+'@example.test',phone:'555-0100',active:true,notes:'Fictional demonstration supplier'}));
const cats=['Boxes','Bags & Film','Labels'].map(name=>add('categories',{name,description:name+' packaging materials',active:true}));
const units=['Pieces','Boxes','Rolls','Labels','Pounds','Pallets'].map(name=>add('units',{name,active:true}));
const admin=add('profiles',{email:'admin@example.test',name:'Alex Morgan',role:'ADMINISTRATOR',supplier_id:null,active:true});password(admin.id,'DemoAdmin123!');
suppliers.forEach((s,i)=>{const p=add('profiles',{email:`supplier${i+1}@example.test`,name:String(s.name),role:'SUPPLIER',supplier_id:s.id,active:true});password(p.id,'DemoSupplier123!')});
const names=['15lbs Beef Topline Box','25 lbs Roma Box','Heirloom Box','Organic TOV Tray','10 lb Pepper Carton','1 lb Mini Sweet Peppers Bag','12x1 Pint Red Grape Top Seal Film','2 lb Tomato Bag','Organic Cucumber Film','Produce Stretch Wrap','PTI Label','Loblaw FM Label','Organic Certification Label','Harvest Traceability Label','Pallet Shipping Label'];
names.forEach((name,i)=>{const cat=Math.floor(i/5);const item=add('items',{name,sku:`PKG-${String(i+1).padStart(3,'0')}`,description:'Fresh produce packaging',category_id:cats[cat].id,unit_id:units[cat===1?2:0].id,active:true,notes:''});const quantity=[12000,3400,0,8200,1800,450,9500,2200,700,6500,25000,1200,11000,2300,800][i];const a=add('supplier_items',{item_id:item.id,supplier_id:suppliers[cat].id,minimum_stock:cat===2?5000:4000,current_quantity:quantity,in_transit:0,in_production:0,active:true,notes:''});add('inventory_movements',{supplier_item_id:a.id,item_id:item.id,supplier_id:suppliers[cat].id,movement_type:'INITIAL',quantity,previous_quantity:0,new_quantity:quantity,reference:'Opening balance',notes:'Seed data',user_id:admin.id});if(i%2===0){put('supplier_items',{...a,current_quantity:quantity+500});add('inventory_movements',{supplier_item_id:a.id,item_id:item.id,supplier_id:suppliers[cat].id,movement_type:'RECEIPT',quantity:500,previous_quantity:quantity,new_quantity:quantity+500,reference:'PO-2026-'+i,notes:'Sample delivery',user_id:admin.id})}if(i%3===0)add('incoming_inventory',{supplier_item_id:a.id,item_id:item.id,supplier_id:suppliers[cat].id,quantity:1500,stage:i%2?'PRODUCTION':'TRANSIT',status:'OPEN',reference:'PO-IN-'+i,expected_date:'2026-11-01',notes:''});});
add('settings',{company_name:'Fresh Produce Co.',warning_threshold:1.2,timezone:'America/Mexico_City',date_format:'en-US',default_unit:'Pieces'});
})}
