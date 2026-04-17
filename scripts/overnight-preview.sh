#!/usr/bin/env bash
# overnight-preview.sh — 為 overnight/* branch 部署 Firebase Hosting Preview Channel
#
# 用法：
#   bash scripts/overnight-preview.sh                                        # 處理所有本地 overnight/* branch
#   bash scripts/overnight-preview.sh overnight/2026-04-16/body-history-fixes  # 指定單一 branch
#   bash scripts/overnight-preview.sh branch-a branch-b                      # 指定多個 branch
#
# 環境需求：
#   - firebase CLI 已安裝並登入（firebase login）
#   - Node.js、npm 已安裝
#   - 必須在專案根目錄執行，或任意目錄（腳本會自動 cd）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIREBASE_PROJECT="fitnesswith47"
CHANNEL_TTL="7d"
ORIGINAL_BRANCH=""
RESULTS=()

# ── 顏色輸出 ─────────────────────────────────────────────────────────────────

log_info()  { printf '\033[36m[INFO]\033[0m  %s\n' "$*"; }
log_ok()    { printf '\033[32m[ OK ]\033[0m  %s\n' "$*"; }
log_warn()  { printf '\033[33m[WARN]\033[0m  %s\n' "$*"; }
log_error() { printf '\033[31m[ERR ]\033[0m  %s\n' "$*"; }

# ── Channel ID 生成（最長 36 字元）────────────────────────────────────────────
# 格式：ov-{YYYYMMDD}-{feature slug 前 24 字元}
# 範例：overnight/2026-04-16/body-history-fixes → ov-20260416-body-history-fixes

branch_to_channel_id() {
  local branch="$1"
  # 去除 overnight/ 前綴
  local rest="${branch#overnight/}"
  # 分拆日期（2026-04-16）與 feature（body-history-fixes）
  local date_part="${rest%%/*}"
  local feature_part="${rest#*/}"
  # 壓縮日期：2026-04-16 → 20260416
  local date_compact="${date_part//-/}"
  # feature slug：小寫、非英數字轉 -、合併連續 -、截 24 字元、移除尾端 -
  local feature_slug
  feature_slug=$(printf '%s' "$feature_part" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -cs 'a-z0-9-' '-' \
    | sed 's/-\+/-/g' \
    | cut -c1-24)
  feature_slug="${feature_slug%-}"
  printf 'ov-%s-%s' "$date_compact" "$feature_slug"
}

# ── Cleanup：離開時切回原本 branch ───────────────────────────────────────────

save_branch() {
  ORIGINAL_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
}

cleanup() {
  if [[ -n "$ORIGINAL_BRANCH" && "$ORIGINAL_BRANCH" != "HEAD" ]]; then
    git -C "$PROJECT_ROOT" checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── 前置檢查 ─────────────────────────────────────────────────────────────────

check_prerequisites() {
  if ! command -v firebase &>/dev/null; then
    log_error "firebase CLI 未安裝。請執行：npm install -g firebase-tools"
    exit 1
  fi
  if ! command -v npm &>/dev/null; then
    log_error "npm 未找到"
    exit 1
  fi
  # 簡單測試 firebase 是否已登入（不需網路，只檢查 token 存在）
  if ! firebase projects:list --json &>/dev/null 2>&1; then
    log_warn "Firebase 可能尚未登入。若部署失敗請執行：firebase login"
  fi
}

# ── 處理單一 branch ───────────────────────────────────────────────────────────

deploy_branch_preview() {
  local branch="$1"
  local channel_id
  channel_id=$(branch_to_channel_id "$branch")

  log_info "────────────────────────────────────────────"
  log_info "Branch : $branch"
  log_info "Channel: $channel_id"

  # Step 1: checkout
  if ! git -C "$PROJECT_ROOT" checkout "$branch" --quiet 2>/dev/null; then
    log_error "無法 checkout branch: $branch（本地是否存在？）"
    RESULTS+=("FAIL|$branch|$channel_id|無法 checkout branch")
    return 1
  fi

  # Step 2: npm run build
  log_info "執行 npm run build ..."
  if ! (cd "$PROJECT_ROOT" && npm run build 2>&1); then
    log_error "Build 失敗 — 已保留 git commit，不影響功能"
    RESULTS+=("FAIL|$branch|$channel_id|npm run build 失敗")
    return 1
  fi
  log_ok "Build 完成"

  # Step 3: firebase hosting:channel:deploy
  log_info "部署 Preview Channel: $channel_id（有效期 $CHANNEL_TTL）..."
  local deploy_output
  if ! deploy_output=$(firebase hosting:channel:deploy "$channel_id" \
      --project "$FIREBASE_PROJECT" \
      --expires "$CHANNEL_TTL" \
      2>&1); then
    log_error "Preview deploy 失敗"
    log_warn "$deploy_output"
    RESULTS+=("FAIL|$branch|$channel_id|firebase channel deploy 失敗")
    return 1
  fi

  # 從 channel:list 取得正確的 Preview URL（deploy 輸出只含 live URL）
  local preview_url
  preview_url=$(firebase hosting:channel:list \
      --project "$FIREBASE_PROJECT" 2>/dev/null \
    | grep "$channel_id" \
    | grep -oE 'https://[a-zA-Z0-9._-]+\.web\.app' \
    | head -1)

  if [[ -z "$preview_url" ]]; then
    preview_url="（請至 Firebase Console → Hosting → Preview Channels 查詢）"
  fi

  # Step 4: 自動將 Preview URL 加入 Firebase Auth 授權網域
  if [[ "$preview_url" == https://* ]]; then
    local domain="${preview_url#https://}"
    log_info "加入 Firebase Auth 授權網域：$domain"
    if node "$PROJECT_ROOT/scripts/add-auth-domain.cjs" "$domain" 2>&1; then
      log_ok "Auth 授權網域已更新"
    else
      log_warn "Auth 授權網域更新失敗（可手動至 Firebase Console 新增）"
    fi
  fi

  log_ok "Preview URL: $preview_url"
  RESULTS+=("OK|$branch|$channel_id|$preview_url")
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  cd "$PROJECT_ROOT"
  save_branch
  check_prerequisites

  local branches=()

  if [[ $# -gt 0 ]]; then
    branches=("$@")
  else
    # 自動掃描所有本地 overnight/* branch
    while IFS= read -r b; do
      [[ -n "$b" ]] && branches+=("$b")
    done < <(git branch --list 'overnight/*' | sed 's/^[* ]*//')
  fi

  if [[ ${#branches[@]} -eq 0 ]]; then
    log_warn "找不到任何 overnight/* branch"
    exit 0
  fi

  log_info "共找到 ${#branches[@]} 個 branch 待部署"
  echo

  for branch in "${branches[@]}"; do
    deploy_branch_preview "$branch" || true
    echo
  done

  # ── 匯總報告 ─────────────────────────────────────────────────────────────
  log_info "══════════════ 部署結果 ══════════════"
  local success=0 failure=0
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status branch channel url_or_msg <<< "$result"
    if [[ "$status" == "OK" ]]; then
      log_ok "✅ $branch"
      printf '        URL: %s\n' "$url_or_msg"
      ((success++)) || true
    else
      log_error "❌ $branch"
      printf '        原因: %s\n' "$url_or_msg"
      ((failure++)) || true
    fi
  done
  echo
  log_info "成功：$success  失敗：$failure"

  [[ $failure -gt 0 ]] && exit 1
  exit 0
}

main "$@"
