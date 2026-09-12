function getTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }

const PAGE_SIZE = 5;

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
    formHeight: '',
    formWeight: '',
    today: getTodayStr()
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({ babyId: options.babyId });
    }
  },

  onShow() {
    this.setData({ currentPage: 1 });
    this.loadRecords();
  },

  async loadRecords() {
    const res = await this.callCloudFunction('getGrowthRecords', {
      babyId: this.data.babyId,
      page: this.data.currentPage,
      pageSize: PAGE_SIZE
    });
    if (res && res.success) {
      const totalPages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
      this.setData({
        records: res.data,
        total: res.total,
        totalPages
      });
    }
  },

  prevPage() {
    if (this.data.currentPage <= 1) return;
    this.setData({ currentPage: this.data.currentPage - 1 });
    this.loadRecords();
  },

  nextPage() {
    if (this.data.currentPage >= this.data.totalPages) return;
    this.setData({ currentPage: this.data.currentPage + 1 });
    this.loadRecords();
  },

  onJumpPageInput(e) {
    this.setData({ jumpPage: e.detail.value });
  },

  jumpToPage() {
    const page = parseInt(this.data.jumpPage);
    if (isNaN(page) || page < 1 || page > this.data.totalPages) {
      wx.showToast({ title: `页码范围1-${this.data.totalPages}`, icon: 'none' });
      return;
    }
    this.setData({ currentPage: page, jumpPage: '' });
    this.loadRecords();
  },

  showModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editId: '',
      formDate: getTodayStr(),
      formHeight: '',
      formWeight: ''
    });
  },

  onEdit(e) {
    const { id, date, height, weight } = e.currentTarget.dataset;
    this.setData({
      showModal: true,
      isEdit: true,
      editId: id,
      formDate: date,
      formHeight: height || '',
      formWeight: weight || ''
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  onHeightInput(e) {
    this.setData({ formHeight: e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ formWeight: e.detail.value });
  },

  async onConfirm() {
    const { isEdit, editId, formDate, formHeight, formWeight, babyId } = this.data;

    if (!formHeight && !formWeight) {
      wx.showToast({ title: '请填写身高或体重', icon: 'none' });
      return;
    }

    if (formHeight && (Number(formHeight) < 30 || Number(formHeight) > 150)) {
      wx.showToast({ title: '身高范围30-150cm', icon: 'none' });
      return;
    }

    if (formWeight && (Number(formWeight) < 0.5 || Number(formWeight) > 50)) {
      wx.showToast({ title: '体重范围0.5-50kg', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    let res;
    if (isEdit) {
      res = await this.callCloudFunction('updateGrowthRecord', {
        _id: editId,
        height: formHeight || null,
        weight: formWeight || null,
        recordDate: formDate
      });
    } else {
      res = await this.callCloudFunction('addGrowthRecord', {
        babyId,
        height: formHeight || null,
        weight: formWeight || null,
        recordDate: formDate
      });
    }
    wx.hideLoading();

    if (res && res.success) {
      wx.showToast({ title: isEdit ? '修改成功' : '记录成功', icon: 'success' });
      this.setData({ showModal: false, isEdit: false, editId: '' });
      this.loadRecords();
    } else {
      wx.showToast({ title: res.errMsg || '保存失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认',
      content: '确定删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          const result = await this.callCloudFunction('deleteGrowthRecord', { _id: id });
          if (result && result.success) {
            wx.showToast({ title: '已删除' });
            this.setData({ currentPage: 1 });
            this.loadRecords();
          }
        }
      }
    });
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
