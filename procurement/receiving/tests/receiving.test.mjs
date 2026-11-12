import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {handoffIssues, inspectionIssues, mergeSources, over, parseRecords, quantity, reconcileSummary, short, trackingLabel, validDate} from '../core.mjs';
import {boxRecords, checkArchive} from '../io.mjs';
import {listFiles, prepareHandoff} from '../export.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('../../../assets/jszip.min.js');

test('uses the correct quantity column and only joins exact model numbers', () => {
  const po = parseRecords([
    ['PO #', 'STARK-4821'], ['Carrier', 'LTL'], ['PRO', '00971'], ['Expected delivery', '11/20/2026'],
    ['Model #', 'Ordered Qty', 'Shipped Qty'],
    ['AB-01', '10', '3'], ['AB-01', '2', '1'], ['AB01', '4', '1'],
  ], 'po');
  const slip = parseRecords([
    ['PO #', 'stark-4821'], ['SKU', 'Ordered Qty', 'Shipped Qty'],
    ['AB-01', '12', '8'], ['CD-02', '4', '0'], ['Grand Total', '16', '8'],
  ], 'slip');
  const result = mergeSources(po, slip);
  assert.equal(result.mismatch, false);
  assert.deepEqual(result.meta, {po:'stark-4821',method:'LTL',tracking:'00971',expected:'2026-11-20'});
  assert.deepEqual(result.lines.map(({model,ordered,packed})=>[model,ordered,packed]), [
    ['AB-01',12,8], ['AB01',4,null], ['CD-02',null,0],
  ]);
  assert.equal(mergeSources(po, {...slip,meta:{...slip.meta,po:['STARK-8000']}}).mismatch,true);
});

test('a missing description in positioned PDF text does not shift the quantity', () => {
  const b=(text,x,y,w=40)=>({text,x,y,w,h:11});
  const records=boxRecords([
    b('Model #',30,20),b('Description',140,20,66),b('Ordered Qty',400,20,66),
    b('RX-100',30,50),b('8',414,50,5),
    b('RX-200',30,80),b('Replacement motor',140,80,105),b('12',414,80,10),
  ]);
  assert.deepEqual(parseRecords(records,'po').rows.map(r=>[r.model,r.qty]),[['RX-100',8],['RX-200',12]]);
});

test('unconfirmed counts stay unknown, with shortages separate from overages', () => {
  assert.equal(quantity('1,204 EA'),1204);
  for(const invalid of ['',-1,'4.5','5e3','2,33'])assert.equal(quantity(invalid),null);
  assert.equal(short(8,6),2);
  assert.equal(short(8,9),0);
  assert.equal(short(8,null),null);
  assert.equal(over(12,13),1);
  assert.equal(over(null,0),null);
  assert.equal(short(0,0),0);
});

test('distinguishes an outgoing 3PL handoff from a finished receiving record', async () => {
  const snapshot={
    info:{po:'STARK-4821',method:'USPS',tracking:'9400000000000000000000',expected:'2026-11-20',
      reviewed:true,receiver:'Warehouse User',date:'2026-11-20',time:'12:00',zone:'UTC',truck:'yes',pallet:'yes',arrival:'Torn wrap'},
    files:{po:{name:'vendor.pdf'},slip:{name:'packing.pdf'},delivery:[],pallet:[],truck:[]},
    lines:[{model:'RX-100',ordered:10,packed:8,received:6,damages:'yes',notes:'Private QA note',photos:[]}],
  };
  assert.deepEqual(handoffIssues(snapshot),[]);
  const issues=inspectionIssues(snapshot);
  assert.equal(issues.length,4);
  assert.match(issues.join(' '),/truck or trailer.*pallet.*Line 1: attach damage proof/);
  const handoff=await prepareHandoff(snapshot,new Uint8Array([1,2,3]));
  assert.deepEqual(Object.keys(handoff.snapshot.info),['po','method','tracking','expected']);
  assert.deepEqual(handoff.snapshot.lines[0],{model:'RX-100',ordered:10,packed:8,received:null,damages:'',notes:'',photos:[]});
  assert.equal(handoff.attachments.length,0);
  assert.equal(trackingLabel('LTL'),'PRO number');
  for(const method of ['FEDEX','UPS','USPS'])assert.equal(trackingLabel(method),'Tracking number');
  assert.deepEqual(handoffIssues({...snapshot,info:{...snapshot.info,tracking:''}}),['Enter the tracking number.']);
  const usps=parseRecords([['Carrier','USPS'],['USPS Tracking #','9400000000000000000000']],'slip');
  assert.deepEqual(usps.meta.method,['USPS']);
  assert.deepEqual(usps.meta.tracking,['9400000000000000000000']);
});

