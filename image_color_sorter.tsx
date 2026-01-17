import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Download, Save, FolderOpen, Pipette } from 'lucide-react';

const ImageColorSorter = () => {
  const [images, setImages] = useState([]);
  const [sortedImages, setSortedImages] = useState([]);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  const [gap, setGap] = useState(10);
  const [sortDirection, setSortDirection] = useState('hue-asc');
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [activeWeightPanel, setActiveWeightPanel] = useState(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [pickingColor, setPickingColor] = useState(null);
  const [previewColor, setPreviewColor] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const resultRef = useRef(null);

  // 加载保存的项目
  useEffect(() => {
    loadProject();
  }, []);

  // 自动保存 - 防抖处理
  useEffect(() => {
    if (images.length > 0) {
      const timer = setTimeout(() => {
        saveProject();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [images]);

  // 处理后自动更新
  useEffect(() => {
    if (isProcessed && images.length > 0) {
      performSort();
    }
  }, [rows, cols, gap, sortDirection, images]);

  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s * 100, l * 100];
  };

  const extractDominantColor = (img) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 缩小图片以提高性能
    const maxSize = 100;
    const scale = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // 颜色统计对象
    const colorMap = {};
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // 排除透明像素
      if (a < 128) continue;
      
      // 排除白色及接近白色的像素 (RGB > 240)
      if (r > 240 && g > 240 && b > 240) continue;
      
      // 排除黑色及接近黑色的像素 (RGB < 15) - 可选
      // if (r < 15 && g < 15 && b < 15) continue;
      
      // 将相似颜色合并 (降低精度到16级)
      const rKey = Math.floor(r / 16) * 16;
      const gKey = Math.floor(g / 16) * 16;
      const bKey = Math.floor(b / 16) * 16;
      const key = `${rKey},${gKey},${bKey}`;
      
      if (!colorMap[key]) {
        colorMap[key] = { r: rKey, g: gKey, b: bKey, count: 0 };
      }
      colorMap[key].count++;
    }
    
    // 找出出现次数最多的颜色
    let dominantColor = { r: 128, g: 128, b: 128 }; // 默认灰色
    let maxCount = 0;
    
    for (const key in colorMap) {
      if (colorMap[key].count > maxCount) {
        maxCount = colorMap[key].count;
        dominantColor = {
          r: colorMap[key].r,
          g: colorMap[key].g,
          b: colorMap[key].b
        };
      }
    }

    return dominantColor;
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 60) {
      alert('最多只能上传60张图片');
      return;
    }

    files.forEach(file => {
      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert(`${file.name} 格式不支持,仅支持PNG和JPEG`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const color = extractDominantColor(img);
          const newImage = {
            id: Date.now() + Math.random(),
            src: event.target.result,
            color,
            weight: 3,
            imgElement: img
          };
          setImages(prev => [...prev, newImage]);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const performSort = () => {
    const sorted = [...images].sort((a, b) => {
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }

      const hslA = rgbToHsl(a.color.r, a.color.g, a.color.b);
      const hslB = rgbToHsl(b.color.r, b.color.g, b.color.b);

      if (sortDirection === 'hue-asc') {
        return hslA[0] - hslB[0];
      } else {
        return hslB[0] - hslA[0];
      }
    });

    setSortedImages(sorted);
    setIsProcessed(true);
  };

  const handleProcess = () => {
    if (images.length === 0) {
      alert('请先上传图片');
      return;
    }
    performSort();
  };

  const toggleImageSelection = (id) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedImages(newSelection);
  };

  const deleteSelected = () => {
    if (selectedImages.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedImages.size} 张图片吗?`)) return;

    setImages(prev => prev.filter(img => !selectedImages.has(img.id)));
    setSortedImages(prev => prev.filter(img => !selectedImages.has(img.id)));
    setSelectedImages(new Set());
  };

  const setWeight = (id, weight) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, weight } : img
    ));
  };

  const startColorPicking = (id) => {
    setPickingColor(id);
    setActiveWeightPanel(null);
    
    // 准备canvas用于取色
    const img = images.find(item => item.id === id);
    if (img && img.imgElement) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img.imgElement, 0, 0, canvas.width, canvas.height);
        }
      }, 0);
    }
  };

  const handleCanvasClick = (e, img) => {
    if (pickingColor !== img.id) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 获取图片元素的位置
    const imgElement = e.target;
    const rect = imgElement.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;

    setImages(prev => prev.map(item => 
      item.id === img.id 
        ? { ...item, color: { r: pixel[0], g: pixel[1], b: pixel[2] } }
        : item
    ));

    setPickingColor(null);
    setPreviewColor(null);
  };

  const handleCanvasMove = (e, img) => {
    if (pickingColor !== img.id) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgElement = e.target;
    const rect = imgElement.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    setPreviewColor(`rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`);
  };

  const saveProject = () => {
    try {
      // 只保存必要的数据，不保存完整图片
      const project = {
        images: images.map(img => ({
          id: img.id,
          color: img.color,
          weight: img.weight
          // 不保存src，因为base64图片太大
        })),
        settings: { rows, cols, gap, sortDirection }
      };
      localStorage.setItem('imageColorSorterProject', JSON.stringify(project));
      alert('✅ 设置已保存！');
    } catch (error) {
      console.error('保存失败:', error);
      // localStorage 空间不足时清除旧数据
      if (error.name === 'QuotaExceededError') {
        localStorage.removeItem('imageColorSorterProject');
        alert('❌ 存储空间不足，已清除旧数据。注意：关闭页面后图片将丢失，请及时导出结果。');
      } else {
        alert('❌ 保存失败：' + error.message);
      }
    }
  };

  const loadProject = () => {
    const saved = localStorage.getItem('imageColorSorterProject');
    if (!saved) {
      alert('ℹ️ 没有找到已保存的设置');
      return;
    }

    try {
      const project = JSON.parse(saved);
      // 只恢复设置和权重，图片需要重新上传
      if (project.settings) {
        setRows(project.settings.rows);
        setCols(project.settings.cols);
        setGap(project.settings.gap);
        setSortDirection(project.settings.sortDirection);
        alert('✅ 设置已加载！');
      }
      // 如果有图片数据（只有颜色和权重），等待用户重新上传图片后应用
      if (project.images && project.images.length > 0) {
        // 保存权重配置供后续使用
        window.savedWeights = project.images;
      }
    } catch (e) {
      console.error('加载项目失败', e);
      alert('❌ 加载失败：' + e.message);
    }
  };

  const exportImage = async () => {
    if (!isProcessed || sortedImages.length === 0) {
      alert('⚠️ 请先点击"处理图片"按钮生成排序结果');
      return;
    }

    try {
      // 创建导出canvas
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      
      // 获取单张图片的实际显示尺寸
      const gridContainer = resultRef.current;
      const firstImg = gridContainer?.querySelector('img');
      
      if (!firstImg) {
        alert('❌ 未找到图片元素');
        return;
      }
      
      const imgWidth = firstImg.clientWidth || 200;
      const imgHeight = firstImg.clientHeight || 200;
      
      // 计算总尺寸
      const totalWidth = cols * imgWidth + (cols - 1) * gap;
      const totalHeight = rows * imgHeight + (rows - 1) * gap;
      
      exportCanvas.width = totalWidth;
      exportCanvas.height = totalHeight;
      
      // 填充背景色
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // 绘制所有图片
      const imagesToExport = sortedImages.slice(0, rows * cols);
      let loadedCount = 0;
      
      const drawPromises = imagesToExport.map((img, index) => {
        return new Promise((resolve, reject) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const x = col * (imgWidth + gap);
          const y = row * (imgHeight + gap);
          
          if (img.imgElement && img.imgElement.complete) {
            ctx.drawImage(img.imgElement, x, y, imgWidth, imgHeight);
            resolve();
          } else {
            // 如果图片未加载，重新加载
            const tempImg = new Image();
            tempImg.onload = () => {
              ctx.drawImage(tempImg, x, y, imgWidth, imgHeight);
              resolve();
            };
            tempImg.onerror = reject;
            tempImg.src = img.src;
          }
        });
      });

      // 等待所有图片绘制完成
      await Promise.all(drawPromises);

      // 导出图片
      const link = document.createElement('a');
      link.download = `sorted-images-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      
      alert('✅ 导出成功！');
    } catch (error) {
      console.error('导出失败:', error);
      alert('❌ 导出失败：' + error.message);
    }
  };

  const displayImages = isProcessed ? sortedImages : images;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">图片色彩排序工具</h1>

        {/* 上传区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
            💡 提示：图片仅保存在浏览器内存中，关闭页面后会丢失。请及时导出结果！仅设置项会被保存。
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-500 transition-colors flex flex-col items-center gap-3"
          >
            <Upload className="w-12 h-12 text-gray-400" />
            <span className="text-gray-600">点击上传图片 (最多60张, PNG/JPEG)</span>
            <span className="text-sm text-gray-400">已上传: {images.length}/60</span>
          </button>
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">排序方向</label>
              <select 
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="hue-asc">色相环 (正序)</option>
                <option value="hue-desc">色相环 (倒序)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">行数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">列数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">间距 (px)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={gap}
                onChange={(e) => setGap(parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleProcess}
                disabled={images.length === 0}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                处理图片
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={deleteSelected}
              disabled={selectedImages.size === 0}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedImages.size})
            </button>
            <button
              onClick={saveProject}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              <Save className="w-4 h-4" />
              保存设置
            </button>
            <button
              onClick={loadProject}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              <FolderOpen className="w-4 h-4" />
              加载设置
            </button>
            <button
              onClick={exportImage}
              disabled={!isProcessed}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed ml-auto"
            >
              <Download className="w-4 h-4" />
              导出拼接图
            </button>
          </div>
        </div>

        {/* 图片网格 */}
        <div ref={resultRef} className="bg-white rounded-lg shadow-sm p-6">
          <div 
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: `${gap}px`
            }}
          >
            {displayImages.map((img) => (
              <div
                key={img.id}
                className="relative group aspect-square"
                onClick={(e) => {
                  if (!pickingColor && e.target.tagName !== 'BUTTON') {
                    toggleImageSelection(img.id);
                  }
                }}
              >
                {/* 显示实际图片 */}
                <img
                  src={img.src}
                  alt="uploaded"
                  className={`w-full h-full object-cover rounded ${
                    selectedImages.has(img.id) ? 'ring-4 ring-blue-500' : ''
                  } ${pickingColor === img.id ? 'cursor-crosshair' : 'cursor-pointer'}`}
                  onClick={(e) => {
                    if (pickingColor === img.id) {
                      handleCanvasClick(e, img);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (pickingColor === img.id) {
                      handleCanvasMove(e, img);
                    }
                  }}
                />

                {/* 隐藏的Canvas用于取色 */}
                <canvas
                  ref={pickingColor === img.id ? canvasRef : null}
                  className="hidden"
                  width={img.imgElement?.width || 200}
                  height={img.imgElement?.height || 200}
                  onLoad={(e) => {
                    const canvas = e.target;
                    const ctx = canvas.getContext('2d');
                    if (img.imgElement) {
                      ctx.drawImage(img.imgElement, 0, 0, canvas.width, canvas.height);
                    }
                  }}
                />

                {/* 主色条 */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-8"
                  style={{ backgroundColor: `rgb(${img.color.r}, ${img.color.g}, ${img.color.b})` }}
                />

                {/* 取色图标 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startColorPicking(img.id);
                  }}
                  className="absolute top-2 right-2 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                >
                  <Pipette className="w-4 h-4 text-gray-700" />
                </button>

                {/* 权重显示 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveWeightPanel(activeWeightPanel === img.id ? null : img.id);
                    setPickingColor(null);
                  }}
                  className="absolute top-2 left-2 bg-white px-2 py-1 rounded shadow text-sm font-medium"
                >
                  ⭐ {img.weight}
                </button>

                {/* 权重面板 */}
                {activeWeightPanel === img.id && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-4 z-10">
                    <div className="text-center mb-3 font-medium">设置权重</div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(w => (
                        <button
                          key={w}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWeight(img.id, w);
                            setActiveWeightPanel(null);
                          }}
                          className={`w-10 h-10 rounded ${
                            img.weight === w 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 颜色预览 */}
                {pickingColor === img.id && previewColor && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <div 
                      className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
                      style={{ backgroundColor: previewColor }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {displayImages.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              暂无图片,请上传图片开始使用
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageColorSorter;