'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
// PDF via jsPDF mantido comentado — reservado para implementação futura com Gotenberg
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';

const PRIMARY    = '#1E3264';
const GOLD       = '#C8A020';
const BG         = '#F8F9FA';
const BORDER     = '#E8EAF0';
const TEXT       = '#1A2340';
const SUBTEXT    = '#6B7490';
const SUCCESS    = '#1A7A44';
const DANGER     = '#C0392B';
const EXCEL_BLUE = '#002060';
const GREEN      = '#2E7D32';
const GREEN_LIGHT = '#F0F8F4';
const GREEN_BORDER = '#B8DFC8';

type Posicao = '0°' | '+90°' | '-90°';

type AmostraRow = {
  id: string; item: number; amostra: string; posicao: Posicao;
  limInf: number | null; limSup: number | null; ieMedio: number | null;
  status: 'Amostra Válida' | 'Amostra Perdida';
  ieEfetivo: number | null; resistencia: number | null; dispersao: string; impactosRaw: string[];
  // Memorial fotográfico
  fotoFile?: File | null;
  fotoPreview?: string | null;
  fotoWidth?: number;
  fotoHeight?: number;
};

type Cabecalho = {
  rlt: string; data: string; cliente: string; obra: string; att: string; endereco: string;
  notas: string; bigorna: string[];
};

type ObraPonto = { id: string; amostra: string; posicao: Posicao; impactosRaw: string[]; };
type ObraGrupo = { id: string; nome: string; pontos: ObraPonto[]; savedAt: string; };

const POSICOES: Posicao[] = ['0°', '+90°', '-90°'];
const LS_KEY      = 'tecomat_esclerometria_v1';
const LS_OBRA_KEY = 'tecomat_esclerometria_obra_v2';

function calcularAmostra(amostra: string, posicao: Posicao, impactosStr: string[], coefBigorna: number, item: number): AmostraRow {
  const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random());
  const validos = impactosStr.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
  if (validos.length === 0) return { id, item, amostra, posicao, limInf: null, limSup: null, ieMedio: null, status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  const mediaBruta = validos.reduce((a, b) => a + b, 0) / validos.length;
  const limInf = mediaBruta * 0.90, limSup = mediaBruta * 1.10;
  const filtrados = validos.filter(v => v >= limInf && v <= limSup);
  if (filtrados.length < 5) return { id, item, amostra, posicao, limInf, limSup, ieMedio: null, status: 'Amostra Perdida', ieEfetivo: null, resistencia: null, dispersao: '-', impactosRaw: impactosStr };
  const ieMedio = filtrados.reduce((a, b) => a + b, 0) / filtrados.length;
  const ieEfetivo = ieMedio * coefBigorna;
  let resistencia: number, dispersao: string;
  if (posicao === '0°') {
    resistencia = (0.0089 * ieEfetivo ** 2) + (1.111 * ieEfetivo) - 15.78;
    dispersao = ieEfetivo <= 26 ? '±4,5' : ieEfetivo <= 32 ? '±6,0' : ieEfetivo <= 38 ? '±6,5' : ieEfetivo <= 44 ? '±7,0' : '±7,5';
  } else if (posicao === '+90°') {
    resistencia = (0.0099 * ieEfetivo ** 2) + (1.063 * ieEfetivo) - 24.31;
    dispersao = ieEfetivo <= 29 ? '±4,5' : ieEfetivo <= 38 ? '±6,0' : ieEfetivo <= 43 ? '±6,5' : ieEfetivo <= 48 ? '±7,0' : '±7,5';
  } else {
    resistencia = (0.0133 * ieEfetivo ** 2) + (0.800 * ieEfetivo) - 5.33;
    dispersao = ieEfetivo <= 23 ? '±4,5' : ieEfetivo <= 29 ? '±6,0' : ieEfetivo <= 35 ? '±6,5' : ieEfetivo <= 41 ? '±7,0' : '±7,5';
  }
  return { id, item, amostra, posicao, limInf, limSup, ieMedio, status: 'Amostra Válida', ieEfetivo, resistencia, dispersao, impactosRaw: impactosStr };
}

function fmt(v: number | null, dec = 2): string { return v === null ? '—' : v.toFixed(dec); }

function salvarLocal(cab: Cabecalho, amostras: AmostraRow[]) { try { localStorage.setItem(LS_KEY, JSON.stringify({ cab, amostras })); } catch {} }
function carregarLocal(): { cab: Cabecalho; amostras: AmostraRow[] } | null {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return null;
    const parsed = JSON.parse(r);
    // retrocompatibilidade: remove campos antigos que não existem mais no tipo
    if (parsed.cab) {
      delete parsed.cab.respNome;
      delete parsed.cab.respCrea;
    }
    return parsed;
  } catch { return null; }
}
function salvarGrupos(grupos: ObraGrupo[]) { try { localStorage.setItem(LS_OBRA_KEY, JSON.stringify(grupos)); } catch {} }
function carregarGrupos(): ObraGrupo[] { try { const r = localStorage.getItem(LS_OBRA_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function newId() { return typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Math.random()); }

function Campo({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${BORDER}`, fontSize: 14, fontFamily: 'inherit', color: TEXT, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s' };

function StatusBadge({ status }: { status: AmostraRow['status'] }) {
  const ok = status === 'Amostra Válida';
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: ok ? '#E8F5EE' : '#FFF0EE', color: ok ? SUCCESS : DANGER, border: `1px solid ${ok ? '#B8DFC8' : '#FADADD'}`, whiteSpace: 'nowrap' }}>{ok ? '✓ Válida' : '✗ Perdida'}</span>;
}

function Header({ displayName, initials, cargo, onSignOut }: { displayName: string; initials: string; cargo: string; onSignOut: () => void; }) {
  return (
    <header className="header-root" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60, padding: '0 28px', backgroundColor: PRIMARY, boxShadow: '0 2px 12px rgba(30,50,100,0.25)', position: 'sticky', top: 0, zIndex: 50 }}>
      <style>{`.sb-u:hover{background:rgba(255,255,255,0.12)!important}.nv-u:hover{color:#fff!important}`}</style>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}><img src="/logo_tecomat.png" alt="TECOMAT" style={{ height: 34, objectFit: 'contain' }} /></a>
        <nav style={{ display: 'flex', gap: 6 }}>
          <a href="/dashboard" className="nv-u" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, borderBottom: `2px solid ${GOLD}`, paddingBottom: 5 }}>Ensaios</a>
          <a href="/usuarios" className="nv-u" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, transition: 'color 0.15s' }}>Usuários</a>
        </nav>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: GOLD, color: PRIMARY, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>{initials}</div>
          <div>
            <p className="header-user-name" style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>{displayName}</p>
            {cargo && <p className="header-cargo" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>{cargo}</p>}
          </div>
        </div>
        <div className="header-divider" style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <button className="sb-u" onClick={onSignOut} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span className="signout-text">Sair</span>
        </button>
      </div>
    </header>
  );
}

