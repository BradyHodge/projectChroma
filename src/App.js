import React, { useState } from 'react';
import './App.css';
import { Copy, Check } from 'lucide-react';

const generateRandomColor = () => {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
};

const ColorBox = ({ color }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(color).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="color-box" style={{ backgroundColor: color }}>
      <span>{color}</span>
      <button onClick={copyToClipboard} className="copy-button">
        {copied ? <Check size={20} /> : <Copy size={20} />}
      </button>
    </div>
  );
};

const App = () => {
  const [colors, setColors] = useState(Array(5).fill().map(generateRandomColor));

  const generateNewPalette = () => {
    setColors(Array(5).fill().map(generateRandomColor));
  };
// The ER is a bad place to do homework, I wana sleep
  return (
    <div className="app">
      <div className="palette-container">
        <div className="palette">
          <h1>Random Color Palette Generator</h1>
          <div className="color-boxes">
            {colors.map((color, index) => (
              <ColorBox key={index} color={color} />
            ))}
          </div>
          <button onClick={generateNewPalette} className="generate-button">
            Generate New Palette
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;