# 游戏开始
南贤：游戏开始
胡斐：少侠来此所谓何事？
- 无事
  jump nothing
- 乞讨
  get_money 100
  胡斐：给你钱

battle 新手战
- win
  南贤：少侠好身手
- lose
- timeout
  南贤：太墨迹了

if has_item 小刀 and $money > 100
  南贤：不错
elif !has_item 小刀 || $money > 10
  南贤：也行
else
  南贤：穷鬼

# nothing
南贤：后会有期
