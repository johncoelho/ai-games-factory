import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { RadioEngine, VOLUME_PADRAO } from './radioEngine.js';

const MONO = "ui-monospace,Consolas,'JetBrains Mono',monospace";
const CHAVE_VOL = 'factory-radio-volume';

// Guarda so o volume. A radio NUNCA liga sozinha: o AudioContext so nasce no clique do usuario.
function volumeSalvo(): number {
  try {
    const v = parseFloat(localStorage.getItem(CHAVE_VOL) ?? '');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : VOLUME_PADRAO;
  } catch {
    return VOLUME_PADRAO;
  }
}

export function Radio() {
  const motor = useRef<RadioEngine | null>(null);
  const [ligada, setLigada] = useState(false);
  const [vol, setVol] = useState(volumeSalvo);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const m = (motor.current ??= new RadioEngine());
    m.setVolume(vol);
    return () => m.desligar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVis = () => motor.current?.pausar(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const alternar = () => {
    const m = motor.current;
    if (!m) return;
    if (ligada) {
      m.desligar();
      setLigada(false);
      return;
    }
    m.setVolume(vol);
    const ok = m.ligar();
    setErro(!ok);
    setLigada(ok);
  };

  const mudarVol = (v: number) => {
    setVol(v);
    motor.current?.setVolume(v);
    try {
      localStorage.setItem(CHAVE_VOL, String(v));
    } catch {
      /* sem armazenamento */
    }
  };

  // portal no body: o HumanLayer vive dentro de um painel com transform (mobile, 200% de largura) e isso desloca o position:fixed
  return createPortal(
    <div
      data-radio
      className="factory-radio"
      style={{ position: 'fixed', zIndex: 26, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(8,9,12,.92)', border: '1px solid ' + (ligada ? '#6FCF97' : '#262E3A'), padding: '6px 10px', font: '11px ' + MONO, color: '#EEF1F6' }}
    >
      {/* desktop: topo, a direita do titulo (longe do popup central, da legenda e da coluna de agentes); mobile: canto superior direito, abaixo do titulo */}
      <style>{'.factory-radio{left:calc(50% + 150px);right:auto;top:12px;bottom:auto}@media (max-width:700px){.factory-radio{left:auto;right:8px;top:76px;bottom:auto}}'}</style>
      <button
        type="button"
        onClick={alternar}
        aria-label={ligada ? 'Desligar rádio' : 'Ligar rádio'}
        title={ligada ? 'Desligar rádio' : 'Ligar rádio'}
        aria-pressed={ligada}
        style={{ background: '#0F1318', color: ligada ? '#6FCF97' : '#EEF1F6', border: '1px solid #262E3A', font: '14px ' + MONO, minWidth: 36, minHeight: 36, cursor: 'pointer' }}
      >
        {ligada ? '♪' : '♫'}
      </button>
      <span>{erro ? 'Sem áudio' : ligada ? 'Rádio: ligada' : 'Rádio: desligada'}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={vol}
        onChange={(e) => mudarVol(parseFloat(e.target.value))}
        aria-label="Volume da rádio"
        style={{ width: 56 }}
      />
    </div>,
    document.body,
  );
}
