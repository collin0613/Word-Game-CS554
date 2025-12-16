import React from 'react';

function HintBox({ visibleHints }) {
  if (!visibleHints.length) return null;

  return (
    <div className="hint-box">
      <h3>Hints</h3>
      <ul>
        {visibleHints.map((hint, idx) => (
          <li key={idx}>{hint}</li>
        ))}
      </ul>
    </div>
  );
}

export default HintBox;
