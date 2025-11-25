import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';

export default function DialogueCreatorPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/create')}
          className="flex items-center gap-2 text-periwinkle hover:text-periwinkle-dark font-bold transition-colors"
          data-testid="dialogue-button-back"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Create
        </button>
      </div>

      <div className="mb-8 pb-6 border-b-4 border-periwinkle">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">Comprehensible Input Dialogues</h1>
        <p className="text-xl text-gray-600">Generate AI dialogues calibrated to your proficiency level</p>
      </div>

      <DialogueGenerator />
    </div>
  );
}
