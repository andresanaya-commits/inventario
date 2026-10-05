\set ON_ERROR_STOP on
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000001','admin@test.local'),('10000000-0000-0000-0000-000000000002','supplier@test.local');
update profiles set role='ADMINISTRATOR',active=true where email='admin@test.local';
update profiles set supplier_id=(select id from suppliers where name='Harvest Pack Solutions'),active=true where email='supplier@test.local';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$declare a supplier_items; begin for a in select * from supplier_items loop perform record_movement(a.id,'INITIAL',1000,'PG-INITIAL','SQL test',true);perform record_movement(a.id,'RECEIPT',100,'PG-RECEIPT','SQL test',true);end loop; if (select count(*) from inventory_movements)<>30 then raise exception 'Seed ledger count mismatch';end if;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$declare a supplier_items;r incoming_inventory; m inventory_movements; denied boolean;begin
if(select count(*) from suppliers)<>1 or(select count(*) from items)<>5 or(select count(*) from inventory_movements)<>10 then raise exception 'RLS isolation failed';end if;
select * into a from supplier_items limit 1;
m:=record_movement(a.id,'USAGE',-10,'PG-USAGE','',true);
if m.previous_quantity<>1100 or m.new_quantity<>1090 then raise exception 'Balance mismatch';end if;
denied:=false;begin perform record_movement(a.id,'ADJUSTMENT',1,'','',true);exception when others then denied:=true;end;if not denied then raise exception 'Supplier adjustment allowed';end if;
denied:=false;begin perform record_movement(a.id,'USAGE',-9999,'','',true);exception when others then denied:=true;end;if not denied then raise exception 'Negative stock allowed';end if;
denied:=false;begin update supplier_items set current_quantity=999 where id=a.id;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct balance mutation allowed';end if;
denied:=false;begin delete from inventory_movements;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'History deletion allowed';end if;
insert into incoming_inventory(supplier_item_id,item_id,supplier_id,quantity,stage,expected_date) values(a.id,a.item_id,a.supplier_id,12,'TRANSIT',current_date) returning * into r;
m:=receive_incoming(r.id);if m.new_quantity<>1102 then raise exception 'Incoming receipt failed';end if;
denied:=false;begin perform receive_incoming(r.id);exception when others then denied:=true;end;if not denied then raise exception 'Duplicate receipt allowed';end if;
end$$;
reset role;
select 'PASS: PostgreSQL migrations, seed, RLS supplier isolation, atomic ledger, negative rejection, protected balances, immutable history, incoming receipt, duplicate prevention' as result;
