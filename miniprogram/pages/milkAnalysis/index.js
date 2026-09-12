Page({
  data: {
    babyId: '',
    chartData: [],
    maxAmount: 0,
    avgAmount: 0,
    totalAmount: 0,
    days: 0,
    totalCount: 0,
    avgCount: 0
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
    const dateList = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const full = year + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
      const short = month + '/' + day;
      dateList.push({ full, short });
    }

    const startDate = dateList[0].full;
    const endDate = dateList[6].full;

    wx.showLoading({ title: '加载中...' });
    const res = await this.callCloudFunction('getMilkRecordsByDateRange', {
      startDate,
      endDate,
      babyId: this.data.babyId
    });
    wx.hideLoading();

    if (res && res.success) {
      this.processData(res.data || [], dateList);
    }
  },

  processData(records, dateList) {
    const dailyAmountMap = {};
    const dailyCountMap = {};
    dateList.forEach(item => {
      dailyAmountMap[item.full] = 0;
      dailyCountMap[item.full] = 0;
    });

    records.forEach(record => {
      if (dailyAmountMap[record.recordDate] !== undefined) {
        dailyAmountMap[record.recordDate] += record.amount;
        dailyCountMap[record.recordDate] += 1;
      }
    });

    const chartData = dateList.map(item => ({
      date: item.full,
      label: item.short,
      amount: dailyAmountMap[item.full],
      count: dailyCountMap[item.full]
    }));

    const amounts = chartData.map(item => item.amount).filter(a => a > 0);
    const counts = chartData.map(item => item.count);
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
    const avgAmount = amounts.length > 0 ? Math.round(totalAmount / amounts.length) : 0;
    const totalCount = counts.reduce((sum, c) => sum + c, 0);
    const avgCount = amounts.length > 0 ? Math.round(totalCount / amounts.length * 10) / 10 : 0;

    this.setData({
      chartData,
      maxAmount,
      avgAmount,
      totalAmount,
      days: amounts.length,
      totalCount,
      avgCount
    });

    setTimeout(() => {
      this.drawChart();
    }, 100);
  },

  drawChart() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#lineChart')
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

        this.drawLineChart(ctx, width, height);
      });
  },

  drawLineChart(ctx, width, height) {
    const { chartData, maxAmount } = this.data;
    if (!chartData || chartData.length === 0) return;

    // 计算次数的最大值
    const maxCount = Math.max(...chartData.map(d => d.count), 1);

    const padding = { top: 30, right: 35, bottom: 45, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // 计算 nice max
    const calcNiceMax = (max) => {
      if (max <= 0) return 100;
      const rough = max / 4;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const n = rough / mag;
      let step;
      if (n <= 1) step = 1;
      else if (n <= 2) step = 2;
      else if (n <= 5) step = 5;
      else step = 10;
      return step * mag * 4;
    };

    const calcNiceMaxSmall = (max) => {
      if (max <= 0) return 5;
      if (max <= 2) return 4;
      if (max <= 5) return 8;
      if (max <= 10) return 12;
      return Math.ceil(max / 4) * 4;
    };

    const yMaxLeft = calcNiceMax(maxAmount);
    const yStepLeft = yMaxLeft / 4;
    const yMaxRight = calcNiceMaxSmall(maxCount);
    const yStepRight = yMaxRight / 4;

    // Y轴基线（左侧）
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // X轴基线
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    // 右侧Y轴基线
    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    // 网格线 & Y轴标签（左侧 - 奶量）
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // 左侧标签（奶量，粉色）
      ctx.fillStyle = '#FF9B9B';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(yMaxLeft - yStepLeft * i, padding.left - 6, y + 4);

      // 右侧标签（次数，蓝色）
      ctx.fillStyle = '#7EC8E3';
      ctx.textAlign = 'left';
      ctx.fillText(yMaxRight - yStepRight * i, width - padding.right + 6, y + 4);
    }

    // 平均奶量红色虚线
    const avgY = padding.top + chartHeight - (yMaxLeft > 0 ? (this.data.avgAmount / yMaxLeft) * chartHeight : 0);
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, avgY);
    ctx.lineTo(width - padding.right, avgY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 平均奶量标签
    ctx.fillStyle = '#FF6B6B';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('均' + this.data.avgAmount, width - padding.right, avgY - 5);

    // 计算点坐标 - 奶量（左侧Y轴）
    const divisor = Math.max(chartData.length - 1, 1);
    const pointsAmount = chartData.map((item, index) => ({
      x: padding.left + (chartWidth / divisor) * index,
      y: padding.top + chartHeight - (yMaxLeft > 0 ? (item.amount / yMaxLeft) * chartHeight : 0),
      value: item.amount,
      label: item.label
    }));

    // 计算点坐标 - 次数（右侧Y轴）
    const pointsCount = chartData.map((item, index) => ({
      x: padding.left + (chartWidth / divisor) * index,
      y: padding.top + chartHeight - (yMaxRight > 0 ? (item.count / yMaxRight) * chartHeight : 0),
      value: item.count
    }));

    // 绘制奶量渐变填充（粉色）
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(255, 155, 155, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 155, 155, 0.02)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(pointsAmount[0].x, padding.top + chartHeight);
    pointsAmount.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.lineTo(pointsAmount[pointsAmount.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // 绘制奶量折线（粉色）
    ctx.strokeStyle = '#FF9B9B';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pointsAmount[0].x, pointsAmount[0].y);
    pointsAmount.forEach((point, index) => {
      if (index > 0) ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    // 绘制次数折线（蓝色）
    ctx.strokeStyle = '#7EC8E3';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pointsCount[0].x, pointsCount[0].y);
    pointsCount.forEach((point, index) => {
      if (index > 0) ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    // 绘制奶量数据点（粉色圆点）
    pointsAmount.forEach(point => {
      ctx.fillStyle = '#FF9B9B';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (point.value > 0) {
        ctx.fillStyle = '#FF9B9B';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(point.value, point.x, point.y - 14);
      }
    });

    // 绘制次数数据点（蓝色圆点）
    pointsCount.forEach(point => {
      ctx.fillStyle = '#7EC8E3';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // X轴日期标签
    chartData.forEach((item, index) => {
      const x = padding.left + (chartWidth / divisor) * index;
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x, height - 12);
    });

    // 图例
    const legendY = 14;
    // 粉色图例 - 奶量
    ctx.fillStyle = '#FF9B9B';
    ctx.beginPath();
    ctx.arc(padding.left + 8, legendY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('奶量(ml)', padding.left + 18, legendY + 4);

    // 蓝色图例 - 次数
    ctx.fillStyle = '#7EC8E3';
    ctx.beginPath();
    ctx.arc(padding.left + 90, legendY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#999';
    ctx.fillText('次数', padding.left + 100, legendY + 4);
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
