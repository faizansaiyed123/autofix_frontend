/* eslint-disable @typescript-eslint/no-explicit-any */
// The adapter mirrors heterogeneous response objects from the existing API contract.
import { ApiError } from "@/lib/api/client";

type Row = Record<string, any>;
type Store = Record<string, Row[]>;
type Role = "OWNER" | "SERVICE_ADVISOR" | "TECHNICIAN" | "PARTS_STAFF" | "CUSTOMER";

const STORE_KEY = "autofix.demo.store.v1";
const USERS: (Row & { password: string; roles: Role[] })[] = [
  { id:"demo-owner", email:"owner@autofix.demo", password:"demo1234", first_name:"John", last_name:"Smith", phone:"+1 555 010 1001", is_active:true, is_staff:true, email_verified:true, roles:["OWNER"] },
  { id:"demo-advisor", email:"manager@autofix.demo", password:"demo1234", first_name:"Sarah", last_name:"Johnson", phone:"+1 555 010 1002", is_active:true, is_staff:true, email_verified:true, roles:["SERVICE_ADVISOR"] },
  { id:"demo-tech", email:"tech@autofix.demo", password:"demo1234", first_name:"Mike", last_name:"Rodriguez", phone:"+1 555 010 1003", is_active:true, is_staff:true, email_verified:true, roles:["TECHNICIAN"] },
  { id:"demo-parts", email:"parts@autofix.demo", password:"demo1234", first_name:"Lisa", last_name:"Chen", phone:"+1 555 010 1004", is_active:true, is_staff:true, email_verified:true, roles:["PARTS_STAFF"] },
  { id:"demo-customer", email:"customer@autofix.demo", password:"demo1234", first_name:"David", last_name:"Wilson", phone:"+1 555 010 1005", is_active:true, is_staff:false, email_verified:true, roles:["CUSTOMER"] },
];
const OWNER = [
  "reports:read","reports:analytics","notifications:read","service_requests:read","service_requests:create","service_requests:update",
  "appointments:read","appointments:create","appointments:update","customers:read","customers:create","customers:update",
  "vehicles:read","vehicles:create","vehicles:update","check_ins:read","check_ins:create","check_ins:update",
  "inspections:read","inspections:create","inspections:update","estimates:read","estimates:create","estimates:update",
  "repair_orders:read","repair_orders:create","repair_orders:update","part_requests:read","part_requests:create","part_requests:update",
  "qc:read","qc:create","qc:update","labor:read","labor:create","labor:update","invoices:read","invoices:create",
  "payments:read","payments:create","parts:read","parts:create","parts:update","inventory:read","inventory:create",
  "suppliers:read","suppliers:create","suppliers:update","purchase_orders:read","purchase_orders:create","purchase_orders:update",
  "users:read","users:create","users:update","audit_logs:read"
];
const PERMISSIONS: Record<Role,string[]> = {
  OWNER: OWNER,
  SERVICE_ADVISOR: OWNER.filter((p)=>!["reports:analytics","inventory:read","users:create","users:update","audit_logs:read"].includes(p)),
  TECHNICIAN:["notifications:read","inspections:read","inspections:create","inspections:update","repair_orders:read","repair_orders:update","labor:read","labor:create","part_requests:read","part_requests:create","qc:read","qc:update","vehicles:read"],
  PARTS_STAFF:["notifications:read","part_requests:read","part_requests:update","parts:read","parts:create","parts:update","inventory:read","inventory:create","suppliers:read","suppliers:create","suppliers:update","purchase_orders:read","purchase_orders:create","purchase_orders:update"],
  CUSTOMER:[]
};
const iso = (days:number=0,hour:number=10) => { const d=new Date();d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString(); };
const day = (days:number=0) => iso(days).slice(0,10);
const now = () => new Date().toISOString();
const copy = <T,>(x:T):T => JSON.parse(JSON.stringify(x));
const id = (prefix:string) => prefix+"-"+Math.random().toString(36).slice(2,8);
const money = (n:number) => Math.round(n*100)/100;

