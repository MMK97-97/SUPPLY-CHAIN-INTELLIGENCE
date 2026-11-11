import {clean, displayQty, inspectionIssues, METHODS, safeName, short, trackingLabel, yesNo} from './core.mjs';
import {asset, imageFile, loadScript, makePreview, zipTool} from './io.mjs';

const fields = method => [
  ['Vendor PO#','po'],['Shipping method','method'],['Expected delivery','expected'],
  [trackingLabel(method),'tracking'],['Received by','receiver'],['Date received','date'],
  ['Time received','time'],['Time zone','zone'],['Truck / trailer damage or tampering','truck'],
  ['Pallet damage or tampering','pallet']
];
const arrivalFields=new Set(['receiver','date','time','zone','truck','pallet']);
const returnInstructions='After delivery, email this completed report back to your Stark procurement contact. Include every signed BOL or proof of delivery and photos showing the truck or trailer (if applicable), pallet condition, and any damaged items.';
const columns = [
  ['Model #',132],['Actual ordered',55],['Packing slip',65],['Received',60],
  ['Shortage',53],['Shortage qty',59],['Damages',59],['Photos',49]
];
const red='A12239', ink='17293C', muted='475B70', line='CBD5E1', paper='F4F7FA';
const plain = (v, blank=false) => clean(v,200) || (blank?'':'Not entered');
const fmtInfo = (key,info,blank=false) => key==='method' ? (METHODS[info[key]]||plain('',blank)) : ['pallet','truck'].includes(key) ? (blank&&!info[key]?'':yesNo(info[key])) : plain(info[key],blank);
const lineValues = (l,blank=false) => {
  const gap=short(l.packed,l.received);
  const q=n=>blank&&n===null?'':displayQty(n);
  return [plain(l.model,blank),q(l.ordered),q(l.packed),q(l.received),gap===null?(blank?'':'Not entered'):gap?'Yes':'No',q(gap),blank&&!l.damages?'':yesNo(l.damages),blank?'':String(l.photos.length)];
};
const numbered=(file,index)=>String(index+1).padStart(2,'0')+'-'+safeName(file.name);
export function listFiles(snapshot) {
  const {files,lines}=snapshot;
  const out=[];
  for(const [key,label] of [['po','Vendor PO'],['slip','Packing slip']])
    if(files[key])out.push({path:'sources/'+key+'-'+safeName(files[key].name),file:files[key],label,group:key});
  for(const [key,label] of [['delivery','Signed BOL or proof of delivery'],['pallet','Pallet condition proof'],['truck','Truck or trailer condition proof']])
    (files[key]||[]).forEach((file,index)=>out.push({path:key+'/'+numbered(file,index),file,label,group:key,index}));
  lines.forEach((row,index)=>row.photos.forEach((file,photo)=>out.push({path:'lines/'+String(index+1).padStart(3,'0')+'-'+safeName(row.model||'model')+'/'+numbered(file,photo),file,label:'Line '+(index+1)+' · '+(row.model||'Model not entered'),group:'line',index,photo})));
  return out;
}
async function localBytes(path){
  const response=await fetch(asset(path));
  if(!response.ok)throw new Error('A report asset could not load.');
  return new Uint8Array(await response.arrayBuffer());
}
export async function prepare(snapshot){
  const attachments=listFiles(snapshot),logo=await localBytes('stark-enterprises.png');
  const images=[];
  for(const item of attachments){
    if(!['delivery','pallet','truck','line'].includes(item.group)||!imageFile(item.file))continue;
    try{images.push({...item,...await makePreview(item.file)});}
    catch{throw new Error('Could not read evidence photo '+safeName(item.file.name)+'. Replace it with a JPG, PNG, or WebP image.');}
  }
  return {snapshot,attachments,images,logo,issues:inspectionIssues(snapshot)};
}
export async function prepareHandoff(snapshot, logo){
  const info=Object.fromEntries(['po','method','tracking','expected'].map(k=>[k,snapshot.info[k]]));
  const lines=snapshot.lines.map(({model,ordered,packed})=>({model,ordered,packed,received:null,damages:'',notes:'',photos:[]}));
  return {snapshot:{info,lines},attachments:[],images:[],logo:logo||await localBytes('stark-enterprises.png'),issues:[],handoff:true};
}
const stateName = issues => issues.length?'DRAFT · REVIEW NEEDED':'RECEIVING RECORD';
function attachLabel(a){return a.label+' — '+safeName(a.file.name);}

