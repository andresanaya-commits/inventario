-- Run once, after creating and activating an administrator profile.
-- Keeps opening balances and deliveries fully audited through the same RPC.
do $$declare actor uuid; a supplier_items; i int:=0; q numeric;begin
select id into actor from profiles where role='ADMINISTRATOR' and active limit 1;
if actor is null then raise exception 'Create and activate an administrator profile first';end if;
perform set_config('request.jwt.claim.sub',actor::text,true);
for a in select s.* from supplier_items s join items i on i.id=s.item_id order by i.sku loop
if exists(select 1 from inventory_movements where supplier_item_id=a.id) then continue;end if;
i:=i+1;q:=(array[12000,3400,0,8200,1800,450,9500,2200,700,6500,25000,1200,11000,2300,800])[i];
-- Zero opening inventory needs no movement; a small first receipt preserves an audited entry.
perform record_movement(a.id,'INITIAL',greatest(q,1),'Opening balance','Fictional sample inventory',true);
if i%2=1 then perform record_movement(a.id,'RECEIPT',500,'PO-DEMO-'||i,'Sample delivery',true);end if;
if i%3=1 then insert into incoming_inventory(supplier_item_id,item_id,supplier_id,quantity,stage,expected_date,reference) values(a.id,a.item_id,a.supplier_id,1500,case when i%2=1 then 'TRANSIT' else 'PRODUCTION' end,current_date+14,'PO-IN-'||i);end if;
end loop;end$$;
