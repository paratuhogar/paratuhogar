#!/usr/bin/env python3
"""One-column, mobile-readable manual. All figures are real verified screenshots."""
from pathlib import Path
from io import BytesIO
import hashlib, html, json, re, os
from PIL import Image
import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs/guia-gestores'
SRC=Path(os.environ.get('PTH_GUIDE_CAPTURE_DIR',str(DOCS/'capturas')))
OUT=Path(os.environ.get('PTH_GUIDE_BUILD_DIR',str(DOCS/'build')));OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((DOCS/'inventario-capturas.json').read_text())
ready={r['file']:r for r in manifest['files'] if r['ready_for_tutorial']}
for name,r in ready.items():
 assert hashlib.sha256((SRC/name).read_bytes()).hexdigest()==r['sha256'],name
pdfmetrics.registerFont(TTFont('Guide','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('GuideBold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

def fig(name,caption,box=None,width=320):
 assert name in ready,name
 return dict(file=name,caption=caption,box=box,width=width)

PAGES=json.loads((DOCS/'contenido.json').read_text())
assert len(PAGES)==20
W,H=420,820; M=30; WIDTH=W-2*M
BLUE=HexColor('#1a4789'); INK=HexColor('#111827'); MUTED=HexColor('#4b5563'); PALE=HexColor('#edf4fd')
styles={
 'body':ParagraphStyle('body',fontName='Guide',fontSize=13.3,leading=18.7,textColor=INK,spaceAfter=10),
 'title':ParagraphStyle('title',fontName='GuideBold',fontSize=22,leading=27,textColor=INK),
 'caption':ParagraphStyle('caption',fontName='Guide',fontSize=9.6,leading=13,textColor=MUTED),
 'callout':ParagraphStyle('callout',fontName='Guide',fontSize=11.2,leading=15.5,textColor=INK),
 'index':ParagraphStyle('index',fontName='Guide',fontSize=12.3,leading=18.5,textColor=BLUE),
}
pdf_path=OUT/'paratuhogar-tutorial-mobile.pdf'
c=canvas.Canvas(str(pdf_path),pagesize=(W,H),pageCompression=1)
c.setTitle('ParaTuHogar · Guía de trabajo en la web')
c.setAuthor('ParaTuHogar');c.setSubject('Guía móvil con pantallas reales de demostración')
mapping=[];content=[]

def para(text,y,width=WIDTH,x=M,style='body',markup=False):
 p=Paragraph(text if markup else html.escape(text),styles[style]);_,height=p.wrap(width,H)
 p.drawOn(c,x,y-height)
 return y-height-styles[style].spaceAfter

def add_figure(f,y,page_number):
 im=Image.open(SRC/f['file']).convert('RGB')
 original_box=(0,0,im.width,im.height)
 box=tuple(f['box']) if f['box'] else original_box
 assert 0<=box[0]<box[2]<=im.width and 0<=box[1]<box[3]<=im.height
 crop=im.crop(box)
 image_width=min(f['width'],WIDTH);image_height=image_width*crop.height/crop.width
 buf=BytesIO();crop.save(buf,format='PNG',optimize=True);buf.seek(0)
 x=(W-image_width)/2
 c.setFillColor(PALE);c.roundRect(x-4,y-image_height-4,image_width+8,image_height+8,8,fill=1,stroke=0)
 c.drawImage(ImageReader(buf),x,y-image_height,width=image_width,height=image_height)
 y-=image_height+8
 caption='Pantalla real · datos de demostración. '+f['caption']
 y=para(caption,y,WIDTH,M,'caption')-12
 mapping.append(dict(page=page_number,file=f['file'],crop=list(box),caption=caption,source=ready[f['file']]['source'],sha256=ready[f['file']]['sha256'],fixture=True,date='2026-10-03',display_width_points=image_width))
 return y

for n,p in enumerate(PAGES,1):
 c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(BLUE);c.rect(0,H-42,W,42,fill=1,stroke=0)
 c.setFillColor(white);c.setFont('GuideBold',15);c.drawString(M,H-28,'paratuhogar')
 c.setFont('Guide',8.5);c.drawRightString(W-M,H-27,'GUÍA · 03 OCT 2026')
 c.setFillColor(MUTED);c.setFont('GuideBold',9);c.drawString(M,H-68,p['section'])
 c.bookmarkPage('p'+str(n));c.addOutlineEntry(p['title'],'p'+str(n),0,False)
 y=para(p['title'],H-82,style='title')-20
 for t in p['body']:
  y=para(t,y)
  content.append(t)
 if p.get('callout') and not p.get('figures') and not p.get('designs'):
  y=para(p['callout'],y-8,style='callout')-10
 for f in p.get('figures',[]):y=add_figure(f,y-5,n)
 if p.get('designs'):
  y=para(p['callout'],y-5,style='callout')-15
  # Comparison figure only; document reading order remains one column.
  themes=[('16-story-essential.png','Azul esencial'),('17-story-premium.png','Grafito premium'),('18-story-technical.png','Ficha clara'),('19-story-editorial.png','Hogar editorial')]
  for i,(name,label) in enumerate(themes):
   im=Image.open(SRC/name).crop((123,376,270,635)).convert('RGB')
   buf=BytesIO();im.save(buf,format='PNG',optimize=True);buf.seek(0)
   image_width=80;image_height=image_width*im.height/im.width
   x=M+i*93
   c.drawImage(ImageReader(buf),x,y-image_height,width=image_width,height=image_height)
   para(label,y-image_height-9,83,x,'caption')
   mapping.append(dict(page=n,file=name,crop=[123,376,270,635],caption='Ejemplo real de plantilla · datos de demostración · '+label,source=ready[name]['source'],sha256=ready[name]['sha256'],fixture=True,date='2026-10-03',display_width_points=image_width))
  y-=image_height+46
  y=para('Ejemplos de las cuatro plantillas reales de Story rápida, también disponibles como diseños en Magic Studio. Los importes y equipos son ficticios.',y,style='caption')-12
 if p.get('figures') and p.get('callout'):
  y=para(p['callout'],y-3,style='callout')-10
 if p.get('index'):
  y=para('Ir a: <link href="#p2">Empezar · 2–3</link>   <link href="#p4">Vender · 4–8</link><br/><link href="#p9">Conexión · 9–10</link>   <link href="#p11">Promoción · 11–15</link><br/><link href="#p16">Control · 16–20</link>',y-6,style='index',markup=True)-5
  c.linkURL('https://paratuhogar.org/',(M,H-42,M+145,H),relative=0)
 assert y>53,(n,p['title'],y)
 c.setStrokeColor(HexColor('#d8e2ee'));c.line(M,47,W-M,47)
 c.setFillColor(MUTED);c.setFont('Guide',8.2);c.drawString(M,30,'Pantallas reales · datos de demostración')
 c.drawRightString(W-M,30,f'{n} / 20')
 c.showPage()
c.save()
assert pdf_path.stat().st_size<=5_000_000
doc=fitz.open(pdf_path);assert len(doc)==20
text='\n'.join(p.get_text() for p in doc)
normalized_text=re.sub(r'\s+',' ',text)
for bad in ['CAPTURA C','VERIFICAR','GUION EDITORIAL','instrucciones de producción']:
 assert bad not in text,bad
for needed in ['SOLICITUDES Y PAGOS','Sin puesto','1, 1, 3','12 MB','datos de demostración','Guardar pedido pendiente']:
 assert needed in normalized_text,needed
links=[l for p in doc for l in p.get_links()]
internal_links=[l for l in links if l['kind'] in (fitz.LINK_GOTO,fitz.LINK_NAMED)]
assert len(internal_links)==5
assert sorted(int(l['page'])+(1 if l['kind']==fitz.LINK_GOTO else 0) for l in internal_links)==[2,4,9,11,16]
assert any(l.get('uri')=='https://paratuhogar.org/' for l in links)
for p in doc:
 for block in p.get_text('dict')['blocks']:
  if block.get('type')!=0:continue
  for line in block['lines']:
   for span in line['spans']:
    rect=fitz.Rect(span['bbox']);assert rect.x0>=0 and rect.x1<=W+1 and rect.y0>=0 and rect.y1<=H+1,span['text']
 # Every page rendered, not just thumbnails. Inspect contact sheets separately.
 p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(OUT/('pagina-'+str(p.number+1).zfill(2)+'.png'))
for start in [0,5,10,15]:
 thumbs=[]
 for i in range(start,start+5):
  im=Image.open(OUT/('pagina-'+str(i+1).zfill(2)+'.png')).convert('RGB')
  im.thumbnail((315,615));thumbs.append(im)
 sheet=Image.new('RGB',(5*335,655),'#e7edf5')
 for j,im in enumerate(thumbs):sheet.paste(im,(10+j*335,10))
 sheet.save(OUT/('revision-'+str(start+1).zfill(2)+'-'+str(start+5).zfill(2)+'.png'))
data={'file':pdf_path.name,'bytes':pdf_path.stat().st_size,'sha256':hashlib.sha256(pdf_path.read_bytes()).hexdigest(),'pages':20,'layout':'Una columna; 420 × 820 pt; cuerpo 13,3 pt; títulos negros; texto seleccionable','figure_count':len(mapping),'unique_verified_screenshots':len(set(m['file'] for m in mapping)),'figure_mapping':mapping,'internal_index_links':5,'all_pages_rendered':True,'library_id':None,'library_status':'Documento de revisión; la publicación requiere el PDF definitivo aprobado.','capture_gaps':'Acceso, catálogo/producto/carrito y PDF no tienen captura final con todas sus fuentes. Rendimiento, precios y red privada se explican de forma condicional sin imagen. No se usaron capturas marcadas para revisión ni se inventaron controles.'}
(OUT/'inventario-imagen-pagina.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(OUT/'contenido-editorial-verificado.json').write_text(json.dumps(PAGES,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in data.items() if k!='figure_mapping'},ensure_ascii=False))