test('packet paths preserve the attachment group and line identity', () => {
  const snapshot={files:{delivery:[{name:'signed.pdf'},{name:'signed.pdf'}],pallet:[],truck:[{name:'truck.jpg'}]},
    lines:[{model:'AB/01',photos:[{name:'damage.jpg'}]},{model:'XY-02',photos:[{name:'damage.jpg'}]}]};
  assert.deepEqual(listFiles(snapshot).map(a=>[a.path,a.group,a.index]),[
    ['delivery/01-signed.pdf','delivery',0],['delivery/02-signed.pdf','delivery',1],['truck/01-truck.jpg','truck',0],
    ['lines/001-AB_01/01-damage.jpg','line',0],['lines/002-XY-02/01-damage.jpg','line',1],
  ]);
});

test('checks ZIP entry sizes and rejects traversal before extraction', async () => {
  const valid=new JSZip();
  valid.file('originals/evidence.jpg','test only');
  const bytes=await valid.generateAsync({type:'uint8array'});
  assert.equal(checkArchive(bytes).get('originals/evidence.jpg'),9);
  assert.throws(()=>checkArchive(bytes,8),/expanded archive/);
  const invalid=new JSZip();
  invalid.file('../outside.txt','x',{createFolders:false});
  assert.throws(()=>checkArchive(Buffer.from([1,2,3])),/Invalid ZIP/);
  const zip=await invalid.generateAsync({type:'uint8array'});
  assert.throws(()=>checkArchive(zip),/Invalid archive path/);
});

test('prioritized header aliases and trailing unit suffixes resolve deterministically', () => {
  const po = parseRecords([
    ['Vendor Item', 'Model #', 'Unit Qty', 'Ordered Qty (ea)', 'Shipped Qty (pcs)'],
    ['V-900', 'MK-100', '999', '12', '4'],
    ['V-901', 'MK-200', '888', '6', '6'],
  ], 'po');
  assert.deepEqual(
    po.rows.map(r => [r.model, r.qty]),
    [['MK-100', 12], ['MK-200', 6]]
  );
  const slip = parseRecords([
    ['SKU', 'Ordered Qty (ea)', 'Shipped Qty (pcs)'],
    ['MK-100', '12', '10'],
    ['MK-200', '6', '6'],
  ], 'slip');
  assert.deepEqual(
    slip.rows.map(r => [r.model, r.qty]),
    [['MK-100', 10], ['MK-200', 6]]
  );
});

test('extracts inline multi-field metadata and validates calendar dates', () => {
  const rec = parseRecords([
    ['PO: PO-9988 Tracking: 1Z999AA101 Carrier: UPS'],
    ['Waybill: 778899 Carrier: FedEx Expected Delivery: Nov 20, 2026'],
    ['Model #', 'Ordered Qty'],
    ['M-1', '5'],
  ], 'po');
  assert.equal(rec.meta.po.includes('PO-9988'), true);
  assert.equal(rec.meta.tracking.includes('1Z999AA101'), true);
  assert.equal(rec.meta.tracking.includes('778899'), true);
  assert.equal(rec.meta.method.includes('UPS'), true);
  assert.equal(rec.meta.method.includes('FEDEX'), true);
  assert.equal(rec.meta.expected.includes('2026-11-20'), true);
  assert.equal(validDate('02/30/2026'), '');
  assert.equal(validDate('2026-02-28'), '2026-02-28');
});

test('boxRecords does not mutate the caller boxes array', () => {
  const input = [
    { text: '10', x: 180, y: 20, w: 15, h: 10 },
    { text: 'MK-10', x: 20, y: 20, w: 40, h: 10 },
    { text: 'Model #', x: 20, y: 5, w: 45, h: 10 },
  ];
  const snapshotCopy = input.map(item => ({ ...item }));
  const rows = boxRecords(input, 1);
  assert.deepEqual(input, snapshotCopy);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cells[0].text, 'Model #');
  assert.deepEqual(rows[1].cells.map(c => c.text), ['MK-10', '10']);
});

test('reconcileSummary computes ordered, packed, received, shortage, overage, and damaged counts', () => {
  const s = reconcileSummary([
    { ordered: 10, packed: 10, received: 8, damages: 'yes' },
    { ordered: 5, packed: 5, received: 7, damages: 'no' },
    { ordered: 4, packed: 4, received: null, damages: '' },
    { ordered: 3, packed: 3, received: 3, damages: 'no' },
  ]);
  assert.deepEqual(s, {
    linesCount: 4,
    totalOrdered: 22,
    totalPacked: 22,
    totalReceived: 18,
    shortageUnits: 2,
    overageUnits: 2,
    checkedCount: 3,
    uncountedCount: 1,
    damagedCount: 1,
    matchedCount: 1,
  });
});
