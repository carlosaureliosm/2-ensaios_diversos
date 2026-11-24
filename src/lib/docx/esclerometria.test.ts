import { describe, it, expect } from 'vitest';
import PizZip from 'pizzip';
import {
  formatarData,
  formatarRlt,
  injetarMemorial,
  sanitizarNomeArquivoDocx,
} from './esclerometria';

function criarZipMinimo(): PizZip {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    '<w:document><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>MEMORIAL_PLACEHOLDER</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  );
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  );
  return zip;
}

describe('helpers DOCX de esclerometria', () => {
  it('escapa caracteres XML nas legendas do memorial e grava largura da tabela em dxa', () => {
    const zip = criarZipMinimo();
    injetarMemorial(zip, [
      {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: 'image/png',
        largura: 800,
        altura: 600,
        legenda: 'Pilar P1 & P2 <Bloco "A">',
      },
    ]);

    const xml = zip.file('word/document.xml')!.asText();
    expect(xml).toContain('Foto 1 — Pilar P1 &amp; P2 &lt;Bloco &quot;A&quot;&gt;');
    expect(xml).not.toContain('P1 & P2');
    expect(xml).toContain('<w:tblW w:w="10054" w:type="dxa"/>');
  });

  it('sanitiza nome de arquivo para Content-Disposition sem quebrar cabeçalho', () => {
    expect(sanitizarNomeArquivoDocx('RLT.LAU-001.26-00')).toBe('RLT.LAU-001.26-00');
    expect(sanitizarNomeArquivoDocx('laudo"\r\nX-Evil: 1/..\\ação')).toBe('laudo___X-Evil_ 1_.._acao');
    expect(sanitizarNomeArquivoDocx('   ')).toBe('relatorio');
  });

  it('formata RLT usando os 2 últimos dígitos do ano atual', () => {
    const aa = String(new Date().getFullYear()).slice(-2);
    expect(formatarRlt('')).toBe(`RLT.LAU-XXX.${aa}-00`);
    expect(formatarRlt('7')).toBe(`RLT.LAU-007.${aa}-00`);
    expect(formatarRlt('12A')).toBe(`RLT.LAU-12A.${aa}-00`);
  });

  it('retorna vazio para data com mês inválido em formatarData', () => {
    expect(formatarData('10/13/2026')).toEqual({ capa: '', corpo: '' });
    expect(formatarData('10/00/2026')).toEqual({ capa: '', corpo: '' });
    expect(formatarData('10/03/2026')).toEqual({
      capa: 'MARÇO, 2026',
      corpo: 'Recife, 10 de março de 2026',
    });
  });
});
