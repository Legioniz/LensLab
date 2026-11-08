/** Minimal ZIP writer using the STORE method. No dependency, compression, or server required. */
const crcTable = (() => { const table = new Uint32Array(256); for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
function crc32(data: Uint8Array) { let crc=0xffffffff; for(const byte of data) crc=crcTable[(crc^byte)&0xff]^(crc>>>8); return (crc^0xffffffff)>>>0; }
function u16(view: DataView, offset: number, value: number) { view.setUint16(offset,value,true); }
function u32(view: DataView, offset: number, value: number) { view.setUint32(offset,value,true); }
export function createZipStore(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder(); const local: Uint8Array[]=[]; const central: Uint8Array[]=[]; let offset=0;
  for(const file of files){
    const safeName = file.name.replace(/\\/g,"/").split("/").filter((part) => part && part !== "." && part !== "..").join("/").slice(0, 180) || "unnamed.bin";
    const name=encoder.encode(safeName); const data=file.data; const crc=crc32(data);
    const header=new Uint8Array(30+name.length); const hv=new DataView(header.buffer);
    u32(hv,0,0x04034b50);u16(hv,4,20);u16(hv,6,0x0800);u16(hv,8,0);u32(hv,14,crc);u32(hv,18,data.length);u32(hv,22,data.length);u16(hv,26,name.length);header.set(name,30);
    local.push(header,data);
    const dir=new Uint8Array(46+name.length);const dv=new DataView(dir.buffer);
    u32(dv,0,0x02014b50);u16(dv,4,20);u16(dv,6,20);u16(dv,8,0x0800);u16(dv,10,0);u32(dv,16,crc);u32(dv,20,data.length);u32(dv,24,data.length);u16(dv,28,name.length);u32(dv,42,offset);dir.set(name,46);central.push(dir);offset+=header.length+data.length;
  }
  const centralSize=central.reduce((sum,item)=>sum+item.length,0);const end=new Uint8Array(22);const ev=new DataView(end.buffer);
  u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralSize);u32(ev,16,offset);
  const parts = [...local, ...central, end].map((item) => item.buffer.slice(item.byteOffset, item.byteOffset + item.byteLength) as ArrayBuffer);
  return new Blob(parts,{type:"application/zip"});
}
