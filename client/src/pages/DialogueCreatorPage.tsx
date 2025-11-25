import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DialogueGenerator from '../components/dialogue/DialogueGenerator';

export default function DialogueCreatorPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 pb-6 border-b-4 border-periwinkle">
        <h1 className="text-5xl font-bold text-dark-brown mb-3">Comprehensible Input Dialogues</h1>
        <p className="text-xl text-gray-600">Generate AI dialogues calibrated to your proficiency level</p>
      </div>

      <DialogueGenerator />
    </div>
  );
}