function seed():Store {
  const customers = [
    {id:"customer-1",first_name:"David",last_name:"Wilson",company_name:null,email:"customer@autofix.demo",phone:"+1 555 010 1005",preferred_contact:"EMAIL",customer_status:"ACTIVE",notes:"Long-standing customer",user_id:"demo-customer",addresses:[]},
    {id:"customer-2",first_name:"Olivia",last_name:"Martinez",company_name:null,email:"olivia.martinez@example.test",phone:"+1 555 010 2002",preferred_contact:"PHONE",customer_status:"ACTIVE",notes:null,user_id:null,addresses:[]},
    {id:"customer-3",first_name:"Noah",last_name:"Patel",company_name:"Patel Design Studio",email:"noah@example.test",phone:"+1 555 010 2003",preferred_contact:"EMAIL",customer_status:"ACTIVE",notes:"Fleet customer",user_id:null,addresses:[]},
    {id:"customer-4",first_name:"Emma",last_name:"Thompson",company_name:null,email:"emma@example.test",phone:"+1 555 010 2004",preferred_contact:"SMS",customer_status:"ACTIVE",notes:null,user_id:null,addresses:[]}
  ];
  const vehicles = [
    {id:"vehicle-1",customer_id:"customer-1",vin:"1HGBH41JXMN109186",license_plate:"AUT-104",make:"Toyota",model:"Camry",year:2022,trim:"SE",engine:"2.5L I4",transmission:"Automatic",mileage:42850,color:"Silver",fuel_type:"Petrol",purchase_date:"2022-04-12",notes:null,status:"IN_SHOP",mileage_records:[]},
    {id:"vehicle-2",customer_id:"customer-2",vin:"1FTFW1E58NFA12345",license_plate:"AUT-205",make:"Ford",model:"F-150",year:2021,trim:"XLT",engine:"3.5L V6",transmission:"Automatic",mileage:61200,color:"Blue",fuel_type:"Petrol",purchase_date:"2021-02-17",notes:null,status:"ACTIVE",mileage_records:[]},
    {id:"vehicle-3",customer_id:"customer-3",vin:"WBA8E9G55GNU12345",license_plate:"AUT-306",make:"BMW",model:"330i",year:2020,trim:"Sport",engine:"2.0L Turbo",transmission:"Automatic",mileage:73410,color:"Black",fuel_type:"Petrol",purchase_date:"2020-06-20",notes:null,status:"ACTIVE",mileage_records:[]},
    {id:"vehicle-4",customer_id:"customer-4",vin:"1N4BL4BV0NC123456",license_plate:"AUT-407",make:"Nissan",model:"Altima",year:2023,trim:"SV",engine:"2.5L I4",transmission:"CVT",mileage:21800,color:"White",fuel_type:"Petrol",purchase_date:"2023-01-10",notes:null,status:"ACTIVE",mileage_records:[]}
  ];
  const serviceRequests = [
    {id:"request-1",customer_id:"customer-1",vehicle_id:"vehicle-1",title:"Brake vibration at highway speed",description:"Steering wheel vibrates under braking. Inspect the front rotors.",priority:"HIGH",status:"IN_REVIEW",service_advisor_notes:"Inspect front brakes",created_at:iso(-1),updated_at:iso(-1)},
    {id:"request-2",customer_id:"customer-2",vehicle_id:"vehicle-2",title:"Oil service and tire rotation",description:"Routine 60,000 mile service.",priority:"NORMAL",status:"APPROVED",service_advisor_notes:null,created_at:iso(-3),updated_at:iso(-2)},
    {id:"request-3",customer_id:"customer-4",vehicle_id:"vehicle-4",title:"Air conditioning not cooling",description:"Cabin takes a long time to cool down.",priority:"NORMAL",status:"NEW",service_advisor_notes:null,created_at:iso(-2),updated_at:iso(-2)}
  ];
  const appointments = [
    {id:"appointment-1",customer_id:"customer-1",vehicle_id:"vehicle-1",service_request_id:"request-1",service_type:"Brake inspection",scheduled_start:iso(0,9),scheduled_end:iso(0,11),duration_minutes:120,advisor_id:"demo-advisor",technician_id:"demo-tech",bay:"Bay 2",customer_concern:"Brake vibration",notes:"Road test after inspection",status:"CONFIRMED",cancellation_reason:null,checkin_id:"checkin-1",created_at:iso(-2),updated_at:iso(-1)},
    {id:"appointment-2",customer_id:"customer-2",vehicle_id:"vehicle-2",service_request_id:"request-2",service_type:"Scheduled maintenance",scheduled_start:iso(1,10),scheduled_end:iso(1,12),duration_minutes:120,advisor_id:"demo-advisor",technician_id:"demo-tech",bay:"Bay 1",customer_concern:"60k service",notes:null,status:"CONFIRMED",cancellation_reason:null,checkin_id:null,created_at:iso(-2),updated_at:iso(-2)},
    {id:"appointment-3",customer_id:"customer-3",vehicle_id:"vehicle-3",service_request_id:null,service_type:"Engine diagnostic",scheduled_start:iso(-1,13),scheduled_end:iso(-1,15),duration_minutes:120,advisor_id:"demo-advisor",technician_id:"demo-tech",bay:"Bay 3",customer_concern:"Check engine light",notes:null,status:"COMPLETED",cancellation_reason:null,checkin_id:null,created_at:iso(-5),updated_at:iso(-1)}
  ];
  const checkIns = [
    {id:"checkin-1",vehicle_id:"vehicle-1",customer_id:"customer-1",odometer:42850,checkin_type:"APPOINTMENT",status:"IN_PROGRESS",notes:"Customer reports vibration while braking",expected_completion:iso(0,17),tire_condition:"GOOD",fluid_levels:"GOOD",lights_status:"GOOD",service_advisor_id:"demo-advisor",created_at:iso(0,9),updated_at:iso(0,9)},
    {id:"checkin-2",vehicle_id:"vehicle-2",customer_id:"customer-2",odometer:61200,checkin_type:"APPOINTMENT",status:"COMPLETED",notes:null,expected_completion:iso(1,15),tire_condition:"FAIR",fluid_levels:"GOOD",lights_status:"GOOD",service_advisor_id:"demo-advisor",created_at:iso(-1,10),updated_at:iso(-1,10)}
  ];
  const inspections = [
    {id:"inspection-1",vehicle_id:"vehicle-1",customer_id:"customer-1",checkin_id:"checkin-1",technician_id:"demo-tech",mileage:42850,overall_notes:"Front brake components require attention.",status:"IN_PROGRESS",overall_condition:"FAIR",items:[{id:"insp-item-1",category:"Brakes",item_name:"Front brake pads",status:"NEEDS_ATTENTION",severity_color:"AMBER",measurement:"3 mm",notes:"Wear approaching limit",recommendation:"Replace front brake pads",photo_url:null,photo_caption:null,photos:[]},{id:"insp-item-2",category:"Tires",item_name:"Front tires",status:"GOOD",severity_color:"GREEN",measurement:"6 mm",notes:null,recommendation:null,photo_url:null,photo_caption:null,photos:[]}],created_at:iso(0,9),updated_at:iso(0,9)},
    {id:"inspection-2",vehicle_id:"vehicle-2",customer_id:"customer-2",checkin_id:"checkin-2",technician_id:"demo-tech",mileage:61200,overall_notes:"Routine service inspection complete.",status:"COMPLETED",overall_condition:"GOOD",items:[{id:"insp-item-3",category:"Engine",item_name:"Engine oil",status:"GOOD",severity_color:"GREEN",measurement:"Level OK",notes:null,recommendation:null,photo_url:null,photo_caption:null,photos:[]}],created_at:iso(-1),updated_at:iso(-1)}
  ];
  const estimates = [
    {id:"estimate-1",estimate_number:"EST-2026-0042",customer_id:"customer-1",vehicle_id:"vehicle-1",inspection_id:"inspection-1",service_request_id:"request-1",created_by_id:"demo-advisor",status:"SENT",subtotal:485,discount_amount:0,tax_rate:0.08,tax_amount:38.8,total:523.8,approved_total:0,valid_until:day(14),is_expired:false,notes:"Brake system service",customer_notes:"Please approve the recommended repairs.",decline_reason:null,sent_at:iso(-1),decided_at:null,items:[{id:"est-line-1",item_type:"LABOR",description:"Front brake service",labor_hours:1.5,labor_rate:110,part_number:null,part_name:null,quantity:1,unit_price:165,discount_amount:0,is_optional:false,notes:null,status:"PENDING",line_total:165,customer_notes:null,created_at:iso(-1),updated_at:iso(-1)},{id:"est-line-2",item_type:"PART",description:"Ceramic brake pad set",labor_hours:null,labor_rate:null,part_number:"BRK-204",part_name:"Ceramic brake pads",quantity:1,unit_price:320,discount_amount:0,is_optional:false,notes:null,status:"PENDING",line_total:320,customer_notes:null,created_at:iso(-1),updated_at:iso(-1)}],created_at:iso(-1),updated_at:iso(-1)},
    {id:"estimate-2",estimate_number:"EST-2026-0038",customer_id:"customer-2",vehicle_id:"vehicle-2",inspection_id:null,service_request_id:"request-2",created_by_id:"demo-advisor",status:"APPROVED",subtotal:690,discount_amount:0,tax_rate:0.08,tax_amount:55.2,total:745.2,approved_total:745.2,valid_until:day(8),is_expired:false,notes:null,customer_notes:null,decline_reason:null,sent_at:iso(-4),decided_at:iso(-3),items:[{id:"est-line-3",item_type:"LABOR",description:"60,000 mile maintenance",labor_hours:2,labor_rate:120,part_number:null,part_name:null,quantity:1,unit_price:240,discount_amount:0,is_optional:false,notes:null,status:"APPROVED",line_total:240,customer_notes:null,created_at:iso(-4),updated_at:iso(-3)}],created_at:iso(-4),updated_at:iso(-3)}
  ];
  const repairOrders = [
    {id:"repair-1",ro_number:"RO-2026-0192",customer_id:"customer-1",vehicle_id:"vehicle-1",estimate_id:"estimate-1",appointment_id:"appointment-1",advisor_id:"demo-advisor",technician_id:"demo-tech",status:"IN_PROGRESS",odometer_in:42850,odometer_out:null,bay:"Bay 2",promised_at:iso(0,17),notes:"Verify brake vibration after repair",customer_notes:null,cancel_reason:null,started_at:iso(0,9),completed_at:null,delivered_at:null,all_tasks_done:false,tasks:[{id:"task-1",repair_order_id:"repair-1",description:"Inspect front brake rotors",notes:null,status:"IN_PROGRESS",sequence:1,assigned_to_id:"demo-tech",completed_at:null},{id:"task-2",repair_order_id:"repair-1",description:"Replace front brake pads",notes:null,status:"PENDING",sequence:2,assigned_to_id:"demo-tech",completed_at:null}],created_at:iso(0),updated_at:iso(0)},
    {id:"repair-2",ro_number:"RO-2026-0188",customer_id:"customer-2",vehicle_id:"vehicle-2",estimate_id:"estimate-2",appointment_id:"appointment-2",advisor_id:"demo-advisor",technician_id:"demo-tech",status:"AWAITING_QC",odometer_in:61200,odometer_out:61205,bay:"Bay 1",promised_at:iso(1,16),notes:null,customer_notes:null,cancel_reason:null,started_at:iso(-1),completed_at:null,delivered_at:null,all_tasks_done:true,tasks:[{id:"task-3",repair_order_id:"repair-2",description:"Complete scheduled maintenance",notes:null,status:"COMPLETED",sequence:1,assigned_to_id:"demo-tech",completed_at:iso(0)}],created_at:iso(-1),updated_at:iso(0)}
  ];
  const parts = [
    {id:"part-1",part_number:"BRK-204",name:"Ceramic brake pad set",description:"Front axle ceramic brake pads",category:"Brakes",brand:"RoadPro",unit_cost:128,unit_price:320,quantity_on_hand:4,reorder_level:6,location:"A-01",status:"ACTIVE"},
    {id:"part-2",part_number:"OIL-510",name:"Synthetic oil service kit",description:"5W-30 oil and filter kit",category:"Fluids",brand:"MotorWorks",unit_cost:110,unit_price:225,quantity_on_hand:18,reorder_level:8,location:"B-03",status:"ACTIVE"},
    {id:"part-3",part_number:"FLT-110",name:"Engine air filter",description:"OEM-fit engine air filter",category:"Filters",brand:"AirFlow",unit_cost:18,unit_price:42,quantity_on_hand:2,reorder_level:5,location:"B-01",status:"ACTIVE"},
    {id:"part-4",part_number:"BRK-390",name:"Brake rotor",description:"Vented front brake rotor",category:"Brakes",brand:"RoadPro",unit_cost:92,unit_price:185,quantity_on_hand:0,reorder_level:4,location:"A-02",status:"ACTIVE"},
    {id:"part-5",part_number:"BAT-021",name:"AGM battery",description:"12V AGM battery",category:"Electrical",brand:"VoltMax",unit_cost:142,unit_price:265,quantity_on_hand:7,reorder_level:4,location:"C-02",status:"ACTIVE"}
  ];
  const suppliers = [
    {id:"supplier-1",name:"Metro Auto Supply",contact_name:"Alex Rivera",email:"orders@metroauto.example.test",phone:"+1 555 020 1001",address_line1:"18 Industrial Way",address_line2:null,address:"18 Industrial Way, Austin, TX",city:"Austin",state:"TX",postal_code:"78701",country:"USA",account_number:"MAS-204",website:null,lead_time_days:2,payment_terms:"NET 30",notes:null,status:"ACTIVE",is_preferred:true,is_active:true},
    {id:"supplier-2",name:"Northside Parts Co.",contact_name:"Morgan Lee",email:"sales@northside.example.test",phone:"+1 555 020 1002",address_line1:"230 Commerce St",address_line2:null,address:"230 Commerce St, Austin, TX",city:"Austin",state:"TX",postal_code:"78702",country:"USA",account_number:null,website:null,lead_time_days:4,payment_terms:"NET 15",notes:null,status:"ACTIVE",is_preferred:false,is_active:true}
  ];
  const partRequests = [
    {id:"part-request-1",repair_order_id:"repair-1",part_id:"part-1",requested_by_id:"demo-tech",approved_by_id:null,fulfilled_by_id:null,quantity:1,status:"PENDING",reason:"Required for approved brake repair",decision_reason:null,created_at:iso(0),updated_at:iso(0)},
    {id:"part-request-2",repair_order_id:"repair-2",part_id:"part-2",requested_by_id:"demo-tech",approved_by_id:"demo-parts",fulfilled_by_id:"demo-parts",quantity:1,status:"FULFILLED",reason:null,decision_reason:null,created_at:iso(-2),updated_at:iso(-1)}
  ];
  const qualityChecks = [
    {id:"qc-1",repair_order_id:"repair-2",inspector_id:"demo-advisor",status:"IN_PROGRESS",attempt_number:1,started_at:iso(0),completed_at:null,notes:"Final road test and brake check",failure_reason:null,is_terminal:false,passed:false,checks:[{id:"qc-check-1",check_type:"ROAD_TEST",label:"Road test",passed:false,blocking:true,notes:null,manually_overridden:false}],photos:[]}
  ];
  const invoices = [
    {id:"invoice-1",invoice_number:"INV-2026-0114",customer_id:"customer-1",vehicle_id:"vehicle-1",repair_order_id:"repair-1",estimate_id:"estimate-1",created_by_id:"demo-advisor",status:"PARTIALLY_PAID",invoice_date:day(-6),due_date:day(8),subtotal:690,discount_amount:0,tax_rate:0.08,tax_amount:55.2,total:745.2,amount_paid:300,balance:445.2,is_overdue:false,days_overdue:0,void_reason:null,issued_at:iso(-6),paid_at:null,voided_at:null,notes:null,customer_notes:"Thank you for choosing AutoFix.",items:[]},
    {id:"invoice-2",invoice_number:"INV-2026-0108",customer_id:"customer-2",vehicle_id:"vehicle-2",repair_order_id:"repair-2",estimate_id:null,created_by_id:"demo-advisor",status:"ISSUED",invoice_date:day(-20),due_date:day(-2),subtotal:480,discount_amount:0,tax_rate:0.08,tax_amount:38.4,total:518.4,amount_paid:0,balance:518.4,is_overdue:true,days_overdue:2,void_reason:null,issued_at:iso(-20),paid_at:null,voided_at:null,notes:null,customer_notes:null,items:[]},
    {id:"invoice-3",invoice_number:"INV-2026-0099",customer_id:"customer-3",vehicle_id:"vehicle-3",repair_order_id:"repair-2",estimate_id:null,created_by_id:"demo-advisor",status:"PAID",invoice_date:day(-30),due_date:day(-15),subtotal:250,discount_amount:0,tax_rate:0.08,tax_amount:20,total:270,amount_paid:270,balance:0,is_overdue:false,days_overdue:0,void_reason:null,issued_at:iso(-30),paid_at:iso(-29),voided_at:null,notes:null,customer_notes:null,items:[]}
  ];
  const payments = [
    {id:"payment-1",invoice_id:"invoice-1",amount:300,method:"CARD",status:"COMPLETED",payment_date:iso(-2),reference:"CARD-2048",notes:null,recorded_by_id:"demo-advisor",void_reason:null,voided_at:null},
    {id:"payment-2",invoice_id:"invoice-3",amount:270,method:"CARD",status:"COMPLETED",payment_date:iso(-29),reference:"CARD-1993",notes:null,recorded_by_id:"demo-advisor",void_reason:null,voided_at:null}
  ];
  const inventoryTransactions = [
    {id:"txn-1",part_id:"part-1",transaction_type:"RECEIPT",quantity:12,quantity_before:0,quantity_after:12,unit_cost:128,reference:"OPENING-STOCK",notes:"Opening stock",created_at:iso(-12)},
    {id:"txn-2",part_id:"part-1",transaction_type:"ISSUE",quantity:8,quantity_before:12,quantity_after:4,unit_cost:128,reference:"RO-2026-0192",notes:"Brake repair",created_at:iso(-2)}
  ];
  const purchaseOrders = [
    {id:"po-1",po_number:"PO-2026-0034",supplier_id:"supplier-1",supplier_name:"Metro Auto Supply",status:"SENT",order_date:day(-1),expected_delivery_date:day(2),subtotal:460,tax_amount:36.8,shipping_amount:0,total_amount:496.8,currency:"USD",notes:"Replenish service stock",internal_notes:null,sent_at:iso(-1),received_at:null,cancelled_at:null,cancel_reason:null,item_count:2,total_units_ordered:5,total_units_received:0,is_fully_received:false,is_terminal:false,is_editable:false,is_overdue:false,items:[{id:"po-item-1",part_id:"part-3",part_number:"FLT-110",part_name:"Engine air filter",quantity_ordered:3,quantity_received:0,unit_cost:18,line_total:54},{id:"po-item-2",part_id:"part-4",part_number:"BRK-390",part_name:"Brake rotor",quantity_ordered:2,quantity_received:0,unit_cost:92,line_total:184}]}
  ];
  const labor = [
    {id:"labor-1",repair_order_id:"repair-1",repair_task_id:"task-1",technician_id:"demo-tech",description:"Brake system diagnosis",actual_hours:0.8,billable_hours:0.8,hourly_rate:110,labor_cost:88,performed_at:iso(0),notes:"Confirmed front brake vibration"}
  ];
  const notifications = [
    {id:"notification-1",user_id:"demo-owner",title:"Estimate awaiting customer decision",message:"EST-2026-0042 is waiting for approval.",notification_type:"ESTIMATE",priority:"HIGH",is_read:false,created_at:iso(-1),entity_type:"estimate",entity_id:"estimate-1"},
    {id:"notification-2",user_id:"demo-advisor",title:"Customer service request received",message:"A new air-conditioning request needs review.",notification_type:"SERVICE_REQUEST",priority:"NORMAL",is_read:false,created_at:iso(-2),entity_type:"service_request",entity_id:"request-3"},
    {id:"notification-3",user_id:"demo-tech",title:"Repair task assigned",message:"Inspect front brake rotors on RO-2026-0192.",notification_type:"REPAIR_ORDER",priority:"NORMAL",is_read:false,created_at:iso(0),entity_type:"repair_order",entity_id:"repair-1"}
  ];
  const auditLogs = [{id:"audit-1",action:"STATUS_CHANGED",entity_type:"repair_order",entity_id:"repair-1",entity_label:"RO-2026-0192",actor_id:"demo-advisor",actor_email:"manager@autofix.demo",actor_role:"SERVICE_ADVISOR",actor_label:"Sarah Johnson",summary:"Repair order moved to In progress",changes:null,created_at:iso(0)}];
  return {customers,vehicles,serviceRequests,appointments,checkIns,inspections,estimates,repairOrders,parts,suppliers,partRequests,qualityChecks,invoices,payments,inventoryTransactions,purchaseOrders,labor,notifications,auditLogs,users:USERS.map(safeUser)};
}

