export default function BookArtwork({ className = "" }: { className?: string }) {
  return (
    <div className={`book-artwork ${className}`} role="img" aria-label="A rotating open book on a display plate with a floating golden halo">
      <span className="book-spark book-spark-one" />
      <span className="book-spark book-spark-two" />
      <div className="book-scene">
        <div className="book-turntable">
          <div className="book-halo" />
          <div className="book-assembly">
            <div className="book-spin">
              <div className="book-cover book-cover-left" />
              <div className="book-cover book-cover-right" />
              <div className="book-page book-page-left">
                <span className="page-title" />
                <span className="page-line line-one" />
                <span className="page-line line-two" />
                <span className="page-line line-three" />
                <span className="page-diagram" />
              </div>
              <div className="book-page book-page-right">
                <span className="page-title" />
                <span className="page-line line-one" />
                <span className="page-line line-two" />
                <span className="page-line line-three" />
                <span className="page-diagram diagram-right" />
              </div>
              <div className="book-spine" />
            </div>
          </div>
          <div className="book-plate"><div className="book-plate-top" /></div>
        </div>
      </div>
    </div>
  );
}
