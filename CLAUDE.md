# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

宝宝成长记录 — a WeChat Mini Program (微信小程序) built on WeChat Cloud Development (云开发) for tracking a baby's feeding, growth, expenses, and gifts, with family sharing across WeChat users. All UI text and comments are in Chinese.

There is **no build step, no bundler, no npm package, no lint, and no test suite**. Development happens inside the WeChat DevTools (微信开发者工具) IDE, which compiles and previews the mini program directly. The `README.md` is just the upstream cloud-dev quickstart template and is not project-specific.

## Running & Deploying

- **Run/preview**: open the project root in WeChat DevTools. The `miniprogramRoot` is `miniprogram/` and `cloudfunctionRoot` is `cloudfunctions/` (see `project.config.json`). AppID: `wxf4f88e3bcf53a773`; cloud env ID: `cloud1-d9g4vd6odac1d447b` (hardcoded in `miniprogram/app.js`).
- **Cloud function dependencies**: install `wx-server-sdk` inside `cloudfunctions/quickstartFunctions/` (already vendored as `~2.4.0`). Re-run npm install there only if you change that dependency.
- **Deploy the cloud function**: either right-click it in DevTools ("上传并部署：云端安装依赖"), or use `./uploadCloudFunction.sh` (a template using `cloud functions deploy --e <envId> --n quickstartFunctions`).

## Architecture

### Two halves, one entry point

- **`miniprogram/`** — the frontend: `app.js` (global helpers + `wx.cloud.init`), `pages/` (one directory per screen), and `components/baby-header/` (the only reusable component, registered globally in `app.json`). Page list is declared in `miniprogram/app.json`.
- **`cloudfunctions/quickstartFunctions/`** — the entire backend, packed into **one** cloud function. `index.js` has an `exports.main(event, context)` that dispatches on `event.type` via a giant `switch` to individual `async` handler functions (each a top-level `const` in the same file). There are no per-feature modules.

### Request pattern (the single most important convention)

Every page has a private helper that wraps all backend calls:

```js
async callCloudFunction(type, data = {}) {
  const res = await wx.cloud.callFunction({
    name: 'quickstartFunctions',
    data: { type, data }
  });
  return res.result;
}
```

The cloud function receives `{ type, data }`, where `type` is the switch key (e.g. `'addMilkRecord'`) and `data` is the per-handler payload. Responses are plain objects conventionally shaped `{ success: boolean, data?, errMsg? }`.

**Adding a backend action means two edits**: add a handler `const` in `cloudfunctions/quickstartFunctions/index.js` and add a `case` in the `exports.main` switch. There is no router/registration beyond that switch.

### Database

Cloud Firestore-style document DB (`wx-server-sdk`'s `cloud.database()`), one collection per entity:

- `babies` — the parent entity; everything else keys off `babyId`
- `milk_records`, `growth_records`, `expense_records`, `gift_records` — the four record types
- `family_shares` — sharing grants (one doc per baby, see below)

Dates are stored as **`YYYY-MM-DD` strings in local time** (e.g. `recordDate`), times as `HH:MM`, plus an `iso` `createdAt`. Handlers build these strings manually rather than relying on server timestamps. Range queries use `db.command.gte/lte` on the date string.

### Auth & family-sharing model

- Every record stores `_openid` (the creator's WeChat openid) explicitly at write time.
- **Ownership check pattern**: delete/update handlers re-`get()` the doc and verify `record._openid === wxContext.OPENID` before mutating — never trust client input for ownership.
- **Sharing**: `family_shares` docs have `ownerOpenid`, `sharedOpenids` (array), and a 6-digit `shareCode`. `getUserOpenids(currentOpenid)` computes the set of openids a user may read: their own plus every member of any share they belong to (as owner or member).
- **Read queries** filter with `_openid: db.command.in(openids)` so shared records are visible to all members. Write/delete still require being the actual `_openid` owner.

### Gotchas (from recent fixes, don't regress)

- `getUserOpenids` fetches **all** `family_shares` and filters in JS, because cloud DB can't match an object-array member (`sharedOpenids`). The `sharedOpenids` format is **legacy-compatible**: members may be plain strings (old) or `{ openid, nickname }` objects (new) — code must keep handling both (`typeof item === 'string' ? item : item.openid`).
- Cloud DB `where().remove()` 在云函数端会删除全部匹配记录（20 条限制仅存在于小程序端）。`deleteBaby` 仍保留防御性循环删除，新增批量删除时沿用该写法即可。
- Avatars are now stored as **Base64 data URLs** (`data:image/jpeg;base64,...`) in the `babies.avatar` field (see `pages/babyForm/index.js`). Some older `cloud://` fileID-conversion code still lingers in `pages/index/index.js` and `components/baby-header/index.js` as a fallback — don't reintroduce cloud-file upload for avatars.
- Charts are drawn with the **raw canvas 2d API** (`wx.createSelectorQuery().select('#...').fields({node:true})`), not a chart library. See `pages/milkAnalysis/index.js` for the line-chart pattern and `pages/cropper/index.js` for the touch + canvas image-crop/rotate pattern.
- Shared date/age helpers (`calcDays`, `calcAge`, `getTodayStr`) are **duplicated inline** at the top of each page that needs them, and also exist on `app.js`'s `util` — pages do not import them.
