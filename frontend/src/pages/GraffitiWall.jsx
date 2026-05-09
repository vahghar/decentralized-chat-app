import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DrawingCanvas from '../components/DrawingCanvas';

const GraffitiWall = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost btn-sm text-gray-400 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-2xl font-bold text-cyan-400">
            Digital Graffiti Wall
          </h1>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Drawing Canvas */}
          <DrawingCanvas />

          {/* Anonymous Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Drawing anonymously • See others in real-time • Find the community
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraffitiWall;