// ── gerarPDFOficial mantida comentada — reservada para implementação futura com Gotenberg ──
/*
async function gerarPDFOficial(cab: Cabecalho, amostras: AmostraRow[], mediaBigorna: number, coefBigorna: number, rltOficial: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, ML = 10, MR = 10;
  const azulEscuro: [number,number,number] = [0,32,96];
  const cinzaClaro: [number,number,number] = [242,242,242];
  const branco: [number,number,number] = [255,255,255];
  const preto: [number,number,number] = [0,0,0];
  const verdeOk: [number,number,number] = [26,122,68];
  const vermelhoPerdida: [number,number,number] = [192,57,43];

  const carregarImagem = (url: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d')!.drawImage(img,0,0); resolve(c.toDataURL('image/png')); };
      img.onerror = () => resolve(''); img.src = url;
    });
  const logoData = await carregarImagem('/logo_tecomat.png');

  const hLine = (y:number,x1=ML,x2=PW-MR,lw=0.3,color:[number,number,number]=[180,185,200])=>{doc.setDrawColor(...color);doc.setLineWidth(lw);doc.line(x1,y,x2,y);};
  const vLine = (x:number,y1:number,y2:number,lw=0.3,color:[number,number,number]=[180,185,200])=>{doc.setDrawColor(...color);doc.setLineWidth(lw);doc.line(x,y1,x,y2);};
  const rect  = (x:number,y:number,w:number,h:number,fill:[number,number,number],stroke?:[number,number,number])=>{doc.setFillColor(...fill);if(stroke){doc.setDrawColor(...stroke);doc.setLineWidth(0.4);doc.rect(x,y,w,h,'FD');}else doc.rect(x,y,w,h,'F');};
  const txt   = (text:string,x:number,y:number,opts:{size?:number;bold?:boolean;color?:[number,number,number];align?:'left'|'center'|'right';maxWidth?:number}={})=>{doc.setFontSize(opts.size??9);doc.setFont('helvetica',opts.bold?'bold':'normal');doc.setTextColor(...(opts.color??preto));doc.text(text,x,y,{align:opts.align??'left',maxWidth:opts.maxWidth});};

  const drawCabecalho = (pg:number,tot:number)=>{
    rect(ML,8,PW-ML-MR,30,azulEscuro);
    if(logoData)doc.addImage(logoData,'PNG',ML+2,10,38,13);else txt('TECOMAT ENGENHARIA',ML+3,18,{size:11,bold:true,color:branco});
    txt('ENSAIO DE ESCLEROMETRIA',PW/2,16,{size:13,bold:true,color:branco,align:'center'});
    txt('NBR 7584:2012',PW/2,22,{size:8,color:[200,210,230],align:'center'});
    rect(PW-MR-42,10,42,8,[0,20,70]);txt('Nº DO LAUDO',PW-MR-41,14.5,{size:6,bold:true,color:[180,190,215]});txt(rltOficial,PW-MR-21,17.5,{size:7.5,bold:true,color:branco,align:'center'});
    rect(PW-MR-42,20,42,8,[0,20,70]);txt('PÁGINA',PW-MR-41,24.5,{size:6,bold:true,color:[180,190,215]});txt(`${pg} / ${tot}`,PW-MR-21,27.5,{size:7.5,bold:true,color:branco,align:'center'});
    doc.setFillColor(200,160,32);doc.rect(ML,38,PW-ML-MR,1.2,'F');
  };
  const drawDadosObra=(startY:number):number=>{
    let y=startY;doc.setDrawColor(180,185,200);doc.setLineWidth(0.4);doc.rect(ML,y,PW-ML-MR,28,'S');
    rect(ML,y,PW-ML-MR,5.5,cinzaClaro);txt('DADOS DA OBRA E CLIENTE',ML+3,y+3.8,{size:7,bold:true,color:azulEscuro});hLine(y+5.5,ML,PW-MR,0.3,[180,185,200]);y+=7;
    txt('CLIENTE:',ML+2,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(cab.cliente||'—',ML+18,y+3.2,{size:8.5,maxWidth:110});txt('DATA DE EMISSÃO:',PW-MR-48,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(cab.data||'—',PW-MR-10,y+3.2,{size:8.5,align:'right'});hLine(y+5,ML,PW-MR,0.2,[220,223,230]);y+=5.5;
    txt('OBRA:',ML+2,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(cab.obra||'—',ML+18,y+3.2,{size:8.5,maxWidth:140});hLine(y+5,ML,PW-MR,0.2,[220,223,230]);y+=5.5;
    txt('A/C:',ML+2,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(cab.att||'—',ML+18,y+3.2,{size:8.5,maxWidth:55});vLine(ML+80,y,y+5,0.2,[220,223,230]);txt('ENDEREÇO:',ML+82,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(cab.endereco||'—',ML+100,y+3.2,{size:8.5,maxWidth:80});hLine(y+5,ML,PW-MR,0.2,[220,223,230]);y+=5.5;
    txt('NORMA:',ML+2,y+3.2,{size:7,bold:true,color:[80,90,120]});txt('NBR 7584:2012 — Concreto endurecido — Esclerômetro de reflexão',ML+18,y+3.2,{size:7.5,maxWidth:110});vLine(ML+135,y,y+5,0.2,[220,223,230]);txt('RESPONSÁVEL:',ML+137,y+3.2,{size:7,bold:true,color:[80,90,120]});txt(`${cab.respNome||'—'}  |  CREA: ${cab.respCrea||'—'}`,ML+158,y+3.2,{size:7.5,maxWidth:30,align:'right'});
    return startY+29;
  };
  const drawBigorna=(startY:number):number=>{
    let y=startY;doc.setDrawColor(180,185,200);doc.setLineWidth(0.4);doc.rect(ML,y,PW-ML-MR,20,'S');
    rect(ML,y,PW-ML-MR,5.5,cinzaClaro);txt('VERIFICAÇÃO DO APARELHO — ÍNDICE ESCLEROMÉTRICO DA BIGORNA',ML+3,y+3.8,{size:7,bold:true,color:azulEscuro});hLine(y+5.5,ML,PW-MR,0.3,[180,185,200]);y+=7;
    const gW=14,sX=ML+3;txt('GOLPE',sX,y+2.5,{size:6.5,bold:true,color:[80,90,120]});
    for(let i=0;i<10;i++)txt(`${i+1}°`,sX+18+i*gW,y+2.5,{size:7,bold:true,align:'center'});
    txt('MÉDIA',sX+18+10*gW+3,y+2.5,{size:7,bold:true});txt('COEF. CORREÇÃO',PW-MR-2,y+2.5,{size:7,bold:true,align:'right'});hLine(y+4,ML,PW-MR,0.2,[210,214,220]);y+=5;
    txt('VALOR',sX,y+2.5,{size:6.5,color:[80,90,120]});
    for(let i=0;i<10;i++){const v=cab.bigorna[i];const n=parseFloat(v.replace(',','.'));txt(isNaN(n)?'—':n.toFixed(1),sX+18+i*gW,y+2.5,{size:8,bold:true,align:'center'});}
    txt(mediaBigorna>0?mediaBigorna.toFixed(2):'—',sX+18+10*gW+3,y+2.5,{size:8,bold:true,color:azulEscuro});txt(coefBigorna!==1.0?coefBigorna.toFixed(6):'1,0000',PW-MR-2,y+2.5,{size:8,bold:true,color:azulEscuro,align:'right'});
    return startY+21;
  };
  const drawTabela=(startY:number,_pg:number,tot:number)=>{
    rect(ML,startY,PW-ML-MR,6,cinzaClaro);doc.setDrawColor(180,185,200);doc.setLineWidth(0.4);doc.rect(ML,startY,PW-ML-MR,6,'S');
    txt('RESULTADOS DE ENSAIO — Tabela 1: Estimativa da Resistência à Compressão Superficial (MPa)',ML+3,startY+4,{size:7,bold:true,color:azulEscuro});
    const linhas=amostras.map(a=>[String(a.item),a.amostra,a.posicao,fmt(a.limInf),fmt(a.limSup),fmt(a.ieMedio),a.status==='Amostra Válida'?'VÁLIDA':'PERDIDA',fmt(a.ieEfetivo),fmt(a.resistencia),a.dispersao]);
    autoTable(doc,{
      head:[['Nº','ELEMENTO','POSIÇÃO\nESCLERÔMETRO','LIM.\nINF.','LIM.\nSUP.','I.E.\nMÉDIO','STATUS','I.E. MÉDIO\nEFETIVO','RESIST. COMPR.\nESTIMADA (MPa)','DISP.\n(MPa)']],
      body:linhas,startY:startY+6,margin:{left:ML,right:MR},tableWidth:PW-ML-MR,
      styles:{fontSize:7.5,cellPadding:{top:2,bottom:2,left:1.5,right:1.5},font:'helvetica',textColor:preto,lineColor:[200,205,215],lineWidth:0.2,valign:'middle'},
      headStyles:{fillColor:azulEscuro,textColor:branco,fontStyle:'bold',fontSize:7,halign:'center',minCellHeight:10,valign:'middle'},
      alternateRowStyles:{fillColor:[247,249,253]},
      columnStyles:{0:{halign:'center',cellWidth:8},1:{cellWidth:42},2:{halign:'center',cellWidth:20},3:{halign:'center',cellWidth:14},4:{halign:'center',cellWidth:14},5:{halign:'center',cellWidth:14},6:{halign:'center',cellWidth:18},7:{halign:'center',cellWidth:18},8:{halign:'center',cellWidth:24},9:{halign:'center',cellWidth:14}},
      didParseCell:(data:any)=>{if(data.section==='body'&&data.column.index===6){const v=data.cell.raw as string;data.cell.styles.textColor=v==='VÁLIDA'?verdeOk:vermelhoPerdida;data.cell.styles.fontStyle='bold';}},
      didDrawPage:(_data:any)=>{const p=doc.getCurrentPageInfo().pageNumber;drawCabecalho(p,tot);doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(150,155,170);doc.text(`TECOMAT Engenharia  •  Ensaio de Esclerometria  •  ${rltOficial}`,PW/2,290,{align:'center'});hLine(288,ML,PW-MR,0.3,[200,205,215]);},
    });
    return (doc as any).lastAutoTable.finalY as number;
  };
  const drawRodape=(startY:number)=>{
    const avail=282-startY;if(avail<15){doc.addPage();startY=46;}
    doc.setDrawColor(180,185,200);doc.setLineWidth(0.4);doc.rect(ML,startY,PW-ML-MR,Math.min(avail-3,30),'S');
    rect(ML,startY,PW-ML-MR,5.5,cinzaClaro);txt('NOTAS / OBSERVAÇÕES',ML+3,startY+3.8,{size:7,bold:true,color:azulEscuro});hLine(startY+5.5,ML,PW-MR,0.3,[180,185,200]);
    let y=startY+8;
    if(cab.notas.trim()){const ln=doc.splitTextToSize(cab.notas,PW-ML-MR-4);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(0,0,0);doc.text(ln,ML+3,y);y+=ln.length*4+4;}
    const aX=PW-MR-70;vLine(aX,startY+5.5,startY+Math.min(avail-3,30),0.3,[180,185,200]);
    txt('RESPONSÁVEL TÉCNICO',aX+5,startY+9,{size:7,bold:true,color:[80,90,120]});hLine(startY+20,aX+3,PW-MR-3,0.5,[100,110,130]);
    txt(cab.respNome||'—',(aX+PW-MR)/2,startY+24,{size:8,bold:true,align:'center'});txt(`CREA: ${cab.respCrea||'—'}`,(aX+PW-MR)/2,startY+28,{size:7.5,align:'center',color:[80,90,120]});
  };
  const lpp1=Math.floor((282-46-29-21-6-10-30)/7.5);
  const lRest=amostras.length-lpp1;
  const pExt=lRest>0?Math.ceil(lRest/Math.floor((282-46-6)/7.5)):0;
  const tot=1+pExt;
  drawCabecalho(1,tot);
  let y=42;y=drawDadosObra(y)+3;y=drawBigorna(y)+3;
  const finalY=drawTabela(y,1,tot);drawRodape(finalY+4);
  doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(150,155,170);
  doc.text(`TECOMAT Engenharia  •  Ensaio de Esclerometria  •  ${rltOficial}`,PW/2,290,{align:'center'});
  hLine(288,ML,PW-MR,0.3,[200,205,215]);
  doc.save(`${rltOficial}.pdf`);
}
*/

