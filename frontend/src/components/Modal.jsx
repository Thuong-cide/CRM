export default function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = { sm: 'md:max-w-sm', md: 'md:max-w-md', lg: 'md:max-w-2xl' };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className={`relative bg-white w-full ${sizes[size]} md:rounded-xl shadow-2xl
        rounded-t-2xl max-h-[92vh] md:max-h-[90vh] flex flex-col`}>

        {/* Header sticky */}
        <div className="flex justify-between items-center px-4 py-3 border-b flex-shrink-0">
          {/* Drag handle mobile */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full md:hidden" />
          <h3 className="font-semibold text-gray-800 text-base mt-1 md:mt-0">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1 -mr-1">✕</button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-4 md:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
