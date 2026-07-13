import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationBar({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const from = total ? currentPage * pageSize + 1 : 0;
  const to = Math.min((currentPage + 1) * pageSize, total);

  return (
    <div className="pagination-bar compact-pagination" aria-label="Paginación">
      <span>{from}-{to} de {total}</span>
      <div className="pagination-actions">
        <button
          className="outline-button compact"
          type="button"
          disabled={currentPage === 0}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
          title="Página anterior"
        >
          <ChevronLeft size={16} />
          Anterior
        </button>
        <span className="status-pill">Página {currentPage + 1} de {totalPages}</span>
        <button
          className="outline-button compact"
          type="button"
          disabled={currentPage + 1 >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente"
          title="Página siguiente"
        >
          Siguiente
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
