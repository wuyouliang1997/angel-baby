Page({
  data: {
    babyId: '',
    records: [],
    latestHeight: '--',
    latestWeight: '--',
    totalCount: 0
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({ babyId: options.babyId });
    }
  },

  onShow() {
    if (this.data.babyId) {
      this.loadData();
    }
  },

  async loadData() {
    wx.showLoading({ title: '加载中...' });
    const res = await this.callCloudFunction('getGrowthRecordsForChart', {
      babyId: this.data.babyId,
      limit: 5
    });
    wx.hideLoading();

    if (res && res.success) {
      const records = res.data || [];
      const latest = records.length > 0 ? records[records.length - 1] : null;
      this.setData({
        records,
        latestHeight: latest ? latest.height || '--' : '--',
        latestWeight: latest ? latest.weight || '--' : '--',
        totalCount: res.total || records.length
      });

      if (records.length > 0) {
        setTimeout(() => this.drawChart(), 100);
      }
    }
  },

  drawChart() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#growthChart')
      .fields({ node: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          setTimeout(() => this.drawChart(), 200);
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const sys = wx.getSystemInfoSync();
        const dpr = sys.pixelRatio;

        const rpx = sys.windowWidth / 750;
        const width = sys.windowWidth * 0.9 - 20 * rpx;
        const height = 650 * rpx;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.drawGrowthChart(ctx, width, height);
      });
  },

  drawGrowthChart(ctx, width, height) {
    const { records } = this.data;
    if (!records || records.length === 0) return;

    const padding = { top: 40, right: 35, bottom: 50, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // 准备数据
    const heights = records.filter(r => r.height).map(r => r.height);
    const weights = records.filter(r => r.weight).map(r => r.weight);

    const maxH = heights.length > 0 ? Math.max(...heights) : 100;
    const minH = heights.length > 0 ? Math.min(...heights) : 50;
    const maxW = weights.length > 0 ? Math.max(...weights) : 10;
    const minW = weights.length > 0 ? Math.min(...weights) : 3;

    const calcNiceMax = (max, min) => {
      const range = max - min;
      if (range <= 0) return max + 10;
      const rough = range / 3;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const n = rough / mag;
      let step;
      if (n <= 1) step = 1;
      else if (n <= 2) step = 2;
      else if (n <= 5) step = 5;
      else step = 10;
      return Math.ceil(max / step) * step + step;
    };

    const calcNiceMin = (min) => {
      if (min <= 0) return 0;
      const mag = Math.pow(10, Math.floor(Math.log10(min)));
      return Math.floor(min / mag) * mag;
    };

    const yMaxH = calcNiceMax(maxH, minH);
    const yMinH = calcNiceMin(minH);
    const yRangeH = yMaxH - yMinH || 1;

    const yMaxW = calcNiceMax(maxW, minW);
    const yMinW = calcNiceMin(minW);
    const yRangeW = yMaxW - yMinW || 1;

    // 网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // 左侧标签（身高，红色）
      const hVal = yMaxH - (yRangeH / 4) * i;
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(hVal), padding.left - 6, y + 4);

      // 右侧标签（体重，蓝色）
      const wVal = yMaxW - (yRangeW / 4) * i;
      ctx.fillStyle = '#7EC8E3';
      ctx.textAlign = 'left';
      ctx.fillText(wVal.toFixed(1), width - padding.right + 6, y + 4);
    }

    // 左侧Y轴
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // 右侧Y轴
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    // X轴
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    // 计算点坐标
    const pointsH = records.map((item, index) => ({
      x: padding.left + (chartWidth / Math.max(records.length - 1, 1)) * index,
      y: padding.top + chartHeight - (item.height != null ? ((item.height - yMinH) / yRangeH) * chartHeight : 0),
      value: item.height
    }));

    const pointsW = records.map((item, index) => ({
      x: padding.left + (chartWidth / Math.max(records.length - 1, 1)) * index,
      y: padding.top + chartHeight - (item.weight != null ? ((item.weight - yMinW) / yRangeW) * chartHeight : 0),
      value: item.weight
    }));

    // 身高渐变填充
    const gradientH = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradientH.addColorStop(0, 'rgba(255, 107, 107, 0.3)');
    gradientH.addColorStop(1, 'rgba(255, 107, 107, 0.02)');

    ctx.fillStyle = gradientH;
    ctx.beginPath();
    let started = false;
    ctx.moveTo(pointsH[0].x, padding.top + chartHeight);
    pointsH.forEach(point => {
      if (point.value != null) {
        if (!started) {
          ctx.lineTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
    });
    const lastH = pointsH.filter(p => p.value != null);
    if (lastH.length > 0) {
      ctx.lineTo(lastH[lastH.length - 1].x, padding.top + chartHeight);
    }
    ctx.closePath();
    ctx.fill();

    // 身高折线（红色实线）
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    started = false;
    pointsH.forEach(point => {
      if (point.value != null) {
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
    });
    ctx.stroke();

    // 体重折线（蓝色实线）
    ctx.strokeStyle = '#7EC8E3';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    started = false;
    pointsW.forEach(point => {
      if (point.value != null) {
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
    });
    ctx.stroke();

    // 身高数据点
    pointsH.forEach(point => {
      if (point.value != null) {
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(point.value, point.x, point.y - 16);
      }
    });

    // 体重数据点
    pointsW.forEach(point => {
      if (point.value != null) {
        ctx.fillStyle = '#7EC8E3';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#7EC8E3';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(point.value, point.x, point.y + 22);
      }
    });

    // X轴日期标签
    records.forEach((item, index) => {
      const x = padding.left + (chartWidth / Math.max(records.length - 1, 1)) * index;
      const d = new Date(item.recordDate);
      const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, height - 12);
    });

    // 图例
    const legendY = 16;
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(padding.left + 8, legendY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('身高(cm)', padding.left + 18, legendY + 4);

    ctx.fillStyle = '#7EC8E3';
    ctx.beginPath();
    ctx.arc(padding.left + 90, legendY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.fillText('体重(kg)', padding.left + 100, legendY + 4);
  },

  async callCloudFunction(type, data = {}) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type, data }
      });
      return res.result;
    } catch (err) {
      console.error(`[${type}] failed:`, err);
      return { success: false, errMsg: err.errMsg };
    }
  }
});
