-- Fictional catalog. Apply after 001_schema.sql. Opening balances require an
-- active administrator and record_movement; do not mutate quantities directly.
insert into suppliers(name,contact_name,email,phone,notes) values
('Harvest Pack Solutions','Operations Team','harvest@example.test','555-0100','Fictional demo supplier'),
('Valley Film & Bag','Operations Team','valley@example.test','555-0101','Fictional demo supplier'),
('Orchard Label Co.','Operations Team','orchard@example.test','555-0102','Fictional demo supplier');
insert into items(name,sku,description,category_id,unit_id)
select n.name,'PKG-'||lpad(n.i::text,3,'0'),'Fresh produce packaging',c.id,u.id from
(values(1,'15lbs Beef Topline Box'),(2,'25 lbs Roma Box'),(3,'Heirloom Box'),(4,'Organic TOV Tray'),(5,'10 lb Pepper Carton'),(6,'1 lb Mini Sweet Peppers Bag'),(7,'12x1 Pint Red Grape Top Seal Film'),(8,'2 lb Tomato Bag'),(9,'Organic Cucumber Film'),(10,'Produce Stretch Wrap'),(11,'PTI Label'),(12,'Loblaw FM Label'),(13,'Organic Certification Label'),(14,'Harvest Traceability Label'),(15,'Pallet Shipping Label')) n(i,name)
join categories c on c.name=case when n.i<=5 then 'Boxes' when n.i<=10 then 'Bags & Film' else 'Labels' end
join units u on u.name=case when n.i between 6 and 10 then 'Rolls' else 'Pieces' end;
insert into supplier_items(item_id,supplier_id,minimum_stock)
select i.id,s.id,case when c.name='Labels' then 5000 else 4000 end from items i join categories c on c.id=i.category_id join suppliers s on s.name=case c.name when 'Boxes' then 'Harvest Pack Solutions' when 'Bags & Film' then 'Valley Film & Bag' else 'Orchard Label Co.' end;
