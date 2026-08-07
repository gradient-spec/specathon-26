import { Code2, GitBranch, Cpu, Terminal, Share2, Zap } from 'lucide-react';
import { DEFAULT_FRAME } from '../constants/frames';

import agLogo from '../assets/domains/agriculture.png';
import aiLogo from '../assets/domains/artificial-intelligence.png';
import blockchainLogo from '../assets/domains/blockchain.png';
import securityLogo from '../assets/domains/cyber-security.png';
import iotLogo from '../assets/domains/iot.png';

import dataScienceLogo from '../assets/domains/data-science.png';
import povertyLogo from '../assets/domains/low poverty.png';
import innovationLogo from '../assets/domains/open innovation.png';
import mobilityLogo from '../assets/domains/self-driving-car.png';
import recycleLogo from '../assets/domains/waste-management.png';

function AiChip({ color }) {
  return (
    <div
      className="w-4 h-4 rounded border flex items-center justify-center font-mono font-bold text-[6px] tracking-wider"
      style={{ borderColor: color, color }}
    >
      AI
    </div>
  );
}

// =====================================================================
// MANUAL POSITIONS TABLE — Edit these values to place each element!
//
//   top  = vertical position as a % of the frame height (0% = top, 100% = bottom)
//   x    = horizontal nudge in pixels (negative = toward outer border, positive = toward camera frame)
//   rot  = rotation in degrees (negative = tilt left, positive = tilt right)
//
// There are 5 elements on each side. Adjust each one independently.
// =====================================================================

const MANUAL_POSITIONS = {
  left: [
    { top: 10, x: -1, rot: -4 },   // Element 1 (topmost)
    { top: 28, x: -2, rot: 10 },   // Element 2
    { top: 50, x: -1, rot: -10 },   // Element 3 (middle)
    { top: 70, x: -2, rot: -15 },   // Element 4
    { top: 90, x: 1, rot: 20 },   // Element 5 (bottommost)
  ],
  right: [
    { top: 9, x: 2, rot: 20 },   // Element 1 (topmost)
    { top: 28, x: 2, rot: -20 },   // Element 2
    { top: 50, x: 3, rot: 20 },   // Element 3 (middle)
    { top: 70, x: 0, rot: 0 },   // Element 4
    { top: 88, x: 3, rot: 20 },   // Element 5 (bottommost)
  ],
};

function getManualOffsets(isLeft, index) {
  const pos = isLeft ? MANUAL_POSITIONS.left[index] : MANUAL_POSITIONS.right[index];
  return {
    top: `${pos.top}%`,
    x: pos.x,
    rot: pos.rot
  };
}

