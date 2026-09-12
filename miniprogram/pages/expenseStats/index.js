const CATEGORIES = ['全部', '饮食', '日用品', '服装', '玩具教育', '医疗', '出行游玩', '纪念', '其他'];
const CATEGORY_FILTER = ['饮食', '日用品', '服装', '玩具教育', '医疗', '出行游玩', '纪念', '其他'];
const PAGE_SIZE = 8;

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

Page({
  data: {
    babyId: '',
    categoryIndex: 0,
    periodIndex: 0,
    startDate: '',
    endDate: '',
    records: [],
    totalAmount: 0,
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    jumpPage: ''
  },

  onLoad(options) {
    if (options.babyId) this.setData({ babyId: options.babyId });
    this.setData({ startDate: getMonthStart(), endDate: getTodayStr() });
  },

  onShow() {
    if (this.data.babyId) this.loadStats();
  },

  async loadStats() {
    wx.showLoading({ title: '加载中...' });
    const params = {
      babyId: this.data.babyId,
      page: 1,
      pageSize: 1000,
      startDate: this.data.startDate,
      endDate: this.data.endDate
    };
    if (this.data.categoryIndex > 0) {
      params.category = CATEGORY_FILTER[this.data.categoryIndex - 1];
    }
    const res = await this.callCloudFunction('getExpenseRecords', params);
    wx.hideLoading();

    if (res && res.success) {
      // 日期与分类已在服务端过滤
      const records = res.data.slice();
      records.sort((a, b) => b.recordDate.localeCompare(a.recordDate));

      const totalAmount = Math.round(records.reduce((s, r) => s + r.amount, 0) * 100) / 100;
      const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
      const start = (this.data.currentPage - 1) * PAGE_SIZE;
      const paged = records.slice(start, start + PAGE_SIZE);

      this.setData({
        records: paged,
        totalAmount,
        totalCount: records.length,
        totalPages
      });
    }
  },

  onFilterChange() {
    this.setData({ currentPage: 1 });
    this.loadStats();
  },

  onCategoryChange(e) { this.setData({ categoryIndex: parseInt(e.detail.value) }); this.onFilterChange(); },

  onPeriodChange(e) {
    this.setData({ periodIndex: parseInt(e.detail.value) });
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const endDate = getTodayStr();
    let startDate = endDate;

    switch (this.data.periodIndex) {
      case 0: startDate = `${y}-${String(m).padStart(2, '0')}-01`; break;
      case 1: { const d = new Date(y, m - 3, now.getDate()); startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; break; }
      case 2: { const d = new Date(y, m - 6, now.getDate()); startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; break; }
      case 3: { const d = new Date(y - 1, m - 1, now.getDate()); startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; break; }
    }
    this.setData({ startDate, endDate });
    this.onFilterChange();
  },

  onStartDateChange(e) { this.setData({ startDate: e.detail.value }); this.onFilterChange(); },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); this.onFilterChange(); },

  prevPage() { if (this.data.currentPage <= 1) return; this.setData({ currentPage: this.data.currentPage - 1 }); this.loadStats(); },
  nextPage() { if (this.data.currentPage >= this.data.totalPages) return; this.setData({ currentPage: this.data.currentPage + 1 }); this.loadStats(); },
  onJumpInput(e) { this.setData({ jumpPage: e.detail.value }); },
  jumpToPage() {
    const p = parseInt(this.data.jumpPage);
    if (isNaN(p) || p < 1 || p > this.data.totalPages) { wx.showToast({ title: `1-${this.data.totalPages}`, icon: 'none' }); return; }
    this.setData({ currentPage: p, jumpPage: '' }); this.loadStats();
  },

  async callCloudFunction(type, data = {}) {
    try {
      const res = await wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type, data } });
      return res.result;
    } catch (err) {
      console.error(`[${type}] failed:`, err);
      return { success: false, errMsg: err.errMsg };
    }
  }
});
