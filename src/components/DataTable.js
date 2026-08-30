/**
 * Tabla genérica: columns = [{ key, label, render? }], rows = array de objetos.
 * `render(row)` opcional para celdas custom (badges, botones de acción, etc.).
 */
export default function DataTable({ columns, rows, emptyLabel = "Sin datos." }) {
  if (!rows || rows.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 align-top text-slate-700">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
