// Bound to the private Google Sheet. Deploy as a web app, executing as its owner.
// Script properties: BRIDGE_SECRET (random secret, also set in Worker).
const SPREADSHEET_ID='1njwao7YmibMaEFBa5s1XKksznBYcPFcVL6cIDGKGQ9E';
function classifyTopic(topic,rules){
  const text=topic.normalize('NFKC').toLowerCase().replace(/ё/g,'е');let best='Неразобрано',score=0;const hits=[];
  rules.forEach(function(row){const category=String(row[0]||'').trim();if(!category)return;const patterns=[...new Set(String(row[1]||'').split('|').map(s=>s.trim().toLowerCase().replace(/ё/g,'е')).filter(Boolean))];const found=patterns.filter(p=>text.includes(p));if(found.length){hits.push(category+': '+found.join(', '));if(found.length>score){score=found.length;best=category;}}});
  return {category:best,matches:hits.join(' / ')};
}
function doPost(e){
  const output=obj=>ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  const lock=LockService.getScriptLock();
  try{
    const envelope=JSON.parse(e.postData.contents);const secret=PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET');if(!secret)throw Error('NOT_CONFIGURED');
    const signature=Utilities.computeHmacSha256Signature(envelope.message,secret).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
    if(signature.length!==String(envelope.signature).length)throw Error('UNAUTHORIZED');let difference=0;for(let i=0;i<signature.length;i++)difference|=signature.charCodeAt(i)^String(envelope.signature).charCodeAt(i);if(difference)throw Error('UNAUTHORIZED');
    const message=JSON.parse(envelope.message);if(Math.abs(Date.now()-message.timestamp)>300000)throw Error('EXPIRED');const p=message.payload;
    if(!p||typeof p.topic!=='string'||p.topic.trim().length<1||p.topic.length>500||!/^[a-f0-9-]{36}$/i.test(p.id))throw Error('INVALID');
    lock.waitLock(20000);const book=SpreadsheetApp.openById(SPREADSHEET_ID),sheet=book.getSheetByName('Темы');
    const found=sheet.getRange('A2:A10001').createTextFinder(p.id).matchEntireCell(true).findNext();if(found)return output({ok:true,category:sheet.getRange(found.getRow(),7).getValue()});
    const row=sheet.getLastRow()+1;if(row>10001)throw Error('CAPACITY');const rules=book.getSheetByName('Категории').getRange('A2:B11').getValues();const c=classifyTopic(p.topic,rules);
    // RAW-equivalent strings: prevent user text from becoming spreadsheet formulas.
    const safe=s=>{s=String(s||'');return /^[=+@\-\t\r]/.test(s)?"'"+s:s;};
    sheet.getRange(row,1,1,11).setValues([[p.id,Utilities.formatDate(new Date(p.createdAt),'Asia/Yekaterinburg','yyyy-MM-dd HH:mm:ss'),safe(p.topic),safe(p.team),safe(p.author),safe(p.telegram),c.category,'','',safe(c.matches),'Новое']]);
    sheet.getRange(row,9).setFormula('=IF(H'+row+'="";G'+row+';H'+row+')');sheet.getRange(row,3).setWrap(true);SpreadsheetApp.flush();return output({ok:true,category:c.category});
  }catch(error){console.error(error.name+': '+error.message);return output({ok:false,error:'Не удалось записать тему.',code:['NOT_CONFIGURED','UNAUTHORIZED','EXPIRED','INVALID','CAPACITY'].includes(error.message)?error.message:'SHEET_WRITE'});}finally{if(lock.hasLock())lock.releaseLock();}
}
