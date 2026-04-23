import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { BookOpen, Upload, ChevronLeft, ChevronRight, Download, Loader2, Share2 } from 'lucide-react';
import './index.css';

// Set up the PDF.js worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function App() {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('Mi Flipbook');
  const [downloadReady, setDownloadReady] = useState(false);

  const flipBookRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfName = urlParams.get('pdf');
    if (pdfName) {
      const url = pdfName.startsWith('/') ? pdfName : `/${pdfName}`;
      loadPdfFromUrl(url, pdfName);
    }
  }, []);

  const loadPdfFromUrl = async (url: string, name: string) => {
    setLoading(true);
    setUploadStatus('Cargando libro interactivo...');
    setDocTitle(name.replace('.pdf', '').replace(/-/g, ' ').replace(/_/g, ' '));
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      await renderPdfPages(pdf);
    } catch (error) {
      console.error('Error fetching PDF:', error);
      alert('No se pudo cargar este libro. Asegúrate de que el archivo existe.');
      setLoading(false);
    }
  };

  const renderPdfPages = async (pdf: any) => {
    const numPages = pdf.numPages;
    const images: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext: any = { canvasContext: context, viewport };
      await page.render(renderContext).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8));
      setProgress(Math.round((i / numPages) * 100));
    }

    setPages(images);
    setDownloadReady(true);
    setLoading(false);
  };

  const extractPagesFromPdf = async (file: File) => {
    setLoading(true);
    setProgress(0);
    setDownloadReady(false);
    setDocTitle(file.name.replace('.pdf', '').replace(/-/g, ' ').replace(/_/g, ' '));
    setUploadStatus('Procesando páginas...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const images: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.2;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: any = { canvasContext: context, viewport };
        await page.render(renderContext).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.7));

        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        setProgress(Math.round((i / numPages) * 100));
      }

      setPages(images);
      setDownloadReady(true);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Hubo un error al procesar el PDF. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  const processImages = (files: File[]) => {
    setLoading(true);
    setProgress(0);
    setDownloadReady(false);
    setDocTitle('Mi Flipbook');
    const images: string[] = [];
    let processed = 0;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          images[index] = e.target.result as string;
        }
        processed++;
        setProgress(Math.round((processed / files.length) * 100));

        if (processed === files.length) {
          setPages(images.filter(Boolean));
          setDownloadReady(true);
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = (files: FileList) => {
    if (files.length === 0) return;

    if (files.length === 1 && files[0].type === 'application/pdf') {
      extractPagesFromPdf(files[0]);
    } else {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        processImages(imageFiles);
      } else {
        alert('Por favor selecciona un archivo PDF o varias imágenes.');
      }
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const onPageChange = (e: { data: number }) => {
    setCurrentPage(e.data);
  };

  const nextButtonClick = () => {
    if (flipBookRef.current) flipBookRef.current.pageFlip().flipNext();
  };

  const prevButtonClick = () => {
    if (flipBookRef.current) flipBookRef.current.pageFlip().flipPrev();
  };

  /**
   * Generates a fully self-contained HTML flipbook file.
   * The recipient only needs to open it in any browser — no internet needed.
   */
  const downloadShareableFlipbook = () => {
    // Build slides as direct <img> tags — no JSON parsing needed, works with any PDF size
    const slides = pages.map((src, i) =>
      `<div class="slide${i === 0 ? ' active' : ''}"><img src="${src}" alt="Página ${i + 1}" loading="lazy"/></div>`
    ).join('\n');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${docTitle}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f0f1a;font-family:system-ui,sans-serif;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:1rem}
    h1{margin:1.5rem 0 1rem;font-size:1.5rem;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:center}
    #slides{width:100%;max-width:800px}
    .slide{display:none;border-radius:8px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .slide.active{display:block}
    .slide img{width:100%;height:auto;display:block}
    .controls{display:flex;align-items:center;justify-content:center;gap:1.5rem;margin:1.5rem 0}
    .btn{background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.4);color:#fff;padding:0.6rem 1.5rem;border-radius:999px;cursor:pointer;font-size:1rem;transition:all 0.2s}
    .btn:hover{background:rgba(167,139,250,0.4)}
    .btn:disabled{opacity:0.3;cursor:not-allowed}
    .indicator{font-size:0.9rem;color:#a78bfa;min-width:80px;text-align:center}
    .footer{font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:2rem;text-align:center}
  </style>
</head>
<body>
  <h1>📖 ${docTitle}</h1>
  <div id="slides">
${slides}
  </div>
  <div class="controls">
    <button class="btn" id="prev" disabled ontouchend="this.click()">◀ Anterior</button>
    <span class="indicator" id="ind">1 / ${pages.length}</span>
    <button class="btn" id="next" ontouchend="this.click()">Siguiente ▶</button>
  </div>
  <div class="footer">Creado con FlipCreator PRO · ${pages.length} páginas · Abre este archivo en cualquier navegador</div>
  <script>
    var slides = document.querySelectorAll('.slide');
    var current = 0;
    var total = slides.length;
    function show(n) {
      slides[current].classList.remove('active');
      current = Math.max(0, Math.min(total - 1, n));
      slides[current].classList.add('active');
      document.getElementById('ind').textContent = (current + 1) + ' / ' + total;
      document.getElementById('prev').disabled = current === 0;
      document.getElementById('next').disabled = current === total - 1;
    }
    document.getElementById('prev').addEventListener('click', function(e){ e.preventDefault(); show(current - 1); });
    document.getElementById('next').addEventListener('click', function(e){ e.preventDefault(); show(current + 1); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    // Swipe only on the slides container (not buttons)
    var slidesEl = document.getElementById('slides');
    var startX = 0;
    slidesEl.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, {passive:true});
    slidesEl.addEventListener('touchend', function(e){
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) show(diff > 0 ? current + 1 : current - 1);
    }, {passive:true});
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/\s+/g, '-').toLowerCase()}-flipbook.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareOrCopyLink = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: docTitle, text: '¡Mira este flipbook interactivo!', url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert('¡Enlace copiado al portapapeles!');
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="container header-content">
          <div className="logo">
            <BookOpen size={28} />
            <span>FlipCreator PRO</span>
          </div>
          {pages.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={downloadShareableFlipbook}>
                <Download size={18} />
                Descargar para compartir
              </button>
              <button className="btn" onClick={shareOrCopyLink}>
                <Share2 size={18} />
                Copiar enlace
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container main-content">
        {loading && (
          <div className="loading-overlay">
            <Loader2 size={48} className="spinner" />
            <h2 style={{ color: 'white' }}>{uploadStatus || 'Procesando documento...'}</h2>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <p style={{ color: 'white', marginTop: '0.5rem' }}>{progress}% completado</p>
          </div>
        )}

        {pages.length === 0 && !loading ? (
          <div
            className={`uploader ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={48} className="uploader-icon" />
            <h2 className="uploader-title">Sube tu PDF o Imágenes</h2>
            <p className="uploader-text">
              Arrastra y suelta aquí, o haz clic para seleccionar archivos.<br />
              Convertiremos tu documento en un libro interactivo listo para compartir.
            </p>
            <input
              type="file"
              className="hidden-input"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              accept=".pdf,image/*"
              multiple
            />
            <button className="btn btn-primary" style={{ marginTop: '2rem' }}>
              Seleccionar Archivos
            </button>
          </div>
        ) : (
          pages.length > 0 && !loading && (
            <div className="flipbook-wrapper">
              <div className="flipbook-container">
                {/* @ts-ignore */}
                <HTMLFlipBook
                  width={400}
                  height={600}
                  size="stretch"
                  minWidth={315}
                  maxWidth={1000}
                  minHeight={400}
                  maxHeight={1533}
                  maxShadowOpacity={0.5}
                  showCover={true}
                  mobileScrollSupport={true}
                  onFlip={onPageChange}
                  ref={flipBookRef}
                  className="demo-book"
                >
                  {pages.map((img, i) => (
                    <div key={i} className="page">
                      <img src={img} alt={`Página ${i + 1}`} />
                    </div>
                  ))}
                </HTMLFlipBook>
              </div>

              <div className="controls">
                <button className="btn-icon" onClick={prevButtonClick} disabled={currentPage === 0} aria-label="Página anterior">
                  <ChevronLeft size={24} />
                </button>
                <span className="page-indicator">
                  {currentPage + 1} / {pages.length}
                </span>
                <button className="btn-icon" onClick={nextButtonClick} disabled={currentPage >= pages.length - 1} aria-label="Página siguiente">
                  <ChevronRight size={24} />
                </button>
              </div>

              {downloadReady && (
                <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                  <h3 style={{ marginBottom: '0.75rem' }}>✅ ¡Tu flipbook está listo!</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Descarga el archivo HTML y envíalo por <strong>WhatsApp, email o Telegram</strong>.
                    Quien lo reciba solo tiene que abrirlo con su móvil o navegador — sin instalar nada.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={downloadShareableFlipbook}>
                      <Download size={18} />
                      Descargar flipbook (.html)
                    </button>
                    <button className="btn" onClick={() => {
                      setPages([]);
                      setDownloadReady(false);
                      window.history.pushState({}, '', window.location.pathname);
                    }}>
                      Crear otro
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;
