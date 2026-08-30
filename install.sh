#!/usr/bin/env bash
# 装/更新「深研档案馆」捆绑包(bundle)到 Forsion 家目录。
#   用法:sh install.sh [dev|prod]     缺省 dev(~/.forsion-dev);prod=~/.forsion
# 本仓即 bundle 本体:整目录拷到 <home>/plugins/dossier/ 一处即完成——
#   桌面识别 manifest.json(UI 插件)+ spaces/(内嵌 Space);
#   引擎(tangu-agent bundles.ts)原地扫描 skills/(dossier-format,内置 < bundle < 用户)。
set -euo pipefail
MODE="${1:-dev}"
case "$MODE" in
  dev)  HOME_DIR="$HOME/.forsion-dev" ;;
  prod) HOME_DIR="$HOME/.forsion" ;;
  *) echo "用法:sh install.sh [dev|prod]" >&2; exit 2 ;;
esac
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME_DIR/plugins/dossier"

# 不许从已安装目录内自更新:下面的 rm -rf 会先删掉复制源(自己),把插件卸成空壳
if [ "$HERE" = "$(cd "$DEST" 2>/dev/null && pwd || true)" ]; then
  echo "❌ 正在从已安装目录运行,请从源码仓的 forsion-plugin-dossier/ 目录执行 install.sh" >&2
  exit 2
fi

mkdir -p "$HOME_DIR/plugins"
rm -rf "$DEST"
cp -R "$HERE" "$DEST"
# 迁移:若用户目录里存在同名顶层 Space 且确是本插件的配方(引用 plugin:dossier: 视图),
# 它会以「用户 Space 优先」遮蔽 bundle 内嵌版。只在确认是本配方时改名备份令其不再注册——
# 目录与用户其他文件原样保留,绝不无差别删除同名用户资产。
OLD_SPACE="$HOME_DIR/spaces/dossier/space.json"
if grep -q 'plugin:dossier:' "$OLD_SPACE" 2>/dev/null; then
  mv "$OLD_SPACE" "$OLD_SPACE.pre-bundle.bak"
  echo "   (旧版顶层 Space 配方已备份为 space.json.pre-bundle.bak,不再遮蔽 bundle 内嵌版)"
fi

echo "✅ 已安装 bundle → $DEST"
echo "   (随包技能 dossier-format 由引擎原地扫描 $DEST/skills/,无需播种)"
echo "重开 Forsion(dev:重启 desktop)后:命令面板「深研档案馆:打开」,或工作台切到「档案馆」Space。"
