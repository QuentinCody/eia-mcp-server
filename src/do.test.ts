/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
import { EiaDataDO } from "./do";

const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
async function store(data: unknown) {
  const database = new DatabaseSync(":memory:"); databases.push(database);
  let ready: Promise<unknown> = Promise.resolve();
  const exec = (sql: string, ...args: SQLInputValue[]) => {
    const rows = database.prepare(sql).all(...args);
    return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() };
  };
  const ctx = { blockConcurrencyWhile: (run: () => Promise<unknown>) => { ready = run(); return ready; },
    storage: { sql: { exec }, transactionSync: (run: () => unknown) => {
      database.exec("BEGIN"); try { const result = run(); database.exec("COMMIT"); return result; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    } } };
  // This test fixture implements only the Durable Object storage interfaces used here.
  const instance = new EiaDataDO(ctx as unknown as ConstructorParameters<typeof EiaDataDO>[0], {} as ConstructorParameters<typeof EiaDataDO>[1]);
  await ready;
  const result = await instance.fetch(new Request("https://fixture/process", { method: "POST", body: JSON.stringify({ data }) }));
  expect(await result.json()).toMatchObject({ success: true });
  return database;
}

const rows = [{period:"2026-01",stateid:"001",sectorid:"RES",price:"9007199254740993.0100",nullable:null,_rowid:7,mcp_native_json:"native collision",ID:"A",id:"a",extra:{keep:[1,"2",null]}},{period:"2026-01",stateid:"001",sectorid:"RES",price:"-0.0000",_rowid:7,id:"a"}];
const envelope = {response:{total:"5001",dateFormat:"YYYY-MM",frequency:"monthly",data:rows},warning:"parameter out of range",request:{params:{offset:0}},apiVersion:"2.1.12"};
it("keeps full discovery envelopes while materializing repeated records and exact scalar strings",async()=>{
 const input={data:envelope,provenance:{raw_json:JSON.stringify(envelope)}};
 const database=await store(input);
 const recovered=database.prepare("SELECT mcp_source_index,mcp_native_json,price,stateid FROM electricity_data ORDER BY mcp_source_index").all();
 expect(recovered.map(row=>JSON.parse(String(row.mcp_native_json)))).toEqual(rows);
 expect(recovered.map(row=>[row.price,row.stateid])).toEqual(rows.map(row=>[row.price,row.stateid]));
 const control=JSON.parse(String(database.prepare("SELECT native_json FROM eia_response").get()?.native_json));
 expect(control).toEqual({...envelope,response:{total:"5001",dateFormat:"YYYY-MM",frequency:"monthly"}});
});
it("keeps metadata definitions separate from observations, facet values and child routes",async()=>{
 const metadata={response:{id:"leaf",frequency:[{id:"monthly"}],data:{price:{units:"native unit"}},facets:[{id:"stateid"}],description:"α😀"}};
 const db=await store(metadata);
 expect(JSON.parse(String(db.prepare("SELECT mcp_native_json FROM eia_metadata").get()?.mcp_native_json))).toEqual(metadata.response);
 for(const [collection,table] of [["facets","eia_facets"],["routes","eia_routes"]]){
  const items=[{id:"001",name:"first"},{id:"001",name:"repeated",nested:{keep:true}}];
  const staged=await store({response:{[collection]:items,totalFacets:"2"}});
  expect(staged.prepare(`SELECT mcp_native_json,id FROM ${table} ORDER BY mcp_source_index`).all().map(row=>[JSON.parse(String(row.mcp_native_json)),row.id])).toEqual(items.map(row=>[row,row.id]));
 }
});
it("unwraps complete MCP envelopes and restages SQL without reserved-column collisions",async()=>{
 const db=await store({content:[],structuredContent:{success:true,data:envelope}});
 expect(db.prepare("SELECT COUNT(*) AS n FROM electricity_data").get()).toEqual({n:2});
 const values=[{_rowid:7,value:"0.0100"},{_rowid:7,value:null}];
 const second=await store({content:[],structuredContent:{success:true,data:{rows:values,sql:"SELECT * FROM electricity_data"}}});
 expect(second.prepare("SELECT native_json FROM query_rows ORDER BY row_index").all().map(row=>JSON.parse(String(row.native_json)))).toEqual(values);
});
it("preserves empty data pages and classifies gas before generic regional petroleum",async()=>{
 const db=await store({response:{data:[],total:"0"},warning:"keep empty"});
 expect(JSON.parse(String(db.prepare("SELECT native_json FROM eia_response").get()?.native_json))).toMatchObject({response:{total:"0"},warning:"keep empty"});
 const gas=await store({response:{data:[{period:"2026",duoarea:"R48",process:"natural gas storage",value:"001.00"}]}});
 expect(gas.prepare("SELECT value FROM natural_gas_data").get()).toEqual({value:"001.00"});
});
