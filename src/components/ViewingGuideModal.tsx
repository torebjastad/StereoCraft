import React, { useState } from 'react';
import { X, Sparkles, Target, Compass, CheckCircle } from 'lucide-react';

interface ViewingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchMode: (mode: 'parallel' | 'cross-eyed') => void;
}

export const ViewingGuideModal: React.FC<ViewingGuideModalProps> = ({
  isOpen,
  onClose,
  onSwitchMode,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">How to See 3D Stereograms</h2>
              <p className="text-xs text-slate-400">Mastering the art of vergence & depth perception</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
          {[
            { id: 1, title: '1. The Science' },
            { id: 2, title: '2. The 3 Dots Method' },
            { id: 3, title: '3. Nose-to-Screen' },
            { id: 4, title: '4. Parallel vs Cross-Eyed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStep(tab.id)}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition ${
                activeStep === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-300 text-xs leading-relaxed">
          {activeStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                Why are Stereograms hard to see at first?
              </h3>
              <p>
                Normally, your eyes do two things simultaneously:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>
                  <strong className="text-white">Accommodation:</strong> Your eye’s lens focuses to make the surface sharp at your screen’s distance (e.g. 45 cm).
                </li>
                <li>
                  <strong className="text-white">Vergence:</strong> Both eyeballs angle inward to meet at that exact same physical spot.
                </li>
              </ul>
              <p className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-200">
                To see an <strong>autostereogram</strong>, you must decouple these two reflexes: your lenses must stay focused on the screen, while your eyes relax their angle as if gazing into the distance behind the screen!
              </p>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Technique #1: The Convergence Guide Dots (Recommended)
              </h3>
              <p>
                At the top of the stereogram, there are two glowing dots separated by the exact repeating pattern distance.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-16">
                  <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 animate-ping" />
                  <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/80 animate-ping" />
                </div>
                <div className="text-[11px] text-slate-400 text-center font-mono">
                  Normal view: ● &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ●
                  <br />
                  <span className="text-emerald-400 font-bold">Fused stereo view: ● &nbsp; &nbsp; ● (sharp) &nbsp; &nbsp; ●</span>
                </div>
              </div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Stare at the two dots. Relax your eyes and look <em>through</em> the screen as if looking at a far horizon.
                </li>
                <li>
                  The two dots will double into four. As you adjust your focus, the two inner dots will slide together and merge into a single solid dot.
                </li>
                <li>
                  You will now see <strong>three dots</strong> in a row! The middle one will appear stable and sharp.
                </li>
                <li>
                  Hold that eye lock, and smoothly glide your eyes down into the pattern. The 3D shapes will instantly pop into view!
                </li>
              </ol>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" />
                Technique #2: The Nose-to-Screen Pullback
              </h3>
              <p>
                If relaxing your eyes into the distance is difficult, this physical trick forces your visual cortex to decouple focus:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Move your face right up to the monitor until your nose is practically touching the screen.
                </li>
                <li>
                  Everything will be totally blurry. <strong>Do not try to focus!</strong> Keep your eyes relaxed, staring straight ahead as if looking through a glass window.
                </li>
                <li>
                  Very slowly, pull your head straight back at about 2 cm per second.
                </li>
                <li>
                  Keep your gaze relaxed without actively refocusing. When you reach about 30 to 45 cm distance, your brain will suddenly lock onto the repeated pattern, and the 3D relief will emerge with stunning depth!
                </li>
              </ol>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Are you seeing a hollow cave instead of a popped-out shape?
              </h3>
              <p>
                Humans view stereograms with one of two distinct ocular techniques:
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-bold text-indigo-400 mb-1">Parallel (Wall-Eyed)</div>
                  <p className="text-[11px] text-slate-400">
                    Eyes look straight or slightly diverge into the distance. This is the classic 1990s Magic Eye standard.
                  </p>
                  <button
                    onClick={() => {
                      onSwitchMode('parallel');
                      onClose();
                    }}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                  >
                    Select Parallel Mode
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-bold text-pink-400 mb-1">Cross-Eyed (Convergent)</div>
                  <p className="text-[11px] text-slate-400">
                    Eyes cross in front of the screen. If you cross your eyes on a parallel stereogram, depths look hollow or inverted!
                  </p>
                  <button
                    onClick={() => {
                      onSwitchMode('cross-eyed');
                      onClose();
                    }}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-pink-600 text-white text-xs font-semibold hover:bg-pink-500 transition"
                  >
                    Select Cross-Eyed Mode
                  </button>
                </div>
              </div>
              <p className="text-slate-400 text-[11px] pt-1">
                💡 Tip: If an object looks recessed like an indentation in sand rather than a raised 3D object, simply switch to Cross-Eyed Mode!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
          <div className="text-[11px] text-slate-500">
            Press <strong className="text-slate-400">Esc</strong> or click Got it to resume creating.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition"
          >
            Got it, let's create!
          </button>
        </div>
      </div>
    </div>
  );
};