export async function makePdf(data, dependencies){
  const PDF=dependencies?.PDF || await loadScript(asset('vendor/pdf-lib.min.js'),'PDFLib');
  const kit=dependencies?.kit || await loadScript(asset('vendor/fontkit.min.js'),'fontkit');
  const doc=await PDF.PDFDocument.create();
  doc.registerFontkit(kit);
  const rgb=hex=>PDF.rgb(...[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255));
  const [regular,bold]=await Promise.all([
    doc.embedFont(dependencies?.regular||await localBytes('vendor/DejaVuSans.ttf'),{subset:true}),
    doc.embedFont(dependencies?.bold||await localBytes('vendor/DejaVuSans-Bold.ttf'),{subset:true})
  ]);
  const logo=await doc.embedPng(data.logo),{snapshot,attachments,images,issues,handoff,blank}=data;
  const form=handoff?doc.getForm():null;
  const formFont=handoff?await doc.embedFont(PDF.StandardFonts.Helvetica):null;
  const metadata=fields(snapshot.info.method);
  const W=612,H=792,M=40,R=W-M,width=W-M*2;
  doc.setTitle('Receiving Inspection Report');
  doc.setAuthor('Stark Enterprises');
  doc.setSubject('Vendor PO receiving and delivery evidence');
  let page,y;
  const draw=(str,x,top,{size=10,font=regular,color=ink}={})=>page.drawText(str,{x,y:top-size,size,font,color:rgb(color)});
  const rect=(x,top,w,h,color)=>page.drawRectangle({x,y:top-h,width:w,height:h,color:rgb(color)});
  const rule=(top,color=line)=>page.drawLine({start:{x:M,y:top},end:{x:R,y:top},thickness:0.6,color:rgb(color)});
  const wrap=(value,space,size=10,font=regular)=>{
    const rows=[];
    let current='';
    for(const word of String(value).split(/\s+/)){
      const candidate=current?current+' '+word:word;
      if(font.widthOfTextAtSize(candidate,size)<=space){current=candidate;continue;}
      if(current){rows.push(current);current='';}
      for(const c of Array.from(word)){
        if(current&&font.widthOfTextAtSize(current+c,size)>space){rows.push(current);current='';}
        current+=c;
      }
    }
    if(current||!rows.length)rows.push(current);
    return rows;
  };
  function widget(name,x,top,w,h,{choices,multiline=false,size=9}={}){
    const field=choices?form.createDropdown(name):form.createTextField(name);
    if(choices)field.setOptions(choices);
    else if(multiline)field.enableMultiline();
    field.addToPage(page,{x,y:top-h,width:w,height:h,font:formFont,textColor:rgb(ink),backgroundColor:rgb('FFFFFF'),borderColor:rgb(line),borderWidth:.6});
    field.setFontSize(size);
  }
  function newPage(first=false){
    page=doc.addPage([W,H]);
    rect(M,H-34,4,first?67:40,red);
    const w=first?70:45, h=logo.height/ logo.width*w;
    page.drawImage(logo,{x:M+12,y:H-39-h,width:w,height:h});
    const x=M+12+w+16;
    draw(first?'RECEIVING INSPECTION REPORT':'Receiving Inspection Report',x,H-42,{font:bold,size:first?16.5:13});
    const subtitle=first?(handoff?'3PL RECEIVING FORM · COMPLETE AFTER DELIVERY':stateName(issues)):blank?'3PL RECEIVING FORM':'PO '+plain(snapshot.info.po);
    wrap(subtitle,R-x,9,bold).slice(0,2).forEach((s,i)=>draw(s,x,H-67-i*10,{font:bold,size:9,color:red}));
    y=first?H-112:H-91;
    rule(y+8);
  }
  const space=h=>{if(y-h<58)newPage();};
  function note(value,options={}){
    const {size=9.5,color=muted,font=regular,after=6}=options;
    const rows=wrap(value,width,size,font);
    for(const row of rows){space(size+7);draw(row,M,y,{size,color,font});y-=size+4;}
    y-=after;
  }
  function heading(title){space(37);draw(title,M,y,{size:12,font:bold,color:red});y-=22;}
  newPage(true);
  if(handoff)note(returnInstructions,{size:9,after:10});
  if(blank)note('Use the PRO number for LTL, or the tracking number for FedEx, UPS, or USPS.',{size:8.8});
  heading('Shipment and receiving details');
  const metaColumns=handoff?4:3;
  for(let i=0;i<metadata.length;i+=metaColumns){
    const group=metadata.slice(i,i+metaColumns),cw=width/metaColumns;
    const sets=group.map(([label,k])=>({labels:wrap(label,cw-13,8,bold),values:wrap(fmtInfo(k,snapshot.info,handoff),cw-13,10)}));
    const labelHeight=Math.max(...sets.map(a=>a.labels.length))*10;
    const height=20+labelHeight+Math.max(...sets.map(a=>a.values.length))*13;
    space(height);
    rect(M,y,width,height-3,paper);
    group.forEach(([,key],j)=>{
      const x=M+j*cw+7,top=y-8-labelHeight;
      sets[j].labels.forEach((str,k)=>draw(str,x,y-5-k*10,{size:8,font:bold,color:muted}));
      if(handoff&&(blank||arrivalFields.has(key)))widget(key,x,top,cw-14,16,{choices:key==='truck'?['Yes','No','Not applicable']:key==='pallet'?['Yes','No']:key==='method'?Object.values(METHODS):null});
      else sets[j].values.forEach((str,k)=>draw(str,x,top-k*13,{size:10}));
    });
    y-=height;
  }
  if(!handoff&&snapshot.info.arrival)note('Arrival condition notes: '+clean(snapshot.info.arrival,500),{size:9});
  note('Shortage quantity = packing slip quantity − received quantity, with a minimum of zero.',{after:10});
  heading('Line items');
  if(handoff)note('Enter received counts, shortages and damage status. Use short photo references, such as P1, and include the PO and model in each photo filename.',{size:8.6});
  function tableHead(){
    rect(M,y,width,30,ink);
    let x=M;
    columns.forEach(([label,w])=>{wrap(handoff&&label==='Photos'?'Photo refs':label,w-10,7.4,bold).forEach((part,i)=>draw(part,x+5,y-5-i*9,{font:bold,size:7.4,color:'FFFFFF'}));x+=w;});
    y-=30;
  }
  tableHead();
  if(!snapshot.lines.length)note('No line items have been entered.');
  snapshot.lines.forEach((l,i)=>{
    const values=lineValues(l,handoff), wrapped=values.map((v,j)=>wrap(v,columns[j][1]-10,8.7,j===0?bold:regular));
    const remarks=clean(l.notes,500);
    const notes=remarks?wrap('Inspection note: '+remarks,width-12,8.5):[];
    const h=Math.max(29,12+Math.max(...wrapped.map(w=>w.length))*11+notes.length*11);
    if(y-h<58){newPage();heading('Line items continued');tableHead();}
    if(i%2===0)rect(M,y,width,h,paper);
    let x=M;
    wrapped.forEach((parts,j)=>{
      if(handoff&&(blank||j>=3))widget('line_'+(i+1)+'_'+['model','ordered','packed','received','shortage','shortage_qty','damages','photo_refs'][j],x+3,y-4,columns[j][1]-6,h-8,{size:8,choices:j===4||j===6?['Yes','No']:null,multiline:j===7});
      else parts.forEach((v,k)=>draw(v,x+5,y-6-k*11,{size:8.7,font:j===0?bold:regular,color:j===4&&values[4]==='Yes'?red:ink}));
      x+=columns[j][1];
    });
    const rowH=Math.max(...wrapped.map(w=>w.length))*11;
    notes.forEach((text,k)=>draw(text,M+6,y-9-rowH-k*11,{size:8.5,color:muted}));
    y-=h;rule(y);
  });
  y-=18;
  if(handoff){
    space(165);
    heading('Delivery evidence and arrival notes');
    note('Attach the files to your reply. Label truck, pallet and model photos so they can be matched to this PO.',{size:8.8});
    const proofFields=[['delivery_refs','Signed BOL / POD filenames',210],['truck_refs','Truck / trailer photo filenames',166],['pallet_refs','Pallet photo filenames',156]];
    let x=M;
    for(const [name,label,w] of proofFields){
      draw(label,x,y,{size:8.5,font:bold,color:muted});
      widget(name,x,y-13,w-7,29,{multiline:true});
      x+=w;
    }
    y-=52;
    draw('Describe seal, wrap, load condition or visible damage',M,y,{size:8.5,font:bold,color:muted});
    widget('arrival_notes',M,y-13,width,55,{multiline:true});
    y-=76;
    form.updateFieldAppearances(formFont);
  }else{
    heading('Source and delivery files');
    if(!attachments.length)note('No files attached.');
    for(const a of attachments.filter(a=>a.group==='po'||a.group==='slip'||a.group==='delivery'))note(attachLabel(a),{size:8.8,after:2});
    if(attachments.length)
    note(data.attachOriginals===false?'Original files are stored separately in this receiving packet.':'Original files are embedded as PDF attachments and included in the receiving packet. File attachment support varies by PDF viewer.',{size:8.5});
  }
  if(images.length){
    newPage();heading('Delivery and inspection photos');
    for(const img of images){
      const jpeg=await doc.embedJpg(img.bytes);
      const maxW=width, maxH=230,scale=Math.min(maxW/jpeg.width,maxH/jpeg.height,1);
      const w=jpeg.width*scale,h=jpeg.height*scale;
      const caption=wrap(attachLabel(img),width,9,bold);
      space(h+caption.length*13+23);
      caption.forEach((s,k)=>draw(s,M,y-k*13,{size:9,font:bold}));
      y-=caption.length*13+3;
      page.drawImage(jpeg,{x:M,y:y-h,width:w,height:h});
      y-=h+16;rule(y+4);
    }
  }
  for(const a of data.attachOriginals===false?[]:attachments){
    const bytes=new Uint8Array(await a.file.arrayBuffer());
    await doc.attach(bytes,a.path.replaceAll('/',' - '),{mimeType:a.file.type||'application/octet-stream',description:a.label,creationDate:new Date(0)});
  }
  const pages=doc.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:M,y:43},end:{x:R,y:43},thickness:0.6,color:rgb(line)});
    p.drawText('STARK ENTERPRISES  /  PROCUREMENT', {x:M,y:28,font:bold,size:8,color:rgb(muted)});
    p.drawText((i+1)+' / '+pages.length,{x:R-42,y:28,font:regular,size:8,color:rgb(muted)});
  });
  return new Blob([await doc.save({updateFieldAppearances:!handoff})],{type:'application/pdf'});
}

