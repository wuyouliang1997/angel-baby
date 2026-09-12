function getTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
function getCurrentTimeStr() { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function formatDateDisplay(dateStr) { const d = new Date(dateStr); const w = ['日','一','二','三','四','五','六']; return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + w[d.getDay()]; }

const PAGE_SIZE = 10;

Page({
  data: {
    babyId: '',
    currentDate: '',
    currentDateDisplay: '',
    allRecords: [],
    records: [],
    totalAmount: 0,
    recordCount: 0,
    isToday: true,
    showModal: false,
    isEdit: false,
    editId: '',
    formTime: '',
    formAmount: '',
    formRemark: '',
    formDate: '',
    currentPage: 1,
    hasMore: false
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({
        babyId: options.babyId,
        currentDate: getTodayStr(),
        isToday: true,
        currentPage: 1
      });
    }
  },

  onShow() {
    if (this.data.babyId) {
      this.loadRecords();
    }
  },

  async loadRecords() {
    const res = await this.callCloudFunction('getTodayRecords', {
      date: this.data.currentDate,
      babyId: this.data.babyId
    });
    if (res && res.success) {
      const allRecords = res.data || [];
      const totalAmount = res.total || 0;
      const recordCount = res.count || 0;

      this.setData({
        allRecords,
        totalAmount,
        recordCount,
        currentDateDisplay: formatDateDisplay(this.data.currentDate)
      });

      this.updatePageData();
    }
  },

  updatePageData() {
    const { allRecords, currentPage } = this.data;
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = currentPage * PAGE_SIZE;
    const records = allRecords.slice(start, end);
    const hasMore = end < allRecords.length;

    this.setData({ records, hasMore });
  },

  loadMore() {
    this.setData({
      currentPage: this.data.currentPage + 1
    });
    this.updatePageData();
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
      if (err.errMsg && err.errMsg.includes('Environment not found')) {
        wx.showModal({ title: '提示', content: '请在 app.js 中配置云环境 ID' });
      }
      return { success: false, errMsg: err.errMsg };
    }
  },

  prevDay() {
    const newDate = addDays(this.data.currentDate, -1);
    this.setData({
      currentDate: newDate,
      isToday: newDate === getTodayStr(),
      currentPage: 1
    });
    this.loadRecords();
  },

  nextDay() {
    if (this.data.isToday) return;
    const newDate = addDays(this.data.currentDate, 1);
    this.setData({
      currentDate: newDate,
      isToday: newDate === getTodayStr(),
      currentPage: 1
    });
    this.loadRecords();
  },

  onDateSelect(e) {
    const selectedDate = e.detail.value;
    this.setData({
      currentDate: selectedDate,
      isToday: selectedDate === getTodayStr(),
      currentPage: 1
    });
    this.loadRecords();
  },

  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      editId: '',
      formDate: this.data.currentDate,
      formTime: getCurrentTimeStr(),
      formAmount: '',
      formRemark: ''
    });
  },

  onEdit(e) {
    const { id, time, amount, remark } = e.currentTarget.dataset;
    this.setData({
      showModal: true,
      isEdit: true,
      editId: id,
      formDate: this.data.currentDate,
      formTime: time,
      formAmount: String(amount),
      formRemark: remark || ''
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ formTime: e.detail.value });
  },

  onAmountInput(e) {
    this.setData({ formAmount: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ formRemark: e.detail.value });
  },

  async onAddConfirm() {
    const { formTime, formAmount, formRemark, formDate, isEdit, editId, currentDate } = this.data;
    const amount = Number(formAmount);

    if (!formTime) {
      wx.showToast({ title: '请选择时间', icon: 'none' });
      return;
    }
    if (!amount || amount < 10 || amount > 500) {
      wx.showToast({ title: '奶量请填写10-500ml', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    const recordDate = formDate;
    const timestamp = new Date(`${recordDate}T${formTime}`).getTime();

    let res;
    if (isEdit) {
      res = await this.callCloudFunction('updateMilkRecord', {
        _id: editId,
        amount,
        recordTime: formTime,
        recordDate: formDate,
        timestamp,
        remark: formRemark
      });
    } else {
      res = await this.callCloudFunction('addMilkRecord', {
        amount,
        recordTime: formTime,
        recordDate: formDate,
        timestamp,
        remark: formRemark,
        babyId: this.data.babyId
      });
    }
    wx.hideLoading();

    if (res && res.success) {
      wx.showToast({ title: isEdit ? '修改成功' : '记录成功', icon: 'success' });
      this.setData({ showModal: false });

      if (!isEdit && formDate !== currentDate) {
        this.setData({
          currentDate: formDate,
          isToday: formDate === getTodayStr()
        });
      }
      this.loadRecords();
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除确认',
      content: '确定删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          const result = await this.callCloudFunction('deleteMilkRecord', { _id: id });
          if (result && result.success) {
            wx.showToast({ title: '已删除' });
            this.loadRecords();
          }
        }
      }
    });
  },

  goToAnalysis() {
    wx.navigateTo({ url: `/pages/milkAnalysis/index?babyId=${this.data.babyId}` });
  }
});
