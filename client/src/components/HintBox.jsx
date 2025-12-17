import React from 'react';
function HintBox({ visibleHints }) {
  if (!visibleHints.length) return null;

  return (
    <div className="mx-auto mb-6 w-full max-w-3xl rounded-xl bg-white p-6 shadow">
      <h3 className="mb-3 text-center text-xl font-semibold text-gray-800">
        Hints
      </h3>

      <ul className="space-y-2 text-center break-words">
        {visibleHints.map((hint, idx) => (
          <li
            key={idx}
            className={
              idx === visibleHints.length - 1
                ? "font-semibold text-blue-600"
                : "text-gray-700"
            }
          >
            {hint}
          </li>
        ))}
      </ul>
    </div>
  );
}
export default HintBox