let cached:Store|null=null;
function store():Store {
  if(cached)return cached;
  if(typeof window!=="undefined"){
    const raw=window.localStorage.getItem(STORE_KEY);
    if(raw){try{cached=JSON.parse(raw) as Store;return cached;}catch{window.localStorage.removeItem(STORE_KEY);}}
  }
  cached=seed();return cached;
}
function persist(){if(typeof window!=="undefined")window.localStorage.setItem(STORE_KEY,JSON.stringify(store()));}
export function resetDemoData(){
  cached=seed();
  if(typeof window!=="undefined"){
    window.localStorage.setItem(STORE_KEY,JSON.stringify(cached));
    window.localStorage.removeItem("autofix.access_token");
    window.localStorage.removeItem("autofix.refresh_token");
  }
}
function identity():Row|null{
  if(typeof window==="undefined")return null;
  const token=window.localStorage.getItem("autofix.access_token")??"";
  if(!token.startsWith("demo-access:"))return null;
  const email=decodeURIComponent(token.slice(12));
  return USERS.find(u=>u.email===email)??null;
}
function mustAuth():Row{const u=identity();if(!u)throw new ApiError(401,"Not authenticated");return u;}
function safeUser(u:Row){const safe=copy(u);delete safe.password;return safe;}
function fail(message:string,status=404):never{throw new ApiError(status,message,message);}
function one(s:Store,k:string,key:string){return s[k]?.find(x=>x.id===key)??null;}
function statusView(status:string){
  const labels:Record<string,string>={NEW:"Received",IN_REVIEW:"Under review",APPROVED:"Approved",REJECTED:"Declined",CONFIRMED:"Confirmed",IN_PROGRESS:"In progress",COMPLETED:"Completed",SENT:"Waiting for you",PAID:"Paid",PARTIALLY_PAID:"Part paid",ISSUED:"Payment due",READY_FOR_PICKUP:"Ready for pickup"};
  return {label:labels[status]??status.replaceAll("_"," ").toLowerCase(),detail:null,tone:"neutral"};
}
function paged(items:Row[],q:Record<string,any>){
  let result=[...items];const search=String(q.q??q.search??"").toLowerCase();
  if(search)result=result.filter(x=>JSON.stringify(x).toLowerCase().includes(search));
  for(const [key,value] of Object.entries(q)){
    if(["q","search","page","size","limit","sort","order"].includes(key)||value==null||value==="")continue;
    if(result.some(x=>key in x))result=result.filter(x=>String(x[key])===String(value));
  }
  const page=Math.max(1,Number(q.page??1));const size=Math.max(1,Math.min(100,Number(q.size??q.limit??20)));
  return {data:copy(result.slice((page-1)*size,page*size)),meta:{page,size,total:result.length,pages:Math.max(1,Math.ceil(result.length/size))}};
}
function customerFor(s:Store,u:Row){return s.customers.find(c=>c.user_id===u.id||c.email===u.email)??null;}
function audit(s:Store,u:Row,action:string,entity:string,item:Row){
  s.auditLogs.unshift({id:id("audit"),action,entity_type:entity,entity_id:item.id,entity_label:item.estimate_number??item.ro_number??item.invoice_number??item.name??item.title??item.id,actor_id:u.id,actor_email:u.email,actor_role:u.roles[0],actor_label:u.first_name+" "+u.last_name,summary:action.replaceAll("_"," ").toLowerCase(),changes:null,created_at:now()});
}
function createRecord(s:Store,key:string,prefix:string,body:Row):Row{
  const item={...body,id:id(prefix),created_at:now(),updated_at:now()};s[key].unshift(item);persist();return copy(item);
}

