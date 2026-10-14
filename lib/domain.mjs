export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const skillsOf=s=>new Set(normalize(s).split(',').map(x=>x.trim()).filter(Boolean));
// Deterministic suggestions: known equal availability, skill complementarity, stable tie-break by ID.
export function suggestTeams(people,min,max){
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<2||max<min||max>10)throw Error('Limites inválidos.');
 const seen=new Set();for(const p of people){if(seen.has(p.id))throw Error('Participante duplicado.');seen.add(p.id)}
 const buckets=new Map(),unassigned=[],teams=[];
 for(const p of [...people].sort((a,b)=>a.id.localeCompare(b.id))){const key=normalize(p.availability).trim();if(!key){unassigned.push({id:p.id,reason:'Disponibilidade não declarada'});continue}if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p)}
 for(const [availability,pool]of buckets){while(pool.length>=min){const team=[];const covered=new Set();const size=Math.min(max,pool.length);const remainder=pool.length-size;const target=remainder>0&&remainder<min&&size-(min-remainder)>=min?size-(min-remainder):size;
 while(team.length<target){pool.sort((a,b)=>[...skillsOf(b.skills)].filter(s=>!covered.has(s)).length-[...skillsOf(a.skills)].filter(s=>!covered.has(s)).length||a.id.localeCompare(b.id));const p=pool.shift();team.push(p.id);for(const s of skillsOf(p.skills))covered.add(s)}teams.push({members:team,availability,skills:[...covered],reason:'Disponibilidade declarada compatível e competências complementares; revisar antes de confirmar.'});}for(const p of pool)unassigned.push({id:p.id,reason:'Quantidade insuficiente para o tamanho mínimo'})}
 const all=teams.flatMap(t=>t.members).concat(unassigned.map(x=>x.id));if(new Set(all).size!==people.length||all.length!==people.length)throw Error('Falha de integridade.');return {algorithm:'team-match-v1',teams,unassigned};
}
export function validateDates(e){return e.opens_at<e.closes_at&&e.closes_at<=e.starts_at&&e.starts_at<e.ends_at;}
export function searchCatalog(events,filters){return events.filter(e=>(!filters.q||normalize(e.title+' '+e.summary+' '+e.theme).includes(normalize(filters.q)))&&(!filters.city||normalize(e.city).includes(normalize(filters.city)))&&(!filters.format||e.format===filters.format)&&(!filters.theme||normalize(e.theme).includes(normalize(filters.theme)))&&(!filters.from||e.starts_at>=filters.from)&&(!filters.to||e.starts_at<=filters.to+'T23:59:59Z'));}
