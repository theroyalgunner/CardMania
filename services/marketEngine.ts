// Replacement marketEngine.ts
import { CollectionCard } from "./collectionStore";

function normalizeText(card: Partial<CollectionCard>) {
  return [card.player,card.team,card.manufacturer,card.set,card.year,card.parallel,card.serialNumber,card.cardNumber,card.grade,card.condition,card.notes]
  .filter(Boolean).join(" ").toLowerCase();
}
function has(text:string,terms:string[]){return terms.some(t=>text.includes(t));}
function detailCompleteness(card:Partial<CollectionCard>){
 const f=[card.player,card.manufacturer,card.set,card.year,card.parallel,card.serialNumber,card.grade];
 return f.filter(Boolean).length/f.length;
}
function extractRun(serial?:string,text=""){
 const v=`${serial||""} ${text}`;
 if(/1\s*\/\s*1|one of one|superfractor|printing plate/i.test(v)) return 1;
 const m=v.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
 return m?Number(m[2]):null;
}
function qualityMultiplier(card:Partial<CollectionCard>){
 const t=normalizeText(card); let m=1;
 if(has(t,["messi","cristiano","ronaldo","pele","maradona"])) m*=3.8;
 else if(has(t,["zidane","beckham","ronaldinho","neymar","mbappe","haaland"])) m*=2.8;
 else if(has(t,["yamal","bellingham","vinicius","endrick","saka","pedri"])) m*=2.2;
 if(has(t,["topps chrome","sapphire","prizm","select","obsidian","immaculate","flawless"])) m*=1.6;
 if(has(t,["auto","autograph","signed"])) m*=2.9;
 if(has(t,["patch","jersey","relic","memorabilia"])) m*=2.1;
 if(has(t,["rookie"," rc ","debut"])) m*=1.7;
 if(has(t,["gold","orange","red","black","refractor","mojo","wave"])) m*=1.8;
 if(has(t,["ssp","case hit","kaboom","downtown","color blast"])) m*=3.2;
 const r=extractRun(card.serialNumber,t);
 if(r===1)m*=10; else if(r&&r<=5)m*=5.5; else if(r&&r<=10)m*=4.2; else if(r&&r<=25)m*=3.1; else if(r&&r<=50)m*=2.25; else if(r&&r<=99)m*=1.65; else if(r&&r<=199)m*=1.25;
 const g=String(card.grade||"").toLowerCase();
 if(g.includes("psa 10")||g.includes("bgs 10")||g.includes("sgc 10")) m*=3.4;
 else if(g.includes("psa 9")||g.includes("bgs 9.5")||g.includes("sgc 9.5")) m*=1.85;
 else if(g.includes("psa 8")||g.includes("graded")) m*=1.25;
 return m;
}
export function estimateCardValue(card:Partial<CollectionCard>){
 const existing=Number(card.estimatedValue||0);
 if(existing>10)return Math.round(existing);
 const base=15+detailCompleteness(card)*20;
 return Math.max(5,Math.round(base*qualityMultiplier(card)));
}
export function valuationConfidence(card:Partial<CollectionCard>){
 const s=detailCompleteness(card); if(s>0.8)return "High"; if(s>0.5)return "Medium"; return "Low";
}
export function profitFor(card:Partial<CollectionCard>){return Number(card.estimatedValue||0)-Number(card.purchasePrice||0);}
export function profitLabel(card:Partial<CollectionCard>){const p=profitFor(card);return `${p>=0?"+":"-"}£${Math.abs(p).toLocaleString()}`;}