export default function PolaroidDecorations({ frame = DEFAULT_FRAME }) {
  const safeFrame = frame || DEFAULT_FRAME;
  const {
    motifIndigo: indigo = '#3730A3',
    motifViolet: violet = '#6D28D9',
    motifCyan: cyan = '#0369A1',
  } = safeFrame;

  const isDomainFrame = ['burgundy', 'slate', 'gold'].includes(safeFrame.id);

  let leftItems = [];
  let rightItems = [];

  if (isDomainFrame) {
    // 10 domain logos split into two distinct sets
    const leftSet = [agLogo, aiLogo, blockchainLogo, securityLogo, iotLogo];
    const rightSet = [dataScienceLogo, povertyLogo, innovationLogo, mobilityLogo, recycleLogo];

    let leftOrdered = [...leftSet];
    let rightOrdered = [...rightSet];

    // Shuffling patterns based on frame ID to differentiate each theme
    if (safeFrame.id === 'slate') {
      leftOrdered = [blockchainLogo, agLogo, iotLogo, securityLogo, aiLogo];
      rightOrdered = [innovationLogo, mobilityLogo, dataScienceLogo, recycleLogo, povertyLogo];
    } else if (safeFrame.id === 'gold') {
      leftOrdered = [securityLogo, blockchainLogo, aiLogo, iotLogo, agLogo];
      rightOrdered = [recycleLogo, innovationLogo, povertyLogo, dataScienceLogo, mobilityLogo];
    }

    leftItems = leftOrdered.map((logo, index) => {
      const layout = getManualOffsets(true, index);
      return {
        top: layout.top,
        x: layout.x,
        rot: layout.rot,
        node: (
          <img
            src={logo}
            alt="domain-left"
            className="w-5 h-5 object-contain transition-all duration-300"
            style={{
              filter: safeFrame.logoFilter || 'none',
              mixBlendMode: safeFrame.isDark ? 'screen' : 'multiply',
              opacity: 0.9,
            }}
          />
        ),
      };
    });

    rightItems = rightOrdered.map((logo, index) => {
      const layout = getManualOffsets(false, index);
      return {
        top: layout.top,
        x: layout.x,
        rot: layout.rot,
        node: (
          <img
            src={logo}
            alt="domain-right"
            className="w-5 h-5 object-contain transition-all duration-300"
            style={{
              filter: safeFrame.logoFilter || 'none',
              mixBlendMode: safeFrame.isDark ? 'screen' : 'multiply',
              opacity: 0.9,
            }}
          />
        ),
      };
    });
  } else {
    // 5 Standard Tech Elements for Classic and Midnight (shuffled order for Midnight)
    let leftStandard = [
      { key: 'code', node: <span className="font-mono text-[10px] font-bold" style={{ color: indigo }}>{'</>'}</span> },
      { key: 'ai', node: <AiChip color={indigo} /> },
      { key: 'git', node: <GitBranch className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
      { key: 'terminal', node: <Terminal className="w-4 h-4" style={{ color: indigo }} strokeWidth={2} /> },
      { key: 'zap', node: <Zap className="w-4 h-4" style={{ color: violet }} strokeWidth={2} fill="currentColor" fillOpacity={0.25} /> },
    ];

    let rightStandard = [
      { key: 'binary', node: <span className="font-mono text-[8px] font-bold leading-[1.2] text-right block" style={{ color: cyan }}>0101<br />1010</span> },
      { key: 'brackets', node: <span className="font-mono text-[10px] font-bold" style={{ color: violet }}>{'{ }'}</span> },
      { key: 'code2', node: <Code2 className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
      { key: 'share', node: <Share2 className="w-4 h-4" style={{ color: indigo }} strokeWidth={2} /> },
      { key: 'cpu', node: <Cpu className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
    ];

    if (safeFrame.id === 'midnight') {
      leftStandard = [
        { key: 'git', node: <GitBranch className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
        { key: 'code', node: <span className="font-mono text-[10px] font-bold" style={{ color: indigo }}>{'</>'}</span> },
        { key: 'zap', node: <Zap className="w-4 h-4" style={{ color: violet }} strokeWidth={2} fill="currentColor" fillOpacity={0.25} /> },
        { key: 'ai', node: <AiChip color={indigo} /> },
        { key: 'terminal', node: <Terminal className="w-4 h-4" style={{ color: indigo }} strokeWidth={2} /> },
      ];
      rightStandard = [
        { key: 'cpu', node: <Cpu className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
        { key: 'brackets', node: <span className="font-mono text-[10px] font-bold" style={{ color: violet }}>{'{ }'}</span> },
        { key: 'share', node: <Share2 className="w-4 h-4" style={{ color: indigo }} strokeWidth={2} /> },
        { key: 'binary', node: <span className="font-mono text-[8px] font-bold leading-[1.2] text-right block" style={{ color: cyan }}>0101<br />1010</span> },
        { key: 'code2', node: <Code2 className="w-4 h-4" style={{ color: cyan }} strokeWidth={2} /> },
      ];
    }

    leftItems = leftStandard.map((item, index) => {
      const layout = getManualOffsets(true, index);
      return {
        top: layout.top,
        x: layout.x,
        rot: layout.rot,
        node: item.node
      };
    });

    rightItems = rightStandard.map((item, index) => {
      const layout = getManualOffsets(false, index);
      return {
        top: layout.top,
        x: layout.x,
        rot: layout.rot,
        node: item.node
      };
    });
  }

  return (
    <div className="pointer-events-none absolute inset-0 hidden z-10" aria-hidden="true">
      {leftItems.map((item, i) => (
        <div
          key={i}
          className="absolute -left-3 transform -translate-y-1/2"
          style={{
            top: item.top,
            transform: `translate(calc(-50% + ${item.x}px), -50%) rotate(${item.rot}deg)`
          }}
        >
          {item.node}
        </div>
      ))}
      {rightItems.map((item, i) => (
        <div
          key={i}
          className="absolute -right-3 transform -translate-y-1/2"
          style={{
            top: item.top,
            transform: `translate(calc(50% + ${item.x}px), -50%) rotate(${item.rot}deg)`
          }}
        >
          {item.node}
        </div>
      ))}
    </div>
  );
}

