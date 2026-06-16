export default function Filters({ status, onStatusChange, type, onTypeChange }) {
  return (
    <div className="filters">
      {onStatusChange && (
        <select value={status} onChange={event => onStatusChange(event.target.value)}>
          <option value="">All statuses</option>
          <option>Pending</option>
          <option>Ready</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
      )}
      {onTypeChange && (
        <select value={type} onChange={event => onTypeChange(event.target.value)}>
          <option value="">All types</option>
          <option>Indica</option>
          <option>Sativa</option>
          <option>Hybrid</option>
        </select>
      )}
    </div>
  );
}