export type DemoRequestOptions={method?:string;body?:unknown;query?:Record<string,any>;anonymous?:boolean};
export async function demoRequest<T>(path:string,options:DemoRequestOptions={}):Promise<T>{
  const method=(options.method??"GET").toUpperCase();
  const body=(options.body&&typeof options.body==="object"?copy(options.body):{}) as Row;
  const query=options.query??{};
  const s=store();
  const u=path.startsWith("/auth/")?identity():mustAuth();

  if(path==="/auth/login"&&method==="POST"){
    const found=USERS.find(x=>x.email.toLowerCase()===String(body.email??"").toLowerCase()&&x.password===body.password);
    if(!found)fail("Invalid email or password",401);
    return {access_token:"demo-access:"+encodeURIComponent(found.email),refresh_token:"demo-refresh:"+encodeURIComponent(found.email),token_type:"bearer",expires_in:1800} as T;
  }
  if(path==="/auth/refresh"&&method==="POST"){
    const token=String(body.refresh_token??"");const email=decodeURIComponent(token.slice("demo-refresh:".length));const found=USERS.find(x=>x.email===email);
    if(!found)fail("Invalid refresh token",401);
    return {access_token:"demo-access:"+encodeURIComponent(email),refresh_token:"demo-refresh:"+encodeURIComponent(email),token_type:"bearer",expires_in:1800} as T;
  }
  if(path==="/auth/logout"&&method==="POST")return {message:"Signed out"} as T;
  if(path==="/auth/me"){if(!u)fail("Not authenticated",401);return safeUser(u) as T;}
  if(path==="/auth/permissions"){if(!u)fail("Not authenticated",401);return {roles:u.roles,permissions:PERMISSIONS[u.roles[0] as Role]??[]} as T;}
  if(path.startsWith("/auth/"))return {message:"This account workflow is simulated in the browser demo. Email delivery is disabled."} as T;
  if(!u)fail("Not authenticated",401);

  if(path==="/reports/dashboard")return {period:{start_date:day(-29),end_date:day(),days:30},generated_for:u.email,revenue:{invoiced_total:1533.6,collected_total:570,outstanding_balance:963.6,overdue_balance:518.4,overdue_count:1},work:{repair_orders_open:2,repair_orders_in_progress:1,repair_orders_on_hold:0,repair_orders_awaiting_qc:1,completed_in_period:1,part_requests_pending:1},money:{invoices_draft:0,invoices_issued:1,invoices_partially_paid:1,invoices_paid:1},operations:{low_stock_count:2,out_of_stock_count:1,inventory_cost_value:1984,appointments_today:1,vehicles_in_shop:1,unread_notifications:s.notifications.filter(n=>n.user_id===u.id&&!n.is_read).length}} as T;
  if(path==="/reports/revenue")return {period:{start_date:day(-29),end_date:day(),days:30},invoiced_total:1533.6,invoice_count:3,average_invoice:511.2,collected_total:570,payment_count:2,voided_total:0,void_count:0,outstanding_balance:963.6,outstanding_count:2,overdue_balance:518.4,overdue_count:1,invoiced_by_status:{ISSUED:518.4,PARTIALLY_PAID:445.2,PAID:270},series:[-35,-28,-21,-14,-7,0].map((n,i)=>({period_start:day(n),invoiced:180+i*45,collected:120+i*35}))} as T;
  if(path==="/reports/repair-orders")return {period:{start_date:day(-29),end_date:day(),days:30},status_counts:{IN_PROGRESS:1,AWAITING_QC:1},total_orders:2,opened:2,completed:1,delivered:0,cancelled:0,completion_rate:50,average_cycle_hours:5.4,series:[]} as T;
  if(path==="/reports/technicians")return {period:{start_date:day(-29),end_date:day(),days:30},technicians:[],totals:{actual_hours:0.8,billable_hours:0.8,labor_revenue:88}} as T;
  if(path==="/reports/inventory-value")return {as_of:now(),cost_value:1984,retail_value:4200,potential_margin:2216,part_count:s.parts.length,units_on_hand:s.parts.reduce((a,p)=>a+p.quantity_on_hand,0),low_stock_count:2,out_of_stock_count:1,by_category:[],low_stock_items:s.parts.filter(p=>p.quantity_on_hand<=p.reorder_level).map(p=>({part_id:p.id,part_number:p.part_number,name:p.name,quantity_on_hand:p.quantity_on_hand,reorder_level:p.reorder_level,stock_status:p.quantity_on_hand===0?"OUT_OF_STOCK":"LOW_STOCK",cost_value:p.quantity_on_hand*p.unit_cost})),top_movers:[]} as T;
  if(path==="/reports/customer-retention")return {period:{start_date:day(-29),end_date:day(),days:30},customers_billed:4,new_customers:1,returning_customers:3,repeat_rate:75,settled_revenue:570,revenue_per_customer:142.5,top_customers:[]} as T;

  const ownNotifications=s.notifications.filter(n=>n.user_id===u.id);
  if(path==="/notifications/unread-count")return {unread_count:ownNotifications.filter(n=>!n.is_read).length} as T;
  if(path==="/notifications/summary")return {unread_count:ownNotifications.filter(n=>!n.is_read).length,high_priority_unread:ownNotifications.filter(n=>!n.is_read&&n.priority==="HIGH").length,latest_unread_at:ownNotifications.find(n=>!n.is_read)?.created_at??null} as T;
  if(path==="/notifications/"||path==="/notifications")return {notifications:copy(ownNotifications),total:ownNotifications.length,unread_count:ownNotifications.filter(n=>!n.is_read).length} as T;
  if(path==="/notifications/mark-all-read"&&method==="POST"){ownNotifications.forEach(n=>n.is_read=true);persist();return {message:"All notifications marked read"} as T;}
  const notification=path.match(/^\/notifications\/([^/]+)\/(read|unread)$/);
  if(notification&&method==="POST"){const item=one(s,"notifications",notification[1]);if(!item)fail("Notification not found");if(item.user_id!==u.id)fail("Not found");item.is_read=notification[2]==="read";persist();return copy(item) as T;}

  if(path==="/customers/search")return copy(s.customers.filter(c=>(c.first_name+" "+c.last_name+" "+(c.email??"")).toLowerCase().includes(String(query.q??"").toLowerCase())).slice(0,Number(query.limit??20))) as T;
  if(path==="/vehicles/search")return copy(s.vehicles.filter(v=>(v.make+" "+v.model+" "+v.license_plate).toLowerCase().includes(String(query.q??"").toLowerCase())).slice(0,Number(query.limit??20))) as T;
  if(path==="/appointments/calendar"){
    const days=[...new Set(s.appointments.map(a=>a.scheduled_start.slice(0,10)))].sort().map(date=>({date,appointments:copy(s.appointments.filter(a=>a.scheduled_start.startsWith(date)))}));
    return {view:query.view??"week",range_start:days[0]?.date??day(),range_end:days.at(-1)?.date??day(),total:s.appointments.length,days} as T;
  }
  if(path==="/appointments/check-conflicts"&&method==="POST")return {has_conflict:false,conflicts:[]} as T;
  if(path==="/parts/categories")return [...new Set(s.parts.map(p=>p.category))] as T;
  if(path==="/parts/low-stock"||path==="/inventory/low-stock")return copy(s.parts.filter(p=>p.quantity_on_hand<=p.reorder_level).map(p=>({part_id:p.id,part_number:p.part_number,name:p.name,category:p.category,brand:p.brand,location:p.location,quantity_on_hand:p.quantity_on_hand,reorder_level:p.reorder_level,shortage:Math.max(0,p.reorder_level-p.quantity_on_hand),stock_status:p.quantity_on_hand===0?"OUT_OF_STOCK":"LOW_STOCK"}))) as T;
  if(path==="/inventory/stock-summary")return {total_parts:s.parts.length,total_units:s.parts.reduce((a,p)=>a+p.quantity_on_hand,0),total_stock_value:s.parts.reduce((a,p)=>a+p.quantity_on_hand*p.unit_cost,0),low_stock_count:2,out_of_stock_count:1} as T;
  if(path==="/inventory/stock-levels")return copy(s.parts.map(p=>({part_id:p.id,part_number:p.part_number,name:p.name,category:p.category,location:p.location,quantity_on_hand:p.quantity_on_hand,reorder_level:p.reorder_level,unit_cost:p.unit_cost,stock_value:p.quantity_on_hand*p.unit_cost,stock_status:p.quantity_on_hand===0?"OUT_OF_STOCK":p.quantity_on_hand<=p.reorder_level?"LOW_STOCK":"IN_STOCK",is_low_stock:p.quantity_on_hand<=p.reorder_level}))) as T;
  if(path==="/purchase_orders/summary")return {total_orders:s.purchaseOrders.length,draft_orders:0,sent_orders:s.purchaseOrders.length,overdue_orders:0,total_order_value:s.purchaseOrders.reduce((a,p)=>a+p.total_amount,0)} as T;
  if(path==="/suppliers/active")return copy(s.suppliers.filter(x=>x.is_active&&(!query.preferred_only||x.is_preferred))) as T;
  if(path==="/qc/queue")return copy(s.qualityChecks.map(q=>({...q,repair_order:s.repairOrders.find(r=>r.id===q.repair_order_id)??null}))) as T;
  if(path==="/labor/dashboard")return {technician_id:query.technician_id,open_tasks:[],labor_today:[],hours_today:0,hours_this_week:0} as T;
  if(path==="/audit/actions")return {actions:["CREATED","UPDATED","STATUS_CHANGED","PAYMENT_RECORDED"]} as T;
  if(path==="/audit/entity-types")return {entity_types:["customer","vehicle","appointment","estimate","repair_order","invoice","payment"]} as T;

  const portal=path.match(/^\/portal(?:\/(.*))?$/);
  if(portal){
    const customer=customerFor(s,u);if(!customer)fail("No customer account is linked to this user");
    const sub=portal[1]??"";
    const vehicles=s.vehicles.filter(v=>v.customer_id===customer.id);
    const appointments=s.appointments.filter(a=>a.customer_id===customer.id);
    const requests=s.serviceRequests.filter(a=>a.customer_id===customer.id);
    const estimates=s.estimates.filter(a=>a.customer_id===customer.id);
    const invoices=s.invoices.filter(a=>a.customer_id===customer.id);
    if(sub===""&&method==="GET"){
      const balance=invoices.reduce((a,i)=>a+i.balance,0);
      return {customer_id:customer.id,full_name:customer.first_name+" "+customer.last_name,email:customer.email,phone:customer.phone,vehicle_count:vehicles.length,open_balance:money(balance),overdue_balance:money(invoices.filter(i=>i.is_overdue).reduce((a,i)=>a+i.balance,0)),awaiting_approval:estimates.reduce((a,e)=>a+e.items.filter((x:Row)=>x.status==="PENDING").length,0),awaiting_payment:invoices.filter(i=>i.balance>0).length,ready_for_pickup:0,next_appointment:appointments[0]?{...copy(appointments[0]),vehicle_label:(vehicles[0]?.year??"")+" "+(vehicles[0]?.make??"")+" "+(vehicles[0]?.model??""),status_view:statusView(appointments[0].status)}:null} as T;
    }
    if(sub==="vehicles"&&method==="GET")return copy(vehicles.map(v=>({id:v.id,make:v.make,model:v.model,year:v.year,color:v.color,license_plate:v.license_plate,vin:v.vin,mileage:v.mileage,status:v.status,status_view:statusView(v.status)}))) as T;
    if(sub.startsWith("vehicles/")&&method==="GET"){const v=vehicles.find(x=>x.id===sub.split("/")[1]);if(!v)fail("Vehicle not found");return {vehicle:copy(v),service_history:[],appointments:copy(appointments)} as T;}
    if(sub==="appointments"&&method==="GET")return copy(appointments.map(a=>({...a,vehicle_label:vehicles.find(v=>v.id===a.vehicle_id)?.make+" "+vehicles.find(v=>v.id===a.vehicle_id)?.model,status_view:statusView(a.status)}))) as T;
    if(sub==="appointments"&&method==="POST"){const a=createRecord(s,"appointments","appointment",{customer_id:customer.id,vehicle_id:body.vehicle_id,service_request_id:null,service_type:body.service_type??"General service",scheduled_start:body.scheduled_start,scheduled_end:body.scheduled_start,duration_minutes:body.duration_minutes??60,advisor_id:null,technician_id:null,bay:null,customer_concern:body.customer_concern??null,notes:null,status:"REQUESTED",cancellation_reason:null,checkin_id:null});return {...a,vehicle_label:"Vehicle",status_view:statusView(a.status)} as T;}
    if(sub==="service-requests"&&method==="GET")return copy(requests.map(r=>({...r,status_view:statusView(r.status)}))) as T;
    if(sub==="service-requests"&&method==="POST"){const r=createRecord(s,"serviceRequests","request",{customer_id:customer.id,vehicle_id:body.vehicle_id??null,title:body.title,description:body.description??null,priority:body.priority??"NORMAL",status:"NEW",service_advisor_notes:null});return {...r,status_view:statusView(r.status)} as T;}
    if(sub==="estimates"&&method==="GET")return copy(estimates.map(e=>({...e,status_view:statusView(e.status)}))) as T;
    const decision=sub.match(/^estimates\/([^/]+)\/items\/([^/]+)\/decision$/);
    if(decision&&method==="POST"){const e=estimates.find((x:Row)=>x.id===decision[1]);const line=e?.items.find((x:Row)=>x.id===decision[2]);if(!e||!line)fail("Estimate line not found");line.status=body.decision;line.customer_notes=body.notes??null;e.approved_total=money(e.items.filter((x:Row)=>x.status==="APPROVED").reduce((a:number,x:Row)=>a+x.line_total,0));e.status=e.items.every((x:Row)=>x.status!=="PENDING")?"APPROVED":"PARTIALLY_APPROVED";persist();return {estimate:copy(e),approved_total:e.approved_total,remaining_to_decide:e.items.filter((x:Row)=>x.status==="PENDING").length} as T;}
    if(sub==="invoices"&&method==="GET")return copy(invoices.map(i=>({...i,status_view:statusView(i.status)}))) as T;
    const pay=sub.match(/^invoices\/([^/]+)\/payments$/);
    if(pay&&method==="POST"){const i=invoices.find(x=>x.id===pay[1]);if(!i||body.amount<=0||body.amount>i.balance)fail("Payment is outside the invoice balance",422);const p=createRecord(s,"payments","payment",{invoice_id:i.id,amount:body.amount,method:body.method??"CARD",status:"COMPLETED",payment_date:now(),reference:body.reference??"DEMO-PAYMENT",notes:body.notes??null,recorded_by_id:u.id,void_reason:null,voided_at:null});i.amount_paid=money(i.amount_paid+p.amount);i.balance=money(i.total-i.amount_paid);i.status=i.balance===0?"PAID":"PARTIALLY_PAID";persist();return {payment:p,invoice_status:i.status,invoice_status_view:statusView(i.status),invoice_balance:i.balance} as T;}
    if(sub==="payments"&&method==="GET")return copy(s.payments.filter(p=>invoices.some(i=>i.id===p.invoice_id))) as T;
    const inv=sub.match(/^invoices\/([^/]+)$/);if(inv&&method==="GET"){const i=invoices.find(x=>x.id===inv[1]);if(!i)fail("Invoice not found");return {...copy(i),status_view:statusView(i.status)} as T;}
    const est=sub.match(/^estimates\/([^/]+)$/);if(est&&method==="GET"){const e=estimates.find(x=>x.id===est[1]);if(!e)fail("Estimate not found");return {...copy(e),status_view:statusView(e.status)} as T;}
  }

  const map:Record<string,string>={customers:"customers",vehicles:"vehicles",service_requests:"serviceRequests",appointments:"appointments",check_ins:"checkIns",inspections:"inspections",estimates:"estimates",repair_orders:"repairOrders",labor:"labor",part_requests:"partRequests",qc:"qualityChecks",invoices:"invoices",payments:"payments",parts:"parts",inventory:"inventoryTransactions",suppliers:"suppliers",purchase_orders:"purchaseOrders",users:"users",audit:"auditLogs"};
  const clean=path.replace(/\/+$/,"")||"/";const parts=clean.split("/").filter(Boolean);const root=parts[0];const key=map[root];
  if(root==="suppliers"&&parts.length===3&&parts[2]==="summary"&&method==="GET"){
    const supplier=one(s,"suppliers",parts[1]);if(!supplier)fail("Supplier not found");
    const orders=s.purchaseOrders.filter(x=>x.supplier_id===supplier.id);
    return {supplier_id:supplier.id,order_count:orders.length,total_order_value:orders.reduce((a:number,x:Row)=>a+x.total_amount,0),open_order_count:orders.filter((x:Row)=>!["RECEIVED","CANCELLED"].includes(x.status)).length} as T;
  }
  if(root==="suppliers"&&parts.length===3&&parts[2]==="deactivate"&&method==="POST"){
    const supplier=one(s,"suppliers",parts[1]);if(!supplier)fail("Supplier not found");
    supplier.is_active=false;supplier.status="INACTIVE";persist();return copy(supplier) as T;
  }
  if(root==="purchase_orders"&&parts.length===3&&parts[1]==="by-number"&&method==="GET"){
    const order=s.purchaseOrders.find(x=>x.po_number===parts[2]);if(!order)fail("Purchase order not found");return copy(order) as T;
  }
  if(root==="purchase_orders"&&parts.length===2&&parts[1]==="from-low-stock"&&method==="POST"){
    const supplier=one(s,"suppliers",String(body.supplier_id??""));if(!supplier)fail("Supplier not found");
    const selected=s.parts.filter(p=>p.quantity_on_hand<=p.reorder_level&&(!Array.isArray(body.part_ids)||body.part_ids.includes(p.id)));
    const items=selected.map(p=>({id:id("po-item"),part_id:p.id,part_number:p.part_number,part_name:p.name,quantity_ordered:Math.max(1,(p.reorder_level-p.quantity_on_hand)*Number(body.shortage_multiplier??1)),quantity_received:0,unit_cost:p.unit_cost,line_total:Math.max(1,p.reorder_level-p.quantity_on_hand)*p.unit_cost}));
    const subtotal=items.reduce((a:number,x:Row)=>a+x.line_total,0);
    const order=createRecord(s,"purchaseOrders","po",{supplier_id:supplier.id,supplier_name:supplier.name,status:"DRAFT",order_date:day(),expected_delivery_date:body.expected_delivery_date??null,subtotal,tax_amount:Number(body.tax_amount??0),shipping_amount:Number(body.shipping_amount??0),total_amount:subtotal+Number(body.tax_amount??0)+Number(body.shipping_amount??0),currency:"USD",notes:body.notes??null,internal_notes:null,sent_at:null,received_at:null,cancelled_at:null,cancel_reason:null,item_count:items.length,total_units_ordered:items.reduce((a,x)=>a+x.quantity_ordered,0),total_units_received:0,is_fully_received:false,is_terminal:false,is_editable:true,is_overdue:false,items});
    return order as T;
  }
  if(root==="payments"&&parts.length===2&&parts[1]==="summary"&&method==="GET"){
    const payments=s.payments.filter(x=>x.status==="COMPLETED");
    return {payment_count:payments.length,total_collected:payments.reduce((a:number,x:Row)=>a+x.amount,0),voided_count:s.payments.filter((x:Row)=>x.status==="VOIDED").length} as T;
  }
  if(root==="inventory"&&parts[1]==="transactions"&&parts.length===2){
    if(method==="GET")return paged(s.inventoryTransactions,query) as T;
    if(method==="POST"){
      const part=one(s,"parts",String(body.part_id??""));
      if(!part)fail("Part not found");
      const quantity=Number(body.quantity??0);
      if(!Number.isFinite(quantity)||quantity<=0)fail("Quantity must be greater than zero",422);
      const before=Number(part.quantity_on_hand??0);
      const after=body.transaction_type==="ISSUE"?before-quantity:before+quantity;
      if(after<0)fail("Insufficient stock on hand",422);
      part.quantity_on_hand=after;
      const transaction=createRecord(s,"inventoryTransactions","txn",{...body,quantity_before:before,quantity_after:after,unit_cost:body.unit_cost??part.unit_cost});
      persist();
      return transaction as T;
    }
  }
  if(root==="inventory"&&parts[1]==="transactions"&&parts.length===3&&method==="GET"){
    const transaction=one(s,"inventoryTransactions",parts[2]);if(!transaction)fail("Transaction not found");return copy(transaction) as T;
  }
  if(root==="inventory"&&parts[1]==="parts"&&parts[3]==="history")return copy(s.inventoryTransactions.filter(x=>x.part_id===parts[2])) as T;
  if(key&&parts.length===1){
    if(method==="GET"){if(root==="users"&&u.roles[0]!=="OWNER")fail("Not permitted",403);return paged(s[key],query) as T;}
    if(method==="POST"){const item=createRecord(s,key,root.replace(/s$/,""),body);audit(s,u,"CREATED",root,item);persist();return item as T;}
  }
  if(key&&parts.length>=2){
    const item=one(s,key,parts[1]);if(!item)fail("Record not found");
    if(parts.length===2&&method==="GET")return copy(item) as T;
    if(parts.length===2&&method==="PATCH"){Object.assign(item,body,{updated_at:now()});audit(s,u,"UPDATED",root,item);persist();return copy(item) as T;}
    if(parts.length===2&&method==="DELETE"){s[key].splice(s[key].findIndex(x=>x.id===item.id),1);persist();return undefined as T;}
    if(root==="appointments"&&parts[2]==="status"&&method==="PATCH"){item.status=body.status??query.status;item.cancellation_reason=body.cancellation_reason??null;persist();return copy(item) as T;}
    if(root==="estimates"&&parts[2]==="send"&&method==="POST"){item.status="SENT";item.sent_at=now();persist();return copy(item) as T;}
    if(root==="estimates"&&parts[2]==="status"&&method==="PATCH"){item.status=query.status??body.status;persist();return copy(item) as T;}
    if(root==="estimates"&&parts[2]==="items"&&parts[4]==="decision"&&method==="POST"){const line=item.items.find((x:Row)=>x.id===parts[3]);if(!line)fail("Estimate line not found");line.status=body.decision;line.customer_notes=body.notes??null;item.approved_total=money(item.items.filter((x:Row)=>x.status==="APPROVED").reduce((a:number,x:Row)=>a+x.line_total,0));item.status=item.items.every((x:Row)=>x.status!=="PENDING")?"APPROVED":"PARTIALLY_APPROVED";persist();return copy(item) as T;}
    if(root==="repair_orders"&&parts[2]==="status"&&method==="PATCH"){item.status=body.status??query.status;persist();return copy(item) as T;}
    if(root==="repair_orders"&&parts[2]==="tasks"&&parts[4]==="status"&&method==="PATCH"){const task=item.tasks.find((x:Row)=>x.id===parts[3]);if(!task)fail("Task not found");task.status=body.status??query.status;task.completed_at=task.status==="COMPLETED"?now():null;item.all_tasks_done=item.tasks.every((x:Row)=>["COMPLETED","SKIPPED"].includes(x.status));persist();return copy(task) as T;}
    if(root==="repair_orders"&&parts[2]==="tasks"&&method==="POST"){const task={...body,id:id("task"),repair_order_id:item.id,status:"PENDING",sequence:item.tasks.length+1,completed_at:null};item.tasks.push(task);persist();return copy(task) as T;}
    if(root==="part_requests"&&parts[2]==="decision"&&method==="POST"){item.status=body.decision;item.decision_reason=body.decision_reason??null;item.approved_by_id=u.id;persist();return copy(item) as T;}
    if(root==="part_requests"&&parts[2]==="fulfil"&&method==="POST"){item.status="FULFILLED";item.fulfilled_by_id=u.id;persist();return copy(item) as T;}
    if(root==="qc"&&parts[2]==="pass"&&method==="POST"){item.status="PASSED";item.passed=true;item.completed_at=now();item.is_terminal=true;persist();return copy(item) as T;}
    if(root==="qc"&&parts[2]==="fail"&&method==="POST"){item.status="FAILED";item.passed=false;item.failure_reason=body.reason??null;item.completed_at=now();item.is_terminal=true;persist();return copy(item) as T;}
    if(root==="qc"&&parts[2]==="reverify"&&method==="POST"){item.status="IN_PROGRESS";item.passed=false;item.is_terminal=false;item.attempt_number+=1;persist();return copy(item) as T;}
    if(root==="invoices"&&parts[2]==="issue"&&method==="POST"){item.status="ISSUED";item.issued_at=now();persist();return copy(item) as T;}
    if(root==="invoices"&&parts[2]==="void"&&method==="POST"){item.status="VOID";item.void_reason=query.reason??body.reason;item.voided_at=now();persist();return copy(item) as T;}
    if(root==="payments"&&parts[2]==="void"&&method==="POST"){item.status="VOIDED";item.void_reason=body.reason??null;item.voided_at=now();persist();return copy(item) as T;}
    if(root==="purchase_orders"&&parts[2]==="send"&&method==="POST"){item.status="SENT";item.sent_at=now();persist();return copy(item) as T;}
    if(root==="purchase_orders"&&parts[2]==="cancel"&&method==="POST"){item.status="CANCELLED";item.cancel_reason=body.reason??null;persist();return copy(item) as T;}
    if(root==="purchase_orders"&&parts[2]==="receive"&&method==="POST"){item.status="RECEIVED";item.received_at=now();item.is_fully_received=true;item.total_units_received=item.total_units_ordered;persist();return {purchase_order:copy(item),inventory_transactions:[]} as T;}
    if(root==="inspections"&&parts[2]==="report"&&method==="GET")return {inspection:copy(item),summary:"Inspection report generated locally"} as T;
  }
  if(root==="audit"&&parts.length===2&&method==="GET"){const item=one(s,"auditLogs",parts[1]);if(!item)fail("Audit record not found");return {...copy(item),details:item.changes??{}} as T;}
  return [] as T;
}
export async function demoDocument(path:string):Promise<string>{
  mustAuth();
  const label=path.split("/").pop()??"AutoFix document";
  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>AutoFix demo document</title><style>body{font:14px Arial,sans-serif;max-width:760px;margin:48px auto;color:#172033}.notice{margin-top:36px;padding:14px;background:#f1f5f9;border-radius:8px}</style></head><body><h1>AutoFix Garage</h1><p>Sample document: "+label+"</p><div class=\"notice\">Browser-only demo. No email or payment has been sent.</div></body></html>";
}
