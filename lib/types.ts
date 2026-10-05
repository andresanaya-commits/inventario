export type Row = { id:string; [key:string]: string|number|boolean|null };
export type Profile={id:string;email:string;name:string;role:'ADMINISTRATOR'|'SUPPLIER';supplier_id:string|null;active:boolean};
export const tables=['suppliers','categories','units','items','supplier_items','incoming_inventory','inventory_movements','profiles','settings'] as const;
export type Table=typeof tables[number];
export function stock(r:Row, threshold=1.2){return Number(r.current_quantity)<=0?'Out of stock':Number(r.current_quantity)<Number(r.minimum_stock)?'Below minimum':Number(r.current_quantity)<=Number(r.minimum_stock)*threshold?'Approaching minimum':'Healthy'}
export function pending(r:Row){return Math.max(Number(r.minimum_stock)-Number(r.current_quantity)-Number(r.in_transit)-Number(r.in_production),0)}
