import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 pt-6 sm:pt-10 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        // Fecha ao clicar fora do modal
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        // Largura responsiva: cresce em telas maiores pra dar respiro aos
        // forms (que costumam ter vários campos), mantém legível em laptops.
        // Altura sobe até 92vh — mais espaço útil sem encostar nas bordas.
        className="bg-white dark:bg-lidera-gray w-full max-w-3xl lg:max-w-5xl 2xl:max-w-6xl rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[92vh] relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo (permanece visível) */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 sticky top-0 bg-white/95 dark:bg-lidera-gray/95 backdrop-blur">
          <h3 className="text-xl font-bold text-brand-gradient">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="p-6 overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
};