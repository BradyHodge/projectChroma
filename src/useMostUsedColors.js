import { useState, useEffect } from 'react';

function useMostUsedColors(url) {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchColors = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const imgObj = new Image();
          imgObj.onload = () => {
            canvas.width = imgObj.width;
            canvas.height = imgObj.height;
            ctx.drawImage(imgObj, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            const colorMap = {};

            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
              
              if (colorMap[hex]) {
                colorMap[hex]++;
              } else {
                colorMap[hex] = 1;
              }
            }

            const sortedColors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
            setColors(sortedColors.slice(0, 5)); // Get top 5 colors
          };
          imgObj.src = reader.result;
        };
        reader.readAsDataURL(img);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchColors();
  }, [url]);

  return { colors, loading, error };
}

export default useMostUsedColors;