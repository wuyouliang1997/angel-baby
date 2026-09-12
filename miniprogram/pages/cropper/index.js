Page({
  data: {
    src: '',
    imageInfo: null,
    // 图片变换状态
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotate: 0
  },

  // 手势状态
  _lastDist: 0,
  _lastCenter: null,
  _startX: 0,
  _startY: 0,
  _startOffsetX: 0,
  _startOffsetY: 0,
  _isDragging: false,

  onLoad(options) {
    if (options.src) {
      this.setData({ src: options.src });
      this.getImageInfo(options.src);
    }
  },

  getImageInfo(src) {
    wx.getImageInfo({
      src,
      success: (res) => {
        this.setData({ imageInfo: res });
      },
      fail: () => {
        wx.showToast({ title: '图片加载失败', icon: 'none' });
      }
    });
  },

  // 获取两指距离
  _getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // 触摸开始
  onTouchStart(e) {
    if (e.touches.length === 1) {
      // 单指：准备拖动
      this._isDragging = true;
      this._startX = e.touches[0].clientX;
      this._startY = e.touches[0].clientY;
      this._startOffsetX = this.data.offsetX;
      this._startOffsetY = this.data.offsetY;
    } else if (e.touches.length === 2) {
      // 双指：准备缩放
      this._isDragging = false;
      this._lastDist = this._getDistance(e.touches);
    }
  },

  // 触摸移动
  onTouchMove(e) {
    if (e.touches.length === 1 && this._isDragging) {
      // 单指拖动
      const dx = e.touches[0].clientX - this._startX;
      const dy = e.touches[0].clientY - this._startY;
      this.setData({
        offsetX: this._startOffsetX + dx,
        offsetY: this._startOffsetY + dy
      });
    } else if (e.touches.length === 2) {
      // 双指缩放
      const dist = this._getDistance(e.touches);
      if (this._lastDist > 0) {
        const ratio = dist / this._lastDist;
        let newScale = this.data.scale * ratio;
        newScale = Math.max(0.5, Math.min(newScale, 3));
        this.setData({ scale: newScale });
      }
      this._lastDist = dist;
    }
  },

  // 触摸结束
  onTouchEnd() {
    this._isDragging = false;
    this._lastDist = 0;
  },

  // 旋转
  onRotate() {
    const rotate = this.data.rotate + 90;
    this.setData({ rotate: rotate >= 360 ? 0 : rotate });
  },

  // 重置
  onReset() {
    this.setData({ offsetX: 0, offsetY: 0, scale: 1, rotate: 0 });
  },

  cancel() {
    wx.navigateBack();
  },

  confirm() {
    const { src, scale, rotate, offsetX, offsetY, imageInfo } = this.data;
    if (!imageInfo) {
      wx.showToast({ title: '图片未加载完成', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '裁剪中...' });

    const query = wx.createSelectorQuery().in(this);
    query.select('#cropCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          wx.showToast({ title: '画布初始化失败', icon: 'none' });
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const sys = wx.getSystemInfoSync();
        const dpr = sys.pixelRatio;

        // 裁剪区域大小
        const cropSize = 500 * (sys.windowWidth / 750);
        canvas.width = cropSize * dpr;
        canvas.height = cropSize * dpr;
        ctx.scale(dpr, dpr);

        const img = canvas.createImage();
        img.onload = () => {
          ctx.clearRect(0, 0, cropSize, cropSize);

          // 圆形裁剪
          ctx.save();
          ctx.beginPath();
          ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // 计算绘制参数
          const imgW = imageInfo.width;
          const imgH = imageInfo.height;
          const drawSize = cropSize * scale;

          ctx.translate(cropSize / 2 + offsetX, cropSize / 2 + offsetY);
          ctx.rotate((rotate * Math.PI) / 180);

          const ratio = Math.max(drawSize / imgW, drawSize / imgH);
          const dw = imgW * ratio;
          const dh = imgH * ratio;
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

          ctx.restore();

          wx.canvasToTempFilePath({
            canvas,
            x: 0,
            y: 0,
            width: cropSize * dpr,
            height: cropSize * dpr,
            destWidth: cropSize * 2,
            destHeight: cropSize * 2,
            fileType: 'jpg',
            quality: 0.9,
            success: (tempRes) => {
              wx.hideLoading();
              const eventChannel = this.getOpenerEventChannel();
              eventChannel.emit('cropResult', { tempFilePath: tempRes.tempFilePath });
              wx.navigateBack();
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('导出裁剪图失败:', err);
              const eventChannel = this.getOpenerEventChannel();
              eventChannel.emit('cropResult', { tempFilePath: src });
              wx.navigateBack();
            }
          });
        };

        img.onerror = () => {
          wx.hideLoading();
          wx.showToast({ title: '图片加载失败', icon: 'none' });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        };

        img.src = src;
      });
  }
});
