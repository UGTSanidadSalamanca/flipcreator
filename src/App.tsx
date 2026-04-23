import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { BookOpen, Upload, ChevronLeft, ChevronRight, Share2, Loader2, Info } from 'lucide-react';
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
  
  const flipBookRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfName = urlParams.get('pdf');
    if (pdfName) {
      // The pdf is expected to be in the public folder, so we just fetch it by its path
      const url = pdfName.startsWith('/') ? pdfName : `/${pdfName}`;
      loadPdfFromUrl(url);
    }
  }, []);

  const loadPdfFromUrl = async (url: string) => {
    setLoading(true);
    setUploadStatus('Cargando libro interactivo...');
    try {
      await extractPagesFromPdfUrl(url);
    } catch (error) {
      console.error("Error fetching PDF:", error);
      alert("No se pudo cargar este libro. Asegúrate de que el archivo existe en la ruta correcta.");
      setLoading(false);
    }
  };

  const extractPagesFromPdfUrl = async (url: string) => {
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      await renderPdfPages(pdf);
    } catch (error) {
      console.error("Error processing PDF URL:", error);
      alert("Hubo un error al procesar el PDF.");
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

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8));
      
      setProgress(Math.round((i / numPages) * 100));
    }
    
    setPages(images);
    setLoading(false);
  };

  const extractPagesFromPdf = async (file: File) => {
    setLoading(true);
    setProgress(0);
    setUploadStatus('Procesando páginas para vista previa...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const images: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        // Set a more optimal scale to prevent memory crashes on large PDFs
        const scale = 1.2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        // willReadFrequently can help with memory management in some browsers
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.7));
        
        // Free memory aggressively
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        setProgress(Math.round((i / numPages) * 100));
      }
      
      setPages(images);
    } catch (error) {
      console.error("Error processing PDF:", error);
      alert("Hubo un error al procesar el PDF. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
      setUploadStatus('');
    }
  };

  const processImages = (files: File[]) => {
    setLoading(true);
    setProgress(0);
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
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = (files: FileList) => {
    if (files.length === 0) return;
    
    // Check if it's a single PDF
    if (files.length === 1 && files[0].type === 'application/pdf') {
      extractPagesFromPdf(files[0]);
    } else {
      // Treat as multiple images
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        processImages(imageFiles);
      } else {
        alert("Por favor selecciona un archivo PDF o varias imágenes.");
      }
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipNext();
    }
  };

  const prevButtonClick = () => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  };

  const shareFlipbook = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Mi Flipbook Interactivo',
        text: 'Mira este documento convertido en un libro interactivo.',
        url: url,
      }).catch(console.error);
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("¡Enlace copiado al portapapeles!");
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
            <button className="btn btn-primary" onClick={shareFlipbook}>
              <Share2 size={18} />
              Compartir en RRSS
            </button>
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
              Arrastra y suelta aquí, o haz clic para seleccionar archivos.<br/>
              Convertiremos tu documento en un libro interactivo automáticamente.
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
                {/* @ts-ignore - react-pageflip types might be missing some props */}
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
                <button 
                  className="btn-icon" 
                  onClick={prevButtonClick}
                  disabled={currentPage === 0}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="page-indicator">
                  {currentPage + 1} / {pages.length}
                </span>
                <button 
                  className="btn-icon" 
                  onClick={nextButtonClick}
                  disabled={currentPage >= pages.length - 1}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className="glass-panel" style={{ textAlign: 'left', maxWidth: '700px', margin: '2rem auto' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={24} color="var(--primary)" />
                  Vista previa local completada
                </h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Estás viendo este libro en modo "Vista Previa Local". Como hemos configurado la aplicación para no requerir bases de datos (Opción 2), los PDFs no se suben a ninguna nube.
                </p>
                <div style={{ background: 'var(--bg)', padding: '1.5rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>¿Cómo comparto este libro con otros?</h4>
                  <ol style={{ marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                    <li style={{ marginBottom: '0.5rem' }}>Copia tu archivo PDF original y pégalo dentro de la carpeta <code>public</code> de este proyecto (por ejemplo, llámalo <code>mi-guia.pdf</code>).</li>
                    <li style={{ marginBottom: '0.5rem' }}>Sube los cambios a GitHub para que Vercel actualice la web.</li>
                    <li>¡Y ya está! Tu enlace público será:<br/>
                      <strong style={{ color: 'var(--text)' }}>tu-web.vercel.app/?pdf=mi-guia.pdf</strong>
                    </li>
                  </ol>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => {
                    const currentUrl = window.location.origin + window.location.pathname;
                    const demoUrl = `${currentUrl}?pdf=nombre-de-tu-archivo.pdf`;
                    if (navigator.share) {
                      navigator.share({
                        title: 'Mi Flipbook',
                        text: 'Ejemplo de cómo sería el enlace para compartir',
                        url: demoUrl,
                      }).catch(console.error);
                    } else {
                      navigator.clipboard.writeText(demoUrl);
                      alert(`Enlace de ejemplo copiado:\n\n${demoUrl}\n\n(Recuerda cambiar "tu-web.vercel.app" por tu dominio real de Vercel)`);
                    }
                  }}>
                    <Share2 size={18} />
                    Simular enlace final
                  </button>
                  <button className="btn" onClick={() => {
                    setPages([]);
                    window.history.pushState({}, '', window.location.pathname);
                  }}>
                    Cerrar vista previa
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;