export default function EsclerometriaPage() {
  const router = useRouter();
  const [userName,        setUserName]        = useState('');
  const [userEmail,       setUserEmail]       = useState('');
  const [userCargo,       setUserCargo]       = useState('');
  const [userCrea,        setUserCrea]        = useState('');
  const [userAssinatura,  setUserAssinatura]  = useState(''); // URL da assinatura salva no perfil
  const [aba, setAba] = useState<'cabecalho' | 'campo' | 'obra'>('cabecalho');

  const [cab, setCab] = useState<Cabecalho>({ rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '', bigorna: Array(10).fill('') });
  const [mediaBigorna, setMediaBigorna] = useState(0);
  const [coefBigorna,  setCoefBigorna]  = useState(1.0);

  // Bloco responsável técnico
  const [outroResp,        setOutroResp]        = useState(false);
  const [outroRespNome,    setOutroRespNome]    = useState('');
  const [outroRespCrea,    setOutroRespCrea]    = useState('');
  const [outroRespFile,    setOutroRespFile]    = useState<File | null>(null);
  const [outroRespPreview, setOutroRespPreview] = useState<string | null>(null);
  const outroAssinaturaRef = useRef<HTMLInputElement>(null);
  
  // Coordenadas para mapa
  const [coordenadas,   setCoordenadas]   = useState('');
  // Motivação
  const [usarMotivacao, setUsarMotivacao] = useState(false);
  const [motivacao,     setMotivacao]     = useState('');
  // Foto geral
  const [usarFotoGeral,    setUsarFotoGeral]    = useState(false);
  const [fotoGeralFile,    setFotoGeralFile]    = useState<File | null>(null);
  const [fotoGeralPreview, setFotoGeralPreview] = useState<string | null>(null);
  const fotoGeralRef = useRef<HTMLInputElement>(null);
  // Croqui
  const [usarCroqui,    setUsarCroqui]    = useState(false);
  const [croquiFile,    setCroquiFile]    = useState<File | null>(null);
  const [croquiPreview, setCroquiPreview] = useState<string | null>(null);
  const croquiRef = useRef<HTMLInputElement>(null);

  const [amostras,    setAmostras]    = useState<AmostraRow[]>([]);
  const [editandoId,  setEditandoId]  = useState<string | null>(null);
  const [nomeAmostra, setNomeAmostra] = useState('');
  const [posicao,     setPosicao]     = useState<Posicao>('0°');
  const [impactos,    setImpactos]    = useState<string[]>(Array(16).fill(''));
  const [gerandoDocx, setGerandoDocx] = useState(false);
  const [salvoMsg,    setSalvoMsg]    = useState('');

  // Modo Obra
  const [grupos,        setGrupos]        = useState<ObraGrupo[]>([]);
  const [grupoAtivoId,  setGrupoAtivoId]  = useState<string | null>(null);
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [pontNome,      setPontNome]      = useState('');
  const [pontPosicao,   setPontPosicao]   = useState<Posicao>('0°');
  const [pontImpactos,  setPontImpactos]  = useState<string[]>(Array(16).fill(''));
  const [pontEditId,    setPontEditId]    = useState<string | null>(null);
  const [obraSalvoMsg,  setObraSalvoMsg]  = useState('');
  const [showImportar,  setShowImportar]  = useState(false);

  const impactoRefs     = useRef<(HTMLInputElement | null)[]>([]);
  const pontImpactoRefs = useRef<(HTMLInputElement | null)[]>([]);

  const bigornaPronta = cab.bigorna.filter(v => v.trim() !== '' && !isNaN(parseFloat(v.replace(',', '.')))).length === 10;
  const totalPontos   = grupos.reduce((s, g) => s + g.pontos.length, 0);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? '');
      const m = user.user_metadata ?? {};
      setUserName(m.full_name ?? m.name ?? user.email ?? '');
      setUserCargo(m.cargo ?? '');
      setUserCrea(m.crea ?? '');
      setUserAssinatura(m.assinatura_url ?? '');
    });
  }, [router]);

  useEffect(() => { const s = carregarLocal(); if (!s) return; setCab(s.cab); setAmostras(s.amostras); recalcularBigorna(s.cab.bigorna); }, []);
  useEffect(() => { setGrupos(carregarGrupos()); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      salvarLocal(cab, amostras);
      setSalvoMsg('Salvo');
      const t2 = setTimeout(() => setSalvoMsg(''), 1800);
      return () => clearTimeout(t2);
    }, 500);
    return () => clearTimeout(t);
  }, [cab, amostras]);

  const handleSignOut = async () => { localStorage.removeItem(LS_KEY); const sb = createClient(); await sb.auth.signOut(); router.push('/login'); };

  const recalcularBigorna = useCallback((vals: string[]) => {
    const nums = vals.map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
    if (nums.length === 0) { setMediaBigorna(0); setCoefBigorna(1.0); return; }
    const media = nums.reduce((a, b) => a + b, 0) / nums.length;
    setMediaBigorna(media); setCoefBigorna(media > 0 ? 80 / media : 1.0);
  }, []);

  const setBigorna = (i: number, v: string) => {
    const novo = [...cab.bigorna]; novo[i] = v;
    setCab(c => ({ ...c, bigorna: novo })); recalcularBigorna(novo);
  };

  const processarAmostra = () => {
    if (!nomeAmostra.trim() || !impactos.some(v => v.trim())) return;
    if (editandoId) {
      setAmostras(prev => prev.map(a => a.id !== editandoId ? a : { ...calcularAmostra(nomeAmostra, posicao, impactos, coefBigorna, a.item), id: a.id, item: a.item }));
      setEditandoId(null);
    } else {
      const item = amostras.length > 0 ? amostras[amostras.length - 1].item + 1 : 1;
      setAmostras(prev => [...prev, calcularAmostra(nomeAmostra, posicao, impactos, coefBigorna, item)]);
    }
    setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°');
    impactoRefs.current[0]?.focus();
  };

  const carregarParaEdicao = (a: AmostraRow) => { setNomeAmostra(a.amostra); setPosicao(a.posicao); setImpactos([...a.impactosRaw, ...Array(16).fill('')].slice(0, 16)); setEditandoId(a.id); setAba('campo'); };
  const apagarAmostra = (id: string) => { setAmostras(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, item: i + 1 }))); if (editandoId === id) { setEditandoId(null); setNomeAmostra(''); setImpactos(Array(16).fill('')); } };
  const cancelarEdicao = () => { setEditandoId(null); setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°'); };

  const criarGrupo = () => {
    if (!novoGrupoNome.trim()) return;
    const g: ObraGrupo = { id: newId(), nome: novoGrupoNome.trim(), pontos: [], savedAt: new Date().toISOString() };
    const novos = [...grupos, g]; setGrupos(novos); salvarGrupos(novos);
    setGrupoAtivoId(g.id); setNovoGrupoNome('');
  };
  const removerGrupo = (id: string) => { const novos = grupos.filter(g => g.id !== id); setGrupos(novos); salvarGrupos(novos); if (grupoAtivoId === id) setGrupoAtivoId(null); };
  const atualizarGrupos = (novos: ObraGrupo[]) => { setGrupos(novos); salvarGrupos(novos); };

  const salvarPonto = () => {
    if (!grupoAtivoId || !pontNome.trim() || !pontImpactos.some(v => v.trim())) return;
    const novos = grupos.map(g => {
      if (g.id !== grupoAtivoId) return g;
      if (pontEditId) return { ...g, pontos: g.pontos.map(p => p.id === pontEditId ? { ...p, amostra: pontNome.trim(), posicao: pontPosicao, impactosRaw: pontImpactos } : p) };
      return { ...g, pontos: [...g.pontos, { id: newId(), amostra: pontNome.trim(), posicao: pontPosicao, impactosRaw: pontImpactos }] };
    });
    atualizarGrupos(novos);
    setPontNome(''); setPontImpactos(Array(16).fill('')); setPontPosicao('0°'); setPontEditId(null);
    setObraSalvoMsg(pontEditId ? 'Ponto atualizado!' : 'Ponto salvo!');
    setTimeout(() => setObraSalvoMsg(''), 2000);
    pontImpactoRefs.current[0]?.focus();
  };
  const editarPonto = (p: ObraPonto) => { setPontNome(p.amostra); setPontPosicao(p.posicao); setPontImpactos([...p.impactosRaw, ...Array(16).fill('')].slice(0, 16)); setPontEditId(p.id); };
  const removerPonto = (grupoId: string, pontoId: string) => { const novos = grupos.map(g => g.id !== grupoId ? g : { ...g, pontos: g.pontos.filter(p => p.id !== pontoId) }); atualizarGrupos(novos); if (pontEditId === pontoId) { setPontNome(''); setPontImpactos(Array(16).fill('')); setPontEditId(null); } };
  const cancelarEdicaoPonto = () => { setPontNome(''); setPontImpactos(Array(16).fill('')); setPontPosicao('0°'); setPontEditId(null); };

  const importarGrupo = (g: ObraGrupo) => {
    if (g.pontos.length === 0) return;
    let proximoItem = amostras.length > 0 ? amostras[amostras.length - 1].item + 1 : 1;
    const novas = g.pontos.map(p => { const r = calcularAmostra(p.amostra, p.posicao, p.impactosRaw, coefBigorna, proximoItem); proximoItem++; return r; });
    setAmostras(prev => [...prev, ...novas]);
    setShowImportar(false); setAba('campo');
  };

  const limparTudo = () => {
    if (!confirm('Apagar TODOS os dados e começar do zero?')) return;
    setCab({ rlt: '', data: '', cliente: '', obra: '', att: '', endereco: '', notas: '', bigorna: Array(10).fill('') });
    setAmostras([]); setCoefBigorna(1.0); setMediaBigorna(0);
    setNomeAmostra(''); setImpactos(Array(16).fill('')); setEditandoId(null);
    setOutroResp(false); setOutroRespNome(''); setOutroRespCrea('');
    setOutroRespFile(null); setOutroRespPreview(null);
    setCoordenadas('');
    setUsarMotivacao(false); setMotivacao('');
    setUsarFotoGeral(false); setFotoGeralFile(null); setFotoGeralPreview(null);
    setUsarCroqui(false); setCroquiFile(null); setCroquiPreview(null);
    localStorage.removeItem(LS_KEY);
  };

  const onlyNumbers = (v: string) => v.replace(/\D/g, '');
  const onlyDecimal = (v: string) => v.replace(/[^\d,.']/g, '');
  const maskData = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); if (d.length <= 2) return d; if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`; return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`; };

  const rltOficial = (() => { const n = cab.rlt.trim(); if (!n) return 'RLT.LAU-XXX.26-00'; if (/^\d+$/.test(n)) return `RLT.LAU-${n.padStart(3, '0')}.26-00`; return `RLT.LAU-${n}.26-00`; })();
  const initials = (() => { if (!userName) return userEmail.slice(0, 2).toUpperCase(); const p = userName.trim().split(/\s+/); return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase(); })();

  // Resolve dados do responsável (padrão = perfil; outro = campos manuais)
  const respNomeFinal = outroResp ? outroRespNome : userName;
  const respCreaFinal = outroResp ? outroRespCrea : userCrea;

  // Converte imagem "outro responsável" para base64 (se selecionada)
  const lerOutroRespBase64 = (): Promise<string> =>
    new Promise((resolve) => {
      if (!outroRespFile) { resolve(''); return; }
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(outroRespFile);
    });

  // Lê arquivo de imagem como base64 + dimensões (com compressão para reduzir payload)
  const lerImagemComDimensoes = (file: File | null | undefined): Promise<{ base64: string; width: number; height: number; contentType: string }> =>
    new Promise((resolve) => {
      if (!file) { resolve({ base64: '', width: 800, height: 600, contentType: 'image/jpeg' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          // Redimensiona para no máximo 1200px mantendo proporção
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          // JPEG com qualidade 0.82 para reduzir tamanho
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ base64: compressed.split(',')[1] ?? '', width, height, contentType: 'image/jpeg' });
        };
        img.onerror = () => resolve({ base64: dataUrl.split(',')[1] ?? '', width: 800, height: 600, contentType: file.type });
        img.src = dataUrl;
      };
      reader.onerror = () => resolve({ base64: '', width: 800, height: 600, contentType: file.type });
      reader.readAsDataURL(file);
    });

  // ── Gerar Laudo DOCX ────────────────────────────────────────────
  const gerarDocx = async () => {
    if (amostras.length === 0) { alert('Nenhuma amostra na tabela.'); return; }
    if (outroResp && !outroRespNome.trim()) { alert('Informe o nome do responsável.'); return; }
    setGerandoDocx(true);
    try {
      // Assinatura: "outro" usa arquivo local (base64); padrão usa URL do perfil
      let respAssinaturaBase64 = '';
      let respAssinaturaContentType = 'image/png';
      if (outroResp && outroRespFile) {
        respAssinaturaBase64    = await lerOutroRespBase64();
        respAssinaturaContentType = outroRespFile.type;
      }
      // Se padrão, a URL do perfil é enviada para a route buscar server-side
      const respAssinaturaUrl = (!outroResp && userAssinatura) ? userAssinatura : '';

      const payload = {
        rlt: cab.rlt,
        data: cab.data,
        cliente: cab.cliente,
        obra: cab.obra,
        att: cab.att,
        endereco: cab.endereco,
        coordenadas: coordenadas.trim() || undefined,
        respNome: respNomeFinal,
        respCrea: respCreaFinal,
        respAssinaturaUrl,
        respAssinaturaBase64,
        respAssinaturaContentType,
        notas: cab.notas,
        bigorna: cab.bigorna,
        mediaBigorna,
        coefBigorna,
        // Motivação
        motivacao: usarMotivacao ? motivacao : undefined,
        // Foto geral
        ...(usarFotoGeral && fotoGeralFile ? await (async () => {
          const r = await lerImagemComDimensoes(fotoGeralFile);
          return { fotoGeralBase64: r.base64, fotoGeralContentType: r.contentType, fotoGeralWidth: r.width, fotoGeralHeight: r.height };
        })() : {}),
        // Croqui
        ...(usarCroqui && croquiFile ? await (async () => {
          const r = await lerImagemComDimensoes(croquiFile);
          return { croquiBase64: r.base64, croquiContentType: r.contentType, croquiWidth: r.width, croquiHeight: r.height };
        })() : {}),
        // Amostras (apenas válidas) + fotos do memorial
        amostras: await Promise.all(
          amostras
            .filter(a => a.status === 'Amostra Válida')
            .map(async (a, i) => {
              const base: Record<string, unknown> = {
                item: i + 1,
                amostra: a.amostra,
                posicao: a.posicao,
                ie_medio: fmt(a.ieMedio),
                ie_efetivo: fmt(a.ieEfetivo),
                resistencia: fmt(a.resistencia),
                dispersao: a.dispersao,
              };
              if (a.fotoFile) {
                const r = await lerImagemComDimensoes(a.fotoFile);
                base.fotoBase64 = r.base64;
                base.fotoContentType = r.contentType;
                base.fotoWidth = r.width;
                base.fotoHeight = r.height;
              }
              return base;
            })
        ),
      };

      const res = await fetch('/api/ensaios/esclerometria/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rltOficial}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erro ao gerar DOCX.');
    } finally {
      setGerandoDocx(false);
    }
  };


  const fmtData  = (iso: string) => { try { const d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

  return (
    <div style={{ backgroundColor: BG, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; border-color: ${PRIMARY} !important; box-shadow: 0 0 0 3px rgba(30,50,100,0.07); }
        .tab-icon { display: none; }
        .tab-label-full { display: inline; }
        .tab-label-short { display: none; }
        .tab-btn { transition: all 0.15s; border: none; background: transparent; }
        .tab-btn:hover { opacity: 0.8; }
        .row-h:hover { background: #F3F5FB !important; }
        .icon-btn:hover { filter: brightness(0.88); }
        .btn-pri:hover { box-shadow: 0 4px 16px rgba(30,50,100,0.3) !important; }
        .btn-gold:hover { background: #b08c18 !important; }
        .num-in:focus { border-color: ${PRIMARY} !important; background: #F0F4FC !important; }
        .ponto-row:hover { background: #F3F5FB !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Sem scroll horizontal ── */
        html, body { overflow-x: hidden; max-width: 100vw; }

        /* ── Mobile ── */
        @media (max-width: 600px) {
          /* Header */
          .header-root { padding: 0 12px !important; flex-wrap: nowrap !important; }
          .header-left { gap: 10px !important; flex-shrink: 1; min-width: 0; overflow: hidden; }
          .header-right { gap: 4px !important; flex-shrink: 0; }
          .header-user-name { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .header-cargo { display: none !important; }
          .header-divider { display: none !important; }
          .signout-text { display: none; }
          .sb-u { padding: 6px 8px !important; }
          /* Main padding */
          .main-esclero { padding: 16px 14px !important; }
          /* Page title area */
          .page-title-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .page-action-btns { width: 100%; display: flex; gap: 8px; }
          .page-action-btns button { flex: 1; justify-content: center; }
          /* Abas — Mobile: 3 blocos iguais com ícone + texto curto */
          .tabs-row { background: #F1F3F8; padding: 6px 6px 0; gap: 4px !important; border-bottom: none !important; border-radius: 10px 10px 0 0; }
          .tab-btn { flex: 1; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 4px !important; padding: 10px 4px 8px !important; font-size: 11px !important; white-space: nowrap; border-radius: 8px 8px 0 0 !important; background: rgba(255,255,255,0.6) !important; border-bottom: 3px solid transparent !important; margin-bottom: 0 !important; }
          .tab-btn.tab-ativo { background: #fff !important; opacity: 1 !important; border-bottom: 4px solid currentColor !important; }
          .tab-icon { display: block !important; }
          .tab-label-full { display: none !important; }
          .tab-label-short { display: block !important; }
          /* Section padding */
          .section-pad { padding: 16px 14px !important; }
          /* Grids */
          .grid-rlt { grid-template-columns: 1fr 1fr !important; }
          .grid-obra-atts { grid-template-columns: 1fr !important; }
          .grid-outro-resp { grid-template-columns: 1fr !important; }
          .grid-imposto-id { grid-template-columns: 1fr !important; }
          /* Bigorna stats */
          .bigorna-stats { flex-direction: column !important; }
          .bigorna-stats > div { border-left: none !important; border-top: 1px solid #E8EAF0 !important; }
          .bigorna-stats > div:first-child { border-top: none !important; }
          /* Tabela resultados */
          .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          /* Impactos grid */
          .impactos-wrap input { width: 44px !important; }
          /* Botões ação */
          .action-btns-row { flex-wrap: wrap !important; }
          /* Modo Obra grupo header */
          .grupo-header { flex-wrap: wrap !important; gap: 8px !important; }
        }
        @media (max-width: 400px) {
          .impactos-wrap input { width: 38px !important; padding: 6px 2px !important; font-size: 12px !important; }
          .num-bigorna { width: 44px !important; }
        }
      `}</style>

      <Header displayName={userName || userEmail} initials={initials} cargo={userCargo} onSignOut={handleSignOut} />

      {showImportar && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowImportar(false); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(30,50,100,0.35)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ backgroundColor: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(30,50,100,0.18)', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: TEXT }}>Importar do Modo Obra</h2>
            </div>
            <p style={{ margin: '0 0 16px 16px', fontSize: 12, color: SUBTEXT }}>
              Coeficiente de bigorna: <strong style={{ color: PRIMARY }}>{coefBigorna.toFixed(4)}</strong> — será aplicado em todos os pontos.
            </p>
            {grupos.filter(g => g.pontos.length > 0).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: SUBTEXT }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Nenhum grupo com pontos na fila</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grupos.filter(g => g.pontos.length > 0).map(g => (
                  <div key={g.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: TEXT }}>{g.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>{g.pontos.length} ponto{g.pontos.length !== 1 ? 's' : ''} · {fmtData(g.savedAt)}</p>
                      </div>
                      <button onClick={() => importarGrupo(g)} style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: PRIMARY, color: '#fff', border: 'none' }}>
                        Importar todos ({g.pontos.length}) →
                      </button>
                    </div>
                    {g.pontos.map((p, pi) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: pi < g.pontos.length - 1 ? `1px solid ${BORDER}` : 'none', background: '#fff' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, width: 18, textAlign: 'center' }}>{pi + 1}</span>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.amostra}</p>
                        <span style={{ fontSize: 11, color: SUBTEXT, flexShrink: 0 }}>{p.posicao} · {p.impactosRaw.filter(v => v.trim()).length} golpes</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowImportar(false)} style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <main className="main-esclero" style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <a href="/dashboard" style={{ fontSize: 12, color: SUBTEXT, textDecoration: 'none' }}>Ensaios</a>
            <span style={{ fontSize: 12, color: SUBTEXT }}>›</span>
            <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 700 }}>Esclerometria</span>
          </div>
          <div className="page-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ensaio</p>
              <h1 style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 800, color: TEXT }}>Esclerometria</h1>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: SUBTEXT }}>NBR 7584:2012 — Concreto endurecido</p>
            </div>
            <div className="page-action-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {salvoMsg && <span style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>{salvoMsg}</span>}
              <button onClick={limparTudo} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>🗑 Limpar Tudo</button>
              <button
                onClick={gerarDocx}
                disabled={gerandoDocx || amostras.length === 0}
                className="btn-gold"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', borderRadius: 7,
                  fontSize: 13, fontWeight: 700,
                  cursor: amostras.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  backgroundColor: GOLD, color: PRIMARY,
                  border: 'none',
                  opacity: amostras.length === 0 ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                {gerandoDocx ? 'Gerando…' : 'Gerar relatório'}
              </button>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="tabs-row" style={{ display: 'flex', borderBottom: `2px solid ${BORDER}`, marginBottom: 0 }}>

          {/* Aba 1 — Cabeçalho */}
          <button
            className={`tab-btn${aba === 'cabecalho' ? ' tab-ativo' : ''}`}
            onClick={() => setAba('cabecalho')}
            style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              color: aba === 'cabecalho' ? PRIMARY : SUBTEXT,
              borderBottom: aba === 'cabecalho' ? `3px solid ${GOLD}` : '3px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {/* Ícone — só visível no mobile via CSS */}
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'cabecalho' ? '#1A2B56' : SUBTEXT }}>
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <span className="tab-label-full">1. Cabeçalho e Aparelho</span>
            <span className="tab-label-short" style={{ color: aba === 'cabecalho' ? '#1A2B56' : SUBTEXT, fontWeight: 700, fontSize: 11 }}>Cabeçalho</span>
          </button>

          {/* Aba 2 — Dados de Campo */}
          <button
            className={`tab-btn${aba === 'campo' ? ' tab-ativo' : ''}`}
            onClick={() => bigornaPronta ? setAba('campo') : undefined}
            title={!bigornaPronta ? 'Preencha os 10 golpes da bigorna para liberar' : undefined}
            style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 700,
              cursor: bigornaPronta ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              color: aba === 'campo' ? PRIMARY : bigornaPronta ? SUBTEXT : '#C0C8D8',
              borderBottom: aba === 'campo' ? `3px solid ${GOLD}` : '3px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
              opacity: bigornaPronta ? 1 : 0.55,
            }}
          >
            {/* Ícone mobile */}
            {bigornaPronta
              ? <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'campo' ? '#1A2B56' : SUBTEXT }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              : <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            }
            {/* Cadeado desktop — só quando bloqueado */}
            {!bigornaPronta && <svg className="tab-icon-lock-desktop" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
            <span className="tab-label-full" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {!bigornaPronta && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              2. Dados de Campo{amostras.length > 0 ? ` (${amostras.length})` : ''}
            </span>
            <span className="tab-label-short" style={{ color: aba === 'campo' ? '#1A2B56' : SUBTEXT, fontWeight: 700, fontSize: 11 }}>Dados</span>
          </button>

          {/* Aba 3 — Modo Obra */}
          <button
            className={`tab-btn${aba === 'obra' ? ' tab-ativo' : ''}`}
            onClick={() => setAba('obra')}
            style={{
              padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              color: aba === 'obra' ? GREEN : SUBTEXT,
              borderBottom: aba === 'obra' ? `3px solid ${GREEN}` : '3px solid transparent',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {/* Capacete de obra */}
            <svg className="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: aba === 'obra' ? GREEN : SUBTEXT }}>
              <path d="M2 20h20"/><path d="M6 20v-4a6 6 0 0 1 12 0v4"/><path d="M12 4v4"/><path d="M4 12a8 8 0 0 1 16 0"/>
            </svg>
            <span className="tab-label-full" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              3. Modo Obra
              {totalPontos > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', fontSize: 10, fontWeight: 800, background: aba === 'obra' ? GREEN : SUBTEXT, color: '#fff' }}>{totalPontos}</span>}
            </span>
            <span className="tab-label-short" style={{ color: aba === 'obra' ? GREEN : SUBTEXT, fontWeight: 700, fontSize: 11 }}>
              Obra{totalPontos > 0 ? ` (${totalPontos})` : ''}
            </span>
          </button>

        </div>

        {/* ABA 1 */}
        {aba === 'cabecalho' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="section-pad" style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dados da Obra e Cliente</h3>
              <div className="grid-rlt" style={{ display: 'grid', gridTemplateColumns: '140px 150px 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Nº do RLT"><input style={inputStyle} inputMode="numeric" value={cab.rlt} onChange={e => setCab(c => ({ ...c, rlt: onlyNumbers(e.target.value) }))} placeholder="Ex: 42" maxLength={6} /></Campo>
                <Campo label="Data de Emissão"><input style={inputStyle} inputMode="numeric" value={cab.data} onChange={e => setCab(c => ({ ...c, data: maskData(e.target.value) }))} placeholder="DD/MM/AAAA" maxLength={10} /></Campo>
                <Campo label="Cliente"><input style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.cliente} onChange={e => setCab(c => ({ ...c, cliente: e.target.value.toUpperCase() }))} placeholder="NOME DO CLIENTE" /></Campo>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                <Campo label="Obra"><input style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.obra} onChange={e => setCab(c => ({ ...c, obra: e.target.value.toUpperCase() }))} placeholder="DESCRIÇÃO DA OBRA" /></Campo>
                <Campo label="A/C (Att.)"><input style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.att} onChange={e => setCab(c => ({ ...c, att: e.target.value.toUpperCase() }))} placeholder="A/C DE…" /></Campo>
              </div>
              <Campo label="Endereço"><input style={{ ...inputStyle, textTransform: 'uppercase' }} value={cab.endereco} onChange={e => setCab(c => ({ ...c, endereco: e.target.value.toUpperCase() }))} placeholder="ENDEREÇO COMPLETO DA OBRA" /></Campo>
              <Campo label="Coordenadas GPS (opcional — prioridade sobre endereço no mapa)">
                <input
                  style={inputStyle}
                  value={coordenadas}
                  onChange={e => setCoordenadas(e.target.value)}
                  placeholder="Ex: -8.0522,-34.9286"
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: SUBTEXT }}>Se preenchido, o pino do mapa será posicionado nas coordenadas informadas.</p>
              </Campo>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Verificação do Aparelho — 10 Golpes na Bigorna</h3>
                {bigornaPronta
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: SUCCESS, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Completo — Dados de Campo liberados</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT }}>Preencha os 10 golpes para liberar a aba Dados de Campo</span>}
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: SUBTEXT }}>Índice de referência: <strong>IE = 80</strong>. O coeficiente de correção é calculado automaticamente.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {cab.bigorna.map((v, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}°</span>
                    <input type="text" inputMode="decimal" value={v} onChange={e => setBigorna(i, onlyDecimal(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); (document.querySelectorAll('.bigorna-input')[i + 1] as HTMLElement)?.focus(); } else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); (document.querySelectorAll('.bigorna-input')[i - 1] as HTMLElement)?.focus(); } else if (e.key === 'Enter') { e.preventDefault(); (document.querySelectorAll('.bigorna-input')[i + 1] as HTMLElement)?.focus(); } }}
                      style={{ width: 52, textAlign: 'center', padding: '7px 4px', border: `1.5px solid ${v ? PRIMARY + '55' : BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: TEXT, background: v ? '#F0F4FC' : '#fff', outline: 'none', transition: 'all 0.1s' }}
                      className="num-in bigorna-input" />
                  </div>
                ))}
              </div>
              <div className="bigorna-stats" style={{ display: 'flex', gap: 0, background: '#F0F4FC', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                {[{ label: 'Média dos Golpes', value: mediaBigorna > 0 ? mediaBigorna.toFixed(2) : '—', highlight: false }, { label: 'Coef. de Correção (80 / Média)', value: coefBigorna !== 1.0 ? coefBigorna.toFixed(6) : coefBigorna.toFixed(4), highlight: coefBigorna !== 1.0 }, { label: 'IE de Referência', value: '80,00', highlight: false }].map((item, i) => (
                  <div key={i} style={{ flex: 1, padding: '14px 20px', borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: item.highlight ? GOLD : PRIMARY }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Responsável Técnico</h3>

              {/* Bloco padrão — dados do perfil */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                padding: '14px 16px', borderRadius: 10,
                background: outroResp ? '#F8F9FA' : '#F0F4FC',
                border: `1.5px solid ${outroResp ? BORDER : PRIMARY + '44'}`,
                marginBottom: 14, opacity: outroResp ? 0.5 : 1,
                transition: 'all 0.2s',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Engenheiro Responsável TECOMAT</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: TEXT }}>{userName || <span style={{ color: SUBTEXT }}>—</span>}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>CREA</p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: userCrea ? TEXT : SUBTEXT }}>{userCrea || 'Não cadastrado'}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Assinatura</p>
                  {userAssinatura
                    ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={userAssinatura} alt="Assinatura" style={{ maxHeight: 40, maxWidth: 200, objectFit: 'contain', marginTop: 6, display: 'block' }} />
                    )
                    : <p style={{ margin: '4px 0 0', fontSize: 12, color: SUBTEXT }}>Não cadastrada — <a href="/usuarios" style={{ color: PRIMARY, textDecoration: 'underline' }}>cadastrar no perfil</a></p>
                  }
                </div>
              </div>

              {/* Checkbox outro responsável */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginBottom: outroResp ? 14 : 0 }}>
                <input
                  type="checkbox"
                  checked={outroResp}
                  onChange={e => {
                    setOutroResp(e.target.checked);
                    if (!e.target.checked) { setOutroRespNome(''); setOutroRespCrea(''); setOutroRespFile(null); setOutroRespPreview(null); }
                  }}
                  style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: outroResp ? PRIMARY : SUBTEXT }}>
                  Outro responsável para este relatório
                </span>
              </label>

              {/* Campos expandidos quando "outro responsável" marcado */}
              {outroResp && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 14,
                  padding: '16px', borderRadius: 10,
                  background: '#F0F4FC',
                  border: `1.5px solid ${PRIMARY}44`,
                  animation: 'fadeIn 0.15s ease',
                }}>
                  <div className="grid-outro-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>
                    <Campo label="Engenheiro Responsável TECOMAT">
                      <input
                        style={inputStyle}
                        value={outroRespNome}
                        onChange={e => setOutroRespNome(e.target.value)}
                        placeholder="Nome completo do engenheiro"
                      />
                    </Campo>
                    <Campo label="CREA">
                      <input
                        style={inputStyle}
                        value={outroRespCrea}
                        onChange={e => setOutroRespCrea(e.target.value)}
                        placeholder="Nº CREA"
                      />
                    </Campo>
                  </div>

                  <Campo label="Imagem da Assinatura">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        ref={outroAssinaturaRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setOutroRespFile(f);
                          setOutroRespPreview(URL.createObjectURL(f));
                        }}
                      />
                      <button
                        onClick={() => outroAssinaturaRef.current?.click()}
                        style={{
                          padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}`,
                        }}
                      >
                        {outroRespPreview ? '↻ Trocar imagem' : '📁 Selecionar assinatura'}
                      </button>
                      {outroRespPreview && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={outroRespPreview} alt="Prévia" style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 4, background: '#fff' }} />
                          <button
                            onClick={() => { setOutroRespFile(null); setOutroRespPreview(null); if (outroAssinaturaRef.current) outroAssinaturaRef.current.value = ''; }}
                            style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: SUBTEXT }}>PNG com fundo transparente recomendado · não será salva no perfil</p>
                  </Campo>
                </div>
              )}
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Conteúdo Opcional do Relatório</h3>

              {/* Motivação */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginBottom: usarMotivacao ? 12 : 0 }}>
                  <input type="checkbox" checked={usarMotivacao} onChange={e => { setUsarMotivacao(e.target.checked); if (!e.target.checked) setMotivacao(''); }} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: usarMotivacao ? PRIMARY : SUBTEXT }}>Incluir motivação do ensaio</span>
                </label>
                {usarMotivacao && (
                  <div style={{ animation: 'fadeIn 0.15s ease' }}>
                    <textarea
                      value={motivacao}
                      onChange={e => setMotivacao(e.target.value)}
                      rows={3}
                      placeholder="Descreva a motivação do ensaio…"
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                )}
              </div>

              {/* Foto geral */}
              <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginBottom: usarFotoGeral ? 12 : 0 }}>
                  <input type="checkbox" checked={usarFotoGeral} onChange={e => { setUsarFotoGeral(e.target.checked); if (!e.target.checked) { setFotoGeralFile(null); setFotoGeralPreview(null); if (fotoGeralRef.current) fotoGeralRef.current.value = ''; } }} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: usarFotoGeral ? PRIMARY : SUBTEXT }}>Incluir foto geral da estrutura (Figura 2)</span>
                </label>
                {usarFotoGeral && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', animation: 'fadeIn 0.15s ease' }}>
                    <input ref={fotoGeralRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setFotoGeralFile(f); setFotoGeralPreview(URL.createObjectURL(f)); }} />
                    <button onClick={() => fotoGeralRef.current?.click()} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}` }}>
                      {fotoGeralPreview ? '↻ Trocar foto' : '📁 Selecionar foto geral'}
                    </button>
                    {fotoGeralPreview && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotoGeralPreview} alt="Prévia foto geral" style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 4, background: '#fff' }} />
                        <button onClick={() => { setFotoGeralFile(null); setFotoGeralPreview(null); if (fotoGeralRef.current) fotoGeralRef.current.value = ''; }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>Remover</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Croqui */}
              <div style={{ paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginBottom: usarCroqui ? 12 : 0 }}>
                  <input type="checkbox" checked={usarCroqui} onChange={e => { setUsarCroqui(e.target.checked); if (!e.target.checked) { setCroquiFile(null); setCroquiPreview(null); if (croquiRef.current) croquiRef.current.value = ''; } }} style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: usarCroqui ? PRIMARY : SUBTEXT }}>Incluir croqui com indicação dos elementos (Figura 3)</span>
                </label>
                {usarCroqui && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', animation: 'fadeIn 0.15s ease' }}>
                    <input ref={croquiRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; setCroquiFile(f); setCroquiPreview(URL.createObjectURL(f)); }} />
                    <button onClick={() => croquiRef.current?.click()} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#EEF1F8', color: PRIMARY, border: `1px solid ${BORDER}` }}>
                      {croquiPreview ? '↻ Trocar croqui' : '📁 Selecionar croqui'}
                    </button>
                    {croquiPreview && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={croquiPreview} alt="Prévia croqui" style={{ maxHeight: 60, maxWidth: 200, objectFit: 'contain', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 4, background: '#fff' }} />
                        <button onClick={() => { setCroquiFile(null); setCroquiPreview(null); if (croquiRef.current) croquiRef.current.value = ''; }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#FFF0EE', color: DANGER, border: `1px solid #FADADD` }}>Remover</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notas / Observações</h3>
              <textarea value={cab.notas} onChange={e => setCab(c => ({ ...c, notas: e.target.value }))} rows={3} placeholder="Observações gerais sobre o ensaio…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => bigornaPronta ? setAba('campo') : undefined} disabled={!bigornaPronta} className="btn-pri" title={!bigornaPronta ? 'Preencha os 10 golpes da bigorna primeiro' : undefined} style={{ padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: bigornaPronta ? 'pointer' : 'not-allowed', fontFamily: 'inherit', backgroundColor: bigornaPronta ? PRIMARY : '#C0C8D8', color: '#fff', border: 'none', boxShadow: bigornaPronta ? '0 2px 8px rgba(30,50,100,0.2)' : 'none', transition: 'all 0.15s' }}>
                {bigornaPronta ? 'Avançar para Dados de Campo →' : '🔒 Preencha a bigorna para avançar'}
              </button>
            </div>
          </div>
        )}

        {/* ABA 2 */}
        {aba === 'campo' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section style={{ background: '#fff', border: `1px solid ${editandoId ? GOLD : BORDER}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: editandoId ? '#8B6914' : PRIMARY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{editandoId ? '✎  Editando Amostra' : '+  Inserir Nova Amostra'}</h3>
                {grupos.filter(g => g.pontos.length > 0).length > 0 && !editandoId && (
                  <button onClick={() => setShowImportar(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: GREEN_LIGHT, color: GREEN, border: `1.5px solid ${GREEN_BORDER}` }}>
                    Importar do Modo Obra ({grupos.reduce((s, g) => s + g.pontos.length, 0)})
                  </button>
                )}
              </div>
              <div className="grid-imposto-id" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 16 }}>
                <Campo label="Identificação da amostra (ex: P1 - Pilar Térreo)"><input style={inputStyle} value={nomeAmostra} onChange={e => setNomeAmostra(e.target.value)} placeholder="Ex: V1 - Viga Piso 2, P3 - Pilar Térreo…" onKeyDown={e => e.key === 'Enter' && impactoRefs.current[0]?.focus()} /></Campo>
                <Campo label="Posição do Esclerômetro">
                  <div style={{ display: 'flex', gap: 6 }}>
                    {POSICOES.map(p => <button key={p} onClick={() => setPosicao(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', backgroundColor: posicao === p ? PRIMARY : '#F0F2F8', color: posicao === p ? '#fff' : SUBTEXT, border: `2px solid ${posicao === p ? PRIMARY : 'transparent'}` }}>{p}</button>)}
                  </div>
                </Campo>
              </div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impactos (máx. 16) — filtro automático ±10% da média bruta — mínimo 5 válidos</p>
                <div className="impactos-wrap" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {impactos.map((v, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}</span>
                      <input ref={el => { impactoRefs.current[i] = el; }} type="text" inputMode="decimal" value={v}
                        onChange={e => { const n = [...impactos]; n[i] = onlyDecimal(e.target.value); setImpactos(n); }}
                        onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const nx = impactoRefs.current[i + 1]; if (nx) nx.focus(); else processarAmostra(); } else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); const pv = impactoRefs.current[i - 1]; if (pv) pv.focus(); } else if (e.key === 'Enter') { e.preventDefault(); const nx = impactoRefs.current[i + 1]; if (nx) nx.focus(); else processarAmostra(); } }}
                        style={{ width: 52, textAlign: 'center', padding: '7px 4px', border: `1.5px solid ${v ? PRIMARY + '55' : BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: TEXT, background: v ? '#F0F4FC' : '#fff', outline: 'none', transition: 'all 0.1s' }}
                        onFocus={e => { e.target.style.borderColor = PRIMARY; e.target.style.background = '#E8EFFE'; }}
                        onBlur={e => { e.target.style.borderColor = v ? PRIMARY + '55' : BORDER; e.target.style.background = v ? '#F0F4FC' : '#fff'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={processarAmostra} disabled={!nomeAmostra.trim()} className="btn-pri" style={{ padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: nomeAmostra.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', backgroundColor: editandoId ? GOLD : PRIMARY, color: editandoId ? PRIMARY : '#fff', border: 'none', opacity: nomeAmostra.trim() ? 1 : 0.5 }}>{editandoId ? '✓ Salvar Alterações' : '+ Calcular e Adicionar'}</button>
                {editandoId && <button onClick={cancelarEdicao} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Cancelar</button>}
                <button onClick={() => { setNomeAmostra(''); setImpactos(Array(16).fill('')); setPosicao('0°'); }} style={{ padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Limpar Campos</button>
              </div>
            </section>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(30,50,100,0.06)' }}>
              <div className="table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 96px 62px 62px 62px 110px 76px 110px 64px 60px 72px', padding: '11px 16px', background: EXCEL_BLUE, minWidth: 820 }}>
                {['#','ELEMENTO','POSIÇÃO','LIM. INF.','LIM. SUP.','I.E. MÉDIO','STATUS','I.E. EFETIVO','RESIST. (MPa)','DISP.','FOTO','AÇÕES'].map(h => <span key={h} style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{h}</span>)}
              </div>
              {amostras.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: SUBTEXT }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>⬡</div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhuma amostra inserida</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>Preencha o formulário acima para adicionar a primeira amostra</p>
                </div>
              ) : amostras.map((a, idx) => {
                const valida = a.status === 'Amostra Válida', editing = editandoId === a.id;
                return (
                  <div key={a.id} className="row-h" style={{ display: 'grid', gridTemplateColumns: '36px 1fr 96px 62px 62px 62px 110px 76px 110px 64px 60px 72px', padding: '11px 16px', borderBottom: idx < amostras.length - 1 ? `1px solid ${BORDER}` : 'none', alignItems: 'center', background: editing ? '#FFFBEC' : idx % 2 === 1 ? '#F8F9FC' : '#fff', opacity: valida ? 1 : 0.72, transition: 'background 0.1s', minWidth: 820 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: SUBTEXT, textAlign: 'center' }}>{a.item}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, paddingRight: 8 }}>{a.amostra}</span>
                    <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{a.posicao}</span>
                    <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.limInf)}</span>
                    <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.limSup)}</span>
                    <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{fmt(a.ieMedio)}</span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><StatusBadge status={a.status} /></div>
                    <span style={{ fontSize: 12, fontWeight: valida ? 700 : 400, color: valida ? PRIMARY : SUBTEXT, textAlign: 'center' }}>{fmt(a.ieEfetivo)}</span>
                    <span style={{ fontSize: 13, fontWeight: valida ? 800 : 400, color: valida ? TEXT : SUBTEXT, textAlign: 'center' }}>{fmt(a.resistencia)}</span>
                    <span style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>{a.dispersao}</span>
                    {/* Coluna foto memorial */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <label title={a.fotoFile ? `Foto: ${a.fotoFile.name}` : 'Adicionar foto para o memorial'} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: a.fotoFile ? '#E8F5EE' : '#F0F2F8', border: `1.5px solid ${a.fotoFile ? SUCCESS : BORDER}`, position: 'relative' }}>
                        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const preview = URL.createObjectURL(f);
                          const img = new window.Image();
                          img.onload = () => {
                            setAmostras(prev => prev.map(am => am.id !== a.id ? am : { ...am, fotoFile: f, fotoPreview: preview, fotoWidth: img.width, fotoHeight: img.height }));
                          };
                          img.src = preview;
                        }} />
                        {a.fotoFile
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={SUCCESS} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={SUBTEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        }
                      </label>
                      {a.fotoFile && (
                        <button title="Remover foto" onClick={() => setAmostras(prev => prev.map(am => am.id !== a.id ? am : { ...am, fotoFile: null, fotoPreview: null, fotoWidth: undefined, fotoHeight: undefined }))} style={{ marginLeft: 2, width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                      <button className="icon-btn" title="Editar" aria-label="Editar amostra" onClick={() => carregarParaEdicao(a)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button className="icon-btn" title="Apagar" aria-label="Apagar amostra" onClick={() => { if (confirm(`Apagar "${a.amostra}"?`)) apagarAmostra(a.id); }} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                    </div>
                  </div>
                );
              })}

              </div>{/* /table-wrapper */}
            </section>
          </div>
        )}

        {/* ABA 3 */}
        {aba === 'obra' && (
          <div style={{ paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: GREEN_LIGHT, border: `1.5px solid ${GREEN_BORDER}`, borderRadius: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: GREEN }}>Modo Obra — Registro rápido em campo</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#4A7A54', lineHeight: 1.5 }}>Crie grupos de ensaio (por obra/visita) e adicione pontos. Na aba <strong>Dados de Campo</strong>, importe um grupo inteiro com o coeficiente de bigorna aplicado automaticamente.</p>
              </div>
            </div>

            <section style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 24px', boxShadow: '0 1px 4px rgba(30,50,100,0.04)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 800, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Novo Grupo de Ensaio</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} placeholder="Ex: Edifício Central — Visita 07/05" onKeyDown={e => e.key === 'Enter' && criarGrupo()} />
                <button onClick={criarGrupo} disabled={!novoGrupoNome.trim()} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: novoGrupoNome.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: GREEN, color: '#fff', border: 'none', opacity: novoGrupoNome.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>+ Criar Grupo</button>
              </div>
            </section>

            {grupos.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: SUBTEXT, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.15 }}>📋</div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nenhum grupo criado</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>Crie um grupo acima para começar a registrar pontos</p>
              </div>
            ) : grupos.map(g => {
              const ativo = grupoAtivoId === g.id;
              return (
                <section key={g.id} style={{ background: '#fff', border: `1.5px solid ${ativo ? GREEN : BORDER}`, borderRadius: 12, overflow: 'hidden', boxShadow: ativo ? `0 0 0 3px ${GREEN}22` : '0 1px 4px rgba(30,50,100,0.04)', transition: 'border-color 0.15s' }}>
                  {/* Cabeçalho grupo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: ativo ? '#F0FFF4' : '#F8F9FA', borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setGrupoAtivoId(ativo ? null : g.id)}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: ativo ? GREEN : '#EEF1F8', color: ativo ? '#fff' : SUBTEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{ativo ? '▾' : '▸'}</div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: ativo ? GREEN : TEXT }}>{g.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: SUBTEXT }}>{g.pontos.length} ponto{g.pontos.length !== 1 ? 's' : ''} · {fmtData(g.savedAt)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setGrupoAtivoId(ativo ? null : g.id)} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: ativo ? GREEN : '#EEF1F8', color: ativo ? '#fff' : PRIMARY, border: 'none' }}>{ativo ? 'Fechar' : 'Editar pontos'}</button>
                      <button aria-label="Remover grupo" onClick={() => { if (confirm(`Apagar grupo "${g.nome}" e todos os seus pontos?`)) removerGrupo(g.id); }} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                    </div>
                  </div>

                  {/* Pontos existentes */}
                  {g.pontos.map((p, pi) => (
                    <div key={p.id} className="ponto-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: `1px solid ${BORDER}`, background: pontEditId === p.id ? '#FFFBEC' : '#fff', transition: 'background 0.1s' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: SUBTEXT, width: 20, textAlign: 'center', flexShrink: 0 }}>{pi + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{p.amostra}</span>
                        <span style={{ fontSize: 11, color: SUBTEXT, marginLeft: 10 }}>{p.posicao} · {p.impactosRaw.filter(v => v.trim()).length} golpes:{' '}<strong style={{ color: TEXT }}>{p.impactosRaw.filter(v => v.trim()).map((v, i, arr) => <span key={i}>{v}{i < arr.length - 1 && <span style={{ color: '#C8CEDF', margin: '0 2px' }}> | </span>}</span>)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button onClick={() => { editarPonto(p); setGrupoAtivoId(g.id); }} title="Editar" aria-label="Editar ponto" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EEF1F8', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => { if (confirm(`Apagar "${p.amostra}"?`)) removerPonto(g.id, p.id); }} title="Apagar" aria-label="Apagar ponto" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#FFF0EE', color: DANGER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                      </div>
                    </div>
                  ))}

                  {/* Formulário ponto (só quando ativo) */}
                  {ativo && (
                    <div style={{ padding: '18px 20px', background: '#FAFBFD', borderTop: g.pontos.length > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 800, color: pontEditId ? '#8B6914' : GREEN, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{pontEditId ? '✎ Editando Ponto' : '+ Novo Ponto'}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14, marginBottom: 14 }}>
                        <Campo label="Identificação (ex: P1 - Pilar Térreo)"><input style={inputStyle} value={pontNome} onChange={e => setPontNome(e.target.value)} placeholder="Ex: V1 - Viga Piso 2…" onKeyDown={e => e.key === 'Enter' && pontImpactoRefs.current[0]?.focus()} /></Campo>
                        <Campo label="Posição">
                          <div style={{ display: 'flex', gap: 6 }}>
                            {POSICOES.map(p => <button key={p} onClick={() => setPontPosicao(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', backgroundColor: pontPosicao === p ? GREEN : '#F0F2F8', color: pontPosicao === p ? '#fff' : SUBTEXT, border: `2px solid ${pontPosicao === p ? GREEN : 'transparent'}` }}>{p}</button>)}
                          </div>
                        </Campo>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: SUBTEXT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Golpes (máx. 16)</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {pontImpactos.map((v, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: SUBTEXT }}>{i + 1}</span>
                              <input ref={el => { pontImpactoRefs.current[i] = el; }} type="text" inputMode="decimal" value={v}
                                onChange={e => { const n = [...pontImpactos]; n[i] = onlyDecimal(e.target.value); setPontImpactos(n); }}
                                onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const nx = pontImpactoRefs.current[i + 1]; if (nx) nx.focus(); else salvarPonto(); } else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); const pv = pontImpactoRefs.current[i - 1]; if (pv) pv.focus(); } else if (e.key === 'Enter') { e.preventDefault(); const nx = pontImpactoRefs.current[i + 1]; if (nx) nx.focus(); else salvarPonto(); } }}
                                style={{ width: 52, textAlign: 'center', padding: '7px 4px', border: `1.5px solid ${v ? GREEN + '66' : BORDER}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', color: TEXT, background: v ? GREEN_LIGHT : '#fff', outline: 'none', transition: 'all 0.1s' }}
                                onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = '#E8F5EE'; }}
                                onBlur={e => { e.target.style.borderColor = v ? GREEN + '66' : BORDER; e.target.style.background = v ? GREEN_LIGHT : '#fff'; }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button onClick={salvarPonto} disabled={!pontNome.trim() || !pontImpactos.some(v => v.trim())} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pontNome.trim() && pontImpactos.some(v => v.trim()) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: pontEditId ? GOLD : GREEN, color: pontEditId ? PRIMARY : '#fff', border: 'none', opacity: pontNome.trim() && pontImpactos.some(v => v.trim()) ? 1 : 0.5 }}>{pontEditId ? '✓ Salvar Edição' : '+ Salvar Ponto'}</button>
                        {pontEditId && <button onClick={cancelarEdicaoPonto} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Cancelar</button>}
                        <button onClick={() => { setPontNome(''); setPontImpactos(Array(16).fill('')); setPontPosicao('0°'); setPontEditId(null); }} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#F0F2F8', color: SUBTEXT, border: 'none' }}>Limpar</button>
                        {obraSalvoMsg && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>{obraSalvoMsg}</span>}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            {grupos.some(g => g.pontos.length > 0) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowImportar(true); setAba('campo'); }} disabled={!bigornaPronta} title={!bigornaPronta ? 'Preencha a bigorna no Cabeçalho antes de importar' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: bigornaPronta ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: bigornaPronta ? PRIMARY : '#C0C8D8', color: '#fff', border: 'none', boxShadow: bigornaPronta ? '0 2px 8px rgba(30,50,100,0.2)' : 'none' }}>
                  {bigornaPronta ? 'Ir para Importação →' : '🔒 Preencha a bigorna para importar'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}