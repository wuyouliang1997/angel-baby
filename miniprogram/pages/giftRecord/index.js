function getTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }

const PAGE_SIZE = 10;

Page({
  data: {
    babyId: '',
    records: [],
    currentPage: 1,
    totalPages: 1,
    total: 0,
    jumpPage: '',
    showModal: false,
    isEdit: false,
    editId: '',
    formDate: '',
    formSource: '',
    formDescription: '',
    formAmount: '',
    today: getTodayStr()
  },

  onLoad(options) {
    if (options.babyId) this.setData({ babyId: options.babyId });
  },

  onShow() {
    if (this.data.babyId) {
      this.setData({ currentPage: 1 });
      this.loadRecords();
    }
  },

  async loadRecords() {
    const res = await this.callCloudFunction('getGiftRecords', {
      babyId: this.data.babyId,
      page: this.data.currentPage,
      pageSize: PAGE_SIZE
    });
    if (res && res.success) {
      this.setData({
        records: res.data,
        total: res.total,
        totalPages: Math.max(1, Math.ceil(res.total / PAGE_SIZE))
      });
    }
  },

  prevPage() { if (this.data.currentPage <= 1) return; this.setData({ currentPage: this.data.currentPage - 1 }); this.loadRecords(); },
  nextPage() { if (this.data.currentPage >= this.data.totalPages) return; this.setData({ currentPage: this.data.currentPage + 1 }); this.loadRecords(); },
  onJumpPageInput(e) { this.setData({ jumpPage: e.detail.value }); },

  jumpToPage() {
    const page = parseInt(this.data.jumpPage);
    if (isNaN(page) || page < 1 || page > this.data.totalPages) {
      wx.showToast({ title: `页码范围1-${this.data.totalPages}`, icon: 'none' });
      return;
    }
    this.setData({ currentPage: page, jumpPage: '' });
    this.loadRecords();
  },

  showAdd() {
    this.setData({
      showModal: true, isEdit: false, editId: '',
      formDate: getTodayStr(), formSource: '', formDescription: '', formAmount: ''
    });
  },

  onEdit(e) {
    const { id, date, source, description, amount } = e.currentTarget.dataset;
    this.setData({
      showModal: true, isEdit: true, editId: id,
      formDate: date, formSource: source, formDescription: description || '', formAmount: String(amount)
    });
  },

  hideModal() { this.setData({ showModal: false }); },
  onDateChange(e) { this.setData({ formDate: e.detail.value }); },
  onSourceInput(e) { this.setData({ formSource: e.detail.value }); },
  onDescriptionInput(e) { this.setData({ formDescription: e.detail.value }); },
  onAmountInput(e) { this.setData({ formAmount: e.detail.value }); },

  async onConfirm() {
    const { isEdit, editId, formDate, formSource, formDescription, formAmount, babyId } = this.data;
    if (!formSource.trim()) { wx.showToast({ title: '请填写来源人', icon: 'none' }); return; }
    const amount = Number(formAmount);
    if (!amount || amount <= 0) { wx.showToast({ title: '请填写有效金额', icon: 'none' }); return; }

    wx.showLoading({ title: '保存中...' });
    let res;
    if (isEdit) {
      res = await this.callCloudFunction('updateGiftRecord', { _id: editId, amount, source: formSource, description: formDescription, recordDate: formDate });
    } else {
      res = await this.callCloudFunction('addGiftRecord', { babyId, amount, source: formSource, description: formDescription, recordDate: formDate });
    }
    wx.hideLoading();

    if (res && res.success) {
      wx.showToast({ title: isEdit ? '修改成功' : '记录成功', icon: 'success' });
      this.setData({ showModal: false });
      this.loadRecords();
    } else {
      wx.showToast({ title: res.errMsg || '保存失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认', content: '确定删除这条记录吗？',
      success: async (result) => {
        if (result.confirm) {
          const res = await this.callCloudFunction('deleteGiftRecord', { _id: id });
          if (res && res.success) { wx.showToast({ title: '已删除' }); this.loadRecords(); }
        }
      }
    });
  },

  goToStats() {
    wx.navigateTo({ url: `/pages/giftStats/index?babyId=${this.data.babyId}` });
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