export async function makeWord(data, dependency, template=false){
  const D=dependency || await loadScript(asset('vendor/docx.iife.js'),'docx');
  const {Paragraph,TextRun,ImageRun,Document,HeadingLevel,Table,TableRow,TableCell,WidthType,BorderStyle,PageNumber,Footer,AlignmentType,Packer}=D;
  const {snapshot,attachments,images,issues,handoff}=data;
  const isTemplate=template||handoff;
  const metadata=fields(snapshot.info.method);
  const txt=(text,props={})=>new TextRun({text:String(text),size:20,color:ink,...props});
  const p=(text,props={})=>new Paragraph({children:[txt(text,props)],spacing:{after:105}});
  const h=text=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[txt(text,{size:24,bold:true,color:red})],spacing:{before:260,after:110},keepNext:true});
  const cell=(children,w,fill='FFFFFF')=>new TableCell({children:Array.isArray(children)?children:[children],width:{size:w,type:WidthType.DXA},shading:{fill},margins:{top:90,bottom:90,left:92,right:92},borders:{top:{style:BorderStyle.SINGLE,size:4,color:line},bottom:{style:BorderStyle.SINGLE,size:4,color:line},left:{style:BorderStyle.SINGLE,size:4,color:line},right:{style:BorderStyle.SINGLE,size:4,color:line}}});
  const table=(rows,ww)=>new Table({rows,width:{size:9580,type:WidthType.DXA},columnWidths:ww,layout:D.TableLayoutType.FIXED});
  const children=[
    new Paragraph({children:[new ImageRun({type:'png',data:data.logo,transformation:{width:76,height:68},altText:{title:'Stark Enterprises',description:'Stark Enterprises logo',name:'Stark Enterprises'}})],spacing:{after:80}}),
    new Paragraph({text:'Receiving Inspection Report',heading:HeadingLevel.TITLE,spacing:{after:80}}),
    p(isTemplate?'3PL receiving form · Complete after delivery':stateName(issues),{bold:true,color:red,size:20}),
    p(isTemplate?returnInstructions:'Record received quantities against the packing slip and retain the original delivery evidence with the receiving packet.',{color:muted,size:19}),
    h('Shipment and receiving details')
  ];
  if(template&&!handoff)children.splice(children.length-1,0,p('Shipping reference: use the PRO number for LTL, or the tracking number for FedEx, UPS, or USPS.',{color:muted,size:18}));
  const grid=[];
  for(let i=0;i<metadata.length;i+=3){
    const entries=metadata.slice(i,i+3);
    grid.push(new TableRow({cantSplit:true,children:[0,1,2].map(j=>{
      const [label,key]=entries[j]||['',''];
      const options=isTemplate?(key==='truck'?'  (Yes / No / N/A)':key==='pallet'?'  (Yes / No)':''):'';
      return cell([p(label+options,{size:17,bold:true,color:muted}),p(key?fmtInfo(key,snapshot.info,isTemplate)||'________________':' ',{size:19})],j===2?3194:3193,paper);
    })}));
  }
  children.push(table(grid,[3193,3193,3194]));
  if(!isTemplate&&snapshot.info.arrival)children.push(p('Arrival condition notes: '+snapshot.info.arrival,{color:muted,size:18}));
  children.push(h('Line items'),p('Shortage quantity = packing slip quantity − received quantity, with a minimum of zero.',{color:muted,size:18}));
  if(isTemplate)children.push(p('Enter received quantities and mark Shortage and Damages as Yes or No. Insert model photos in the evidence section or list the corresponding photo filenames.',{color:muted,size:18}));
  const ws=[2400,980,1130,1050,970,1040,1040,970];
  const head=new TableRow({tableHeader:true,cantSplit:true,children:columns.map(([label],i)=>cell(p(label,{size:16,bold:true,color:'FFFFFF'}),ws[i],ink))});
  const rows=snapshot.lines.map((l,i)=>new TableRow({cantSplit:true,children:lineValues(l,isTemplate).map((v,j)=>cell(p(v||' ',{size:18,bold:j===0}),ws[j],i%2===0?paper:'FFFFFF'))}));
  children.push(table([head,...(rows.length?rows:[new TableRow({children:[cell(p('No line items entered.',{color:muted}),9580)]})])],ws));
  snapshot.lines.forEach((l,i)=>{if(l.notes)children.push(p('Line '+(i+1)+' · '+plain(l.model)+': '+l.notes,{color:muted,size:18}));});
  if(isTemplate){
    children.push(h('Delivery evidence and arrival notes'));
    for(const label of ['Signed BOL / proof of delivery file names','Arrival notes (seal, wrap, load condition or damage)'])children.push(p(label+': ____________________________________',{size:19}));
    children.push(new Paragraph({heading:HeadingLevel.HEADING_2,pageBreakBefore:true,children:[txt('Truck, pallet and model photos',{size:27,bold:true,color:red})],spacing:{after:130}}),
      p('Insert photos in the matching box or attach them to your reply. Label each attachment with the PO number and Truck, Pallet, or its model number.',{color:muted,size:19}));
    const proofCell=(label,hint)=>cell([p(label,{bold:true,size:19}),p(hint,{color:muted,size:17})],4790,paper);
    const proofRows=[new TableRow({cantSplit:true,height:{value:1520,rule:D.HeightRule.ATLEAST},children:[
      proofCell('Truck or trailer on arrival','Insert arrival photo(s), if applicable.'),
      proofCell('Pallet on arrival','Insert condition photo(s) showing wrap and any damage.')
    ]})];
    for(let i=0;i<snapshot.lines.length;i+=2){
      const modelCell=j=>j<snapshot.lines.length?proofCell('Line '+(j+1)+'  |  Model #: '+(snapshot.lines[j].model||'________________'), 'Insert model photo(s) and describe visible damage.'):cell(p(' '),4790);
      proofRows.push(new TableRow({cantSplit:true,height:{value:1520,rule:D.HeightRule.ATLEAST},children:[modelCell(i),modelCell(i+1)]}));
    }
    children.push(table(proofRows,[4790,4790]));
  }else{
    children.push(h('Source and delivery files'));
    const named=attachments.filter(a=>a.group==='po'||a.group==='slip'||a.group==='delivery');
    children.push(...(named.length?named.map(a=>p(attachLabel(a),{size:18})): [p('No files attached.',{color:muted,size:18})]));
    children.push(p('Original uploaded documents and photos are included in the receiving packet.',{color:muted,size:18}));
    if(images.length){
      children.push(h('Delivery and inspection photos'));
      for(const img of images){
        const scale=Math.min(580/img.width,265/img.height,1);
        children.push(new Paragraph({keepNext:true,children:[txt(attachLabel(img),{bold:true,size:19})],spacing:{before:170,after:70}}));
        children.push(new Paragraph({children:[new ImageRun({type:'jpg',data:img.bytes,transformation:{width:Math.round(img.width*scale),height:Math.round(img.height*scale)},altText:{title:img.label,description:safeName(img.file.name),name:safeName(img.file.name)}})],spacing:{after:140}}));
      }
    }
  }
  const document=new Document({
    title:'Receiving Inspection Report',creator:'Stark Enterprises',
    styles:{default:{document:{run:{font:'Arial',size:20,color:ink},paragraph:{spacing:{line:260}}},title:{run:{font:'Arial',size:43,color:'000000',bold:true}}}},
    sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:660,right:1330,bottom:620,left:1330}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[txt('STARK ENTERPRISES  |  PROCUREMENT  |  Page ',{size:16,color:muted}),new TextRun({children:[PageNumber.CURRENT],size:16,color:muted})]})]})},children}]
  });
  return Packer.toBlob(document);
}

export function fileBase(info){
  return 'Stark-Receiving-'+safeName(info.po||'Draft').replaceAll(' ','-')+(info.date?'-'+info.date:'');
}

export async function packet(data,pdf,word){
  const JSZip=await zipTool(),zip=new JSZip();
  const base=fileBase(data.snapshot.info);
  zip.file(base+'.pdf',new Uint8Array(await pdf.arrayBuffer()));
  zip.file(base+'.docx',new Uint8Array(await word.arrayBuffer()));
  for(const a of data.attachments)zip.file('originals/'+a.path,new Uint8Array(await a.file.arrayBuffer()));
  const manifest={
    format:'stark-receiving-inspection',version:1,info:data.snapshot.info,
    files:data.attachments.map(({path,file,group,index,photo})=>({path:'originals/'+path,name:safeName(file.name),group,index,photo})),
    lines:data.snapshot.lines.map(({photos,...row})=>row)
  };
  zip.file('receiving-inspection.json',JSON.stringify(manifest,null,2));
  return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
}
