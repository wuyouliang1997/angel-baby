// app.js
App({
  util: {
    getTodayStr() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    getCurrentTimeStr() {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
    calcDays(birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      return Math.floor((today - birth) / (1000 * 60 * 60 * 24));
    },
    calcAge(birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      let months = today.getMonth() - birth.getMonth();
      let days = today.getDate() - birth.getDate();
      if (days < 0) { months--; const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0); days += lastMonth.getDate(); }
      if (months < 0) { years--; months += 12; }
      let result = '';
      if (years > 0) result += `${years}年`;
      if (months > 0) result += `${months}月`;
      result += `${days}日`;
      return result;
    },
    addDays(dateStr, days) {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    formatDateDisplay(dateStr) {
      const date = new Date(dateStr);
      const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
      return `${date.getMonth() + 1}月${date.getDate()}日 周${weekDays[date.getDay()]}`;
    }
  },

  onLaunch: function () {
    this.globalData = {
      env: "cloud1-d9g4vd6odac1d447b",
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
